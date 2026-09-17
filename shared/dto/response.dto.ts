import type { ClauseDto, InconsistencyDto } from './clause.dto';
import type { DiffStatus } from './enums';

/**
 * Response DTOs for every ClearClause API endpoint.
 *
 * Each shape corresponds one-to-one with the SRS §6 API contracts. Responses
 * carry `apiVersion` so the frontend can log a mismatch against what it
 * expects (FR-20).
 */

/**
 * Response for POST /api/analyze (streamed).
 *
 * The plain-language summary plus the clause-by-clause breakdown, and any
 * deterministic inconsistencies detected between clauses (FR-3, FR-4, FR-5).
 */
export interface AnalysisResponseDto {
  /** API contract version, used by the frontend for mismatch detection (FR-20). */
  apiVersion: string;
  /** Plain-language summary of the whole document, 3–5 sentences (FR-3). */
  summary: string;
  /** Tagged clauses with severity and explanation (FR-4). */
  clauses: ClauseDto[];
  /** Contradictions detected between clauses. Empty when none are found (FR-5). */
  inconsistencies: InconsistencyDto[];
}

/**
 * Response for POST /api/chat (streamed).
 *
 * A grounded answer with citations to the clauses it used. `citedClauseIds`
 * is empty when the document does not address the question (FR-6).
 */
export interface ChatResponseDto {
  /** The grounded answer, generated only from the uploaded document. */
  answer: string;
  /** Clause ids used to produce the answer. */
  citedClauseIds: string[];
}

/**
 * Response for POST /api/checklist.
 *
 * The actionable checklist and the "questions to ask a lawyer" list (FR-7,
 * FR-8).
 */
export interface ChecklistResponseDto {
  /** Practical action items derived from flagged obligations/risks. */
  checklist: string[];
  /** Specific questions to ask a lawyer, each referencing its clause. */
  lawyerQuestions: string[];
}

/**
 * Response for POST /api/compare.
 *
 * Clause-level diff between two documents (FR-9). Status is conveyed by both
 * color and a +/−/~ glyph in the UI, never by color alone.
 */
export interface CompareResponseDto {
  /** Per-clause diff entries between document A and document B. */
  diffs: DiffItemDto[];
}

/**
 * One diff entry within a compare response.
 */
export interface DiffItemDto {
  /** Stable id of the clause in document A (or in B when the clause was added). */
  clauseId: string;
  /** Whether the clause was added, removed, modified, or left unchanged. */
  status: DiffStatus;
  /** One-line plain-English explanation of the change. */
  explanation: string;
}

/**
 * Uniform error response body.
 *
 * `code` is a stable machine-readable string (e.g. "UNSUPPORTED_FILE_TYPE",
 * "UPLOAD_TOO_LARGE", "RATE_LIMITED", "AI_UNREACHABLE") the client can branch
 * on; `message` is the plain-language string shown to the user.
 */
export interface ErrorResponseDto {
  /** Stable machine-readable error code. */
  code: string;
  /** Plain-language, user-facing error message. */
  message: string;
  /** Retry delay in milliseconds for rate-limit (429), provider-timeout, or backoff errors. */
  retryAfterMs?: number;
}
