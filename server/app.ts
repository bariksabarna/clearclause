/**
 * Application factory.
 *
 * Assembles Express with security middleware, rate limiters, routes, static
 * file serving, and the central error handler. Extracted from `index.ts` so
 * supertest can import the app without starting a listener.
 */
import express from 'express';
import compression from 'compression';
import { loadConfig, type ServerConfig } from './config';
import { applySecurity } from './middleware/security';
import { buildGlobalLimiter, buildAiLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { createAnalyzeRouter } from './routes/analyze';
import { createChatRouter } from './routes/chat';
import { createChecklistRouter } from './routes/checklist';
import { createCompareRouter } from './routes/compare';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Build the Express application with all middleware and routes mounted.
 *
 * @param overrides - Optional config for testing.
 * @returns The configured Express app.
 */
export function createApp(overrides?: { config?: ServerConfig }) {
  const config = overrides?.config ?? loadConfig();
  const app = express();

  if (config.trustProxy) {
    app.set('trust proxy', 1);
  }

  applySecurity(app, config);
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(buildGlobalLimiter(config.rateLimit));

  // AI-backed routes behind the stricter limiter
  app.use('/api/analyze', buildAiLimiter(config.rateLimit), createAnalyzeRouter({ config }));
  app.use('/api/chat', buildAiLimiter(config.rateLimit), createChatRouter({ config }));
  app.use('/api/compare', buildAiLimiter(config.rateLimit), createCompareRouter({ config }));

  // Checklist/export: global limiter only (no LLM calls)
  app.use('/api/checklist', createChecklistRouter());

  // Serve the Vite-built client SPA
  const distDir = resolve(__dirname, '..', 'dist');
  app.use(express.static(distDir, { maxAge: '1d', etag: true }));

  // SPA fallback: serve index.html for any non-API, non-file request
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(resolve(distDir, 'index.html'));
  });

  // Catch-all for unknown API routes
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Endpoint not found.', apiVersion: '1.0' });
  });

  app.use(errorHandler);
  return app;
}
