import { PrismaClient, EventType, PrStatus } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface GitHubCommit {
  id: string;
  sha: string;
  message: string;
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
  merged_at: string | null;
  closed_at: string | null;
  head: { ref: string };
  base: { ref: string };
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
  // Try to find existing team
  let team = await prisma.team.findUnique({
    where: { githubOrgId }
  });
  
  // Create if doesn't exist
  if (!team) {
    team = await prisma.team.create({
      data: { 
        githubOrgId: BigInt(githubOrgId),
        githubOrgName: orgName,
        name: orgName 
      }
    });
  }
  
  return team;
}

// Helper to convert GitHub PR state to PrStatus
function toPrStatus(state: string, merged: boolean): PrStatus {
  if (merged) return PrStatus.MERGED;
  return state.toUpperCase() === 'OPEN' ? PrStatus.OPEN : PrStatus.CLOSED;
}

// Update monthly stats for a given month
async function updateMonthStats(teamId: string, date: Date, newCommits: GitHubCommit[] = [], newPullRequest: GitHubPullRequest | null = null) {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  
  // Get existing month record
  const monthRecord = await prisma.month.findUnique({
    where: {
      teamId_date: {
        teamId,
        date: startOfMonth
      }
    }
  });

  // Calculate stats from new commits
  const commitStats = newCommits.reduce((acc, commit) => ({
    linesAdded: acc.linesAdded + (commit.stats?.additions || 0),
    linesDeleted: acc.linesDeleted + (commit.stats?.deletions || 0),
    totalCommits: acc.totalCommits + 1
  }), { linesAdded: 0, linesDeleted: 0, totalCommits: 0 });

  // Calculate PR stats if a new PR is provided
  const prStats = newPullRequest ? {
    totalPrs: 1,
    openPrs: newPullRequest.state.toUpperCase() === 'OPEN' ? 1 : 0,
    mergedPrs: newPullRequest.merged ? 1 : 0,
    closedPrs: newPullRequest.state.toUpperCase() === 'CLOSED' && !newPullRequest.merged ? 1 : 0,
    prLinesAdded: newPullRequest.additions,
    prLinesDeleted: newPullRequest.deletions,
    prComments: newPullRequest.comments + newPullRequest.review_comments
  } : {
    totalPrs: 0,
    openPrs: 0,
    mergedPrs: 0,
    closedPrs: 0,
    prLinesAdded: 0,
    prLinesDeleted: 0,
    prComments: 0
  };

  // Get existing stats or use defaults
  const existingStats = monthRecord?.stats as {
    totalCommits: number;
    totalPrs: number;
    openPrs: number;
    mergedPrs: number;
    closedPrs: number;
    linesAdded: number;
    linesDeleted: number;
    prComments: number;
  } | null || {
    totalCommits: 0,
    totalPrs: 0,
    openPrs: 0,
    mergedPrs: 0,
    closedPrs: 0,
    linesAdded: 0,
    linesDeleted: 0,
    prComments: 0
  };

  // Create or update month record
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
      stats: {
        totalCommits: commitStats.totalCommits,
        totalPrs: prStats.totalPrs,
        openPrs: prStats.openPrs,
        mergedPrs: prStats.mergedPrs,
        closedPrs: prStats.closedPrs,
        linesAdded: commitStats.linesAdded + prStats.prLinesAdded,
        linesDeleted: commitStats.linesDeleted + prStats.prLinesDeleted,
        prComments: prStats.prComments
      }
    },
    update: {
      stats: {
        totalCommits: existingStats.totalCommits + commitStats.totalCommits,
        totalPrs: existingStats.totalPrs + prStats.totalPrs,
        openPrs: existingStats.openPrs + prStats.openPrs,
        mergedPrs: existingStats.mergedPrs + prStats.mergedPrs,
        closedPrs: existingStats.closedPrs + prStats.closedPrs,
        linesAdded: existingStats.linesAdded + commitStats.linesAdded + prStats.prLinesAdded,
        linesDeleted: existingStats.linesDeleted + commitStats.linesDeleted + prStats.prLinesDeleted,
        prComments: existingStats.prComments + prStats.prComments
      }
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

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      const payload = await request.text();
      const signature = request.headers.get('x-hub-signature-256');
      const event = request.headers.get('x-github-event');
      const deliveryId = request.headers.get('x-github-delivery');
      
      // Verify webhook secret
      if (!env.GITHUB_WEBHOOK_SECRET || !signature || !verifySignature(payload, signature, env.GITHUB_WEBHOOK_SECRET)) {
        return new Response('Invalid signature', { status: 401 });
      }

      const data = JSON.parse(payload);
      
      // Get or create team
      const team = await getOrCreateTeam(
        data.repository.owner.id,
        data.repository.owner.login
      );
      const teamId = team.id;

      // Get or create repository
      const repo = await getOrCreateRepo(
        teamId,
        data.repository.name,
        data.repository.id.toString(),
        data.repository.html_url
      );
      
      // Declare variables used in switch cases
      let commits: GitHubCommit[] = [];
      let action = '';
      let pr: GitHubPullRequest | null = null;
      let contributor: Awaited<ReturnType<typeof getOrCreateContributor>> | null = null;
      let eventType: EventType;
      let prRecord: Awaited<ReturnType<typeof prisma.pullRequest.upsert>> | null = null;
      
      switch (event) {
        case 'push':
          commits = (data.commits || []) as GitHubCommit[];
          for (const commit of commits) {
            // Skip if no author info or username
            if (!commit.author?.id || !commit.author.username) continue;

            // Get or create contributor
            contributor = await getOrCreateContributor(
              teamId,
              commit.author.id.toString(),
              commit.author.username,
              commit.author.name || commit.author.username,
              commit.author.avatar_url
            );

            if (!contributor) continue;

            // Create commit record
            const commitRecord = await prisma.commit.create({
              data: {
                githubCommitId: commit.id,
                message: commit.message,
                linesAdded: commit.stats?.additions || 0,
                linesDeleted: commit.stats?.deletions || 0,
                committedAt: new Date(commit.timestamp),
                repoId: repo.id,
                authorId: contributor.id
              }
            });

            // Create event record
            await prisma.event.create({
              data: {
                githubEventId: `${deliveryId}-${commit.id}`,
                type: EventType.COMMIT_PUSHED,
                details: {
                  message: commit.message,
                  linesAdded: commit.stats?.additions || 0,
                  linesDeleted: commit.stats?.deletions || 0
                },
                rawJson: JSON.stringify(commit),
                contributorId: contributor.id,
                repoId: repo.id
              }
            });
          }
          // Update monthly stats with new commits
          if (commits.length > 0) {
            await updateMonthStats(teamId, new Date(commits[0].timestamp), commits);
          }
          break;
          
        case 'pull_request':
          action = data.action;
          pr = data.pull_request as GitHubPullRequest;
          
          if (!pr?.user?.id) break;

          // Get or create contributor
          contributor = await getOrCreateContributor(
            teamId,
            pr.user.id.toString(),
            pr.user.login,
            pr.user.name || pr.user.login,
            pr.user.avatar_url
          );

          if (!contributor) break;

          // Determine event type
          switch (action) {
            case 'opened':
              eventType = EventType.PR_OPENED;
              break;
            case 'closed':
              eventType = pr.merged ? EventType.PR_MERGED : EventType.PR_CLOSED;
              break;
            case 'reopened':
              eventType = EventType.PR_REOPENED;
              break;
            default:
              return new Response('Unhandled PR action', { status: 200 });
          }

          // Create or update PR record
          prRecord = await prisma.pullRequest.upsert({
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
              mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
              closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
              linesAdded: pr.additions,
              linesDeleted: pr.deletions,
              commits: pr.commits,
              comments: pr.comments,
              reviews: pr.review_comments,
              authorId: contributor.id,
              repoId: repo.id
            },
            update: {
              status: toPrStatus(pr.state, pr.merged),
              isDraft: pr.draft,
              isMerged: pr.merged,
              mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
              closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
              linesAdded: pr.additions,
              linesDeleted: pr.deletions,
              commits: pr.commits,
              comments: pr.comments,
              reviews: pr.review_comments
            }
          });

          // Create event record
          await prisma.event.create({
            data: {
              githubEventId: `${deliveryId}-${pr.id}`,
              type: eventType,
              details: {
                title: pr.title,
                state: pr.state,
                merged: pr.merged,
                linesAdded: pr.additions,
                linesDeleted: pr.deletions,
                commits: pr.commits,
                comments: pr.comments + pr.review_comments
              },
              rawJson: JSON.stringify(pr),
              contributorId: contributor.id,
              repoId: repo.id,
              pullRequestId: prRecord.id
            }
          });

          // Update monthly stats with new PR
          await updateMonthStats(teamId, new Date(), [], pr);
          break;
      }

      return new Response('Webhook processed', { status: 200 });
    } catch (error) {
      console.error('Webhook error:', error);
      return new Response('Internal server error', { status: 500 });
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
