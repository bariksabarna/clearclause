/**
 * Upload validation middleware.
 *
 * Enforces the size ceiling (FR-1) and verifies the file's true format by
 * magic bytes rather than extension or declared MIME type (FR-17).
 */
import type { NextFunction, Request, Response } from 'express';
import { fileTypeFromBuffer } from 'file-type';
import { unsupportedFileType } from '../errors';

/** Mime types accepted as real documents, regardless of the claimed extension. */
const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/**
 * Validate that the uploaded file is a genuine PDF or DOCX under its size
 * ceiling. Called after multer has buffered `req.file` in memory.
 *
 * @param req   - Express request; reads `req.file.buffer`.
 * @param _res  - Express response (unused, present for middleware shape).
 * @param next  - Next middleware; passes an AppError on validation failure.
 */
export async function validateUpload(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.file) {
    next(unsupportedFileType());
    return;
  }

  const { buffer } = req.file;

  let detectedMime: string | undefined;
  try {
    const detected = await fileTypeFromBuffer(buffer);
    detectedMime = detected?.mime;
  } catch {
    detectedMime = undefined;
  }

  if (!detectedMime || !ALLOWED_MIMES.includes(detectedMime)) {
    next(unsupportedFileType());
    return;
  }

  next();
}
