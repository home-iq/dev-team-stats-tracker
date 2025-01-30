import { PrismaClient, EventType, PrStatus } from '@prisma/client';
import { calculateContributorScores as _calculateContributorScores } from '../scripts/utils/calculate-scores.js';
import { Octokit } from '@octokit/rest';

const prisma = new PrismaClient();

export interface Env {
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_KEY: string;
}

interface GitHubCommit {
  id: string;
  sha: string;
  message: string;
  repository: string;
  author: {
    id: number;
    username: string;
    name: string;
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

// Verify GitHub webhook signature using Web Crypto API
const verifySignature = async (payload: string, signature: string, secret: string) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signedMessage = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  const expectedSignature = 'sha256=' + Array.from(new Uint8Array(signedMessage))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return expectedSignature === signature;
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
async function createCommit(commit: GitHubCommit, repoId: string, authorId: string, orgName: string) {
  return prisma.commit.create({
    data: {
      githubCommitId: commit.id,
      message: commit.message,
      linesAdded: commit.stats?.additions || 0,
      linesDeleted: commit.stats?.deletions || 0,
      committedAt: new Date(commit.timestamp),
      url: `https://github.com/${orgName}/${commit.repository}/commit/${commit.sha}`,
      repoId: repoId,
      authorId: authorId
    }
  });
}

// Create or update pull request record
async function createOrUpdatePullRequest(pr: GitHubPullRequest, repoId: string, authorId: string, orgName: string) {
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
      url: `https://github.com/${orgName}/${pr.repository}/pull/${pr.number}`,
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
      url: `https://github.com/${orgName}/${pr.repository}/pull/${pr.number}`,
      linesAdded: pr.additions || 0,
      linesDeleted: pr.deletions || 0,
      commits: pr.commits || 0,
      comments: (pr.comments || 0) + (pr.review_comments || 0),
      reviews: pr.review_comments || 0
    }
  });
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

// Helper function to check if an error is a Prisma error
function isPrismaError(err: unknown): err is PrismaError {
  return typeof err === 'object' && err !== null && 'code' in err;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const octokit = new Octokit({
      auth: env.GITHUB_KEY
    });

    // Helper functions that need access to octokit
    async function fetchCommitDetails(owner: string, repo: string, sha: string) {
      try {
        const response = await octokit.repos.getCommit({
          owner,
          repo,
          ref: sha
        });
        
        const commitData = response.data;
        const username = commitData.author?.login || commitData.commit?.author?.name || 'unknown';
        const name = commitData.commit?.author?.name || username;
        
        return {
          id: sha,
          sha,
          message: commitData.commit?.message || '',
          repository: repo,
          author: {
            id: commitData.author?.id || 0,
            username,
            name,
            avatar_url: commitData.author?.avatar_url
          },
          timestamp: commitData.commit?.author?.date || new Date().toISOString(),
          stats: {
            additions: commitData.stats?.additions || 0,
            deletions: commitData.stats?.deletions || 0
          }
        } as GitHubCommit;
      } catch (error) {
        console.error(`Failed to fetch commit details for ${sha}:`, error);
        return null;
      }
    }

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

    // Main webhook processing logic
    try {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      const payload = await request.text();
      const signature = request.headers.get('x-hub-signature-256') || '';

      if (!await verifySignature(payload, signature, env.GITHUB_WEBHOOK_SECRET)) {
        return new Response('Invalid signature', { status: 401 });
      }

      const event = request.headers.get('x-github-event');
      const data = JSON.parse(payload);

      // Log incoming webhook data for debugging
      console.log('Received webhook event:', event);
      console.log('Webhook payload:', JSON.stringify(data, null, 2));

      // For non-push/pull_request events, just acknowledge receipt
      if (!['push', 'pull_request'].includes(event || '') || !data.repository?.owner?.login) {
        return new Response('Webhook received', { status: 200 });
      }

      const orgName = data.repository.owner.login;

      // Process the webhook event
      switch (event) {
        case 'push': {
          // Process push event
          const repoName = data.repository.name;
          const repoId = data.repository.id.toString();
          
          // Get or create team
          const team = await getOrCreateTeam(data.repository.owner.id, orgName);
          
          // Get or create repo
          const repo = await getOrCreateRepo(
            team.id,
            repoName,
            repoId,
            data.repository.html_url
          );

          // Collect all commit details first
          const processedCommits: GitHubCommit[] = [];
          
          // Process each commit
          for (const commit of data.commits) {
            const commitDetails = await fetchCommitDetails(orgName, repoName, commit.id);
            if (!commitDetails?.author?.id) continue;

            const contributor = await getOrCreateContributor(
              team.id,
              commitDetails.author.id.toString(),
              commitDetails.author.username,
              commitDetails.author.name || commitDetails.author.username || 'Unknown User'
            );

            await createCommit(commitDetails, repo.id, contributor.id, orgName);
            processedCommits.push(commitDetails);
          }

          // Update monthly stats once with all commits
          if (processedCommits.length > 0) {
            const firstCommitDate = new Date(processedCommits[0].timestamp);
            await updateMonthStats(team.id, firstCommitDate, processedCommits);
          }
          break;
        }

        case 'pull_request': {
          // Process pull request event
          const repoName = data.repository.name;
          const repoId = data.repository.id.toString();
          
          // Get or create team
          const team = await getOrCreateTeam(data.repository.owner.id, orgName);
          
          // Get or create repo
          const repo = await getOrCreateRepo(
            team.id,
            repoName,
            repoId,
            data.repository.html_url
          );

          const prDetails = await fetchPullRequestDetails(orgName, repoName, data.pull_request.number);
          if (!prDetails?.user?.id) break;

          const contributor = await getOrCreateContributor(
            team.id,
            prDetails.user.id.toString(),
            prDetails.user.login,
            prDetails.user.name || prDetails.user.login,
            prDetails.user.avatar_url
          );

          await createOrUpdatePullRequest(prDetails, repo.id, contributor.id, orgName);
          
          // Update monthly stats
          await updateMonthStats(team.id, new Date(prDetails.created_at), [], prDetails);
          break;
        }

        default:
          return new Response(`Event type ${event} not supported`, { status: 400 });
      }

      return new Response('OK');
    } catch (err) {
      console.error('Error processing webhook:', err);
      
      // Handle Prisma errors specially
      if (isPrismaError(err)) {
        return new Response(`Database error: ${err.code}`, { status: 500 });
      }
      
      return new Response('Internal server error', { status: 500 });
    }
  }
};

export default worker;

// Export handleWebhook for Vite development
export const handleWebhook = async (request: Request, env: Env) => {
  return worker.fetch(request, env, {
    waitUntil: () => {},
    passThroughOnException: () => {}
  });
};

interface PagesContext {
  request: Request;
  env: Env;
  params: { [key: string]: string };
}

// Export the onRequest handler for Cloudflare Pages Functions
export const onRequest = async (context: PagesContext) => {
  const { request, env } = context;
  return handleWebhook(request, env);
};
