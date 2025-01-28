# GitHub Stats Sync Script

This script syncs GitHub activity data (commits, pull requests, and contributor stats) for your organization and stores it in the database.

## Prerequisites

- Node.js 18 or higher
- A GitHub Personal Access Token with `repo` scope
- Environment variables set up in `.env`:
  ```
  GITHUB_KEY=your_github_token
  GITHUB_ORG=your_organization_name
  DATABASE_URL=your_database_url
  ```

## Usage

You can run the script using npm from the project root:

```bash
npm run sync -- --start-date YYYY-MM --months N [--force]
```

Or directly using node:

```bash
node scripts/sync-github.js --start-date YYYY-MM --months N [--force]
```

### Arguments

- `--start-date` (required): The month to start syncing from (format: YYYY-MM)
- `--months` (required): Number of months to process
- `--force` (optional): Ignore saved progress state and start fresh

### Examples

```bash
# Sync the last 3 months
npm run sync -- --start-date 2024-01 --months 3

# Sync a specific month
npm run sync -- --start-date 2023-12 --months 1

# Force sync ignoring previous progress
npm run sync -- --start-date 2024-01 --months 1 --force
```

## Features

- Fetches and stores:
  - Commits (messages, stats, authors)
  - Pull requests (title, description, status, stats)
  - Contributor information (GitHub IDs, logins, avatars)
  - Repository details (GitHub IDs, names, URLs)

- Robust Data Model:
  - Uses permanent GitHub IDs as keys
  - Stores friendly names (repo names, user logins) for display
  - Tracks repository and contributor relationships
  - Maintains historical data integrity

- Monthly Statistics:
  - Lines of code added/removed
  - Total and merged pull requests
  - Commit counts
  - Active contributors per repository
  - Contribution scores calculated from:
    - Lines of code (50%)
    - Merged pull requests (10%)
    - Commits (10%)
    - Tabs (10%)
    - Premium requests (20%)
  - Preserves existing tabs and premium requests

- GitHub API Integration:
  - Handles rate limits with automatic waiting
  - Paginates through results (100 records per page)
  - Efficient data fetching with date filtering

- Progress and Recovery:
  - Saves progress state for resumability
  - Tracks completed repositories
  - Preserves API rate limit status
  - Supports force sync when needed

## Progress Tracking

The script maintains a progress state file at `.cache/github-sync-state.json` which tracks:
- Last successful month processed
- Completed repositories
- Current repository
- GitHub API rate limit status

Progress is automatically saved after each repository is processed, allowing the script to resume if interrupted.

## Output

The script provides detailed statistics for:
- Each repository (commits, PRs, contributors)
- Overall monthly totals
- Contributor scores and rankings
- Lines of code added/removed
- API calls remaining

All output is logged to timestamped files in the `logs` directory for future reference, including:
- Command execution details
- API call counts and rate limits
- Repository processing status
- Detailed statistics
- Errors and warnings

## Error Handling

- Automatically retries failed operations (max 2 retries)
- Waits for rate limit resets
- Preserves progress on interruption
- Detailed error messages for troubleshooting 