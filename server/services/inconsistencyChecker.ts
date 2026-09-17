/**
 * Deterministic inconsistency detector (FR-5).
 *
 * Extracts numeric values (durations, currencies) from each clause and flags
 * any unit for which two or more clauses report different values. The LLM's
 * own judgment is never trusted for this — it is a purely statistical,
 * deterministic pass that runs after tagging.
 */
import type { ClauseDto, InconsistencyDto } from '../../shared/dto';

/** Category types the cross-check cares about. */
type SlotCategory = 'days' | 'months' | 'years' | 'currency';

/** One extracted numeric value from a clause. */
interface ExtractedSlot {
  clauseId: string;
  category: SlotCategory;
  rawValue: string;
  /** Canonical comparison key; currency amounts collapse `$500` and `$500.00`. */
  key: string;
}

const DURATION_RE = /\b(\d+)\s+(days?|months?|years?)\b/gi;
const CURRENCY_RE = /\$\s*([\d,]+(?:\.\d{2})?)\b/g;

/**
 * Pull duration slots from a clause's text.
 *
 * @param clauseId - Clause id.
 * @param text     - Clause source text.
 * @returns Extracted duration slots.
 */
function extractDurations(clauseId: string, text: string): ExtractedSlot[] {
  const hits: ExtractedSlot[] = [];
  for (const match of text.matchAll(DURATION_RE)) {
    const value = match[1];
    const group = match[2].toLowerCase();
    const unit = (
      group === 'days' || group === 'months' || group === 'years' ? group : `${group}s`
    ) as 'days' | 'months' | 'years';
    hits.push({ clauseId, category: unit, rawValue: value, key: value });
  }
  return hits;
}

/**
 * Pull currency slots from a clause's text.
 *
 * @param clauseId - Clause id.
 * @param text     - Clause source text.
 * @returns Extracted currency slots.
 */
function extractCurrencies(clauseId: string, text: string): ExtractedSlot[] {
  const hits: ExtractedSlot[] = [];
  for (const match of text.matchAll(CURRENCY_RE)) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    const key = String(Math.round(amount * 100));
    hits.push({ clauseId, category: 'currency', rawValue: `$${match[1]}`, key });
  }
  return hits;
}

/**
 * Human-readable description of a category for the explanation.
 *
 * @param category - The slot category.
 * @returns A phrase the user can read.
 */
function describeCategory(category: SlotCategory): string {
  if (category === 'currency') return 'monetary terms';
  if (category === 'days') return 'duration in days';
  if (category === 'months') return 'duration in months';
  return 'duration in years';
}

/**
 * Cross-check all tagged clauses for numeric inconsistencies.
 *
 * @param clauses - Fully tagged clauses from the analysis pipeline.
 * @returns An array of InconsistencyDto; empty when no conflicts are found.
 */
export function findInconsistencies(clauses: ClauseDto[]): InconsistencyDto[] {
  const allSlots: ExtractedSlot[] = [];
  for (const clause of clauses) {
    allSlots.push(...extractDurations(clause.id, clause.sourceText));
    allSlots.push(...extractCurrencies(clause.id, clause.sourceText));
  }

  const byCategory = new Map<SlotCategory, ExtractedSlot[]>();
  for (const slot of allSlots) {
    const existing = byCategory.get(slot.category) ?? [];
    existing.push(slot);
    byCategory.set(slot.category, existing);
  }

  const inconsistencies: InconsistencyDto[] = [];
  for (const [category, slots] of byCategory.entries()) {
    const uniqueValues = new Set(slots.map((s) => s.key));
    if (uniqueValues.size <= 1) continue;

    const clauseIds = [...new Set(slots.map((s) => s.clauseId))];
    if (clauseIds.length < 2) continue;

    const seenByClause = new Map<string, Set<string>>();
    const perClause = slots.reduce<Record<string, string[]>>((acc, s) => {
      const seen = seenByClause.get(s.clauseId) ?? new Set<string>();
      seenByClause.set(s.clauseId, seen);
      if (!seen.has(s.key)) {
        seen.add(s.key);
        (acc[s.clauseId] = acc[s.clauseId] ?? []).push(s.rawValue);
      }
      return acc;
    }, {});
    const phrases = Object.entries(perClause)
      .map(([id, vals]) => `${id} (${vals.join(' and ')})`)
      .join(' vs ');

    inconsistencies.push({
      clauseIds,
      explanation: `Conflicting ${describeCategory(category)}: ${phrases}.`,
    });
  }

  return inconsistencies;
}
