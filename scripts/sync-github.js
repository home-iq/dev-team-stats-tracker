#!/usr/bin/env node

import { program } from 'commander';
import { Octokit } from '@octokit/rest';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import ora from 'ora';
import chalk from 'chalk';
import { parse, format, addMonths, startOfMonth } from 'date-fns';
import fs from 'fs/promises';
import path from 'path';
import { setTimeout } from 'timers/promises';
import { calculateRepoStats, calculateContributorScores } from './utils/calculate-scores.js';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();
const octokit = new Octokit({
  auth: process.env.GITHUB_KEY,
  request: {
    hook: async (request, options) => {
      try {
        // Increment counter before the request
        apiCallCounter++;
        apiSpinner.text = `GitHub API Calls: ${apiCallCounter.toLocaleString()}`;
        
        const result = await request(options);
        
        // Update remaining calls after the request
        const rateLimit = result.headers?.['x-ratelimit-remaining'];
        if (rateLimit) {
          apiSpinner.text = `GitHub API Calls: ${apiCallCounter.toLocaleString()} (${rateLimit} remaining)`;
        }
        
        return result;
      } catch (error) {
        // Update spinner even on error
        const rateLimit = error.response?.headers?.['x-ratelimit-remaining'];
        if (rateLimit) {
          apiSpinner.text = `GitHub API Calls: ${apiCallCounter.toLocaleString()} (${rateLimit} remaining)`;
        }
        throw error;
      }
    }
  }
});
const GITHUB_ORG = process.env.GITHUB_ORG;

// Constants
const CACHE_DIR = path.join(process.cwd(), '.cache');
const STATE_FILE = path.join(CACHE_DIR, 'github-sync-state.json');
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, `sync-${format(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.log`);
const MAX_RETRIES = 2;
const RETRY_DELAY = 5000; // 5 seconds

// Track API calls
let apiCallCounter = 0;
const apiSpinner = ora({
  text: 'GitHub API Calls: 0',
  color: 'blue',
  spinner: 'dots'
}).start();

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// Log message to both console and file
async function log(message, type = 'info') {
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Only write to console if it's not a spinner update
  if (!message.startsWith('GitHub API Calls:')) {
    // Clear spinner, print message, then restore spinner
    apiSpinner.stop();
    switch (type) {
      case 'error':
        console.error(chalk.red(message));
        break;
      case 'warning':
        console.warn(chalk.yellow(message));
        break;
      case 'success':
        console.log(chalk.green(message));
        break;
      default:
        console.log(message);
    }
    apiSpinner.start();
  }
  
  // Write to file (without colors)
  await fs.appendFile(LOG_FILE, logMessage);
}

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// Save progress state
async function saveProgressState(state) {
  await ensureCacheDir();
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

// Load progress state
async function loadProgressState() {
  try {
    await ensureCacheDir();
    const data = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
}

// Fetch all repositories for the organization
async function fetchRepositories() {
  const spinner = ora('Fetching repositories...').start();
  try {
    const repos = await octokit.paginate(octokit.repos.listForOrg, {
      org: GITHUB_ORG,
      type: 'all',
      per_page: 100
    });
    
    spinner.succeed(`Found ${repos.length} repositories`);
    return repos.map(repo => ({
      name: repo.name,
      id: repo.id.toString(),
      html_url: repo.html_url
    }));
  } catch (error) {
    spinner.fail('Failed to fetch repositories');
    throw error;
  }
}

// Fetch commits for a repository in a given month
async function fetchMonthlyCommits(repo, startDate, endDate) {
  const failedCommits = [];
  const commits = await octokit.paginate(octokit.repos.listCommits, {
    owner: GITHUB_ORG,
    repo: repo.name,
    since: startDate.toISOString(),
    until: endDate.toISOString(),
    per_page: 100
  });

  // Fetch detailed commit data for each commit
  const detailedCommits = await Promise.all(
    commits.map(async commit => {
      // Try up to 3 times for each commit
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data: fullCommit } = await octokit.repos.getCommit({
            owner: GITHUB_ORG,
            repo: repo.name,
            ref: commit.sha
          });
          return {
            sha: commit.sha,
            message: commit.commit.message,
            author: {
              id: commit.author?.id,
              login: commit.author?.login,
              name: commit.commit.author.name,
              avatar_url: commit.author?.avatar_url
            },
            date: commit.commit.author.date,
            stats: {
              additions: fullCommit.stats?.additions || 0,
              deletions: fullCommit.stats?.deletions || 0
            }
          };
        } catch (error) {
          if (attempt === 2) { // Last attempt failed
            failedCommits.push({
              sha: commit.sha,
              repo: repo.name,
              error: error.message,
              author: commit.author?.login || 'unknown',
              command: `gh api /repos/${GITHUB_ORG}/${repo.name}/commits/${commit.sha}`
            });
            await log(`RETRY_COMMIT|${repo.name}|${commit.sha}|${commit.author?.login || 'unknown'}|${error.message}`, 'error');
            return null;
          }
          // Wait before retrying
          await setTimeout(RETRY_DELAY);
        }
      }
    })
  );

  const successfulCommits = detailedCommits.filter(Boolean);
  if (failedCommits.length > 0) {
    await log(`\nFailed to fetch ${failedCommits.length} commits in ${repo.name} after 3 attempts:`, 'error');
    for (const failed of failedCommits) {
      await log(`FAILED_COMMIT|${failed.repo}|${failed.sha}|${failed.author}|${failed.error}`, 'error');
      await log(`To retry: ${failed.command}`, 'error');
    }
  }

  return successfulCommits;
}

