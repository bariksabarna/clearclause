/**
 * Security middleware — Helmet + CORS.
 *
 * Helmet locks HTTP headers with a strict Content-Security-Policy that only
 * allows same-origin scripts/styles/images. CORS is restricted to an explicit
 * whitelist from config; a wildcard `*` is never used.
 */
import type { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import type { ServerConfig } from '../config';

/**
 * Apply Helmet and CORS to the Express app.
 *
 * @param app    - Express application to harden.
 * @param config - Server config carrying the CORS whitelist.
 */
export function applySecurity(app: Express, config: ServerConfig): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(cors({ origin: config.allowedOrigins }));
}
