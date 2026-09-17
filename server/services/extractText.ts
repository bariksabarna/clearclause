/**
 * Text extraction service (FR-2).
 *
 * Converts an uploaded PDF/DOCX buffer to plain text entirely in memory. A
 * scanned/image-only PDF yields a near-empty result that the route rejects
 * with a clear message instead of crashing.
 */
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { type Buffer } from 'node:buffer';
import { extractedTextTooLarge } from '../errors';

/** Total uncompressed bytes we will hand to the DOCX parser before refusing. */
export const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;

/** Signature marking a ZIP central-directory file header. */
const CENTRAL_SIGNATURE = 0x02014b50;
/** Signature marking the end-of-central-directory (EOCD) record. */
const EOCD_SIGNATURE = 0x06054b50;
/** 32-bit size field escape value indicating a ZIP64 extra field. */
const ZIP64_ESCAPE = 0xffffffff;

/**
 * Locate the ZIP end-of-central-directory record.
 *
 * @param buffer - Candidate ZIP bytes.
 * @returns The EOCD offset, or -1 when no intact record is present.
 */
function findEndOfCentralDirectory(buffer: Buffer): number {
  const earliest = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= earliest; i -= 1) {
    if (
      buffer.readUInt32LE(i) === EOCD_SIGNATURE &&
      i + 22 + buffer.readUInt16LE(i + 20) === buffer.length
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Sum the uncompressed sizes declared in a ZIP central directory.
 *
 * DOCX files are ZIP containers, so the upload ceiling bounds only the
 * *compressed* size: a few kilobytes can expand to gigabytes (a "zip bomb").
 * Reading the declared sizes lets us reject before the XML parser allocates.
 *
 * @param buffer - Candidate DOCX bytes.
 * @returns The declared uncompressed total, or `null` when the archive is
 *          malformed, truncated, or uses ZIP64 (all treated as untrusted).
 */
export function zipUncompressedSize(buffer: Buffer): number | null {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd === -1) return null;

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (directoryOffset === ZIP64_ESCAPE) return null;

  let cursor = directoryOffset;
  let total = 0;
  for (let i = 0; i < entryCount; i += 1) {
    if (cursor + 46 > buffer.length) return null;
    if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) return null;
    const uncompressed = buffer.readUInt32LE(cursor + 24);
    if (uncompressed === ZIP64_ESCAPE) return null;
    total += uncompressed;
    if (total > MAX_DOCX_UNCOMPRESSED_BYTES) return total;
    cursor +=
      46 +
      buffer.readUInt16LE(cursor + 28) +
      buffer.readUInt16LE(cursor + 30) +
      buffer.readUInt16LE(cursor + 32);
  }
  return total;
}

/**
 * Extract plain text from a PDF buffer.
 *
 * @param buffer - In-memory PDF bytes.
 * @returns The extracted text (may be near-empty for scanned PDFs).
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}

/**
 * Extract plain text from a DOCX buffer via mammoth's raw-text converter.
 *
 * Rejects archives whose declared uncompressed size is missing, unknowable
 * (ZIP64), or above the decompression ceiling before any XML is parsed.
 *
 * @param buffer - In-memory DOCX bytes.
 * @returns The extracted text.
 * @throws AppError EXTRACTED_TEXT_TOO_LARGE when the archive may expand too far.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const declared = zipUncompressedSize(buffer);
  if (declared === null || declared > MAX_DOCX_UNCOMPRESSED_BYTES) {
    throw extractedTextTooLarge();
  }
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extract plain text from any supported document buffer.
 *
 * @param mimeType  - Detected mime type (from the magic-byte check).
 * @param buffer    - In-memory document bytes.
 * @returns Extracted plain text.
 */
export async function extractText(mimeType: string, buffer: Buffer): Promise<string> {
  if (mimeType === 'application/pdf') {
    return extractTextFromPdf(buffer);
  }
  return extractTextFromDocx(buffer);
}