// Fetch pull requests for a repository in a given month
async function fetchMonthlyPullRequests(repo, startDate, endDate) {
  const failedPRs = [];
  const prs = await octokit.paginate(octokit.pulls.list, {
    owner: GITHUB_ORG,
    repo: repo.name,
    state: 'all',
    sort: 'created',
    direction: 'desc',
    per_page: 100
  });

  // Filter PRs by creation date instead of update date
  const filteredPRs = prs.filter(pr => {
    const createdAt = new Date(pr.created_at);
    return createdAt >= startDate && createdAt < endDate;
  });

  // Fetch detailed PR data
  const detailedPRs = await Promise.all(
    filteredPRs.map(async pr => {
      // Try up to 3 times for each PR
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data: fullPR } = await octokit.pulls.get({
            owner: GITHUB_ORG,
            repo: repo.name,
            pull_number: pr.number
          });
          return {
            number: pr.number,
            title: pr.title,
            body: pr.body,
            state: pr.state,
            draft: pr.draft,
            merged: pr.merged_at !== null,
            head: { ref: pr.head.ref },
            base: { ref: pr.base.ref },
            user: {
              id: pr.user.id,
              login: pr.user.login,
              name: pr.user.login,
              avatar_url: pr.user.avatar_url
            },
            created_at: pr.created_at || fullPR.created_at,  // Use PR creation date from either source
            merged_at: pr.merged_at || fullPR.merged_at,
            closed_at: pr.closed_at || fullPR.closed_at,
            additions: fullPR.additions || 0,
            deletions: fullPR.deletions || 0,
            commits: fullPR.commits || 0,
            comments: fullPR.comments || 0,
            review_comments: fullPR.review_comments || 0
          };
        } catch (error) {
          if (attempt === 2) { // Last attempt failed
            failedPRs.push({
              number: pr.number,
              repo: repo.name,
              error: error.message,
              author: pr.user?.login || 'unknown',
              command: `gh api /repos/${GITHUB_ORG}/${repo.name}/pulls/${pr.number}`
            });
            await log(`RETRY_PR|${repo.name}|${pr.number}|${pr.user?.login || 'unknown'}|${error.message}`, 'error');
            return null;
          }
          // Wait before retrying
          await setTimeout(RETRY_DELAY);
        }
      }
    })
  );

  const successfulPRs = detailedPRs.filter(Boolean);
  if (failedPRs.length > 0) {
    await log(`\nFailed to fetch ${failedPRs.length} pull requests in ${repo.name} after 3 attempts:`, 'error');
    for (const failed of failedPRs) {
      await log(`FAILED_PR|${failed.repo}|${failed.number}|${failed.author}|${failed.error}`, 'error');
      await log(`To retry: ${failed.command}`, 'error');
    }
  }

  return successfulPRs;
}

// Utility for retrying failed operations
async function withRetry(operation, context = '', progressState = null) {
  let lastError;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Only retry for rate limits or network errors
      if (error.status === 403 && error.message.includes('rate limit')) {
        const rateLimit = await octokit.rateLimit.get();
        const reset = new Date(rateLimit.data.rate.reset * 1000);
        const waitTime = Math.ceil((reset - new Date()) / 1000);
        
        // Save current progress before waiting
        if (progressState) {
          await saveProgressState({
            lastSuccessfulRun: {
              ...progressState.lastSuccessfulRun,
              githubApi: {
                callsRemaining: rateLimit.data.rate.remaining,
                resetTimestamp: reset.toISOString()
              }
            }
          });
        }
        
        console.log(chalk.yellow(`Rate limit hit. Waiting ${waitTime} seconds for reset...`));
        console.log(chalk.gray('Press Ctrl+C to cancel. Progress has been saved.'));
        
        await setTimeout(waitTime * 1000);
        attempt--; // Don't count rate limit retries
        continue;
      } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        if (attempt < MAX_RETRIES) {
          console.log(chalk.yellow(`Retry attempt ${attempt + 1}/${MAX_RETRIES} for ${context}...`));
          await setTimeout(RETRY_DELAY);
          continue;
        }
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  throw lastError;
}

