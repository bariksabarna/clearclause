/**
 * Rate limiting.
 *
 * Two identify-free limiters, using the DEFAULT keyGenerator only.
 * A custom `keyGenerator: (req) => req.ip` previously crashed a Cloud Run
 * deployment (ERR_ERL_KEY_GEN_IPV6) — overriding it is forbidden here.
 */
import rateLimit from 'express-rate-limit';
import type { RateLimitConfig } from '../config';
import { rateLimited } from '../errors';

/** Message sent on the global limiter (non-AI routes). */
const GLOBAL_LIMIT_MESSAGE = 'Too many requests. Please try again shortly.';

/**
 * Build the global limiter applied to every route.
 *
 * @param cfg - Rate-limit window and global maximum.
 * @returns The configured global rate limiter.
 */
export function buildGlobalLimiter(cfg: RateLimitConfig) {
  return rateLimit({
    windowMs: cfg.windowMs,
    max: cfg.maxGlobal,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 'RATE_LIMITED', message: GLOBAL_LIMIT_MESSAGE, apiVersion: '1.0' },
  });
}

/**
 * Compute the effective retry window from a response header.
 *
 * Prefers the `RateLimit-Reset` header (RFC-style epoch seconds) set by
 * express-rate-limit when present, otherwise falls back to the configured
 * window length.
 *
 * @param res       - The response; `getHeader('RateLimit-Reset')` is probed.
 * @param windowMs  - Configured window length in milliseconds.
 * @returns The number of milliseconds (potentially negative) until reset.
 */
export function retryAfterFrom(
  res: { getHeader(name: string): unknown },
  windowMs: number
): number {
  const resetHeader = res.getHeader('RateLimit-Reset');
  const resetUnix = typeof resetHeader === 'string' ? Number(resetHeader) : NaN;
  return Number.isFinite(resetUnix) ? resetUnix * 1000 - Date.now() : windowMs;
}

/**
 * Build the stricter AI-backed limiter for LLM routes.
 *
 * Returns a structured AppError body with a retry window so the client can
 * show "try again in X" (FR-14).
 *
 * @param cfg - Rate-limit window and AI maximum.
 * @returns The configured AI rate limiter.
 */
export function buildAiLimiter(cfg: RateLimitConfig) {
  return rateLimit({
    windowMs: cfg.windowMs,
    max: cfg.maxAi,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json(rateLimited(Math.max(retryAfterFrom(res, cfg.windowMs), 1000)).toJSON());
    },
  });
}
