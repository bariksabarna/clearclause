import type { ClauseDto } from './clause.dto';
import type { ExportFormat } from './enums';

/**
 * Request DTOs for every ClearClause API endpoint.
 *
 * These describe the JSON payload shapes the server accepts. Multipart file
 * uploads are handled by multer upstream at the route level; the DTOs here
 * cover the JSON bodies that follow SRS §6.
 */

/**
 * Body for POST /api/analyze when sending pasted plain text.
 *
 * A multipart file upload carries the document as a binary field (`document`)
 * and sends no JSON body; the server validates that file by magic bytes
 * (FR-17) and size ceiling (FR-1) in the `validateUpload` middleware.
 */
export interface AnalyzeRequestDto {
  /** Pasted document text to analyze. Required — must be non-empty after sanitisation. */
  text: string;
}

/**
 * Body for POST /api/chat.
 *
 * The full extracted document text is sent with every request because the
 * server is stateless — session content lives in the browser between calls
 * (SRS §5).
 */
export interface ChatRequestDto {
  /** Full extracted document text. Treated as delimited, untrusted data by the prompt. */
  sessionText: string;
  /** The user's question about the document. */
  question: string;
}

/**
 * Body for POST /api/checklist.
 *
 * Accepts the tagged clauses produced by an earlier /api/analyze call and
 * derives an actionable checklist plus lawyer-prep questions from them (FR-7,
 * FR-8).
 */
export interface ChecklistRequestDto {
  /** Tagged clauses from the analysis result. */
  clauses: ClauseDto[];
}

/**
 * Body for POST /api/checklist/export.
 *
 * Produces a downloadable text/PDF file containing the checklist and the
 * lawyer questions. No LLM call is made, so this endpoint sits behind the
 * global rate limiter only.
 */
export interface ExportRequestDto {
  /** Checklist items to include in the export. */
  checklist: string[];
  /** Lawyer-prep questions to include in the export. */
  lawyerQuestions: string[];
  /** Desired output format. */
  format: ExportFormat;
}

/**
 * Body for POST /api/compare.
 *
 * Two extracted document texts to align and diff clause-by-clause. When the
 * documents are uploaded as files the route receives multipart fields
 * `documentA` and `documentB` instead; the server extracts text from both
 * before diffing.
 */
export interface CompareRequestDto {
  /** Document A — the "before" text. */
  documentA: string;
  /** Document B — the "after" text. */
  documentB: string;
}