// Process a single month
async function processMonth(date, progressState, teamId) {
  const startDate = startOfMonth(date);
  const endDate = startOfMonth(addMonths(date, 1));
  const monthStr = format(date, 'MMMM yyyy');  // e.g., "January 2024"
  
  // Track total failures
  let totalFailedCommits = 0;
  let totalFailedPRs = 0;
  
  // Check if we should resume from a previous state
  let completedRepos = new Set();
  let currentRepo = null;
  
  if (progressState?.lastSuccessfulRun?.month === format(date, 'yyyy-MM')) {
    completedRepos = new Set(progressState.lastSuccessfulRun.completedRepos);
    currentRepo = progressState.lastSuccessfulRun.currentRepo;
  }

  // Fetch all repositories
  const repos = await fetchRepositories();
  const monthStats = {
    overall: {
      totalCommits: 0,
      totalPrs: 0,
      mergedPrs: 0,
      linesAdded: 0,
      linesRemoved: 0,
      averageContributionScore: 0
    },
    repositories: {},
    contributors: {}
  };

  // Process each repository
  const spinner = ora().start();
  const allCommits = [];
  const allPullRequests = [];
  
  for (const repo of repos) {
    if (completedRepos.has(repo.id)) {
      spinner.text = chalk.gray(`Skipping ${repo.name} (already processed)`);
      continue;
    }

    spinner.text = chalk.blue(`Processing ${repo.name}`);
    try {
      // Get or create repo record
      const dbRepo = await getOrCreateRepo(teamId, repo);

      // Initialize repository stats if not exists
      if (!monthStats.repositories[repo.id]) {
        monthStats.repositories[repo.id] = {
          name: repo.name,
          commits: 0,
          totalPrs: 0,
          mergedPrs: 0,
          linesAdded: 0,
          linesRemoved: 0,
          activeContributors: 0
        };
      }

      // Fetch monthly data
      spinner.text = chalk.blue(`Fetching commits for ${repo.name}...`);
      const commits = await fetchMonthlyCommits(repo, startDate, endDate);
      allCommits.push(...commits.map(c => ({ ...c, repository: repo.id })));
      
      spinner.text = chalk.blue(`Fetching PRs for ${repo.name}...`);
      const pullRequests = await fetchMonthlyPullRequests(repo, startDate, endDate);
      allPullRequests.push(...pullRequests.map(pr => ({ ...pr, repository: repo.id })));
      
      spinner.text = chalk.blue(`Processing ${commits.length} commits and ${pullRequests.length} PRs for ${repo.name}...`);

      // Process commits
      for (const commit of commits) {
        if (!commit.author?.id) continue;

        const contributor = await getOrCreateContributor(teamId, commit.author);
        if (contributor) {
          await createCommit(commit, dbRepo.id, contributor.id, repo.name);

          // Update repository stats
          const repoStats = monthStats.repositories[repo.id];
          repoStats.commits++;
          repoStats.linesAdded += commit.stats?.additions || 0;
          repoStats.linesRemoved += commit.stats?.deletions || 0;

          // Update contributor stats
          const userId = commit.author.id.toString();
          if (!monthStats.contributors[userId]) {
            monthStats.contributors[userId] = {
              login: commit.author.login,
              totalCommits: 0,
              totalPrs: 0,
              mergedPrs: 0,
              linesAdded: 0,
              linesRemoved: 0,
              activeRepositories: [],
              contributionScore: 0,
              tabs: 0,
              premiumRequests: 0
            };
          }
          const contributorStats = monthStats.contributors[userId];
          contributorStats.totalCommits++;
          contributorStats.linesAdded += commit.stats?.additions || 0;
          contributorStats.linesRemoved += commit.stats?.deletions || 0;
          if (!contributorStats.activeRepositories.includes(repo.id)) {
            contributorStats.activeRepositories.push(repo.id);
          }

          // Update overall stats
          monthStats.overall.totalCommits++;
          monthStats.overall.linesAdded += commit.stats?.additions || 0;
          monthStats.overall.linesRemoved += commit.stats?.deletions || 0;
        }
      }

      // Process pull requests
      for (const pr of pullRequests) {
        if (!pr.user?.id) continue;

        const contributor = await getOrCreateContributor(teamId, pr.user);
        if (contributor) {
          await createOrUpdatePullRequest(pr, dbRepo.id, contributor.id, repo.name);

          // Update repository stats
          const repoStats = monthStats.repositories[repo.id];
          repoStats.totalPrs++;
          if (pr.merged) {
            repoStats.mergedPrs++;
          }
          repoStats.linesAdded += pr.additions || 0;
          repoStats.linesRemoved += pr.deletions || 0;

          // Update contributor stats
          const userId = pr.user.id.toString();
          if (!monthStats.contributors[userId]) {
            monthStats.contributors[userId] = {
              login: pr.user.login,
              totalCommits: 0,
              totalPrs: 0,
              mergedPrs: 0,
              linesAdded: 0,
              linesRemoved: 0,
              activeRepositories: [],
              contributionScore: 0,
              tabs: 0,
              premiumRequests: 0
            };
          }
          const contributorStats = monthStats.contributors[userId];
          contributorStats.totalPrs++;
          if (pr.merged) {
            contributorStats.mergedPrs++;
          }
          contributorStats.linesAdded += pr.additions || 0;
          contributorStats.linesRemoved += pr.deletions || 0;
          if (!contributorStats.activeRepositories.includes(repo.id)) {
            contributorStats.activeRepositories.push(repo.id);
          }

          // Update overall stats
          monthStats.overall.totalPrs++;
          if (pr.merged) {
            monthStats.overall.mergedPrs++;
          }
          monthStats.overall.linesAdded += pr.additions || 0;
          monthStats.overall.linesRemoved += pr.deletions || 0;
        }
      }

      // Update active contributors count
      monthStats.repositories[repo.id].activeContributors = Object.values(monthStats.contributors)
        .filter(c => c.activeRepositories.includes(repo.id))
        .length;

      completedRepos.add(repo.id);
      const rateLimit = await octokit.rateLimit.get();
      await saveProgressState({
        lastSuccessfulRun: {
          month: format(date, 'yyyy-MM'),
          completedRepos: Array.from(completedRepos),
          currentRepo: repo.id,
          githubApi: {
            callsRemaining: rateLimit.data.rate.remaining,
            resetTimestamp: new Date(rateLimit.data.rate.reset * 1000).toISOString()
          }
        }
      });
    } catch (error) {
      spinner.fail(`Failed to process repository: ${repo.name}`);
      throw error;
    }
  }

  // Calculate contribution scores
  const allContributorStats = Object.entries(monthStats.contributors).map(([userId, stats]) => ({
    githubUserId: userId,
    ...stats
  }));
  const scores = calculateContributorScores(allContributorStats);
  
  // Update contributor scores
  Object.entries(monthStats.contributors).forEach(([userId, stats]) => {
    stats.contributionScore = scores[userId]?.score || 0;
  });

  // Calculate average contribution score
  const scoreValues = Object.values(scores).map(s => s.score);
  monthStats.overall.averageContributionScore = 
    scoreValues.length > 0 ? scoreValues.reduce((a, b) => a + b) / scoreValues.length : 0;

  spinner.succeed(`Completed processing all repositories for ${monthStr}`);

  // After processing all repositories, log total failures
  if (totalFailedCommits > 0 || totalFailedPRs > 0) {
    await log('\nSummary of failed fetches:', 'error');
    if (totalFailedCommits > 0) {
      await log(`Failed to fetch ${totalFailedCommits} commits`, 'error');
    }
    if (totalFailedPRs > 0) {
      await log(`Failed to fetch ${totalFailedPRs} pull requests`, 'error');
    }
  }

  return { monthStats, commits: allCommits, pullRequests: allPullRequests };
}

