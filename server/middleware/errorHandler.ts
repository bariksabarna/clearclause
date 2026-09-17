/**
 * Central error-handling middleware.
 *
 * Serializes every error into the uniform ErrorResponseDto shape and logs
 * metadata only — timestamp, method, path, and status. Document text is never
 * included in logs (FR-15).
 */
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors';

/** Recognized multer error names (avoiding a direct multer import here). */
const MULTER_LIMIT_FILE_SIZE = 'LIMIT_FILE_SIZE';

/**
 * Send any error to the client as a uniform ErrorResponseDto.
 *
 * @param err    - Thrown error, an AppError, a multer error, or anything else.
 * @param _req   - Express request (unused except for logging).
 * @param res    - Express response.
 * @param _next  - Express next; present so Express treats this as the 4-arg error handler.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (
    err &&
    typeof err === 'object' &&
    'name' in err &&
    (err as { name?: unknown }).name === 'MulterError'
  ) {
    const multerError = err as { name?: string; code?: string };
    appError =
      multerError.code === MULTER_LIMIT_FILE_SIZE
        ? new AppError(
            'UPLOAD_TOO_LARGE',
            413,
            'This file is too large. Maximum upload size is 5 MB.'
          )
        : new AppError(
            'INTERNAL_ERROR',
            400,
            'The upload could not be processed. Please try again with a different file.'
          );
  } else if (
    err &&
    typeof err === 'object' &&
    'type' in err &&
    (err as { type?: string }).type === 'entity.too.large'
  ) {
    appError = new AppError(
      'BODY_TOO_LARGE',
      413,
      'The request body is too large. Please upload a smaller document.'
    );
  } else {
    appError = new AppError('INTERNAL_ERROR', 500, 'Something went wrong. Please try again.');
  }

  if (res.headersSent) {
    return;
  }

  // Metadata-only log line. Never write err.stack or message that could echo document content.
  console.error(
    JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      method: _req.method,
      path: _req.path,
      status: appError.status,
      code: appError.code,
    })
  );

  res.status(appError.status).json(appError.toJSON());
}
