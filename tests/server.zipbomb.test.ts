// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAnalyzeRouter } from '../server/routes/analyze';
import { createCompareRouter } from '../server/routes/compare';
import { loadConfig } from '../server/config';
import { errorHandler } from '../server/middleware/errorHandler';
import { extractedTextTooLarge } from '../server/errors';

vi.mock('../server/services/fileSignature', () => ({
  detectSupportedMime: vi.fn(
    async () => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ),
}));

vi.mock('../server/services/extractText', () => ({
  extractText: vi.fn(),
}));

import { extractText } from '../server/services/extractText';
const extractMock = vi.mocked(extractText);

const ENV = {
  GEMINI_API_KEY: 'test-key',
  RATE_LIMIT_MAX_GLOBAL: '5000',
  RATE_LIMIT_MAX_AI: '5000',
};
const config = { ...loadConfig(ENV) };
const FILE = Buffer.from('PK\x03\x04 fake docx bytes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/analyze', createAnalyzeRouter({ config }));
  app.use('/api/compare', createCompareRouter({ config }));
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  extractMock.mockReset();
});

describe('deliberate extraction errors survive the route catch', () => {
  it('analyze returns the 413 from the decompression guard', async () => {
    extractMock.mockRejectedValue(extractedTextTooLarge());
    const res = await request(buildApp())
      .post('/api/analyze')
      .attach('document', FILE, 'bomb.docx');
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('EXTRACTED_TEXT_TOO_LARGE');
  });

  it('analyze wraps an unexpected extraction error as 500', async () => {
    extractMock.mockRejectedValue(new Error('boom'));
    const res = await request(buildApp())
      .post('/api/analyze')
      .attach('document', FILE, 'broken.docx');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });

  it('compare returns the 413 from the decompression guard', async () => {
    extractMock.mockRejectedValue(extractedTextTooLarge());
    const res = await request(buildApp())
      .post('/api/compare')
      .attach('documents', FILE, 'a.docx')
      .attach('documents', FILE, 'b.docx');
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('EXTRACTED_TEXT_TOO_LARGE');
  });

  it('compare wraps an unexpected extraction error as 500', async () => {
    extractMock.mockRejectedValue(new Error('boom'));
    const res = await request(buildApp())
      .post('/api/compare')
      .attach('documents', FILE, 'a.docx')
      .attach('documents', FILE, 'b.docx');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});
