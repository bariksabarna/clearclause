import type { ClauseTag, RiskSeverity } from './enums';

/**
 * Clause entity DTO.
 *
 * One discrete provision of the uploaded document (a numbered section,
 * paragraph, or bullet) after it has been tagged by the analysis pipeline.
 * The `sourceText` is always the clause's original, unmodified text so it can
 * be rendered verbatim in the document pane.
 *
 * Mirrors the `Clause` interface in PRD-1 §6.
 */
export interface ClauseDto {
  /** Stable identifier within a session, e.g. "c1". Assigned after merge, so it is never duplicated. */
  id: string;
  /** The clause's original text, unmodified. */
  sourceText: string;
  /** Classification of what the clause does. Exactly one per clause. */
  tag: ClauseTag;
  /** One-sentence plain-English explanation, free of legal jargon. */
  explanation: string;
  /** Risk level attached to this clause. Rendered with icon + text, never color alone. */
  severity: RiskSeverity;
  /** Short justification for the severity, shown on hover/tap. */
  severityReason: string;
}

/**
 * Inconsistency DTO.
 *
 * Flags a detected contradiction between clauses (e.g. conflicting dates,
 * contradictory obligations). Produced by a deterministic cross-check pass
 * (FR-5), never trusted to the model's judgment alone.
 */
export interface InconsistencyDto {
  /** Ids of the clauses that contradict each other. Two or more. */
  clauseIds: string[];
  /** Plain-language description of what contradicts what. */
  explanation: string;
}

/**
 * Chat turn DTO.
 *
 * One grounded question/answer exchange. Every answer either cites at least
 * one clause id or explicitly states the document does not address the
 * question — a fabricated answer is never valid (FR-6).
 */
export interface ChatTurnDto {
  /** The user's question. */
  question: string;
  /** The grounded answer, generated only from the uploaded document. */
  answer: string;
  /** Clause ids cited by the answer. Empty when the document does not address the question. */
  citedClauseIds: string[];
}
