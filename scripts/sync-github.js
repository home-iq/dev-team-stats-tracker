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
import { calculateRepoStats, calculateContributorScore } from './utils/calculate-scores.js';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();
const octokit = new Octokit({ auth: process.env.GITHUB_KEY });
const GITHUB_ORG = process.env.GITHUB_ORG;

// Constants
const CACHE_DIR = path.join(process.cwd(), '.cache');
const STATE_FILE = path.join(CACHE_DIR, 'github-sync-state.json');
const MAX_RETRIES = 2;
const RETRY_DELAY = 5000; // 5 seconds

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
  const commits = await octokit.paginate(octokit.repos.listCommits, {
    owner: GITHUB_ORG,
    repo: repo.name,
    since: startDate.toISOString(),
    until: endDate.toISOString(),
    per_page: 100
  });

  return commits.map(commit => ({
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
      additions: commit.stats?.additions || 0,
      deletions: commit.stats?.deletions || 0
    }
  }));
}

// Fetch pull requests for a repository in a given month
async function fetchMonthlyPullRequests(repo, startDate, endDate) {
  const prs = await octokit.paginate(octokit.pulls.list, {
    owner: GITHUB_ORG,
    repo: repo.name,
    state: 'all',
    sort: 'updated',
    direction: 'desc',
    per_page: 100
  });

  return prs
    .filter(pr => {
      const updatedAt = new Date(pr.updated_at);
      return updatedAt >= startDate && updatedAt < endDate;
    })
    .map(pr => ({
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
      mergedAt: pr.merged_at,
      closedAt: pr.closed_at,
      additions: pr.additions,
      deletions: pr.deletions,
      commits: pr.commits,
      comments: pr.comments,
      review_comments: pr.review_comments
    }));
}

// Utility for retrying failed operations
async function withRetry(operation, context = '', progressState = null) {
  let lastError;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(chalk.yellow(`Retry attempt ${attempt}/${MAX_RETRIES} for ${context}...`));
        await setTimeout(RETRY_DELAY);
      }
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if we hit rate limit
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
      }
    }
  }
  
  throw lastError;
}

