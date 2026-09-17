/**
 * Clause tagging service (FR-4).
 *
 * Tags come from the LLM; severity is assigned deterministically here via
 * `calculateSeverity` so the same text always produces the same badge and the
 * rationale is inspectable. Duplicate clause text is cached by content hash so
 * boilerplate repeated across a document is never re-priced by the model.
 */
import { createHash } from 'node:crypto';
import type { ClauseDto, ClauseTag, RiskSeverity } from '../../shared/dto';

/** Words that mark a concrete, enforceable obligation. */
const ACTION_MARKERS = ['shall', 'must', 'required', 'agree to', 'will provide', 'obligated to'];

/** Words that signal significant financial/contractual exposure. */
const HIGH_MARKERS = [
  'terminat',
  'indemnif',
  'forfeit',
  'penalt',
  'liable',
  'liquidated',
  'non-compete',
  'confidential',
  'salary',
  '$',
  'breach',
  'exclusiv',
];

/** Words that limit or qualify a right. */
const LIMITATION_MARKERS = [
  'limitation',
  'cap',
  'deadline',
  'notice required',
  'subject to',
  'waive',
];

/**
 * Deterministic severity for a tagged clause.
 *
 * @param tag        - Clause tag produced by the model.
 * @param sourceText - The clause's original text.
 * @returns A Low/Medium/High severity that is stable for identical input.
 */
export function calculateSeverity(tag: ClauseTag, sourceText: string): RiskSeverity {
  const text = sourceText.toLowerCase();

  if (tag === 'Standard') return 'Low';

  if (tag === 'Risk') {
    if (HIGH_MARKERS.some((marker) => text.includes(marker))) return 'High';
    return 'Medium';
  }

  if (tag === 'Right') {
    if (LIMITATION_MARKERS.some((marker) => text.includes(marker))) return 'Medium';
    return 'Low';
  }

  if (tag === 'Obligation') {
    if (ACTION_MARKERS.some((marker) => text.includes(marker))) {
      return HIGH_MARKERS.some((marker) => text.includes(marker)) ? 'High' : 'Medium';
    }
    return 'Medium';
  }

  return 'Medium';
}

/**
 * Short plain-language justification for a severity.
 *
 * @param tag        - Clause tag.
 * @param sourceText - Clause text used for marker matching.
 * @param llmReason  - Optional model-provided justification, kept when it exists.
 * @returns A one-phrase reason string.
 */
export function severityReasonFor(tag: ClauseTag, sourceText: string, llmReason?: string): string {
  if (llmReason && llmReason.trim().length > 0) {
    return llmReason.trim();
  }
  const text = sourceText.toLowerCase();
  if (tag === 'Standard') return 'Standard, informational language.';
  if (tag === 'Obligation' && ACTION_MARKERS.some((marker) => text.includes(marker))) {
    return 'Contains a binding action you must perform.';
  }
  if (tag === 'Risk' && HIGH_MARKERS.some((marker) => text.includes(marker))) {
    return 'Involves possible financial or legal exposure.';
  }
  if (tag === 'Right' && LIMITATION_MARKERS.some((marker) => text.includes(marker))) {
    return 'The right is limited or conditional.';
  }
  return `This is a ${tag.toLowerCase()} clause with potential consequences.`;
}

/**
 * Hash the content of a clause for cache keys.
 *
 * @param text - Clause source text.
 * @returns Hex SHA-256 digest.
 */
export function createContentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Tag a clause through a cached provider.
 *
 * Identical clause text (e.g. repeated boilerplate) is tagged once and served
 * from the in-memory cache afterwards — the model is never re-priced for the
 * same content.
 *
 * @param cache    - Map used as the content-hash cache.
 * @param tagOne   - Function that tags a single clause via the model.
 * @param clause   - The clause text to tag.
 * @returns A tagged ClauseDto.
 */
export async function tagClauseCached(
  cache: Map<string, ClauseDto>,
  tagOne: (text: string) => Promise<ClauseDto>,
  clause: ClauseDto
): Promise<ClauseDto> {
  const key = createContentHash(clause.sourceText);
  const hit = cache.get(key);
  if (hit) {
    return { ...hit, id: clause.id };
  }
  const freshText = await tagOne(clause.sourceText);
  const tagged = { ...freshText, id: clause.id };
  cache.set(key, tagged);
  return tagged;
}

/**
 * Assert that a raw clause object is structurally valid.
 *
 * @param value - Untrusted parsed clause object.
 * @returns True when the object has the expected clause shape.
 */
export function isClauseShape(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sourceText' in value &&
    typeof (value as { sourceText?: unknown }).sourceText === 'string' &&
    'tag' in value &&
    'explanation' in value &&
    'severity' in value &&
    'severityReason' in value
  );
}
