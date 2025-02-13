import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { handleWebhook } from './functions/github-webhook';
import { handleRequest as handleCalendly } from './functions/get-calendly-times';
import { handleRequest as handleBooking } from './functions/book-calendly-time';
import type { Connect } from 'vite';
import type { ServerResponse } from 'http';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Allow all ngrok-free.app subdomains
    allowedHosts: ['.ngrok-free.app'],
    middleware: [
      {
        name: 'github-webhook',
        // Handle webhook requests 
        handle: async (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
          if (req.url === '/github-webhook' && req.method === 'POST') {
            const response = await handleWebhook(req as unknown as Request, {
              GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET || '',
              GITHUB_KEY: process.env.GITHUB_KEY || '',
              PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL || '',
              SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
            });
            res.statusCode = response.status;
            res.end(await response.text());
            return;
          }
          next();
        },
      },
      {
        name: 'get-calendly-times',
        handle: async (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
          if (req.url === '/get-calendly-times' && req.method === 'GET') {
            const response = await handleCalendly(req as unknown as Request, {
              CALENDLY_API_TOKEN: process.env.CALENDLY_API_TOKEN || ''
            });
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(await response.text());
            return;
          }
          next();
        },
      },
      {
        name: 'book-calendly-time',
        handle: async (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
          if (req.url === '/book-calendly-time' && req.method === 'POST') {
            const response = await handleBooking(req as unknown as Request, {
              BROWSERLESS_TOKEN: process.env.BROWSERLESS_TOKEN || ''
            });
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
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
