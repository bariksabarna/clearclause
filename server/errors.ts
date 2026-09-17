/**
 * Application error types.
 *
 * Every error the server can produce carries a stable machine-readable
 * `code` (defined in ErrorResponseDto) and an HTTP `status` so the central
 * error-handling middleware can serialize it without inspecting message
 * strings. Document text is never placed inside an error message.
 */

export type ErrorCode =
  | 'UPLOAD_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'SCANNED_PDF'
  | 'EMPTY_DOCUMENT'
  | 'EXTRACTED_TEXT_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'AI_UNREACHABLE'
  | 'BODY_TOO_LARGE'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

/**
 * Serializable application error.
 *
 * @param code   - Stable machine-readable code the client can branch on.
 * @param status - HTTP status to return.
 * @param message - Plain-language message shown to the user.
 * @param retryAfterMs - Optional retry delay for 429/backoff responses.
 */
export class AppError extends Error {
  code: ErrorCode;
  status: number;
  retryAfterMs?: number;
  isAppError = true;

  constructor(code: ErrorCode, status: number, message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }

  /** The uniform ErrorResponseDto body for this error. */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      apiVersion: '1.0',
      ...(this.retryAfterMs !== undefined ? { retryAfterMs: this.retryAfterMs } : {}),
    };
  }
}

/** Upload exceeds the configured size ceiling (FR-1). */
export function uploadTooLarge(): AppError {
  return new AppError(
    'UPLOAD_TOO_LARGE',
    413,
    'This file is too large. Maximum upload size is 5 MB.'
  );
}

/** File signature is not a PDF or DOCX regardless of extension/declared type (FR-17). */
export function unsupportedFileType(): AppError {
  return new AppError(
    'UNSUPPORTED_FILE_TYPE',
    415,
    'This file type is not supported. Please upload a PDF, DOCX, or paste plain text.'
  );
}

/** Extraction produced worthless text, e.g. a scanned image-only PDF (FR-2). */
export function scannedPdf(): AppError {
  return new AppError(
    'SCANNED_PDF',
    422,
    "We couldn't read any text from this file. Scanned or image-only documents are not supported yet."
  );
}

/** The document contained no usable text after sanitisation (FR-1). */
export function emptyDocument(): AppError {
  return new AppError(
    'EMPTY_DOCUMENT',
    400,
    'Please provide a document with some text to analyze.'
  );
}

/** Extracted payload exceeds the hard character ceiling (FR-18). */
export function extractedTextTooLarge(): AppError {
  return new AppError(
    'EXTRACTED_TEXT_TOO_LARGE',
    413,
    'This document has too much text to process safely. Please upload a shorter version.'
  );
}

/** AI request was throttled (FR-14). */
export function rateLimited(retryAfterMs: number): AppError {
  return new AppError(
    'RATE_LIMITED',
    429,
    `You've reached the analysis limit. Please wait ${Math.ceil(retryAfterMs / 1000)} seconds and try again.`,
    retryAfterMs
  );
}

/** The AI provider failed after the retry budget was exhausted (FR-19). */
export function aiUnreachable(): AppError {
  return new AppError(
    'AI_UNREACHABLE',
    503,
    'The analysis service is temporarily unavailable. Please try again in a minute.'
  );
}
