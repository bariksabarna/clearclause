import { describe, expect, it } from 'vitest';
import {
  buildWindows,
  chunkText,
  mergeChunkResults,
  needsChunking,
  tokenizeWords,
} from '../server/services/chunker';

const TEXT = 'a b c d e f g h';

describe('tokenizeWords', () => {
  it('splits on whitespace and drops empty tokens', () => {
    expect(tokenizeWords('  a\t b\n\nc ')).toEqual(['a', 'b', 'c']);
    expect(tokenizeWords('')).toEqual([]);
  });
});

describe('buildWindows', () => {
  it('returns an empty list for empty input', () => {
    expect(buildWindows([], 3, 1)).toEqual([]);
  });

  it('returns the whole list when it fits the window', () => {
    expect(buildWindows(['a', 'b'], 3, 1)).toEqual([['a', 'b']]);
  });

  it('builds overlapping windows with a positive step', () => {
    const windows = buildWindows(TEXT.split(' '), 4, 1);
    expect(windows).toEqual([
      ['a', 'b', 'c', 'd'],
      ['d', 'e', 'f', 'g'],
      ['g', 'h'],
    ]);
  });

  it('uses a step of at least 1 even when the overlap is huge', () => {
    const windows = buildWindows(TEXT.split(' '), 3, 10);
    expect(windows[0]).toEqual(['a', 'b', 'c']);
    expect(windows[1]).toEqual(['b', 'c', 'd']);
  });
});

describe('chunkText', () => {
  it('returns [] for empty text', () => {
    expect(chunkText('', { maxWords: 3, overlapWords: 1 })).toEqual([]);
  });

  it('returns a single chunk for short text', () => {
    expect(chunkText('a b', { maxWords: 3, overlapWords: 1 })).toEqual(['a b']);
  });

  it('joins each window into a text chunk', () => {
    const chunks = chunkText(TEXT, { maxWords: 4, overlapWords: 1 });
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toBe('a b c d');
    expect(chunks[1]).toBe('d e f g');
  });
});

describe('needsChunking', () => {
  it('is false at or below the window size', () => {
    expect(needsChunking('a b c', { maxWords: 3, overlapWords: 1 })).toBe(false);
  });

  it('is true above the window size', () => {
    expect(needsChunking(TEXT, { maxWords: 4, overlapWords: 1 })).toBe(true);
  });
});

describe('mergeChunkResults', () => {
  const clause = (id: string, text: string) => ({
    id,
    sourceText: text,
    tag: 'Standard' as const,
    explanation: 'x',
    severity: 'Low' as const,
    severityReason: 'y',
  });

  it('flattens chunk lists and re-sequences ids c1..cN', () => {
    const merged = mergeChunkResults([
      [clause('z9', 'First clause text.')],
      [clause('z1', 'Second clause text.')],
    ]);
    expect(merged.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('collapses exact-duplicate source text across chunks', () => {
    const dedup = mergeChunkResults([
      [clause('a', 'Boilerplate term.')],
      [clause('b', 'Boilerplate term.')],
    ]);
    expect(dedup).toHaveLength(1);
  });

  it('does not collapse clauses that differ only in whitespace case-sensitively after trimming', () => {
    const distinct = mergeChunkResults([[clause('a', 'Term one.')], [clause('b', 'Term One.')]]);
    expect(distinct).toHaveLength(2);
  });
});
