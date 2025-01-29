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
}

interface ContributorScores {
  [key: string]: { score: number };
}

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
  repository: string;
}

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  merged: boolean;
  additions?: number;
  deletions?: number;
  commits?: number;
  comments?: number;
  review_comments?: number;
  user?: {
    id: number;
    login: string;
    name?: string;
    avatar_url?: string;
  };
  repository: string;
}

interface RepoStats {
  totalCommits: number;
  totalPrs: number;
  mergedPrs: number;
  linesAdded: number;
  linesRemoved: number;
  activeContributors: string[];
}

export function calculateContributorScores(contributors: ContributorStats[]): ContributorScores;
export function getContributorScore(contributor: ContributorStats, maxValues: Record<string, number>): number;
export function calculateRepoStats(commits: GitHubCommit[], prs: GitHubPullRequest[]): RepoStats; 
