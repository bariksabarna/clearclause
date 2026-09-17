/**
 * Chunking service (FR-13).
 *
 * Splits a long document into overlapping word windows so each AI call stays
 * within the model's context window, then merges per-chunk clause results
 * into one list with re-sequenced, non-duplicated ids.
 */
import type { ClauseDto } from '../../shared/dto';

export interface ChunkOptions {
  /** Maximum words per chunk before a document is split. */
  maxWords: number;
  /** Words repeated from the previous chunk to preserve clause boundaries. */
  overlapWords: number;
}

/** Split text into words, collapsing all whitespace runs. */
export function tokenizeWords(text: string): string[] {
  return text.split(/\s+/).filter((word) => word.length > 0);
}

/**
 * Split a word array into overlapping windows.
 *
 * Guarantees windows are adjacent (each starts where the previous began its
 * overlap) and never empty.
 *
 * @param words   - Tokenised document words.
 * @param maxWords - Window size.
 * @param overlapWords - Words carried over between windows.
 * @returns Array of word windows, each a string[].
 */
export function buildWindows(words: string[], maxWords: number, overlapWords: number): string[][] {
  if (words.length === 0) return [];
  if (words.length <= maxWords) return [words];

  const windows: string[][] = [];
  const step = Math.max(1, maxWords - overlapWords);
  for (let start = 0; start < words.length; start += step) {
    windows.push(words.slice(start, start + maxWords));
  }
  return windows;
}

/**
 * Chunk a document into overlapping text segments.
 *
 * @param text    - Full document text.
 * @param options - Chunk sizing configuration.
 * @returns Text chunks; always at least one when the text is non-empty.
 */
export function chunkText(text: string, options: ChunkOptions): string[] {
  const words = tokenizeWords(text);
  const windows = buildWindows(words, options.maxWords, options.overlapWords);
  if (windows.length === 0) return [];
  return windows.map((window) => window.join(' '));
}

/**
 * Determine whether a document needs chunking at all.
 *
 * @param text    - Full document text.
 * @param options - Chunk sizing configuration.
 * @returns True when the text exceeds the window size.
 */
export function needsChunking(text: string, options: ChunkOptions): boolean {
  return tokenizeWords(text).length > options.maxWords;
}

/**
 * Merge clause lists from multiple chunks into one clean list.
 *
 * Exact-duplicate source text is collapsed (identical boilerplate clauses
 * appear only once) and ids are re-sequenced `c1..cN` so the client sees a
 * stable, gapless identifier set.
 *
 * @param chunkResults - Clause arrays produced per chunk.
 * @returns A single deduplicated, re-sequenced clause list.
 */
export function mergeChunkResults(chunkResults: ClauseDto[][]): ClauseDto[] {
  const seen = new Set<string>();
  const merged: ClauseDto[] = [];
  for (const clauses of chunkResults) {
    for (const clause of clauses) {
      const key = clause.sourceText.trim();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(clause);
    }
  }
  return merged.map((clause, index) => ({ ...clause, id: `c${index + 1}` }));
}