// Update month stats in database
async function updateMonthStats(teamId, monthStart, newStats) {
  // Find existing month record
  const existingMonth = await prisma.month.findUnique({
    where: { 
      teamId_date: {
        teamId,
        date: monthStart
      }
    }
  });

  if (existingMonth) {
    // Preserve tabs and premiumRequests for existing contributors
    Object.keys(newStats.contributors).forEach(userId => {
      if (existingMonth.stats.contributors[userId]) {
        newStats.contributors[userId].tabs = existingMonth.stats.contributors[userId].tabs;
        newStats.contributors[userId].premiumRequests = existingMonth.stats.contributors[userId].premiumRequests;
      }
    });
  }

  // Upsert the month record
  await prisma.month.upsert({
    where: { 
      teamId_date: { teamId, date: monthStart } 
    },
    create: { 
      teamId,
      date: monthStart,
      stats: newStats 
    },
    update: { 
      stats: newStats 
    }
  });
}

// Format numbers with commas
function formatNumber(num) {
  return num.toLocaleString();
}

// Print monthly summary (updated to log to file)
async function printMonthSummary(monthStats, dbStats) {
  const lines = [];
  
  lines.push('\nRepository Statistics:');
  Object.entries(monthStats.repositories).forEach(([repoId, stats]) => {
    lines.push(`\n${stats.name}`);
    lines.push(`├── Commits: ${formatNumber(stats.commits)} pulled, ` +
      `${formatNumber(dbStats[repoId]?.newCommits || 0)} new, ` +
      `${formatNumber(dbStats[repoId]?.existingCommits || 0)} existing`);
    lines.push(`├── Pull Requests: ${formatNumber(stats.totalPrs)} pulled, ` +
      `${formatNumber(dbStats[repoId]?.newPRs || 0)} new, ` +
      `${formatNumber(dbStats[repoId]?.existingPRs || 0)} existing`);
    lines.push(`└── Contributors: ${formatNumber(stats.activeContributors)} total, ` +
      `${formatNumber(dbStats[repoId]?.newContributors || 0)} new, ` +
      `${formatNumber((stats.activeContributors || 0) - (dbStats[repoId]?.newContributors || 0))} existing`);
  });

  const contributorCount = Object.values(monthStats.contributors).length;
  const newContributors = dbStats.total.newContributors || 0;
  const existingContributors = contributorCount - newContributors;

  lines.push('\nTotal Statistics:');
  lines.push(`├── Commits: ${formatNumber(monthStats.overall.totalCommits)} pulled, ` +
    `${formatNumber(dbStats.total.newCommits)} new, ` +
    `${formatNumber(dbStats.total.existingCommits)} existing`);
  lines.push(`├── Pull Requests: ${formatNumber(monthStats.overall.totalPrs)} pulled, ` +
    `${formatNumber(dbStats.total.newPRs)} new, ` +
    `${formatNumber(dbStats.total.existingPRs)} existing`);
  lines.push(`├── Contributors: ${formatNumber(contributorCount)} total, ` +
    `${formatNumber(newContributors)} new, ` +
    `${formatNumber(existingContributors)} existing`);
  lines.push(`└── API Calls Remaining: ${formatNumber(dbStats.apiCallsRemaining)}`);

  lines.push('\nMonth Stats:');
  
  lines.push('Overall:');
  lines.push(`├── Total Commits: ${formatNumber(monthStats.overall.totalCommits)}`);
  lines.push(`├── Total Pull Requests: ${formatNumber(monthStats.overall.totalPrs)}`);
  lines.push(`├── Merged Pull Requests: ${formatNumber(monthStats.overall.mergedPrs)}`);
  lines.push(`├── Lines Added: ${formatNumber(monthStats.overall.linesAdded)}`);
  lines.push(`├── Lines Removed: ${formatNumber(monthStats.overall.linesRemoved)}`);
  lines.push(`└── Average Contribution Score: ${monthStats.overall.averageContributionScore.toFixed(2)}`);

  lines.push('\nRepository Activity:');
  Object.entries(monthStats.repositories).forEach(([repoId, stats], index, array) => {
    const isLast = index === array.length - 1;
    lines.push(`${isLast ? '└──' : '├──'} ${stats.name}`);
    lines.push(`${isLast ? '    └──' : '    ├──'} ` +
      `Commits: ${formatNumber(stats.commits)}, ` +
      `PRs: ${formatNumber(stats.totalPrs)} (${formatNumber(stats.mergedPrs)} merged), ` +
      `Lines: +${formatNumber(stats.linesAdded)}/-${formatNumber(stats.linesRemoved)}, ` +
      `Active Contributors: ${formatNumber(stats.activeContributors)}`);
  });

  lines.push('\nContributor Activity:');
  Object.entries(monthStats.contributors).forEach(([userId, stats], index, array) => {
    const isLast = index === array.length - 1;
    lines.push(`${isLast ? '└──' : '├──'} ${stats.login}`);
    lines.push(`${isLast ? '    └──' : '    ├──'} ` +
      `Commits: ${formatNumber(stats.totalCommits)}, ` +
      `PRs: ${formatNumber(stats.totalPrs)} (${formatNumber(stats.mergedPrs)} merged), ` +
      `Lines: +${formatNumber(stats.linesAdded)}/-${formatNumber(stats.linesRemoved)}, ` +
      `Active in ${formatNumber(stats.activeRepositories.length)} repos, ` +
      `Score: ${stats.contributionScore.toFixed(2)}`);
  });

  // Print to console with colors
  lines.forEach(line => {
    if (line.startsWith('\n')) console.log('');
    if (line.includes('Statistics:') || line.includes('Activity:') || line.includes('Overall:')) {
      console.log(chalk.cyan(line));
    } else if (line.match(/^[^├└]+$/)) {
      console.log(chalk.yellow(line));
    } else {
      console.log(chalk.gray(line.includes('└──') ? line : line.replace('├──', '├──')));
    }
  });

  // Write to log file without colors
  await log(lines.join('\n'));
}

