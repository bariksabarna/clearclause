import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findInconsistencies } from '../server/services/inconsistencyChecker';
import { sanitizeText } from '../server/services/sanitize';

const samplesDir = resolve(process.cwd(), 'samples');

function clausesFrom(name: string) {
  const text = sanitizeText(readFileSync(resolve(samplesDir, name), 'utf8'));
  return text
    .split(/\n(?=\d+\.\s)/)
    .filter((part) => /^\d+\.\s/.test(part))
    .map((part, index) => ({
      id: `c${index + 1}`,
      sourceText: part.replace(/\s+/g, ' ').trim(),
      tag: 'Obligation' as const,
      explanation: 'x',
      severity: 'Medium' as const,
      severityReason: 'y',
    }));
}

function explanations(name: string) {
  return findInconsistencies(clausesFrom(name)).map((item) => item.explanation);
}

describe('demo samples', () => {
  it('job offer seeds conflicting months and monetary terms', () => {
    expect(explanations('job-offer.txt')).toEqual([
      'Conflicting monetary terms: c1 ($140,000) vs c6 ($8,000).',
      'Conflicting duration in months: c3 (18) vs c6 (12).',
    ]);
  });

  it('lease seeds conflicting day durations', () => {
    expect(explanations('apartment-lease.txt')).toEqual([
      'Conflicting duration in days: c3 (90) vs c4 (30) vs c5 (90).',
    ]);
  });

  it('terms of service seeds conflicting monetary terms', () => {
    expect(explanations('saas-tos.txt')).toEqual([
      'Conflicting monetary terms: c3 ($49) vs c6 ($500).',
    ]);
  });
});