// Process a single month
async function processMonth(date, progressState, teamId) {
  const startDate = startOfMonth(date);
  const endDate = startOfMonth(addMonths(date, 1));
  
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
  for (const repo of repos) {
    if (completedRepos.has(repo.id)) {
      spinner.text = `Skipping completed repository: ${repo.name}`;
      continue;
    }

    spinner.text = `Processing repository: ${repo.name}`;

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
      const [commits, pullRequests] = await Promise.all([
        fetchMonthlyCommits(repo, startDate, endDate),
        fetchMonthlyPullRequests(repo, startDate, endDate)
      ]);

      // Process commits
      for (const commit of commits) {
        if (!commit.author?.id) continue;

        const contributor = await getOrCreateContributor(teamId, commit.author);
        if (contributor) {
          await createCommit(commit, dbRepo.id, contributor.id);

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
              contributionScore: 0
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
          await createOrUpdatePullRequest(pr, dbRepo.id, contributor.id);

          // Update repository stats
          const repoStats = monthStats.repositories[repo.id];
          repoStats.totalPrs++;
          if (pr.merged) {
            repoStats.mergedPrs++;
          }
          repoStats.linesAdded += pr.additions;
          repoStats.linesRemoved += pr.deletions;

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
              contributionScore: 0
            };
          }
          const contributorStats = monthStats.contributors[userId];
          contributorStats.totalPrs++;
          if (pr.merged) {
            contributorStats.mergedPrs++;
          }
          contributorStats.linesAdded += pr.additions;
          contributorStats.linesRemoved += pr.deletions;
          if (!contributorStats.activeRepositories.includes(repo.id)) {
            contributorStats.activeRepositories.push(repo.id);
          }

          // Update overall stats
          monthStats.overall.totalPrs++;
          if (pr.merged) {
            monthStats.overall.mergedPrs++;
          }
          monthStats.overall.linesAdded += pr.additions;
          monthStats.overall.linesRemoved += pr.deletions;
        }
      }

      // Update active contributors count
      repoStats.activeContributors = Object.values(monthStats.contributors)
        .filter(c => c.activeRepositories.includes(repo.id))
        .length;

      completedRepos.add(repo.id);
      await saveProgressState({
        lastSuccessfulRun: {
          month: format(date, 'yyyy-MM'),
          completedRepos: Array.from(completedRepos),
          currentRepo: repo.id,
          githubApi: {
            callsRemaining: (await octokit.rateLimit.get()).data.rate.remaining,
            resetTimestamp: new Date((await octokit.rateLimit.get()).data.rate.reset * 1000).toISOString()
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
  const scores = calculateContributorScore(allContributorStats);
  
  // Update contributor scores
  Object.entries(monthStats.contributors).forEach(([userId, stats]) => {
    stats.contributionScore = scores[userId]?.score || 0;
  });

  // Calculate average contribution score
  const scoreValues = Object.values(scores).map(s => s.score);
  monthStats.overall.averageContributionScore = 
    scoreValues.length > 0 ? scoreValues.reduce((a, b) => a + b) / scoreValues.length : 0;

  spinner.succeed('Completed processing all repositories');
  return monthStats;
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

// Print monthly summary
function printMonthSummary(monthStats, dbStats) {
  console.log('\nRepository Statistics:');
  Object.entries(monthStats.repositories).forEach(([repoId, stats]) => {
    console.log(chalk.cyan(`\n${stats.name}`));
    console.log(chalk.gray('├──'), `Commits: ${formatNumber(stats.commits)} pulled, ` +
      `${formatNumber(dbStats[repoId]?.newCommits || 0)} new, ` +
      `${formatNumber(dbStats[repoId]?.existingCommits || 0)} existing`);
    console.log(chalk.gray('├──'), `Pull Requests: ${formatNumber(stats.totalPrs)} pulled, ` +
      `${formatNumber(dbStats[repoId]?.newPRs || 0)} new, ` +
      `${formatNumber(dbStats[repoId]?.existingPRs || 0)} existing`);
    console.log(chalk.gray('└──'), `Contributors: ${formatNumber(stats.activeContributors)} total`);
  });

  // Get contributor logins for display
  const contributorCount = Object.values(monthStats.contributors)
    .map(stats => stats.login)
    .length;

  console.log(chalk.cyan('\nTotal Statistics:'));
  console.log(chalk.gray('├──'), `Commits: ${formatNumber(monthStats.overall.totalCommits)} pulled, ` +
    `${formatNumber(dbStats.total.newCommits)} new, ` +
    `${formatNumber(dbStats.total.existingCommits)} existing`);
  console.log(chalk.gray('├──'), `Pull Requests: ${formatNumber(monthStats.overall.totalPrs)} pulled, ` +
    `${formatNumber(dbStats.total.newPRs)} new, ` +
    `${formatNumber(dbStats.total.existingPRs)} existing`);
  console.log(chalk.gray('├──'), `Contributors: ${formatNumber(contributorCount)} total`);
  console.log(chalk.gray('└──'), `API Calls Remaining: ${formatNumber(dbStats.apiCallsRemaining)}`);

  console.log(chalk.cyan('\nMonth Stats:'));
  console.log(chalk.gray('├──'), `Total Lines Added: ${formatNumber(monthStats.overall.linesAdded)}`);
  console.log(chalk.gray('├──'), `Total Lines Removed: ${formatNumber(monthStats.overall.linesRemoved)}`);
  console.log(chalk.gray('└──'), `Total Merged PRs: ${formatNumber(monthStats.overall.mergedPrs)}`);
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
async function createCommit(commit, repoId, authorId) {
  return prisma.commit.upsert({
    where: { githubCommitId: commit.sha },
    create: {
      githubCommitId: commit.sha,
      message: commit.message,
      linesAdded: commit.stats.additions,
      linesDeleted: commit.stats.deletions,
      committedAt: new Date(commit.date),
      repoId: repoId,
      authorId: authorId
    },
    update: {} // No updates needed for commits
  });
}

// Create or update pull request record
async function createOrUpdatePullRequest(pr, repoId, authorId) {
  return prisma.pullRequest.upsert({
    where: { githubPrId: pr.number },
    create: {
      githubPrId: pr.number,
      title: pr.title,
      description: pr.body || '',
      status: pr.merged ? 'MERGED' : pr.state.toUpperCase(),
      isDraft: pr.draft,
      isMerged: pr.merged,
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
      mergedAt: pr.mergedAt ? new Date(pr.mergedAt) : null,
      closedAt: pr.closedAt ? new Date(pr.closedAt) : null,
      linesAdded: pr.additions,
      linesDeleted: pr.deletions,
      commits: pr.commits,
      comments: pr.comments,
      reviews: pr.review_comments,
      authorId: authorId,
      repoId: repoId
    },
    update: {
      status: pr.merged ? 'MERGED' : pr.state.toUpperCase(),
      isDraft: pr.draft,
      isMerged: pr.merged,
      mergedAt: pr.mergedAt ? new Date(pr.mergedAt) : null,
      closedAt: pr.closedAt ? new Date(pr.closedAt) : null,
      linesAdded: pr.additions,
      linesDeleted: pr.deletions,
      commits: pr.commits,
      comments: pr.comments,
      reviews: pr.review_comments
    }
  });
}

// Parse command line arguments
program
  .requiredOption('-s, --start-date <date>', 'Start date (YYYY-MM)')
  .requiredOption('-m, --months <number>', 'Number of months to process', parseInt)
  .option('-f, --force', 'Ignore saved progress state')
  .parse(process.argv);

const options = program.opts();

// Main execution
async function main() {
  try {
    // Validate start date
    const startDate = parse(options.startDate, 'yyyy-MM', new Date());
    if (isNaN(startDate.getTime())) {
      throw new Error('Invalid start date format. Use YYYY-MM');
    }

    // Get team ID
    const teamId = await getTeamId();

    // Initialize or load progress state
    let progressState = null;
    if (!options.force) {
      progressState = await loadProgressState();
    }

    // Process each month
    for (let i = 0; i < options.months; i++) {
      const currentMonth = startOfMonth(addMonths(startDate, i));
      const monthStr = format(currentMonth, 'yyyy-MM');
      
      console.log(chalk.cyan(`\nProcessing ${monthStr}...`));
      const spinner = ora('Starting monthly processing...').start();

      try {
        const monthStats = await withRetry(
          () => processMonth(currentMonth, progressState, teamId),
          `processing ${monthStr}`,
          progressState
        );

        spinner.succeed(`Completed processing ${monthStr}`);
        await updateMonthStats(teamId, currentMonth, monthStats);
        printMonthSummary(monthStats);

      } catch (error) {
        spinner.fail(`Failed to process ${monthStr}`);
        throw error;
      }
    }

    console.log(chalk.green('\nSync completed successfully!'));

  } catch (error) {
    console.error(chalk.red('\nError:'), error.message);
    if (error.status === 401) {
      console.error(chalk.red('Authentication failed. Please check your GITHUB_KEY.'));
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Add error handlers
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Unhandled promise rejection:'), error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log(chalk.yellow('\nReceived SIGINT. Cleaning up...'));
  await prisma.$disconnect();
  process.exit(0);
});

// Start the script
main(); 