// Get or create team based on GitHub organization
async function getTeamId() {
  if (!GITHUB_ORG) {
    throw new Error('GITHUB_ORG environment variable is required');
  }

  // Fetch org details from GitHub to get the numeric ID
  const org = await octokit.orgs.get({ org: GITHUB_ORG });
  const orgId = org.data.id;

  // Look up team by githubOrgId
  let team = await prisma.team.findUnique({
    where: { githubOrgId: BigInt(orgId) }
  });

  if (!team) {
    // Create new team
    team = await prisma.team.create({
      data: {
        name: org.data.name || GITHUB_ORG,
        githubOrgId: BigInt(orgId),
        githubOrgName: GITHUB_ORG
      }
    });
    
    console.log(chalk.green(`Created new team for organization ${GITHUB_ORG}`));
  }

  return team.id;
}

// Get or create a repository
async function getOrCreateRepo(teamId, repo) {
  return prisma.repo.upsert({
    where: { githubRepoId: repo.id },
    create: {
      teamId,
      name: repo.name,
      githubRepoId: repo.id,
      url: repo.html_url
    },
    update: {
      name: repo.name,
      url: repo.html_url
    }
  });
}

// Get or create a contributor
async function getOrCreateContributor(teamId, author) {
  if (!author?.id) return null;
  return prisma.contributor.upsert({
    where: { githubUserId: author.id.toString() },
    create: {
      teamId,
      githubUserId: author.id.toString(),
      githubLogin: author.login,
      name: author.name || author.login,
      avatarUrl: author.avatar_url
    },
    update: {
      githubLogin: author.login,
      name: author.name || author.login,
      avatarUrl: author.avatar_url
    }
  });
}

// Create commit record
async function createCommit(commit, repoId, authorId, repoName) {
  return prisma.commit.upsert({
    where: { githubCommitId: commit.sha },
    create: {
      githubCommitId: commit.sha,
      message: commit.message,
      linesAdded: commit.stats.additions,
      linesDeleted: commit.stats.deletions,
      committedAt: new Date(commit.date),
      url: `https://github.com/${GITHUB_ORG}/${repoName}/commit/${commit.sha}`,
      repoId: repoId,
      authorId: authorId
    },
    update: {
      message: commit.message,
      linesAdded: commit.stats.additions,
      linesDeleted: commit.stats.deletions,
      committedAt: new Date(commit.date),
      url: `https://github.com/${GITHUB_ORG}/${repoName}/commit/${commit.sha}`,
      repoId: repoId,
      authorId: authorId
    }
  });
}

