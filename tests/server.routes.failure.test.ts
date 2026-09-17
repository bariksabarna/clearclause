import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { loadConfig } from '../server/config';

vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn(),
}));

vi.mock('pdf-parse', () => ({
  PDFParse: vi.fn(),
}));

import { fileTypeFromBuffer } from 'file-type';
import { PDFParse } from 'pdf-parse';
const fileTypeMock = vi.mocked(fileTypeFromBuffer);
const pdfParseMock = vi.mocked(PDFParse);

const ENV = { GEMINI_API_KEY: 'k', RATE_LIMIT_MAX_GLOBAL: '5000', RATE_LIMIT_MAX_AI: '5000' };
const makeApp = () => createApp({ config: loadConfig(ENV) });

beforeEach(() => {
  fileTypeMock.mockReset();
  pdfParseMock.mockReset();
});

describe('magic-byte reader failures', () => {
  it('analyze treats a failed magic-byte read as an unsupported file', async () => {
    fileTypeMock.mockRejectedValue(new Error('read error'));
    const res = await request(makeApp())
      .post('/api/analyze')
      .attach('document', Buffer.from('garbage'), 'x.pdf');
    expect(res.status).toBe(415);
    expect(res.body.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('compare treats a failed magic-byte read as an unsupported file', async () => {
    fileTypeMock.mockRejectedValue(new Error('read error'));
    const res = await request(makeApp())
      .post('/api/compare')
      .attach('documents', Buffer.from('garbage'), 'a.pdf')
      .attach('documents', Buffer.from('garbage'), 'b.pdf');
    expect(res.status).toBe(415);
    expect(res.body.code).toBe('UNSUPPORTED_FILE_TYPE');
  });
});

describe('text extraction failures', () => {
  it('compare rejects with 500 INTERNAL_ERROR when pdf extraction crashes', async () => {
    fileTypeMock.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' });
    pdfParseMock.mockImplementation(() => ({
      getText: () => Promise.reject(new Error('corrupt file')),
    }));
    const res = await request(makeApp())
      .post('/api/compare')
      .attach('documents', Buffer.from('%PDF-1.7 broken'), 'a.pdf')
      .attach('documents', Buffer.from('%PDF-1.7 broken'), 'b.pdf');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });

  it('analyze rejects with 500 INTERNAL_ERROR when pdf extraction crashes', async () => {
    fileTypeMock.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' });
    pdfParseMock.mockImplementation(() => ({
      getText: () => Promise.reject(new Error('corrupt file')),
    }));
    const res = await request(makeApp())
      .post('/api/analyze')
      .attach('document', Buffer.from('%PDF-1.7 broken'), 'x.pdf');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});
