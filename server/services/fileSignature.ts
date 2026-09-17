/**
 * Upload file-signature gate (FR-17).
 *
 * A buffer is accepted only when its magic bytes identify a genuine PDF or
 * DOCX, regardless of the filename extension or declared MIME type. Shared by
 * the analyze and compare routes so the check has a single implementation.
 */
import { fileTypeFromBuffer } from 'file-type';

/** Mime types accepted as real documents. */
export const ALLOWED_UPLOAD_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * Detect the supported document MIME type for a buffered upload.
 *
 * @param buffer - File bytes buffered in memory.
 * @returns The detected MIME type, or `null` when it is missing, unsupported,
 *          or the detector itself fails.
 */
export async function detectSupportedMime(buffer: Buffer): Promise<string | null> {
  try {
    const detected = await fileTypeFromBuffer(buffer);
    return detected && ALLOWED_UPLOAD_MIMES.has(detected.mime) ? detected.mime : null;
  } catch {
    return null;
  }
}
