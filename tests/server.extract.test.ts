// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractText,
  extractTextFromDocx,
  extractTextFromPdf,
  zipUncompressedSize,
  MAX_DOCX_UNCOMPRESSED_BYTES,
} from '../server/services/extractText';
import mammoth from 'mammoth';
import { makePdfBuffer } from './helpers';

vi.mock('mammoth', () => ({
  default: { extractRawText: vi.fn() },
}));

const mocked = vi.mocked(mammoth.extractRawText);

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_ESCAPE = 0xffffffff;

interface CraftOptions {
  eocdOffset?: number;
  trailing?: number;
}

/**
 * Build a buffer containing only a ZIP central directory + EOCD record.
 *
 * Enough for `zipUncompressedSize` without the local-file headers a real
 * archive would carry before the directory.
 */
function craftZip(
  entries: Array<{ name: string; uncompressed: number }>,
  options: CraftOptions = {}
): Buffer {
  const parts: Buffer[] = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const header = Buffer.alloc(46);
    header.writeUInt32LE(CENTRAL_SIGNATURE, 0);
    header.writeUInt32LE(0, 20);
    header.writeUInt32LE(entry.uncompressed, 24);
    header.writeUInt16LE(name.length, 28);
    parts.push(header, name);
  }
  const central = Buffer.concat(parts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIGNATURE, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(options.eocdOffset ?? 0, 16);
  const trailing = Buffer.alloc(options.trailing ?? 0);
  return Buffer.concat([central, eocd, trailing]);
}

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

describe('zipUncompressedSize', () => {
  it('sums the declared sizes of every central-directory entry', () => {
    const buffer = craftZip([
      { name: 'word/document.xml', uncompressed: 2048 },
      { name: '[Content_Types].xml', uncompressed: 512 },
    ]);
    expect(zipUncompressedSize(buffer)).toBe(2560);
  });

  it('returns the running total once the ceiling is crossed', () => {
    const buffer = craftZip([{ name: 'a', uncompressed: MAX_DOCX_UNCOMPRESSED_BYTES + 1 }]);
    expect(zipUncompressedSize(buffer)).toBe(MAX_DOCX_UNCOMPRESSED_BYTES + 1);
  });

  it('returns 0 for an empty archive', () => {
    expect(zipUncompressedSize(craftZip([]))).toBe(0);
  });

  it('returns null when no end-of-central-directory record exists', () => {
    expect(zipUncompressedSize(Buffer.from('not a zip at all'))).toBe(null);
  });

  it('returns null when trailing bytes break the EOCD comment-length check', () => {
    const buffer = craftZip([{ name: 'a', uncompressed: 8 }], { trailing: 4 });
    expect(zipUncompressedSize(buffer)).toBe(null);
  });

  it('returns null for a ZIP64 directory offset', () => {
    const buffer = craftZip([{ name: 'a', uncompressed: 8 }], { eocdOffset: ZIP64_ESCAPE });
    expect(zipUncompressedSize(buffer)).toBe(null);
  });

  it('returns null when the directory offset points past the buffer', () => {
    const buffer = craftZip([{ name: 'a', uncompressed: 8 }], { eocdOffset: 0xffffffe0 });
    expect(zipUncompressedSize(buffer)).toBe(null);
  });

  it('returns null when a directory entry has no central signature', () => {
    const buffer = craftZip([{ name: 'a', uncompressed: 8 }]);
    buffer.writeUInt32LE(0x12345678, 0);
    expect(zipUncompressedSize(buffer)).toBe(null);
  });

  it('returns null when an entry advertises the ZIP64 escape size', () => {
    const buffer = craftZip([{ name: 'a', uncompressed: ZIP64_ESCAPE }]);
    expect(zipUncompressedSize(buffer)).toBe(null);
  });
});

describe('extractTextFromDocx', () => {
  it('returns the mammoth raw-text value for a bounded archive', async () => {
    mocked.mockResolvedValue({ value: 'DOCX BODY', messages: [] });
    const buffer = craftZip([{ name: 'word/document.xml', uncompressed: 1024 }]);
    await expect(extractTextFromDocx(buffer)).resolves.toBe('DOCX BODY');
  });

  it('rejects a malformed archive before mammoth runs', async () => {
    await expect(extractTextFromDocx(Buffer.from('x'))).rejects.toMatchObject({
      code: 'EXTRACTED_TEXT_TOO_LARGE',
    });
    expect(mocked).not.toHaveBeenCalled();
  });

  it('rejects an archive whose declared size exceeds the ceiling', async () => {
    const buffer = craftZip([
      { name: 'word/document.xml', uncompressed: MAX_DOCX_UNCOMPRESSED_BYTES + 1 },
    ]);
    await expect(extractTextFromDocx(buffer)).rejects.toMatchObject({
      code: 'EXTRACTED_TEXT_TOO_LARGE',
    });
    expect(mocked).not.toHaveBeenCalled();
  });
});

describe('extractText', () => {
  it('routes PDF mimetypes to the pdf extractor', async () => {
    const buffer = await makePdfBuffer('Some words to extract.');
    await expect(extractText('application/pdf', buffer)).resolves.toContain('Some words');
  });

  it('routes DOCX mimetypes to the docx extractor', async () => {
    mocked.mockResolvedValue({ value: 'from docx', messages: [] });
    const buffer = craftZip([{ name: 'word/document.xml', uncompressed: 16 }]);
    await expect(extractText(DOCX_MIME, buffer)).resolves.toBe('from docx');
  });
});
