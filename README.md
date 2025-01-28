# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/17e07e8f-c0df-43b0-86bd-dab5e51bf831

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
  DIRECT_URL=your_direct_database_url
  GITHUB_WEBHOOK_SECRET=your_webhook_secret
  ```

## GitHub Webhook Setup

The application includes a webhook endpoint that automatically processes GitHub events in real-time:

1. Go to your GitHub organization settings
2. Navigate to Webhooks
3. Add a new webhook:
   - Payload URL: `https://your-domain.com/github-webhook`
   - Content type: `application/json`
   - Secret: Same value as your `GITHUB_WEBHOOK_SECRET`
   - Events: Select `Push` and `Pull requests`

The webhook will automatically:
- Process new commits and pull requests
- Create/update contributor records
- Update monthly statistics
- Track contribution scores

## Manual Sync Script Usage

You can also run the sync script manually to process historical data:

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

- Real-time webhook processing of GitHub events
- Historical data sync with progress tracking
- Calculates contribution scores based on:
  - Lines of code (50%)
  - Merged pull requests (10%)
  - Commits (10%)
  - Tabs (10%)
  - Premium requests (20%)
- Handles GitHub API rate limits
- Preserves existing tabs and premium requests

## Deployment

The application is designed to be deployed to Cloudflare Pages with Functions:

1. Connect your repository to Cloudflare Pages
2. Set up the required environment variables in Cloudflare Pages settings
3. The webhook endpoint will be automatically created at `/github-webhook`

## Error Handling

- Automatically retries failed operations
- Waits for rate limit resets
- Preserves progress on interruption
- Detailed error messages for troubleshooting

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/17e07e8f-c0df-43b0-86bd-dab5e51bf831) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with .

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/17e07e8f-c0df-43b0-86bd-dab5e51bf831) and click on Share -> Publish.

## I want to use a custom domain - is that possible?

We don't support custom domains (yet). If you want to deploy your project under your own domain then we recommend using Netlify. Visit our docs for more details: [Custom domains](https://docs.lovable.dev/tips-tricks/custom-domain/)
