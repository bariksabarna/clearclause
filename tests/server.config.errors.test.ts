import { describe, expect, it } from 'vitest';
import { DEFAULT_GEMINI_MODEL, loadConfig, parseOrigins, toPositiveInt } from '../server/config';
import {
  aiUnreachable,
  AppError,
  emptyDocument,
  extractedTextTooLarge,
  rateLimited,
  scannedPdf,
  unsupportedFileType,
  uploadTooLarge,
} from '../server/errors';

describe('config.toPositiveInt', () => {
  it('falls back to the default when the value is undefined', () => {
    expect(toPositiveInt(undefined, 42, 'X')).toBe(42);
  });

  it('parses a valid positive integer', () => {
    expect(toPositiveInt('8080', 42, 'X')).toBe(8080);
  });

  it('falls back when the value is not a number', () => {
    expect(toPositiveInt('abc', 7, 'X')).toBe(7);
  });

  it('falls back when the value is zero or negative', () => {
    expect(toPositiveInt('0', 7, 'X')).toBe(7);
    expect(toPositiveInt('-5', 7, 'X')).toBe(7);
  });

  it('throws for a value beyond the safe-integer range', () => {
    expect(() => toPositiveInt('9007199254740992', 7, 'X')).toThrow(
      /Invalid environment variable X/
    );
  });
});

describe('config.parseOrigins', () => {
  it('returns an empty array for undefined input', () => {
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseOrigins('')).toEqual([]);
  });

  it('splits, trims, and filters empty entries', () => {
    expect(parseOrigins(' http://a.com , https://b.com ,,  ')).toEqual([
      'http://a.com',
      'https://b.com',
    ]);
  });
});

describe('config.loadConfig', () => {
  it('uses sensible defaults', () => {
    const config = loadConfig({});
    expect(config.port).toBe(8080);
    expect(config.nodeEnv).toBe('development');
    expect(config.geminiApiKey).toBe('');
    expect(config.geminiModel).toBe(DEFAULT_GEMINI_MODEL);
    expect(config.allowedOrigins).toEqual([]);
    expect(config.maxUploadBytes).toBe(5 * 1024 * 1024);
    expect(config.maxExtractedChars).toBe(2_000_000);
    expect(config.chunkThresholdWords).toBe(12_000);
    expect(config.chunkOverlapWords).toBe(200);
    expect(config.rateLimit).toEqual({ windowMs: 60_000, maxGlobal: 200, maxAi: 20 });
  });

  it('overrides every value from the environment', () => {
    const config = loadConfig({
      PORT: '4000',
      NODE_ENV: 'production',
      GEMINI_API_KEY: 'secret',
      GEMINI_MODEL: 'gemini-2.5-pro',
      ALLOWED_ORIGINS: 'https://clearclause.app',
      MAX_UPLOAD_MB: '2',
      MAX_EXTRACTED_CHARS: '1000',
      CHUNK_THRESHOLD_WORDS: '50',
      CHUNK_OVERLAP_WORDS: '5',
      RATE_LIMIT_WINDOW_MS: '1000',
      RATE_LIMIT_MAX_GLOBAL: '10',
      RATE_LIMIT_MAX_AI: '2',
    });
    expect(config.port).toBe(4000);
    expect(config.nodeEnv).toBe('production');
    expect(config.geminiApiKey).toBe('secret');
    expect(config.geminiModel).toBe('gemini-2.5-pro');
    expect(config.allowedOrigins).toEqual(['https://clearclause.app']);
    expect(config.maxUploadBytes).toBe(2 * 1024 * 1024);
    expect(config.maxExtractedChars).toBe(1000);
    expect(config.chunkThresholdWords).toBe(50);
    expect(config.chunkOverlapWords).toBe(5);
    expect(config.rateLimit).toEqual({ windowMs: 1000, maxGlobal: 10, maxAi: 2 });
  });

  it('falls back for invalid numeric values and freezes the result', () => {
    const config = loadConfig({ PORT: 'nope', MAX_UPLOAD_MB: '-1', RATE_LIMIT_MAX_AI: 'abc' });
    expect(config.port).toBe(8080);
    expect(config.maxUploadBytes).toBe(5 * 1024 * 1024);
    expect(config.rateLimit.maxAi).toBe(20);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.rateLimit)).toBe(true);
  });
});

describe('errors', () => {
  it('AppError stores code, status, message, and an optional retry delay', () => {
    const err = new AppError('RATE_LIMITED', 429, 'Wait a bit.', 1500);
    expect(err.name).toBe('AppError');
    expect(err.isAppError).toBe(true);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.status).toBe(429);
    expect(err.message).toBe('Wait a bit.');
    expect(err.retryAfterMs).toBe(1500);
    expect(err.toJSON()).toEqual({
      code: 'RATE_LIMITED',
      message: 'Wait a bit.',
      apiVersion: '1.0',
      retryAfterMs: 1500,
    });
  });

  it('AppError.toJSON omits retryAfterMs when undefined', () => {
    const err = new AppError('NOT_FOUND', 404, 'Nope.');
    expect(err.toJSON()).toEqual({ code: 'NOT_FOUND', message: 'Nope.', apiVersion: '1.0' });
  });

  it('exposes a stable factory per error code and status', () => {
    expect(uploadTooLarge().code).toBe('UPLOAD_TOO_LARGE');
    expect(uploadTooLarge().status).toBe(413);
    expect(unsupportedFileType().code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(unsupportedFileType().status).toBe(415);
    expect(scannedPdf().code).toBe('SCANNED_PDF');
    expect(scannedPdf().status).toBe(422);
    expect(emptyDocument().code).toBe('EMPTY_DOCUMENT');
    expect(emptyDocument().status).toBe(400);
    expect(extractedTextTooLarge().code).toBe('EXTRACTED_TEXT_TOO_LARGE');
    expect(extractedTextTooLarge().status).toBe(413);
    expect(aiUnreachable().code).toBe('AI_UNREACHABLE');
    expect(aiUnreachable().status).toBe(503);
    const limited = rateLimited(30000);
    expect(limited.code).toBe('RATE_LIMITED');
    expect(limited.status).toBe(429);
    expect(limited.retryAfterMs).toBe(30000);
    expect(limited.message).toContain('30 seconds');
  });

  it('all factories produce plain-language messages', () => {
    expect(uploadTooLarge().message.length).toBeGreaterThan(10);
    expect(unsupportedFileType().message).toContain('PDF');
    expect(scannedPdf().message).toContain('text');
  });
});
