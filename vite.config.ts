import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { handleWebhook } from './functions/github-webhook';
import type { Connect } from 'vite';
import type { ServerResponse } from 'http';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    middleware: [
      {
        name: 'github-webhook',
        // Handle webhook requests
        handle: async (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
          if (req.url === '/github-webhook' && req.method === 'POST') {
            const response = await handleWebhook(req as unknown as Request, {
              GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET || '',
              GITHUB_KEY: process.env.GITHUB_KEY || ''
            });
            res.statusCode = response.status;
            res.end(await response.text());
            return;
          }
          next();
        },
      },
    ],
  },
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
