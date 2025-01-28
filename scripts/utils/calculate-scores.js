// Calculate contribution scores for all contributors
export function calculateContributorScores(contributorStats) {
  // Weights for each metric
  const weights = {
    loc: 0.50,           // Lines of code
    mergedPRs: 0.10,     // Merged Pull Requests
    commits: 0.10,       // Total commits
    tabs: 0.10,          // Total tabs
    premiumRequests: 0.20 // Total premium requests
  };

  // Find maximum values across all contributors
  const maxValues = {
    loc: Math.max(...contributorStats.map(s => s.linesAdded + s.linesRemoved)),
    mergedPRs: Math.max(...contributorStats.map(s => s.mergedPullRequests)),
    commits: Math.max(...contributorStats.map(s => s.totalCommits)),
    tabs: Math.max(...contributorStats.map(s => s.tabs || 0)),
    premiumRequests: Math.max(...contributorStats.map(s => s.premiumRequests || 0))
  };

  // Calculate scores for all contributors
  return contributorStats.reduce((scores, { githubUserId, login, ...stats }) => {
    // Calculate normalized values
    const normalized = {
      loc: maxValues.loc ? (stats.linesAdded + stats.linesRemoved) / maxValues.loc : 0,
      mergedPRs: maxValues.mergedPRs ? stats.mergedPullRequests / maxValues.mergedPRs : 0,
      commits: maxValues.commits ? stats.totalCommits / maxValues.commits : 0,
      tabs: maxValues.tabs ? (stats.tabs || 0) / maxValues.tabs : 0,
      premiumRequests: maxValues.premiumRequests ? (stats.premiumRequests || 0) / maxValues.premiumRequests : 0
    };

    // Calculate weighted score
    const score = 
      (weights.loc * normalized.loc) +
      (weights.mergedPRs * normalized.mergedPRs) +
      (weights.commits * normalized.commits) +
      (weights.tabs * normalized.tabs) +
      (weights.premiumRequests * normalized.premiumRequests);

    // Add score to results, keyed by githubUserId
    scores[githubUserId] = {
      score: Math.round(score * 100),
      login  // Keep track of current login
    };
    return scores;
  }, {});
}

// Helper to get a single contributor's score from the calculated scores
export function getContributorScore(scores, githubUserId) {
  return scores[githubUserId]?.score || 0;
}

// Calculate repository statistics from commits and pull requests
export function calculateRepoStats(commits, pullRequests) {
  const contributors = {};
  const totals = {
    commits: 0,
    pullRequests: 0,
    mergedPullRequests: 0,
    linesAdded: 0,
    linesRemoved: 0,
    activeContributors: 0
  };

  // Process commits
  commits.forEach(commit => {
    if (!commit.authorGithubUserId) return; // Skip commits without GitHub user ID

    totals.commits++;
    totals.linesAdded += commit.stats.additions;
    totals.linesRemoved += commit.stats.deletions;

    if (!contributors[commit.authorGithubUserId]) {
      contributors[commit.authorGithubUserId] = {
        githubUserId: commit.authorGithubUserId,
        login: commit.authorLogin,
        commits: 0,
        pullRequests: 0,
        mergedPullRequests: 0,
        linesAdded: 0,
        linesRemoved: 0
      };
    }

    contributors[commit.authorGithubUserId].commits++;
    contributors[commit.authorGithubUserId].linesAdded += commit.stats.additions;
    contributors[commit.authorGithubUserId].linesRemoved += commit.stats.deletions;
  });

  // Process pull requests
  pullRequests.forEach(pr => {
    if (!pr.authorGithubUserId) return; // Skip PRs without GitHub user ID

    totals.pullRequests++;
    if (pr.merged) totals.mergedPullRequests++;

    if (!contributors[pr.authorGithubUserId]) {
      contributors[pr.authorGithubUserId] = {
        githubUserId: pr.authorGithubUserId,
        login: pr.authorLogin,
        commits: 0,
        pullRequests: 0,
        mergedPullRequests: 0,
        linesAdded: 0,
        linesRemoved: 0
      };
    }

    contributors[pr.authorGithubUserId].pullRequests++;
    if (pr.merged) contributors[pr.authorGithubUserId].mergedPullRequests++;
  });

  // Calculate active contributors
  totals.activeContributors = Object.keys(contributors).length;

  // Convert contributors object to array with IDs and logins included
  const contributorsArray = Object.entries(contributors).map(([githubUserId, stats]) => ({
    githubUserId,
    ...stats
  }));

  return { contributors: contributorsArray, totals };
} 
