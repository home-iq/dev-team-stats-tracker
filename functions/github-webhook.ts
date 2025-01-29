import { PrismaClient, EventType, PrStatus } from '@prisma/client';
import crypto from 'crypto';
import { calculateContributorScores as _calculateContributorScores } from '../scripts/utils/calculate-scores.js';
import { Octokit } from '@octokit/rest';

const prisma = new PrismaClient();
const octokit = new Octokit({
  auth: process.env.GITHUB_KEY
});

// Get GITHUB_ORG from environment
const GITHUB_ORG = process.env.GITHUB_ORG;

interface GitHubCommit {
  id: string;
  sha: string;
  message: string;
  repository: string;
  author?: {
    id?: number;
    username?: string;
    name?: string;
    avatar_url?: string;
  };
  timestamp: string;
  stats?: {
    additions: number;
    deletions: number;
  };
}

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: string;
  draft: boolean;
  merged: boolean;
  created_at: string;
  merged_at: string | null;
  closed_at: string | null;
  head: { ref: string };
  base: { ref: string };
  repository: string;
  user: {
    id: number;
    login: string;
    name?: string;
    avatar_url?: string;
  };
  additions: number;
  deletions: number;
  commits: number;
  comments: number;
  review_comments: number;
}

// Verify GitHub webhook signature
const verifySignature = (payload: string, signature: string, secret: string) => {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
};

// Get or create a contributor
async function getOrCreateContributor(teamId: string, githubUserId: string, login: string, name: string, avatarUrl?: string) {
  return prisma.contributor.upsert({
    where: { githubUserId },
    create: { teamId, githubUserId, githubLogin: login, name, avatarUrl },
    update: { githubLogin: login, name, avatarUrl }
  });
}

// Get or create a repository
async function getOrCreateRepo(teamId: string, repoName: string, githubRepoId: string, url?: string) {
  return prisma.repo.upsert({
    where: { githubRepoId },
    create: { teamId, name: repoName, githubRepoId, url },
    update: { name: repoName, url }
  });
}

// Get or create a team
async function getOrCreateTeam(githubOrgId: number, orgName: string) {
  return prisma.team.upsert({
    where: { githubOrgId },
    create: { 
      githubOrgId: BigInt(githubOrgId),
      githubOrgName: orgName,
      name: orgName 
    },
    update: {
      githubOrgName: orgName,
      name: orgName
    }
  });
}

// Helper to convert GitHub PR state to PrStatus
function toPrStatus(state: string, merged: boolean): PrStatus {
  if (merged) return PrStatus.MERGED;
  return state.toUpperCase() === 'OPEN' ? PrStatus.OPEN : PrStatus.CLOSED;
}

// Define the stats type
type JsonMonthStats = {
  overall: {
    totalCommits: number;
    totalPrs: number;
    mergedPrs: number;
    linesAdded: number;
    linesRemoved: number;
    activeContributors: number;
    averageContributionScore: number;
  };
  repositories: {
    [key: string]: {
      name: string;
      commits: number;
      totalPrs: number;
      mergedPrs: number;
      linesAdded: number;
      linesRemoved: number;
      activeContributors: number;
    };
  };
  contributors: {
    [key: string]: {
      login: string;
      totalCommits: number;
      totalPrs: number;
      mergedPrs: number;
      linesAdded: number;
      linesRemoved: number;
      activeRepositories: string[];
      contributionScore: number;
      tabs: number;
      premiumRequests: number;
    };
  };
};