// Create or update pull request record
async function createOrUpdatePullRequest(pr, repoId, authorId, repoName) {
  // Validate dates before creating/updating
  const openedAt = pr.created_at ? new Date(pr.created_at) : null;
  const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;
  const closedAt = pr.closed_at ? new Date(pr.closed_at) : null;

  // Ensure we have a valid openedAt date
  if (!openedAt || isNaN(openedAt.getTime())) {
    throw new Error(`Invalid openedAt date for PR #${pr.number}: ${pr.created_at}`);
  }

  return prisma.pullRequest.upsert({
    where: { githubPrId: pr.number },
    create: {
      githubPrId: pr.number,
      title: pr.title,
      description: pr.body || '',
      status: pr.merged ? 'MERGED' : pr.state === 'closed' ? 'CLOSED' : 'OPEN',
      isDraft: pr.draft,
      isMerged: pr.merged,
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
      openedAt,
      mergedAt,
      closedAt,
      url: `https://github.com/${GITHUB_ORG}/${repoName}/pull/${pr.number}`,
      linesAdded: pr.additions || 0,
      linesDeleted: pr.deletions || 0,
      commits: pr.commits || 0,
      comments: (pr.comments || 0) + (pr.review_comments || 0),
      reviews: pr.review_comments || 0,
      authorId: authorId,
      repoId: repoId
    },
    update: {
      status: pr.merged ? 'MERGED' : pr.state === 'closed' ? 'CLOSED' : 'OPEN',
      isDraft: pr.draft,
      isMerged: pr.merged,
      openedAt,
      mergedAt,
      closedAt,
      url: `https://github.com/${GITHUB_ORG}/${repoName}/pull/${pr.number}`,
      linesAdded: pr.additions || 0,
      linesDeleted: pr.deletions || 0,
      commits: pr.commits || 0,
      comments: (pr.comments || 0) + (pr.review_comments || 0),
      reviews: pr.review_comments || 0
    }
  });
}

