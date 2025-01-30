# Dev Team Stats Tracker

This application syncs GitHub activity data (commits, pull requests, and contributor stats) for your organization and stores it in the database. It provides real-time tracking via webhooks and historical data syncing capabilities.

## Prerequisites

- Node.js 22 or higher
- A GitHub Personal Access Token with `repo` scope
- Environment variables set up in `.env`:
  ```
  GITHUB_KEY=your_github_token
  GITHUB_ORG=your_organization_name
  GITHUB_WEBHOOK_SECRET=your_webhook_secret
  DATABASE_URL=your_database_url
  DIRECT_URL=your_direct_database_url
  ```

## Getting Started 

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables in `.env`
4. Start the development server:
   ```bash
   npm run dev
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

## Local Development with Cloudflare Pages Functions 

To develop and test the webhook functionality locally, we use Wrangler (Cloudflare's CLI tool) and ngrok for tunneling.

### Setup Wrangler

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Install Wrangler globally:
   ```bash
   npm install -g wrangler
   ```

3. Create a `.dev.vars` file in your project root with your environment variables

4. Start the development server:
   ```bash
   npm run dev:wrangler
   ```
   This will start both your Vite frontend and the Cloudflare Pages Functions environment.

### Setup ngrok for Webhook Testing

1. Sign up for a free ngrok account at https://dashboard.ngrok.com/signup

2. Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken

3. Install ngrok globally:
   ```bash
   npm install -g ngrok
   ```

4. Configure ngrok with your token:
   ```bash
   ngrok config add-authtoken your_auth_token_here
   ```

5. Start ngrok:
   ```bash
   ngrok http 8788
   ```

6. Copy the ngrok URL (e.g., `https://xxxx-xx-xx-xxx-xxx.ngrok.io`) and update your GitHub webhook settings:
   - Go to your repository/organization settings
   - Navigate to Webhooks
   - Update the Payload URL to: `https://xxxx-xx-xx-xxx-xxx.ngrok.io/github-webhook`

### Development Notes

- The webhook endpoint will be available at `http://localhost:8788/github-webhook` locally
- ngrok provides a web interface at `http://localhost:4040` to inspect webhook requests:
  - View real-time webhook payloads and responses
  - Inspect headers, query parameters, and request bodies
  - Replay requests for testing and debugging
  - View detailed timing information
  - Debug webhook delivery issues
- The ngrok URL changes each time you restart ngrok (unless you have a paid account)
- Remember to update the GitHub webhook URL when the ngrok URL changes
- Keep both the Wrangler server and ngrok running while testing webhooks

### Testing Webhooks

When developing webhook functionality:
1. Start your local development server (`npm run dev:wrangler`)
2. Start ngrok (`ngrok http 8788`)
3. Open the ngrok inspector at `http://localhost:4040`
4. Configure your GitHub webhook with the ngrok URL
5. Make some test commits or PRs
6. Use the inspector to verify:
   - Webhook payloads are correctly formatted
   - Your application is responding properly
   - Any errors or issues in the response
   - Request/response timing and performance

## Manual Sync Script Usage

You can run the sync script manually to process historical data:

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

## Deployment

The application is designed to be deployed to Cloudflare Pages with Functions:

1. Connect your repository to Cloudflare Pages
2. Set up the required environment variables in Cloudflare Pages settings
3. The webhook endpoint will be automatically created at `/github-webhook`

## Technologies Used

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Cloudflare Pages Functions

## Error Handling

- Automatically retries failed operations
- Waits for rate limit resets
- Preserves progress on interruption
- Detailed error messages for troubleshooting

## Troubleshooting

If you encounter dependency-related issues during installation or build:

1. Delete the node_modules directory and package-lock.json:
   ```bash
   rm -rf node_modules package-lock.json
   ```

2. Perform a clean install:
   ```bash
   npm install
   ```

This clean install process can resolve many common issues related to dependencies and platform-specific packages.