// Update monthly stats for a given month
async function updateMonthStats(teamId: string, date: Date, newCommits: GitHubCommit[] = [], newPullRequest: GitHubPullRequest | null = null) {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  
  // Get or create month record with stats
  const monthRecord = await prisma.month.upsert({
    where: {
      teamId_date: {
        teamId,
        date: startOfMonth
      }
    },
    create: {
      teamId,
      date: startOfMonth,
      stats: {
        overall: {
          totalCommits: 0,
          totalPrs: 0,
          mergedPrs: 0,
          linesAdded: 0,
          linesRemoved: 0,
          activeContributors: 0,
          averageContributionScore: 0
        },
        repositories: {},
        contributors: {}
      } as JsonMonthStats
    },
    update: {},
    select: {
      stats: true
    }
  });

  const existingStats = monthRecord.stats as JsonMonthStats;

  // Process new commits
  for (const commit of newCommits) {
    if (!commit.author?.id || !commit.author.username) continue;

    // Update repository stats
    const repoId = commit.repository;
    if (!existingStats.repositories[repoId]) {
      existingStats.repositories[repoId] = {
        name: commit.repository,
        commits: 0,
        totalPrs: 0,
        mergedPrs: 0,
        linesAdded: 0,
        linesRemoved: 0,
        activeContributors: 0
      };
    }
    const repoStats = existingStats.repositories[repoId];
    repoStats.commits++;
    repoStats.linesAdded += commit.stats?.additions || 0;
    repoStats.linesRemoved += commit.stats?.deletions || 0;

    // Update contributor stats
    const userId = commit.author.id.toString();
    if (!existingStats.contributors[userId]) {
      existingStats.contributors[userId] = {
        login: commit.author.username,
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
    const contributorStats = existingStats.contributors[userId];
    contributorStats.totalCommits++;
    contributorStats.linesAdded += commit.stats?.additions || 0;
    contributorStats.linesRemoved += commit.stats?.deletions || 0;
    if (!contributorStats.activeRepositories.includes(repoId)) {
      contributorStats.activeRepositories.push(repoId);
    }

    // Update overall stats
    existingStats.overall.totalCommits++;
    existingStats.overall.linesAdded += commit.stats?.additions || 0;
    existingStats.overall.linesRemoved += commit.stats?.deletions || 0;
  }

  // Process new pull request
  if (newPullRequest) {
    const repoId = newPullRequest.repository;
    const userId = newPullRequest.user.id.toString();

    // Update repository stats
    if (!existingStats.repositories[repoId]) {
      existingStats.repositories[repoId] = {
        name: newPullRequest.repository,
        commits: 0,
        totalPrs: 0,
        mergedPrs: 0,
        linesAdded: 0,
        linesRemoved: 0,
        activeContributors: 0
      };
    }
    const repoStats = existingStats.repositories[repoId];
    repoStats.totalPrs++;
    if (newPullRequest.merged) {
      repoStats.mergedPrs++;
    }
    repoStats.linesAdded += newPullRequest.additions;
    repoStats.linesRemoved += newPullRequest.deletions;

    // Update contributor stats
    if (!existingStats.contributors[userId]) {
      existingStats.contributors[userId] = {
        login: newPullRequest.user.login,
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
    const contributorStats = existingStats.contributors[userId];
    contributorStats.totalPrs++;
    if (newPullRequest.merged) {
      contributorStats.mergedPrs++;
    }
    contributorStats.linesAdded += newPullRequest.additions;
    contributorStats.linesRemoved += newPullRequest.deletions;
    if (!contributorStats.activeRepositories.includes(repoId)) {
      contributorStats.activeRepositories.push(repoId);
    }

    // Update overall stats
    existingStats.overall.totalPrs++;
    if (newPullRequest.merged) {
      existingStats.overall.mergedPrs++;
    }
    existingStats.overall.linesAdded += newPullRequest.additions;
    existingStats.overall.linesRemoved += newPullRequest.deletions;
  }

  // Update active contributors count and recalculate scores
  existingStats.overall.activeContributors = Object.keys(existingStats.contributors).length;
  
  // Calculate contribution scores
  const allContributorStats = Object.entries(existingStats.contributors).map(([userId, stats]) => ({
    githubUserId: userId,
    ...stats,  // stats already includes login
    tabs: stats.tabs || 0,
    premiumRequests: stats.premiumRequests || 0
  }));
  const scores = calculateContributorScores(allContributorStats);
  
  // Update contributor scores
  Object.entries(existingStats.contributors).forEach(([userId, stats]) => {
    stats.contributionScore = scores[userId]?.score || 0;
  });

  // Calculate average contribution score
  const scoreValues = Object.values(scores as { [key: string]: { score: number } }).map(s => s.score);
  existingStats.overall.averageContributionScore = 
    scoreValues.length > 0 ? scoreValues.reduce((a, b) => a + b) / scoreValues.length : 0;

  // Update the month record
  await prisma.month.upsert({
    where: {
      teamId_date: {
        teamId,
        date: startOfMonth
      }
    },
    create: {
      teamId,
      date: startOfMonth,
      stats: existingStats
    },
    update: {
      stats: existingStats
    }
  });
}

// Create commit record
async function createCommit(commit: GitHubCommit, repoId: string, authorId: string) {
  return prisma.commit.create({
    data: {
      githubCommitId: commit.id,
      message: commit.message,
      linesAdded: commit.stats?.additions || 0,
      linesDeleted: commit.stats?.deletions || 0,
      committedAt: new Date(commit.timestamp),
      url: GITHUB_ORG ? `https://github.com/${GITHUB_ORG}/${commit.repository}/commit/${commit.sha}` : null,
      repoId: repoId,
      authorId: authorId
    }
  });
}

// Create or update pull request record
async function createOrUpdatePullRequest(pr: GitHubPullRequest, repoId: string, authorId: string) {
  return prisma.pullRequest.upsert({
    where: { githubPrId: pr.id },
    create: {
      githubPrId: pr.id,
      title: pr.title,
      description: pr.body || '',
      status: toPrStatus(pr.state, pr.merged),
      isDraft: pr.draft,
      isMerged: pr.merged,
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
      openedAt: new Date(pr.created_at),
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
      url: GITHUB_ORG ? `https://github.com/${GITHUB_ORG}/${pr.repository}/pull/${pr.number}` : null,
      linesAdded: pr.additions || 0,
      linesDeleted: pr.deletions || 0,
      commits: pr.commits || 0,
      comments: (pr.comments || 0) + (pr.review_comments || 0),
      reviews: pr.review_comments || 0,
      authorId: authorId,
      repoId: repoId
    },
    update: {
      status: toPrStatus(pr.state, pr.merged),
      isDraft: pr.draft,
      isMerged: pr.merged,
      openedAt: new Date(pr.created_at),
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
      url: GITHUB_ORG ? `https://github.com/${GITHUB_ORG}/${pr.repository}/pull/${pr.number}` : null,
      linesAdded: pr.additions || 0,
      linesDeleted: pr.deletions || 0,
      commits: pr.commits || 0,
      comments: (pr.comments || 0) + (pr.review_comments || 0),
      reviews: pr.review_comments || 0
    }
  });
}

export interface Env {
  GITHUB_WEBHOOK_SECRET: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Instead of augmenting the module, create an interface for the expected function
interface ContributorStats {
  githubUserId: string;
  login: string;
  totalCommits: number;
  totalPrs: number;
  mergedPrs: number;
  linesAdded: number;
  linesRemoved: number;
  activeRepositories: string[];
  contributionScore: number;
  tabs: number;
  premiumRequests: number;
}

interface ContributorScores {
  [key: string]: { score: number };
}

// Import the function and type it
const calculateContributorScores = _calculateContributorScores as (contributors: ContributorStats[]) => ContributorScores;

// Add interface for Prisma error
interface PrismaError {
  code: string;
  [key: string]: unknown;
}

// Fetch full commit data including stats
async function fetchCommitDetails(owner: string, repo: string, sha: string) {
  try {
    const response = await octokit.repos.getCommit({
      owner,
      repo,
      ref: sha
    });
    
    const commitData = response.data;
    return {
      id: sha, // Required by GitHubCommit type
      sha,
      message: commitData.commit?.message || '',
      author: {
        id: commitData.author?.id,
        username: commitData.author?.login || '',
        name: commitData.commit?.author?.name || commitData.author?.login || '',
        avatar_url: commitData.author?.avatar_url
      },
      date: commitData.commit?.author?.date || new Date().toISOString(),
      stats: {
        additions: commitData.stats?.additions || 0,
        deletions: commitData.stats?.deletions || 0
      }
    };
  } catch (error) {
    console.error(`Failed to fetch commit details for ${sha}:`, error);
    return null;
  }
}

// Fetch full PR data including stats
async function fetchPullRequestDetails(owner: string, repo: string, number: number) {
  try {
    const response = await octokit.pulls.get({
      owner,
      repo,
      pull_number: number
    });
    
    const prData = response.data;
    return {
      id: prData.id,
      number: prData.number,
      title: prData.title,
      state: prData.state as PrStatus,
      draft: prData.draft || false,
      merged: prData.merged,
      created_at: prData.created_at,
      merged_at: prData.merged_at,
      closed_at: prData.closed_at,
      head: { ref: prData.head.ref },
      base: { ref: prData.base.ref },
      repository: repo,
      user: {
        id: prData.user?.id || 0,
        login: prData.user?.login || '',
        name: prData.user?.name || prData.user?.login || '',
        avatar_url: prData.user?.avatar_url || ''
      },
      additions: prData.additions || 0,
      deletions: prData.deletions || 0,
      commits: prData.commits || 0,
      comments: prData.comments || 0,
      review_comments: prData.review_comments || 0
    } as GitHubPullRequest;
  } catch (error) {
    console.error(`Failed to fetch PR details for #${number}:`, error);
    return null;
  }
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let deliveryId: string | null = null;
    
    try {
      const payload = await request.text();
      const signature = request.headers.get('x-hub-signature-256');
      const event = request.headers.get('x-github-event');
      deliveryId = request.headers.get('x-github-delivery');
      
      if (!env.GITHUB_WEBHOOK_SECRET || !signature || !verifySignature(payload, signature, env.GITHUB_WEBHOOK_SECRET)) {
        console.error('Invalid webhook signature');
        return new Response('Invalid signature', { status: 401 });
      }

      const data = JSON.parse(payload);
      const owner = data.repository.owner.login;
      const repoName = data.repository.name;
      
      // Get or create team
      const team = await getOrCreateTeam(
        data.repository.owner.id,
        owner
      );
      const teamId = team.id;

      // Get or create repository
      const repo = await getOrCreateRepo(
        teamId,
        repoName,
        data.repository.id.toString(),
        data.repository.html_url
      );
      
      // Variables used across switch cases
      const commits: GitHubCommit[] = [];
      let action = '';
      const pr: GitHubPullRequest | null = null;
      const contributor: Awaited<ReturnType<typeof getOrCreateContributor>> | null = null;
      let eventType: EventType;
      const prRecord: Awaited<ReturnType<typeof prisma.pullRequest.upsert>> | null = null;
      
      // Process webhook event
      switch (event) {
        case 'push': {
          action = 'push';
          const commits: GitHubCommit[] = [];
          
          for (const commit of data.commits) {
            const fullCommit = await fetchCommitDetails(owner, repoName, commit.id);
            if (!fullCommit || !fullCommit.author?.id) continue;

            commits.push({
              ...fullCommit,
              repository: repoName,
              timestamp: commit.timestamp
            });

            // Create commit record
            const contributor = await getOrCreateContributor(
              teamId,
              fullCommit.author.id.toString(),
              fullCommit.author.username || '',
              fullCommit.author.name || fullCommit.author.username || '',
              fullCommit.author.avatar_url
            );
            if (!contributor) continue;

            await prisma.commit.upsert({
              where: { githubCommitId: fullCommit.sha },
              create: {
                githubCommitId: fullCommit.sha,
                message: fullCommit.message,
                linesAdded: fullCommit.stats.additions,
                linesDeleted: fullCommit.stats.deletions,
                committedAt: new Date(fullCommit.date),
                url: `https://github.com/${owner}/${repoName}/commit/${fullCommit.sha}`,
                repoId: repo.id,
                authorId: contributor.id
              },
              update: {
                message: fullCommit.message,
                linesAdded: fullCommit.stats.additions,
                linesDeleted: fullCommit.stats.deletions,
                committedAt: new Date(fullCommit.date),
                url: `https://github.com/${owner}/${repoName}/commit/${fullCommit.sha}`,
                repoId: repo.id,
                authorId: contributor.id
              }
            });
          }

          // Update monthly stats with new commits
          if (commits.length > 0) {
            await updateMonthStats(teamId, new Date(commits[0].timestamp), commits);
          }
          break;
        }
          
        case 'pull_request': {
          action = data.action;
          const fullPR = await fetchPullRequestDetails(owner, repoName, data.pull_request.number);
          if (!fullPR || !fullPR.user?.id) break;

          const contributor = await getOrCreateContributor(
            teamId,
            fullPR.user.id.toString(),
            fullPR.user.login,
            fullPR.user.name || fullPR.user.login,
            fullPR.user.avatar_url
          );
          if (!contributor) break;

          await prisma.pullRequest.upsert({
            where: { githubPrId: fullPR.number },
            create: {
              githubPrId: fullPR.number,
              title: fullPR.title,
              description: data.pull_request.body || '',
              status: fullPR.merged ? 'MERGED' : fullPR.state === 'closed' ? 'CLOSED' : 'OPEN',
              isDraft: fullPR.draft,
              isMerged: fullPR.merged,
              sourceBranch: fullPR.head.ref,
              targetBranch: fullPR.base.ref,
              openedAt: new Date(fullPR.created_at),
              mergedAt: fullPR.merged_at ? new Date(fullPR.merged_at) : null,
              closedAt: fullPR.closed_at ? new Date(fullPR.closed_at) : null,
              url: `https://github.com/${owner}/${repoName}/pull/${fullPR.number}`,
              linesAdded: fullPR.additions || 0,
              linesDeleted: fullPR.deletions || 0,
              commits: fullPR.commits || 0,
              comments: (fullPR.comments || 0) + (fullPR.review_comments || 0),
              reviews: fullPR.review_comments || 0,
              authorId: contributor.id,
              repoId: repo.id
            },
            update: {
              status: fullPR.merged ? 'MERGED' : fullPR.state === 'closed' ? 'CLOSED' : 'OPEN',
              isDraft: fullPR.draft,
              isMerged: fullPR.merged,
              openedAt: new Date(fullPR.created_at),
              mergedAt: fullPR.merged_at ? new Date(fullPR.merged_at) : null,
              closedAt: fullPR.closed_at ? new Date(fullPR.closed_at) : null,
              url: `https://github.com/${owner}/${repoName}/pull/${fullPR.number}`,
              linesAdded: fullPR.additions || 0,
              linesDeleted: fullPR.deletions || 0,
              commits: fullPR.commits || 0,
              comments: (fullPR.comments || 0) + (fullPR.review_comments || 0),
              reviews: fullPR.review_comments || 0
            }
          });

          // Update monthly stats with new PR
          await updateMonthStats(teamId, new Date(), [], fullPR);
          break;
        }
      }

      return new Response('Webhook processed', { status: 200 });
    } catch (error: unknown) {
      const isPrismaError = (err: unknown): err is PrismaError => 
        typeof err === 'object' && err !== null && 'code' in err;

      if (isPrismaError(error) && error.code === 'P2002') {
        // Not an error - just a duplicate event
        console.log('Skipping duplicate event:', deliveryId);
      } else {
        // Log actual errors but still return 200
        console.error('Error processing webhook:', error);
      }
      return new Response('Webhook received', { status: 200 });
    }
  }
};

export default worker;

// Keep the handleWebhook export for Vite development server
export const handleWebhook = async (request: Request, env: Env) => {
  return worker.fetch(request, env, {
    waitUntil: () => {},
    passThroughOnException: () => {}
  });
};
