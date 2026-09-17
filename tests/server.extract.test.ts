// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractText,
  extractTextFromDocx,
  extractTextFromPdf,
} from '../server/services/extractText';
import mammoth from 'mammoth';
import { makePdfBuffer } from './helpers';

vi.mock('mammoth', () => ({
  default: { extractRawText: vi.fn() },
}));

const mocked = vi.mocked(mammoth.extractRawText);

beforeEach(() => {
  mocked.mockReset();
});

describe('extractTextFromPdf', () => {
  it('extracts plain text from a real PDF buffer', async () => {
    const buffer = await makePdfBuffer('The tenant shall provide thirty days notice.');
    const text = await extractTextFromPdf(buffer);
    expect(text).toContain('thirty days notice');
  });

  it('yields a negligible string for a blank PDF', async () => {
    const buffer = await makePdfBuffer(null);
    const text = await extractTextFromPdf(buffer);
    expect(text.trim().length).toBeLessThan(20);
  });
});

describe('extractTextFromDocx', () => {
  it('returns the mammoth raw-text value', async () => {
    mocked.mockResolvedValue({ value: 'DOCX BODY', messages: [] });
    await expect(extractTextFromDocx(Buffer.from('x'))).resolves.toBe('DOCX BODY');
  });
});

describe('extractText', () => {
  it('routes PDF mimetypes to the pdf extractor', async () => {
    const buffer = await makePdfBuffer('Some words to extract.');
    await expect(extractText('application/pdf', buffer)).resolves.toContain('Some words');
  });

  it('routes DOCX mimetypes to the docx extractor', async () => {
    mocked.mockResolvedValue({ value: 'from docx', messages: [] });
    await expect(
      extractText(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        Buffer.from('z')
      )
    ).resolves.toBe('from docx');
  });
});
