interface Contributor {
  tabs: number;
  login: string;
  totalPrs: number;
  mergedPrs: number;
  linesAdded: number;
  githubUserId?: string;
  linesRemoved: number;
  totalCommits: number;
  premiumRequests: number;
  contributionScore: number;
  activeRepositories: string[];
}

interface ContributorsData {
  overall: {
    totalPrs: number;
    mergedPrs: number;
    linesAdded: number;
    linesRemoved: number;
    totalCommits: number;
    averageContributionScore: number;
  };
  contributors: {
    [key: string]: Contributor;
  };
}

export const contributorsData: ContributorsData = {
  "overall": {
    "totalPrs": 226,
    "mergedPrs": 200,
    "linesAdded": 264678,
    "linesRemoved": 261166,
    "totalCommits": 422,
    "averageContributionScore": 10.70588235294118
  },
  "contributors": {
    "4027": {
      "tabs": 0,
      "login": "jonthewayne",
      "totalPrs": 1,
      "mergedPrs": 1,
      "linesAdded": 29679,
      "githubUserId": "4027",
      "linesRemoved": 13059,
      "totalCommits": 87,
      "premiumRequests": 0,
      "contributionScore": 21,
      "activeRepositories": ["921981167"]
    },
    "1223640": {
      "tabs": 0,
      "login": "ekondr",
      "totalPrs": 24,
      "mergedPrs": 21,
      "linesAdded": 72891,
      "githubUserId": "1223640",
      "linesRemoved": 123360,
      "totalCommits": 20,
      "premiumRequests": 0,
      "contributionScore": 52,
      "activeRepositories": ["126354520", "490581816"]
    },
    "1882362": {
      "tabs": 0,
      "login": "iYasya",
      "totalPrs": 16,
      "mergedPrs": 14,
      "linesAdded": 7213,
      "githubUserId": "1882362",
      "linesRemoved": 879,
      "totalCommits": 15,
      "premiumRequests": 0,
      "contributionScore": 4,
      "activeRepositories": ["126354520", "490581816"]
    },
    "9272724": {
      "tabs": 0,
      "login": "SavenkoSy",
      "totalPrs": 10,
      "mergedPrs": 7,
      "linesAdded": 8481,
      "githubUserId": "9272724",
      "linesRemoved": 2778,
      "totalCommits": 26,
      "premiumRequests": 0,
      "contributionScore": 6,
      "activeRepositories": ["126354520", "490581816", "846563116"]
    },
    "11525376": {
      "tabs": 0,
      "login": "pavlofilchuk",
      "totalPrs": 18,
      "mergedPrs": 18,
      "linesAdded": 843,
      "githubUserId": "11525376",
      "linesRemoved": 1377,
      "totalCommits": 28,
      "premiumRequests": 0,
      "contributionScore": 4,
      "activeRepositories": ["124906544", "130052716"]
    },
    "15979348": {
      "tabs": 0,
      "login": "AlexOrd",
      "totalPrs": 0,
      "mergedPrs": 0,
      "linesAdded": 20,
      "githubUserId": "15979348",
      "linesRemoved": 30,
      "totalCommits": 1,
      "premiumRequests": 0,
      "contributionScore": 0,
      "activeRepositories": ["130052716"]
    },
    "19485804": {
      "tabs": 0,
      "login": "scage13",
      "totalPrs": 15,
      "mergedPrs": 12,
      "linesAdded": 42450,
      "githubUserId": "19485804",
      "linesRemoved": 37546,
      "totalCommits": 20,
      "premiumRequests": 0,
      "contributionScore": 23,
      "activeRepositories": ["130052716", "160214106"]
    },
    "22295720": {
      "tabs": 0,
      "login": "Rubyist007",
      "totalPrs": 23,
      "mergedPrs": 17,
      "linesAdded": 16016,
      "githubUserId": "22295720",
      "linesRemoved": 7417,
      "totalCommits": 22,
      "premiumRequests": 0,
      "contributionScore": 8,
      "activeRepositories": ["126354520", "306047601", "490581816"]
    },
    "22976609": {
      "tabs": 0,
      "login": "krymchuk",
      "totalPrs": 60,
      "mergedPrs": 60,
      "linesAdded": 21989,
      "githubUserId": "22976609",
      "linesRemoved": 25309,
      "totalCommits": 38,
      "premiumRequests": 0,
      "contributionScore": 16,
      "activeRepositories": ["124906544", "130052716", "160214106", "178194797", "253441214", "286662104"]
    },
    "27978300": {
      "tabs": 0,
      "login": "sarbash1994",
      "totalPrs": 6,
      "mergedPrs": 4,
      "linesAdded": 1374,
      "githubUserId": "27978300",
      "linesRemoved": 467,
      "totalCommits": 5,
      "premiumRequests": 0,
      "contributionScore": 1,
      "activeRepositories": ["635214262", "883645637"]
    },
    "31440971": {
      "tabs": 0,
      "login": "anko20094",
      "totalPrs": 3,
      "mergedPrs": 2,
      "linesAdded": 8613,
      "githubUserId": "31440971",
      "linesRemoved": 97,
      "totalCommits": 2,
      "premiumRequests": 0,
      "contributionScore": 2,
      "activeRepositories": ["490581816"]
    },
    "37705950": {
      "tabs": 0,
      "login": "Andrii-Okhrimets",
      "totalPrs": 19,
      "mergedPrs": 15,
      "linesAdded": 15788,
      "githubUserId": "37705950",
      "linesRemoved": 9288,
      "totalCommits": 41,
      "premiumRequests": 0,
      "contributionScore": 11,
      "activeRepositories": ["126354520"]
    },
    "44522601": {
      "tabs": 0,
      "login": "AsakuraRET",
      "totalPrs": 0,
      "mergedPrs": 0,
      "linesAdded": 85,
      "githubUserId": "44522601",
      "linesRemoved": 15,
      "totalCommits": 1,
      "premiumRequests": 0,
      "contributionScore": 0,
      "activeRepositories": ["126354520"]
    },
    "49200406": {
      "tabs": 0,
      "login": "kossrlive",
      "totalPrs": 30,
      "mergedPrs": 29,
      "linesAdded": 36085,
      "githubUserId": "49200406",
      "linesRemoved": 38439,
      "totalCommits": 52,
      "premiumRequests": 0,
      "contributionScore": 25,
      "activeRepositories": ["130052716", "160214106", "178194797", "245168513"]
    },
    "55700551": {
      "tabs": 0,
      "login": "sarbashd",
      "totalPrs": 0,
      "mergedPrs": 0,
      "linesAdded": 512,
      "githubUserId": "55700551",
      "linesRemoved": 189,
      "totalCommits": 16,
      "premiumRequests": 0,
      "contributionScore": 2,
      "activeRepositories": ["635214262", "883645637"]
    },
    "110468173": {
      "tabs": 0,
      "login": "KovalchukDmytr0",
      "totalPrs": 1,
      "mergedPrs": 0,
      "linesAdded": 2131,
      "linesRemoved": 687,
      "totalCommits": 0,
      "premiumRequests": 0,
      "contributionScore": 1,
      "activeRepositories": ["635214262"]
    },
    "124673687": {
      "tabs": 0,
      "login": "greng-for-loomlogic",
      "totalPrs": 0,
      "mergedPrs": 0,
      "linesAdded": 508,
      "githubUserId": "124673687",
      "linesRemoved": 229,
      "totalCommits": 48,
      "premiumRequests": 0,
      "contributionScore": 6,
      "activeRepositories": ["919492795"]
    }
  }
};

interface ContributorCard {
  login: string;
  avatar_url: string;
  totalCommits: number;
  totalPrs: number;
  activeRepositories: string[];
  linesOfCode: number;
  contributionScore: number;
  rank: number;
}

// Helper function to get sorted contributors by score
export const getSortedContributors = (): ContributorCard[] => {
  return Object.values(contributorsData.contributors)
    .sort((a, b) => b.contributionScore - a.contributionScore)
    .map((contributor, index) => ({
      login: contributor.login,
      avatar_url: `https://avatars.githubusercontent.com/u/${contributor.githubUserId || contributor.login}`,
      totalCommits: contributor.totalCommits,
      totalPrs: contributor.totalPrs,
      activeRepositories: [...contributor.activeRepositories],
      linesOfCode: contributor.linesAdded + contributor.linesRemoved,
      contributionScore: contributor.contributionScore,
      rank: index + 1,
    }));
}; 
