/**
 * Clause-alignment diff service (FR-9, Should-have).
 *
 * Implements edit-distance clause alignment between two documents. The
 * similarity metric is a weighted blend of normalised Levenshtein distance
 * and token overlap (Jaccard). Pairs above a configurable threshold are
 * aligned; unmatched clauses are marked added/removed. Aligned pairs are
 * classified as unchanged (identical), modified, or one of the extremes.
 */
import type { DiffStatus } from '../../shared/dto';

/** Minimum combined score to accept a match between two clause texts. */
export const SIMILARITY_THRESHOLD = 0.45;

/**
 * Safety bounds for the quadratic alignment.
 *
 * `/api/compare` is unauthenticated, so without these a document crafted as
 * one giant clause (or tens of thousands of clauses) would make the O(n·m)
 * similarity matrix and the O(lenA·lenB) Levenshtein DP block the event loop.
 */
export const MAX_ALIGNED_CLAUSES = 500;
/** Above this many pairs the Levenshtein term is skipped (token overlap only). */
export const MAX_LEVENSHTEIN_PAIRS = 2500;
/** Longest normalized string each side is truncated to before the DP. */
export const MAX_LEVENSHTEIN_CHARS = 5000;

// ─── Text normalisation ─────────────────────────────────────────────────

/** Remove punctuation and lower-case for stable comparison. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split into unique tokens (words). */
export function tokenise(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized.split(' ').filter((w) => w.length > 0);
}

// ─── Similarity metrics ─────────────────────────────────────────────────

/** Classic Levenshtein distance, computed on normalised strings. */
export function levenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const prev = new Array<number>(lb + 1);
  const curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j += 1) prev[j] = j;

  for (let i = 1; i <= la; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= lb; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // delete
        curr[j - 1] + 1, // insert
        prev[j - 1] + cost // replace
      );
    }
    for (let j = 0; j <= lb; j += 1) prev[j] = curr[j];
  }
  return prev[lb];
}

/** Token-overlap Jaccard coefficient. */
export function tokenOverlap(aTokens: string[], bTokens: string[]): number {
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  const union = aSet.size + bSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Precomputed normalised text + tokens for one clause. */
interface PreparedClause {
  normalized: string;
  tokens: string[];
}

/** Normalise a clause once so the matrix does not re-normalise per pair. */
function prepareClause(text: string): PreparedClause {
  const normalized = normalizeText(text);
  return { normalized, tokens: normalized.split(' ').filter((w) => w.length > 0) };
}

/**
 * Score a precomputed pair.
 *
 * @param a         - Prepared clause A.
 * @param b         - Prepared clause B.
 * @param useLev    - When false, use token overlap only (bounds worst-case cost).
 * @returns Score in [0, 1].
 */
function scorePair(a: PreparedClause, b: PreparedClause, useLev: boolean): number {
  const maxLen = Math.max(a.normalized.length, b.normalized.length);
  if (maxLen === 0) return 1;

  const tokenScore = tokenOverlap(a.tokens, b.tokens);
  if (!useLev) return tokenScore;

  const aLev =
    a.normalized.length > MAX_LEVENSHTEIN_CHARS
      ? a.normalized.slice(0, MAX_LEVENSHTEIN_CHARS)
      : a.normalized;
  const bLev =
    b.normalized.length > MAX_LEVENSHTEIN_CHARS
      ? b.normalized.slice(0, MAX_LEVENSHTEIN_CHARS)
      : b.normalized;
  const levMax = Math.max(aLev.length, bLev.length);
  const levScore = 1 - levenshteinDistance(aLev, bLev) / levMax;

  return levScore * 0.55 + tokenScore * 0.45;
}

/**
 * Combined similarity score for two raw clause texts.
 *
 * Weighted: 55 % Levenshtein complement + 45 % token overlap. The blend
 * handles both minor rewording (Levenshtein) and heavy paraphrase where
 * shared vocabulary survives (token overlap).
 *
 * @param textA - Clause A source text.
 * @param textB - Clause B source text.
 * @returns Score in [0, 1].
 */
export function similarity(textA: string, textB: string): number {
  return scorePair(prepareClause(textA), prepareClause(textB), true);
}

// ─── Clause splitting ───────────────────────────────────────────────────

/**
 * Very rough clause splitter.
 *
 * First tries double-newline paragraphs. Falls back to sentence boundaries
 * if the result is still one big block.
 *
 * @param text - Full document text.
 * @returns A list of clause source texts; always non-empty.
 */
export function splitClauses(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length >= 2) return paragraphs;

  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences.length >= 1 ? sentences : [text];
}

