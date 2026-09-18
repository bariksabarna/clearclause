/**
 * Server configuration module.
 *
 * Loads every tunable value from environment variables with safe defaults so
 * the app runs identically in local development, Docker, and Cloud Run.
 * Values are parsed once into a frozen object at startup; nothing is read
 * from `process.env` at request time.
 */

export interface RateLimitConfig {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum requests per window for all routes. */
  maxGlobal: number;
  /** Maximum requests per window for AI-backed routes. */
  maxAi: number;
}

/** Gemini model id used when `GEMINI_MODEL` is unset (locked at build time). */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

export interface ServerConfig {
  /** Port the HTTP server binds to. */
  port: number;
  /** Node environment flag. */
  nodeEnv: string;
  /** Gemmservice key for the AI provider. Empty in local/test when mocked. */
  geminiApiKey: string;
  /** Gemini model id used for every AI call; override with `GEMINI_MODEL`. */
  geminiModel: string;
  /** Comma-separated CORS origin whitelist. Empty array allows no cross-origin calls. */
  allowedOrigins: string[];
  /** Upload size ceiling in bytes (FR-1). */
  maxUploadBytes: number;
  /** Hard ceiling for extracted text payloads in characters (FR-18). */
  maxExtractedChars: number;
  /** Clause word threshold above which a document is chunked (FR-13). */
  chunkThresholdWords: number;
  /** Overlap between adjacent chunks in words (FR-13). */
  chunkOverlapWords: number;
  /** Rate-limiting settings. */
  rateLimit: RateLimitConfig;
  /** Trust the first reverse-proxy hop so rate limits key on the real client IP. */
  trustProxy: boolean;
}

/** Parse a positive integer environment value with a fallback default. */
export function toPositiveInt(value: string | undefined, fallback: number, name: string): number {
  const parsed = value === undefined ? NaN : Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  if (Number.isFinite(parsed) && !Number.isSafeInteger(parsed)) {
    throw new Error(`Invalid environment variable ${name}: ${value}`);
  }
  return parsed;
}

/** Split a comma-separated CORS whitelist into trimmed, non-empty origins. */
export function parseOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * Build the server configuration from a raw environment object.
 *
 * @param env - Environment source (defaults to `process.env`).
 * @returns A frozen ServerConfig with every value resolved.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const config: ServerConfig = {
    port: toPositiveInt(env.PORT, 8080, 'PORT'),
    nodeEnv: env.NODE_ENV || 'development',
    geminiApiKey: env.GEMINI_API_KEY || '',
    geminiModel: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    maxUploadBytes: toPositiveInt(env.MAX_UPLOAD_MB, 5, 'MAX_UPLOAD_MB') * 1024 * 1024,
    maxExtractedChars: toPositiveInt(env.MAX_EXTRACTED_CHARS, 2_000_000, 'MAX_EXTRACTED_CHARS'),
    chunkThresholdWords: toPositiveInt(env.CHUNK_THRESHOLD_WORDS, 12_000, 'CHUNK_THRESHOLD_WORDS'),
    chunkOverlapWords: toPositiveInt(env.CHUNK_OVERLAP_WORDS, 200, 'CHUNK_OVERLAP_WORDS'),
    rateLimit: {
      windowMs: toPositiveInt(env.RATE_LIMIT_WINDOW_MS, 60_000, 'RATE_LIMIT_WINDOW_MS'),
      maxGlobal: toPositiveInt(env.RATE_LIMIT_MAX_GLOBAL, 200, 'RATE_LIMIT_MAX_GLOBAL'),
      maxAi: toPositiveInt(env.RATE_LIMIT_MAX_AI, 20, 'RATE_LIMIT_MAX_AI'),
    },
    trustProxy: env.TRUST_PROXY === 'true',
  };
  if (config.chunkOverlapWords >= config.chunkThresholdWords) {
    throw new Error('CHUNK_OVERLAP_WORDS must be smaller than CHUNK_THRESHOLD_WORDS.');
  }
  Object.freeze(config.rateLimit);
  return Object.freeze(config);
}
