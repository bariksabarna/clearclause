import { describe, expect, it } from 'vitest';
import { findInconsistencies } from '../server/services/inconsistencyChecker';

const clause = (id: string, sourceText: string) => ({
  id,
  sourceText,
  tag: 'Obligation' as const,
  explanation: 'x',
  severity: 'Medium' as const,
  severityReason: 'y',
});

describe('findInconsistencies', () => {
  it('returns zero inconsistencies for a consistent document', () => {
    const result = findInconsistencies([
      clause('c1', 'The tenant stays 12 months and pays $500.'),
      clause('c2', 'The lease runs 12 months total.'),
    ]);
    expect(result).toEqual([]);
  });

  it('flags conflicting day durations across clauses', () => {
    const result = findInconsistencies([
      clause('c1', 'Notice period is 30 days.'),
      clause('c2', 'Notice period is 60 days.'),
    ]);
    expect(result).toEqual([
      expect.objectContaining({
        clauseIds: ['c1', 'c2'],
        explanation: 'Conflicting duration in days: c1 (30) vs c2 (60).',
      }),
    ]);
  });

  it('flags conflicting months, years, and currency categories', () => {
    const result = findInconsistencies([
      clause('c1', 'Term is 5 months and the fee is $100.'),
      clause('c2', 'Term is 7 months and the fee is $250.'),
      clause('c3', 'Guarantee is for 2 years.'),
      clause('c4', 'Guarantee is for 1 years.'),
    ]);
    const explanations = result.map((r) => r.explanation);
    expect(explanations).toContain('Conflicting duration in months: c1 (5) vs c2 (7).');
    expect(explanations).toContain('Conflicting duration in years: c3 (2) vs c4 (1).');
    expect(explanations).toContain('Conflicting monetary terms: c1 ($100) vs c2 ($250).');
  });

  it('groups multiple values observed inside a single clause', () => {
    const result = findInconsistencies([
      clause('c1', 'Notice 30 days or 45 days depending on renewal.'),
      clause('c2', 'Notice 60 days otherwise.'),
    ]);
    expect(result[0].explanation).toContain('c1 (30 and 45) vs c2 (60)');
  });

  it('skips a category with conflicting values inside one clause only', () => {
    const result = findInconsistencies([clause('c1', 'Either 10 days or 20 days is allowed.')]);
    expect(result).toEqual([]);
  });

  it('parses currencies with decimals and thousands separators', () => {
    const result = findInconsistencies([
      clause('c1', 'Deposit of $1,234.56 due up front.'),
      clause('c2', 'Deposit of $2,000.00 due later.'),
    ]);
    expect(result[0].explanation).toContain('c1 ($1,234.56) vs c2 ($2,000.00)');
  });

  it('treats equivalent currency spellings as the same value', () => {
    const result = findInconsistencies([
      clause('c1', 'Deposit of $500 due up front.'),
      clause('c2', 'Deposit of $500.00 due later.'),
      clause('c3', 'Deposit of $1,000.00 due at signing.'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].explanation).toContain('c1 ($500)');
    expect(result[0].explanation).toContain('c2 ($500.00)');
    expect(result[0].explanation).toContain('c3 ($1,000.00)');
  });

  it('does not flag a document where only one currency value is written two ways', () => {
    const result = findInconsistencies([
      clause('c1', 'Deposit of $500 is required.'),
      clause('c2', 'The deposit of $500.00 is refundable.'),
    ]);
    expect(result).toEqual([]);
  });

  it('dedupes repeated identical values within one clause', () => {
    const result = findInconsistencies([
      clause('c1', 'Pay $500 rent and return the $500 deposit.'),
      clause('c2', 'The fee jumps to $600 total.'),
    ]);
    expect(result[0].explanation).toContain('c1 ($500) vs c2 ($600)');
  });

  it('handles singular and capitalized unit forms', () => {
    const result = findInconsistencies([
      clause('c1', 'Before moving in give 30 Day notice and hold for 1 Year.'),
      clause('c2', 'However allow 10 day notice and 2 Years total.'),
    ]);
    const explanations = result.map((r) => r.explanation);
    expect(explanations).toContain('Conflicting duration in days: c1 (30) vs c2 (10).');
    expect(explanations).toContain('Conflicting duration in years: c1 (1) vs c2 (2).');
  });
});