// ─── Greedy alignment ───────────────────────────────────────────────────

export interface AlignResult {
  clauseId: string;
  status: DiffStatus;
  explanation: string;
}

/**
 * Perform greedy alignment and produce a DiffItemDto-compatible result.
 *
 * @param textA - Document A full text.
 * @param textB - Document B full text.
 * @returns Diff items representing the full diff.
 */
export function alignAndDiff(textA: string, textB: string): AlignResult[] {
  const allA = splitClauses(textA);
  const allB = splitClauses(textB);
  const clausesA = allA.slice(0, MAX_ALIGNED_CLAUSES);
  const clausesB = allB.slice(0, MAX_ALIGNED_CLAUSES);

  const n = clausesA.length;
  const m = clausesB.length;
  const useLev = n * m <= MAX_LEVENSHTEIN_PAIRS;

  const prepA = clausesA.map(prepareClause);
  const prepB = clausesB.map(prepareClause);

  // build similarity matrix
  const matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: m }, (_, j) => scorePair(prepA[i], prepB[j], useLev))
  );

  // flatten all pairs and sort by score descending
  const pairs: Array<{ i: number; j: number; score: number }> = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < m; j += 1) {
      pairs.push({ i, j, score: matrix[i][j] });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  const matchedA = new Set<number>();
  const matchedB = new Set<number>();
  const matches: Array<{ i: number; j: number; score: number }> = [];

  for (const pair of pairs) {
    if (matchedA.has(pair.i) || matchedB.has(pair.j)) continue;
    matches.push(pair);
    matchedA.add(pair.i);
    matchedB.add(pair.j);
  }

  const results: AlignResult[] = [];

  for (const match of matches) {
    const clauseId = `a${match.i + 1}`;
    const identical = normalizeText(clausesA[match.i]) === normalizeText(clausesB[match.j]);

    if (identical) {
      results.push({ clauseId, status: 'unchanged', explanation: 'Clause unchanged.' });
      continue;
    }

    const shortA = clausesA[match.i].slice(0, 80);
    const shortB = clausesB[match.j].slice(0, 80);

    if (match.score >= SIMILARITY_THRESHOLD) {
      results.push({
        clauseId,
        status: 'modified',
        explanation: `Clause modified: "${shortA}" → "${shortB}"`,
      });
    } else {
      // low-confidence match treated as a removal + addition
      results.push({
        clauseId,
        status: 'removed',
        explanation: `Clause removed: "${shortA}"`,
      });
      results.push({
        clauseId: `b${match.j + 1}`,
        status: 'added',
        explanation: `Clause added: "${shortB}"`,
      });
    }
  }

  // unmatched from A → removed
  for (let i = 0; i < n; i += 1) {
    if (!matchedA.has(i)) {
      results.push({
        clauseId: `a${i + 1}`,
        status: 'removed',
        explanation: `Clause removed: "${clausesA[i].slice(0, 80)}"`,
      });
    }
  }

  // unmatched from B → added
  for (let j = 0; j < m; j += 1) {
    if (!matchedB.has(j)) {
      results.push({
        clauseId: `b${j + 1}`,
        status: 'added',
        explanation: `Clause added: "${clausesB[j].slice(0, 80)}"`,
      });
    }
  }

  // clauses beyond the alignment bound are reported positionally (no data loss)
  for (let i = clausesA.length; i < allA.length; i += 1) {
    results.push({
      clauseId: `a${i + 1}`,
      status: 'removed',
      explanation: `Clause removed: "${allA[i].slice(0, 80)}"`,
    });
  }
  for (let j = clausesB.length; j < allB.length; j += 1) {
    results.push({
      clauseId: `b${j + 1}`,
      status: 'added',
      explanation: `Clause added: "${allB[j].slice(0, 80)}"`,
    });
  }

  return results;
}
