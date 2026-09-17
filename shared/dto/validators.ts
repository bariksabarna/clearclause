import { CLAUSE_TAGS, DIFF_STATUSES, EXPORT_FORMATS, RISK_SEVERITIES } from './enums';
import type { ClauseTag, DiffStatus, ExportFormat, RiskSeverity } from './enums';
import type { ClauseDto, InconsistencyDto } from './clause.dto';
import type {
  AnalyzeRequestDto,
  ChatRequestDto,
  ChecklistRequestDto,
  CompareRequestDto,
  ExportRequestDto,
} from './request.dto';
import type {
  AnalysisResponseDto,
  ChatResponseDto,
  ChecklistResponseDto,
  CompareResponseDto,
  DiffItemDto,
  ErrorResponseDto,
} from './response.dto';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isString = (v: unknown): v is string => typeof v === 'string';

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);

/**
 * Type guard for clause tag values.
 *
 * @param v - Value to test.
 * @returns True when `v` is one of the four clause tags.
 */
export function isClauseTag(v: unknown): v is ClauseTag {
  return typeof v === 'string' && (CLAUSE_TAGS as readonly string[]).includes(v);
}

/**
 * Type guard for risk severity values.
 *
 * @param v - Value to test.
 * @returns True when `v` is "Low" | "Medium" | "High".
 */
export function isRiskSeverity(v: unknown): v is RiskSeverity {
  return typeof v === 'string' && (RISK_SEVERITIES as readonly string[]).includes(v);
}

/**
 * Type guard for diff status values.
 *
 * @param v - Value to test.
 * @returns True when `v` is one of the four diff statuses.
 */
export function isDiffStatus(v: unknown): v is DiffStatus {
  return typeof v === 'string' && (DIFF_STATUSES as readonly string[]).includes(v);
}

/**
 * Type guard for export format values.
 *
 * @param v - Value to test.
 * @returns True when `v` is "pdf" or "txt".
 */
export function isExportFormat(v: unknown): v is ExportFormat {
  return typeof v === 'string' && (EXPORT_FORMATS as readonly string[]).includes(v);
}

/**
 * Validates a raw JSON value as a ClauseDto.
 *
 * Rejects any object missing a required field, with a non-string field, or
 * with a tag/severity outside the allowed enums.
 *
 * @param v - Value to validate.
 * @returns True when `v` conforms to ClauseDto.
 */
export function isClause(v: unknown): v is ClauseDto {
  if (!isRecord(v)) return false;
  return (
    isString(v.id) &&
    isString(v.sourceText) &&
    isClauseTag(v.tag) &&
    isString(v.explanation) &&
    isRiskSeverity(v.severity) &&
    isString(v.severityReason)
  );
}

/**
 * Validates a raw JSON value as an array of ClauseDto.
 *
 * @param v - Value to validate.
 * @returns True when `v` is a non-empty-safe array whose every element is a ClauseDto.
 */
export function isClauseArray(v: unknown): v is ClauseDto[] {
  return Array.isArray(v) && v.every(isClause);
}

/**
 * Validates a raw JSON value as an InconsistencyDto.
 *
 * @param v - Value to validate.
 * @returns True when `v` has a clauseIds array (2+ ids) and an explanation string.
 */
export function isInconsistency(v: unknown): v is InconsistencyDto {
  if (!isRecord(v)) return false;
  const ids = v.clauseIds;
  return Array.isArray(ids) && ids.length >= 2 && ids.every(isString) && isString(v.explanation);
}

/**
 * Validates the JSON body of POST /api/analyze (text variant).
 *
 * Requires a non-empty `text` string. The empty string is rejected here so
 * the route can return 400 before any AI call.
 *
 * @param v - Parsed request body.
 * @returns True when `v` conforms to AnalyzeRequestDto.
 */
export function isAnalyzeRequest(v: unknown): v is AnalyzeRequestDto {
  return isRecord(v) && isString(v.text) && v.text.length > 0;
}

