/**
 * Shared enum-like constants and literal unions for ClearClause DTOs.
 *
 * Each category exposes a read-only array (usable at runtime for validation
 * and rendering) plus a matching literal union type for compile-time safety.
 * These are the single source of truth for every open-ended string value the
 * API accepts or returns — a string outside one of these arrays is not a valid
 * ClearClause value.
 */

/** The four clause classifications produced by the clause-tagging pipeline. */
export const CLAUSE_TAGS = ['Obligation', 'Right', 'Risk', 'Standard'] as const;
/** Union type of every valid clause tag. */
export type ClauseTag = (typeof CLAUSE_TAGS)[number];

/** Risk levels attached to a tagged clause. Never conveyed by color alone in the UI. */
export const RISK_SEVERITIES = ['Low', 'Medium', 'High'] as const;
/** Union type of every valid risk severity. */
export type RiskSeverity = (typeof RISK_SEVERITIES)[number];

/** Status of a clause pair in a contract comparison diff. */
export const DIFF_STATUSES = ['added', 'removed', 'modified', 'unchanged'] as const;
/** Union type of every valid diff status. */
export type DiffStatus = (typeof DIFF_STATUSES)[number];

/** Supported output formats for checklist / lawyer-prep export. */
export const EXPORT_FORMATS = ['pdf', 'txt'] as const;
/** Union type of every supported export format. */
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Languages supported by the summary/chat language toggle (Could-have). */
export const LANGUAGES = ['en', 'hi', 'bn'] as const;
/** Union type of every supported language code. */
export type Language = (typeof LANGUAGES)[number];

/** Version of the API contract. Included in responses so the frontend can detect a mismatch. */
export const API_VERSION = '1.0' as const;