// Add retry functionality
async function findFailedItems(numLogs = 0) {
  const logFiles = await fs.readdir(LOG_DIR);
  const failedItems = {
    commits: new Map(), // sha -> {repo, author, lastAttempt}
    prs: new Map()     // number -> {repo, author, lastAttempt}
  };

  // Sort log files by date (newest first)
  const syncLogFiles = logFiles
    .filter(file => file.startsWith('sync-') && file.endsWith('.log'))
    .sort((a, b) => {
      const dateA = new Date(a.slice(5, -4).replace(/-/g, '/')); // Extract date from filename
      const dateB = new Date(b.slice(5, -4).replace(/-/g, '/')); // sync-YYYY-MM-DD-HH-mm-ss.log
      return dateB - dateA;
    });

  // Only look at the specified number of most recent logs if numLogs > 0
  const logsToProcess = numLogs > 0 ? syncLogFiles.slice(0, numLogs) : syncLogFiles;
  
  for (const file of logsToProcess) {
    const content = await fs.readFile(path.join(LOG_DIR, file), 'utf8');
    const lines = content.split('\n');
    const fileDate = new Date(file.slice(5, -4).replace(/-/g, '/'));
    
    for (const line of lines) {
      // For successful retries, remove from failed items
      if (line.includes('Successfully reprocessed commit')) {
        const sha = line.match(/commit ([a-f0-9]+)/)?.[1];
        if (sha) failedItems.commits.delete(sha);
      } else if (line.includes('Successfully reprocessed PR #')) {
        const number = line.match(/PR #(\d+)/)?.[1];
        if (number) failedItems.prs.delete(number);
      }
      // For failures, add or update
      else if (line.includes('FAILED_COMMIT|') || line.includes('RETRY_COMMIT|') || line.includes('RETRY_FAILED_COMMIT|')) {
        const [, repo, sha, author] = line.split('|');
        // Only add if not already marked as successful in this file
        if (!line.includes('Successfully reprocessed')) {
          failedItems.commits.set(sha, { repo, author, lastAttempt: fileDate });
        }
      } else if (line.includes('FAILED_PR|') || line.includes('RETRY_PR|') || line.includes('RETRY_FAILED_PR|')) {
        const [, repo, number, author] = line.split('|');
        // Only add if not already marked as successful in this file
        if (!line.includes('Successfully reprocessed')) {
          failedItems.prs.set(number, { repo, author, lastAttempt: fileDate });
        }
      }
    }
  }

  return failedItems;
}

async function retryFailedItems(teamId, numLogs = 0) {
  const spinner = ora('Finding failed items in logs...').start();
  const failed = await findFailedItems(numLogs);
  
  const numLogsMsg = numLogs > 0 ? ` from the last ${numLogs} log file${numLogs === 1 ? '' : 's'}` : ' from all log files';
  spinner.text = `Found ${failed.commits.size} failed commits and ${failed.prs.size} failed PRs${numLogsMsg}`;
  
  if (failed.commits.size === 0 && failed.prs.size === 0) {
    spinner.succeed('No failed items found to retry');
    return;
  }

  // Retry commits
  if (failed.commits.size > 0) {
    spinner.text = 'Retrying failed commits...';
    for (const [sha, { repo, author, lastAttempt }] of failed.commits) {
      try {
        const lastAttemptStr = lastAttempt ? ` (last attempted: ${format(lastAttempt, 'yyyy-MM-dd HH:mm:ss')})` : '';
        spinner.text = `Retrying commit ${sha} in ${repo}${lastAttemptStr}...`;
        const { data: fullCommit } = await octokit.repos.getCommit({
          owner: GITHUB_ORG,
          repo,
          ref: sha
        });

        // Get or create repo record
        const dbRepo = await getOrCreateRepo(teamId, { name: repo, id: fullCommit.repository?.id?.toString() });

        const commit = {
          sha,
          message: fullCommit.commit.message,
          author: {
            id: fullCommit.author?.id,
            login: fullCommit.author?.login,
            name: fullCommit.commit.author.name,
            avatar_url: fullCommit.author?.avatar_url
          },
          date: fullCommit.commit.author.date,
          stats: {
            additions: fullCommit.stats?.additions || 0,
            deletions: fullCommit.stats?.deletions || 0
          }
        };

        const contributor = await getOrCreateContributor(teamId, commit.author);
        if (contributor) {
          await createCommit(commit, dbRepo.id, contributor.id, repo);
          spinner.succeed(`Successfully reprocessed commit ${sha}`);
        }
      } catch (error) {
        spinner.fail(`Failed to reprocess commit ${sha}: ${error.message}`);
        await log(`RETRY_FAILED_COMMIT|${repo}|${sha}|${author}|${error.message}`, 'error');
      }
    }
  }

  // Retry PRs
  if (failed.prs.size > 0) {
    spinner.text = 'Retrying failed pull requests...';
    for (const [number, { repo, author, lastAttempt }] of failed.prs) {
      try {
        const lastAttemptStr = lastAttempt ? ` (last attempted: ${format(lastAttempt, 'yyyy-MM-dd HH:mm:ss')})` : '';
        spinner.text = `Retrying PR #${number} in ${repo}${lastAttemptStr}...`;
        const { data: fullPR } = await octokit.pulls.get({
          owner: GITHUB_ORG,
          repo,
          pull_number: parseInt(number)
        });

        // Get or create repo record
        const dbRepo = await getOrCreateRepo(teamId, { name: repo, id: fullPR.base.repo.id.toString() });

        const pr = {
          number: parseInt(number),
          title: fullPR.title,
          body: fullPR.body,
          state: fullPR.state,
          draft: fullPR.draft,
          merged: fullPR.merged,
          head: { ref: fullPR.head.ref },
          base: { ref: fullPR.base.ref },
          user: {
            id: fullPR.user.id,
            login: fullPR.user.login,
            name: fullPR.user.login,
            avatar_url: fullPR.user.avatar_url
          },
          mergedAt: fullPR.merged_at,
          closedAt: fullPR.closed_at,
          additions: fullPR.additions || 0,
          deletions: fullPR.deletions || 0,
          commits: fullPR.commits || 0,
          comments: fullPR.comments || 0,
          review_comments: fullPR.review_comments || 0
        };

        const contributor = await getOrCreateContributor(teamId, pr.user);
        if (contributor) {
          await createOrUpdatePullRequest(pr, dbRepo.id, contributor.id, repo);
          spinner.succeed(`Successfully reprocessed PR #${number}`);
        }
      } catch (error) {
        spinner.fail(`Failed to reprocess PR #${number}: ${error.message}`);
        await log(`RETRY_FAILED_PR|${repo}|${number}|${author}|${error.message}`, 'error');
      }
    }
  }

  spinner.succeed(`Completed retry attempts for ${failed.commits.size} commits and ${failed.prs.size} PRs`);
}

// Update command line arguments
program
  .requiredOption('-s, --start-date <date>', 'Start date (YYYY-MM)')
  .requiredOption('-m, --months <number>', 'Number of months to process', parseInt)
  .option('-f, --force', 'Ignore saved progress state')
  .option('-r, --retry [number]', 'Retry failed items from logs, optionally specify number of recent log files to check', (value) => value ? parseInt(value) : 1)
  .parse(process.argv);

// Update main function
async function main() {
  try {
    await ensureDirectories();
    
    const options = program.opts();
    const teamId = await getTeamId();

    if (options.retry !== undefined) {
      const numLogs = options.retry;
      const logsMsg = ` from the last ${numLogs} log file${numLogs === 1 ? '' : 's'}`;
      await log(`Running in retry mode - will attempt to reprocess failed items${logsMsg}`);
      await retryFailedItems(teamId, numLogs);
      apiSpinner.stop();
      return;
    }

    await log('\nStarting GitHub sync script');
    await log(`Command: sync-github.js --start-date ${options.startDate} --months ${options.months}${options.force ? ' --force' : ''}\n`);
    
    // Validate start date
    const startDate = parse(options.startDate, 'yyyy-MM', new Date());
    if (isNaN(startDate.getTime())) {
      throw new Error('Invalid start date format. Use YYYY-MM');
    }

    // Initialize or load progress state
    let progressState = null;
    if (!options.force) {
      progressState = await loadProgressState();
    }

    // Process each month
    for (let i = 0; i < options.months; i++) {
      const currentMonth = startOfMonth(addMonths(startDate, i));
      const monthStr = format(currentMonth, 'MMMM yyyy');
      
      console.log(chalk.cyan(`\nProcessing ${monthStr}...`));
      const spinner = ora('Starting monthly processing...').start();

      try {
        const { monthStats, commits, pullRequests } = await withRetry(
          () => processMonth(currentMonth, progressState, teamId),
          `processing ${monthStr}`,
          progressState
        );

        spinner.succeed(`Completed processing ${monthStr}`);
        await updateMonthStats(teamId, currentMonth, monthStats);
        
        // Get existing commits and PRs from database
        const existingCommits = new Set((await prisma.commit.findMany({
          where: { 
            repoId: { in: Object.keys(monthStats.repositories) },
            committedAt: {
              gte: startOfMonth(currentMonth),
              lt: startOfMonth(addMonths(currentMonth, 1))
            }
          },
          select: { githubCommitId: true }
        })).map(c => c.githubCommitId));

        const existingPRs = new Set((await prisma.pullRequest.findMany({
          where: { 
            repoId: { in: Object.keys(monthStats.repositories) },
            openedAt: {
              gte: startOfMonth(currentMonth),
              lt: startOfMonth(addMonths(currentMonth, 1))
            }
          },
          select: { githubPrId: true }
        })).map(pr => pr.githubPrId));

        // For contributors, we still want to check all existing ones since they persist across months
        const existingContributors = new Set((await prisma.contributor.findMany({
          where: { teamId },
          select: { githubUserId: true }
        })).map(c => c.githubUserId));
        
        // Initialize dbStats with default values
        const dbStats = {
          total: {
            newCommits: 0,
            existingCommits: 0,
            newPRs: 0,
            existingPRs: 0,
            newContributors: 0
          },
          apiCallsRemaining: (await octokit.rateLimit.get()).data.rate.remaining
        };
        
        // Add stats for each repository
        Object.entries(monthStats.repositories).forEach(([repoId, stats]) => {
          // Count new vs existing commits for this repo
          const repoCommits = commits.filter(c => c.repository === repoId);
          const newCommitsCount = repoCommits.filter(c => !existingCommits.has(c.sha)).length;
          const existingCommitsCount = repoCommits.length - newCommitsCount;

          // Count new vs existing PRs for this repo
          const repoPRs = pullRequests.filter(pr => pr.repository === repoId);
          const newPRsCount = repoPRs.filter(pr => !existingPRs.has(pr.number)).length;
          const existingPRsCount = repoPRs.length - newPRsCount;

          // Count new vs existing contributors for this repo
          const repoContributors = new Set([
            ...repoCommits.map(c => c.author?.id?.toString()).filter(Boolean),
            ...repoPRs.map(pr => pr.user?.id?.toString()).filter(Boolean)
          ]);
          const newContributorsCount = Array.from(repoContributors).filter(id => !existingContributors.has(id)).length;

          dbStats[repoId] = {
            newCommits: newCommitsCount,
            existingCommits: existingCommitsCount,
            newPRs: newPRsCount,
            existingPRs: existingPRsCount,
            newContributors: newContributorsCount
          };

          // Add to totals
          dbStats.total.newCommits += newCommitsCount;
          dbStats.total.existingCommits += existingCommitsCount;
          dbStats.total.newPRs += newPRsCount;
          dbStats.total.existingPRs += existingPRsCount;
        });

        // Calculate total new contributors
        const allContributors = new Set([
          ...Object.values(monthStats.contributors).map(c => c.githubUserId)
        ]);
        dbStats.total.newContributors = Array.from(allContributors)
          .filter(id => !existingContributors.has(id)).length;

        await printMonthSummary(monthStats, dbStats);

      } catch (error) {
        spinner.fail(`Failed to process ${monthStr}`);
        throw error;
      }
    }

    await log('Sync completed successfully!', 'success');
    apiSpinner.succeed(`Completed with ${apiCallCounter.toLocaleString()} API calls`);

  } catch (error) {
    apiSpinner.fail(`Error after ${apiCallCounter.toLocaleString()} API calls: ${error.message}`);
    await log(`Error: ${error.message}`, 'error');
    if (error.status === 401) {
      await log('Authentication failed. Please check your GITHUB_KEY.', 'error');
    }
    process.exit(1);
  } finally {
    // Ensure spinner is stopped and Prisma is disconnected
    apiSpinner.stop();
    await prisma.$disconnect();
    // Force exit after cleanup
    process.exit(0);
  }
}

// Update error handlers
process.on('unhandledRejection', async (error) => {
  apiSpinner.fail(`Unhandled promise rejection after ${apiCallCounter.toLocaleString()} API calls`);
  console.error(chalk.red('Error details:'), error);
  await prisma.$disconnect();
  process.exit(1);
});

process.on('SIGINT', async () => {
  apiSpinner.warn(`\nInterrupted after ${apiCallCounter.toLocaleString()} API calls`);
  console.log(chalk.yellow('Cleaning up...'));
  await prisma.$disconnect();
  process.exit(0);
});

// Start the script
main(); 