/**
 * Validates the JSON body of POST /api/chat.
 *
 * @param v - Parsed request body.
 * @returns True when `v` has non-empty `sessionText` and `question` strings.
 */
export function isChatRequest(v: unknown): v is ChatRequestDto {
  return (
    isRecord(v) &&
    isString(v.sessionText) &&
    v.sessionText.length > 0 &&
    isString(v.question) &&
    v.question.length > 0
  );
}

/**
 * Validates the JSON body of POST /api/checklist.
 *
 * @param v - Parsed request body.
 * @returns True when `v` carries a non-empty array of ClauseDto.
 */
export function isChecklistRequest(v: unknown): v is ChecklistRequestDto {
  return isRecord(v) && isClauseArray(v.clauses) && v.clauses.length > 0;
}

/**
 * Validates the JSON body of POST /api/checklist/export.
 *
 * @param v - Parsed request body.
 * @returns True when `v` carries the two string lists and a valid format.
 */
export function isExportRequest(v: unknown): v is ExportRequestDto {
  return (
    isRecord(v) &&
    isStringArray(v.checklist) &&
    isStringArray(v.lawyerQuestions) &&
    isExportFormat(v.format)
  );
}

/**
 * Validates the JSON body of POST /api/compare.
 *
 * @param v - Parsed request body.
 * @returns True when `v` carries two non-empty document texts.
 */
export function isCompareRequest(v: unknown): v is CompareRequestDto {
  return (
    isRecord(v) &&
    isString(v.documentA) &&
    v.documentA.length > 0 &&
    isString(v.documentB) &&
    v.documentB.length > 0
  );
}

/**
 * Validates a raw JSON value as a DiffItemDto.
 *
 * @param v - Value to validate.
 * @returns True when `v` has a string clauseId, a valid diff status, and an explanation.
 */
export function isDiffItem(v: unknown): v is DiffItemDto {
  return isRecord(v) && isString(v.clauseId) && isDiffStatus(v.status) && isString(v.explanation);
}

/**
 * Validates a raw JSON value as an AnalysisResponseDto.
 *
 * @param v - Value to validate.
 * @returns True when `v` conforms to AnalysisResponseDto.
 */
export function isAnalysisResponse(v: unknown): v is AnalysisResponseDto {
  return (
    isRecord(v) &&
    isString(v.apiVersion) &&
    isString(v.summary) &&
    isClauseArray(v.clauses) &&
    Array.isArray(v.inconsistencies) &&
    v.inconsistencies.every(isInconsistency)
  );
}

/**
 * Validates a raw JSON value as a ChatResponseDto.
 *
 * @param v - Value to validate.
 * @returns True when `v` has an answer string and a string array of citations.
 */
export function isChatResponse(v: unknown): v is ChatResponseDto {
  return isRecord(v) && isString(v.answer) && isStringArray(v.citedClauseIds);
}

/**
 * Validates a raw JSON value as a ChecklistResponseDto.
 *
 * @param v - Value to validate.
 * @returns True when `v` carries both string arrays.
 */
export function isChecklistResponse(v: unknown): v is ChecklistResponseDto {
  return isRecord(v) && isStringArray(v.checklist) && isStringArray(v.lawyerQuestions);
}

/**
 * Validates a raw JSON value as a CompareResponseDto.
 *
 * @param v - Value to validate.
 * @returns True when `v` carries an array of DiffItemDto.
 */
export function isCompareResponse(v: unknown): v is CompareResponseDto {
  return isRecord(v) && Array.isArray(v.diffs) && v.diffs.every(isDiffItem);
}

/**
 * Validates a raw JSON value as an ErrorResponseDto.
 *
 * @param v - Value to validate.
 * @returns True when `v` has string `code` and `message`, with an optional numeric retry delay.
 */
export function isErrorResponse(v: unknown): v is ErrorResponseDto {
  if (!isRecord(v) || !isString(v.code) || !isString(v.message)) return false;
  return v.retryAfterMs === undefined || typeof v.retryAfterMs === 'number';
}
