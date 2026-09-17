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
 * @param buffer - In-memory DOCX bytes.
 * @returns The extracted text.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
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
