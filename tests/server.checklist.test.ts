import { describe, expect, it } from 'vitest';
import { deriveChecklist, deriveLawyerQuestions } from '../server/services/checklist';

const mkClause = (
  over: Partial<{
    id: string;
    sourceText: string;
    tag: 'Obligation' | 'Right' | 'Risk' | 'Standard';
    explanation: string;
    severity: 'Low' | 'Medium' | 'High';
  }> = {}
) => ({
  id: over.id ?? 'c1',
  sourceText: over.sourceText ?? 'Some clause text.',
  tag: over.tag ?? 'Standard',
  explanation: over.explanation ?? 'An explanation.',
  severity: over.severity ?? 'Low',
  severityReason: 'auto',
});

describe('deriveChecklist', () => {
  it('flags obligations regardless of severity', () => {
    const items = deriveChecklist([mkClause({ tag: 'Obligation', severity: 'Low', id: 'c3' })]);
    expect(items).toEqual(['Review: An explanation. (Clause c3)']);
  });

  it('adds a risk item for Medium-severity risks', () => {
    const items = deriveChecklist([mkClause({ tag: 'Risk', severity: 'Medium', id: 'c4' })]);
    expect(items).toEqual(['Check risk: An explanation. (Clause c4)']);
  });

  it('skips Low-severity non-obligation clauses', () => {
    expect(deriveChecklist([mkClause({ tag: 'Right', severity: 'Low' })])).toEqual([]);
  });

  it('includes High-severity clauses of any tag', () => {
    const items = deriveChecklist([mkClause({ tag: 'Right', severity: 'High', id: 'c7' })]);
    expect(items).toEqual(['Check risk: An explanation. (Clause c7)']);
  });

  it('truncates long explanations to 200 chars', () => {
    const long = 'x'.repeat(250);
    const items = deriveChecklist([mkClause({ tag: 'Risk', severity: 'High', explanation: long })]);
    expect(items[0].startsWith('Check risk: ' + 'x'.repeat(200))).toBe(true);
    expect(items[0].length).toBe(12 + 'x'.repeat(200).length + 12);
  });
});

describe('deriveLawyerQuestions', () => {
  const long = 'y'.repeat(250);

  it('asks about every Risk clause and truncates long text', () => {
    const questions = deriveLawyerQuestions([
      mkClause({ tag: 'Risk', id: 'c1', sourceText: long }),
    ]);
    expect(questions[0]).toContain('(Clause c1)');
    expect(questions[0].length).toBeLessThan(long.length + 80);
    expect(questions[0]).toContain('"'.concat('y'.repeat(200), '"'));
  });

  it('asks whether a High obligation can be negotiated', () => {
    const questions = deriveLawyerQuestions([
      mkClause({ tag: 'Obligation', severity: 'High', id: 'c2' }),
    ]);
    expect(questions[0]).toContain('negotiated or removed');
    expect(questions[0]).toContain('(Clause c2)');
  });

  it('skips Low obligations, risks, rights and standards without a qualifying flag', () => {
    expect(
      deriveLawyerQuestions([
        mkClause({ tag: 'Obligation', severity: 'Low' }),
        mkClause({ tag: 'Right', severity: 'Medium' }),
        mkClause({ tag: 'Standard', severity: 'Medium' }),
      ])
    ).toEqual([
      'Are there any standard terms in this document that should be reviewed by a legal professional?',
    ]);
  });
});
