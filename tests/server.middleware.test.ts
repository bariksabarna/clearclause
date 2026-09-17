import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Request, Response } from 'express';
import { applySecurity } from '../server/middleware/security';
import {
  buildAiLimiter,
  buildGlobalLimiter,
  retryAfterFrom,
} from '../server/middleware/rateLimiter';
import { validateUpload } from '../server/middleware/validateUpload';
import { errorHandler } from '../server/middleware/errorHandler';
import { AppError, rateLimited, unsupportedFileType } from '../server/errors';
import { loadConfig } from '../server/config';

vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn(),
}));

import { fileTypeFromBuffer } from 'file-type';
const fileTypeMock = vi.mocked(fileTypeFromBuffer);

describe('applySecurity (helmet + cors)', () => {
  it('sets strict security headers for whitelisted origins', async () => {
    const app = express();
    applySecurity(app, loadConfig({ ALLOWED_ORIGINS: 'http://trusted.example' }));
    app.get('/ping', (_req, res) => res.send('pong'));

    const res = await request(app).get('/ping').set('Origin', 'http://trusted.example');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://trusted.example');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['cross-origin-opener-policy']).toBeDefined();
  });

  it('does not emit CORS headers for non-whitelisted origins', async () => {
    const app = express();
    applySecurity(app, loadConfig({ ALLOWED_ORIGINS: 'http://trusted.example' }));
    app.get('/ping', (_req, res) => res.send('pong'));

    const res = await request(app).get('/ping').set('Origin', 'http://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limiters', () => {
  it('global limiter rejects requests beyond the maximum with an RATE_LIMITED body', async () => {
    const app = express();
    app.use(buildGlobalLimiter({ windowMs: 60000, maxGlobal: 2, maxAi: 2 }));
    app.get('/x', (_req, res) => res.json({ ok: true }));

    await request(app).get('/x').expect(200);
    await request(app).get('/x').expect(200);
    const blocked = await request(app).get('/x').expect(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(blocked.body.apiVersion).toBe('1.0');
  });

  it('AI limiter returns a retryAfterMs-aware body after the AI maximum', async () => {
    const app = express();
    app.use(buildAiLimiter({ windowMs: 60_000, maxGlobal: 100, maxAi: 1 }));
    app.get('/x', (_req, res) => res.json({ ok: true }));

    await request(app).get('/x').expect(200);
    const blocked = await request(app).get('/x').expect(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(typeof blocked.body.retryAfterMs).toBe('number');
    expect(blocked.body.retryAfterMs).toBeGreaterThanOrEqual(1000);
  });

  it('retryAfterFrom prefers a string RateLimit-Reset header', () => {
    const fakeRes = { getHeader: () => String(Math.floor(Date.now() / 1000) + 60) };
    expect(retryAfterFrom(fakeRes, 60_000)).toBeGreaterThanOrEqual(55_000);
    expect(retryAfterFrom(fakeRes, 60_000)).toBeLessThanOrEqual(61_000);
  });

  it('retryAfterFrom falls back to the window for missing or non-string headers', () => {
    expect(retryAfterFrom({ getHeader: () => undefined }, 30_000)).toBe(30_000);
    expect(retryAfterFrom({ getHeader: () => 5 }, 30_000)).toBe(30_000);
  });
});

describe('validateUpload', () => {
  beforeEach(() => {
    fileTypeMock.mockReset();
  });

  const next = vi.fn();

  it('passes valid PDF magic bytes', async () => {
    const req = { file: { buffer: Buffer.from('some-bytes') } } as unknown as Request;
    fileTypeMock.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' });
    await validateUpload(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('passes valid DOCX magic bytes', async () => {
    const req = { file: { buffer: Buffer.from('some-bytes') } } as unknown as Request;
    fileTypeMock.mockResolvedValue({
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ext: 'docx',
    });
    await validateUpload(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a file that is not a supported document', async () => {
    const req = { file: { buffer: Buffer.from('MZ fake') } } as unknown as Request;
    fileTypeMock.mockResolvedValue({ mime: 'application/x-dosexec', ext: 'exe' });
    await validateUpload(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(unsupportedFileType());
  });

  it('rejects an undetectable or missing-signature file', async () => {
    const req = { file: { buffer: Buffer.from('???') } } as unknown as Request;
    fileTypeMock.mockResolvedValue(undefined);
    await validateUpload(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(unsupportedFileType());
  });

  it('rejects when the magic-byte reader itself throws', async () => {
    const req = { file: { buffer: Buffer.from('???') } } as unknown as Request;
    fileTypeMock.mockRejectedValue(new Error('bad'));
    await validateUpload(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(unsupportedFileType());
  });

  it('rejects a request with no uploaded file', async () => {
    const req = {} as Request;
    await validateUpload(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(unsupportedFileType());
  });
});

describe('errorHandler', () => {
  const makeRes = (headersSent = false) => {
    const res: Record<string, unknown> & {
      headersSent: boolean;
      status: ReturnType<typeof vi.fn>;
      json: ReturnType<typeof vi.fn>;
    } = {
      headersSent,
      status: vi.fn(),
      json: vi.fn(),
    };
    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
    return res;
  };

  const req = { method: 'POST', path: '/api/x' } as unknown as Request;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('serializes an AppError with a retry delay', () => {
    const res = makeRes();
    errorHandler(rateLimited(4000), req, res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      code: 'RATE_LIMITED',
      message: expect.stringContaining('4 seconds'),
      apiVersion: '1.0',
      retryAfterMs: 4000,
    });
  });

  it('maps a multer LIMIT_FILE_SIZE to 413 UPLOAD_TOO_LARGE', () => {
    const res = makeRes();
    errorHandler(
      Object.assign(new Error('File too big'), { name: 'MulterError', code: 'LIMIT_FILE_SIZE' }),
      req,
      res as unknown as Response,
      vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'UPLOAD_TOO_LARGE' }));
  });

  it('maps other multer errors to 400 INTERNAL_ERROR', () => {
    const res = makeRes();
    errorHandler(
      Object.assign(new Error('Too many'), { name: 'MulterError', code: 'LIMIT_UNEXPECTED_FILE' }),
      req,
      res as unknown as Response,
      vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
  });

  it('maps entity.too.large body-parser errors to 413 BODY_TOO_LARGE', () => {
    const res = makeRes();
    errorHandler(
      Object.assign(new Error('entity too large'), { type: 'entity.too.large' }),
      req,
      res as unknown as Response,
      vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BODY_TOO_LARGE' }));
  });

  it('maps any other error to 500 INTERNAL_ERROR', () => {
    const res = makeRes();
    errorHandler(new Error('boom'), req, res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
  });

  it('does nothing once headers are sent', () => {
    const res = makeRes(true);
    errorHandler(
      new AppError('INTERNAL_ERROR', 500, 'x'),
      req,
      res as unknown as Response,
      vi.fn()
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
