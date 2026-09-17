/**
 * Shared test helpers for server tests (excluded from coverage gates).
 */
import PDFDocument from 'pdfkit';

/** Build a real, extractable PDF buffer containing `text` (or blank when empty). */
export async function makePdfBuffer(
  text: string | null = 'Sample clause text here.'
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument();
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const flushed = new Promise<void>((resolve) => doc.on('end', () => resolve()));
  if (text) doc.text(text);
  doc.end();
  await flushed;
  return Buffer.concat(chunks);
}

/** Build a PDF buffer whose extracted text is negligible (scan-like). */
export async function makeBlankPdfBuffer(): Promise<Buffer> {
  return makePdfBuffer(null);
}
