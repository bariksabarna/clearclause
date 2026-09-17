import { describe, expect, it } from 'vitest';
import {
  alignAndDiff,
  levenshteinDistance,
  normalizeText,
  SIMILARITY_THRESHOLD,
  similarity,
  splitClauses,
  tokenise,
  tokenOverlap,
} from '../server/services/alignDiff';

describe('normalizeText', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalizeText('  Party A, shall PAY $5   — today! ')).toBe('party a shall pay 5 today');
  });
});

describe('tokenise', () => {
  it('filters empty tokens', () => {
    expect(tokenise('  a  b  ')).toEqual(['a', 'b']);
  });
});

describe('levenshteinDistance', () => {
  it('is 0 for identical strings', () => {
    expect(levenshteinDistance('kitten', 'kitten')).toBe(0);
  });

  it('returns the other length when one side is empty', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  it('computes insertions, deletions, and substitutions', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('flaw', 'lawn')).toBe(2);
  });
});

describe('tokenOverlap', () => {
  it('is 1 for identical sets', () => {
    expect(tokenOverlap(['a', 'b'], ['b', 'a'])).toBe(1);
  });

  it('is 0 for disjoint sets', () => {
    expect(tokenOverlap(['a'], ['b'])).toBe(0);
  });

  it('computes a partial overlap', () => {
    expect(tokenOverlap(['a', 'b', 'c'], ['b', 'c', 'd'])).toBeCloseTo(0.5, 5);
  });

  it('returns 0 when both sets are empty', () => {
    expect(tokenOverlap([], [])).toBe(0);
  });
});

describe('similarity', () => {
  it('returns 1 for two empty texts', () => {
    expect(similarity('', '')).toBe(1);
  });

  it('is high for identical clause text', () => {
    expect(
      similarity('The tenant shall pay rent monthly.', 'The tenant shall pay rent monthly.')
    ).toBe(1);
  });

  it('is moderate for lightly reworded text', () => {
    expect(
      similarity('The tenant shall pay rent monthly.', 'The tenant must pay rent monthly.')
    ).toBeGreaterThan(SIMILARITY_THRESHOLD);
  });

  it('is below the threshold for unrelated clauses', () => {
    expect(similarity('quiet enjoyment', 'early termination penalty')).toBeLessThan(
      SIMILARITY_THRESHOLD
    );
  });
});

describe('splitClauses', () => {
  it('splits on double newlines when present', () => {
    expect(splitClauses('First paragraph.\n\nSecond paragraph.\n\n')).toEqual([
      'First paragraph.',
      'Second paragraph.',
    ]);
  });

  it('falls back to sentence boundaries for a single block', () => {
    expect(splitClauses('First sentence here. Second sentence there.')).toEqual([
      'First sentence here.',
      'Second sentence there.',
    ]);
  });

  it('keeps a single-sentence block intact', () => {
    expect(splitClauses('Only one sentence.')).toEqual(['Only one sentence.']);
  });

  it('falls back to the raw block when nothing can be split', () => {
    expect(splitClauses('')).toEqual(['']);
  });
});

describe('alignAndDiff', () => {
  it('reports unchanged for identical documents', () => {
    const doc = 'The tenant shall pay rent.\n\nThe landlord maintains the roof.';
    const diffs = alignAndDiff(doc, doc);
    expect(diffs).toEqual([
      expect.objectContaining({ clauseId: 'a1', status: 'unchanged' }),
      expect.objectContaining({ clauseId: 'a2', status: 'unchanged' }),
    ]);
  });

  it('reports modified when similarity exceeds the threshold', () => {
    const diffs = alignAndDiff(
      'The tenant shall pay rent monthly in advance.',
      'The tenant shall pay rent each month in advance.'
    );
    expect(diffs[0].status).toBe('modified');
    expect(diffs[0].explanation).toContain('→');
  });

  it('splits a low-confidence matched pair into removed plus added', () => {
    const diffs = alignAndDiff(
      'quiet enjoyment of the premises.',
      'massive penalty for breach, new term.'
    );
    const statuses = diffs.map((d) => d.status);
    expect(statuses).toContain('removed');
    expect(statuses).toContain('added');
  });

  it('marks unmatched clauses at the end as removed and added', () => {
    const diffs = alignAndDiff(
      'Clause alpha.\n\nClause beta.\n\nOnly present in A here.',
      'Clause alpha.\n\nClause beta.\n\nA completely unrelated arbitration clause.'
    );
    expect(diffs.some((d) => d.clauseId === 'a3' && d.status === 'removed')).toBe(true);
    expect(diffs.some((d) => d.clauseId === 'b3' && d.status === 'added')).toBe(true);
  });

  it('marks trailing clauses present only in B as added', () => {
    const diffs = alignAndDiff(
      'Clause alpha.\n\nClause beta.',
      'Clause alpha.\n\nClause beta.\n\nA brand new term in B.'
    );
    const b3 = diffs.find((d) => d.clauseId === 'b3');
    expect(b3?.status).toBe('added');
    expect(b3?.explanation).toContain('A brand new term in B.');
  });

  it('marks trailing clauses present only in A as removed', () => {
    const diffs = alignAndDiff(
      'Clause alpha.\n\nClause beta.\n\nA withdrawn term from A.',
      'Clause alpha.\n\nClause beta.'
    );
    const a3 = diffs.find((d) => d.clauseId === 'a3');
    expect(a3?.status).toBe('removed');
    expect(a3?.explanation).toContain('A withdrawn term from A.');
  });

  it('truncates explanations to 80 characters', () => {
    const huge = 'This clause has an enormously long description '
      .concat('that repeats '.repeat(12))
      .trim();
    const diffs = alignAndDiff(huge, huge.replace('description', 'fragment'));
    expect(diffs[0].explanation.length).toBeLessThan(huge.length);
  });
});
