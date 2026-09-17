/**
 * Plain-language, non-advisory options for the highest-risk clauses (PRD-1 §3/§4).
 *
 * Only High-severity clauses are surfaced. Every option is phrased as something
 * the reader can raise, ask, or negotiate; none states or promises a legal
 * outcome.
 */

/** Options keyed by clause tag. */
const OPTIONS_BY_TAG = {
  Risk: [
    'Ask for this clause to be removed or narrowed.',
    'Request the specific limit be written into the contract.',
  ],
  Obligation: [
    'Ask whether this obligation can be capped or time-limited.',
    'Request a written exception for reasonable circumstances.',
  ],
  Right: [
    'Confirm how this right is exercised and by when.',
    'Ask what happens if you do not act within the stated window.',
  ],
  Standard: [
    'Ask the other party to justify why this term is needed.',
    'Request this term be aligned with the rest of the agreement.',
  ],
};

/** Neutral options for a High-severity clause whose tag is unrecognised. */
const FALLBACK_OPTIONS = [
  'Note this clause and ask what it would take to change it.',
  'Ask your lawyer how this clause affects the rest of the agreement.',
];

/**
 * Derive the "What are my options" entries for a tagged document.
 *
 * @param clauses - Tagged clauses from the analysis.
 * @returns One entry per High-severity clause, each with at least one option.
 */
export function deriveOptions(clauses) {
  return clauses
    .filter((clause) => clause.severity === 'High')
    .map((clause) => ({
      clauseId: clause.id,
      options: OPTIONS_BY_TAG[clause.tag] ?? FALLBACK_OPTIONS,
    }));
}
