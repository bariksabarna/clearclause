import { describe, expect, it, vi } from 'vitest';
import {
  calculateSeverity,
  createContentHash,
  isClauseShape,
  severityReasonFor,
  tagClauseCached,
} from '../server/services/clauseTagger';

describe('calculateSeverity', () => {
  it('Standard is always Low', () => {
    expect(calculateSeverity('Standard', 'Some standard language.')).toBe('Low');
  });

  it('Risk with a high-exposure marker is High', () => {
    expect(calculateSeverity('Risk', 'Tenant will be liable for all damages.')).toBe('High');
  });

  it('Risk without a high marker is Medium', () => {
    expect(calculateSeverity('Risk', 'Possibly contentious clause.')).toBe('Medium');
  });

  it('Right with a limitation marker is Medium', () => {
    expect(calculateSeverity('Right', 'Subject to prior approval, the tenant may sublet.')).toBe(
      'Medium'
    );
  });

  it('Right without a limitation marker is Low', () => {
    expect(calculateSeverity('Right', 'The tenant may renew the lease.')).toBe('Low');
  });

  it('Obligation with action and high markers is High', () => {
    expect(calculateSeverity('Obligation', 'The tenant shall pay $5,000 immediately.')).toBe(
      'High'
    );
  });

  it('Obligation with action but no high marker is Medium', () => {
    expect(
      calculateSeverity('Obligation', 'The tenant shall notify the landlord in writing.')
    ).toBe('Medium');
  });

  it('Obligation without an action marker is Medium', () => {
    expect(calculateSeverity('Obligation', 'The tenant is reminded of house rules.')).toBe(
      'Medium'
    );
  });

  it('unknown tags fall back to Medium', () => {
    // cast keeps the default branch reachable at runtime
    const unknown = 'Condition' as never;
    expect(calculateSeverity(unknown, 'Some text.')).toBe('Medium');
  });
});

describe('severityReasonFor', () => {
  it('keeps a provided, trimmed LLM reason', () => {
    expect(severityReasonFor('Risk', 'text', '  big exposure  ')).toBe('big exposure');
  });

  it('ignores a blank LLM reason and falls through', () => {
    expect(severityReasonFor('Standard', 'text', '   ')).toBe('Standard, informational language.');
  });

  it('produces a reason for an obligation with an action marker', () => {
    expect(severityReasonFor('Obligation', 'must provide advance notice', '')).toContain(
      'binding action'
    );
  });

  it('produces a reason for a high-risk clause', () => {
    expect(severityReasonFor('Risk', 'penalty applies', '')).toContain(
      'financial or legal exposure'
    );
  });

  it('produces a reason for a limited right', () => {
    expect(severityReasonFor('Right', 'subject to prior consent', '')).toContain(
      'limited or conditional'
    );
  });

  it('falls back to a generic phrasing otherwise', () => {
    expect(severityReasonFor('Obligation', 'the tenant is reminded of house rules')).toContain(
      'potential consequences'
    );
  });
});

describe('createContentHash', () => {
  it('is a deterministic sha256 digest', () => {
    const a = createContentHash('same text');
    expect(a).toBe(createContentHash('same text'));
    expect(a).toHaveLength(64);
    expect(a).not.toBe(createContentHash('different text'));
  });
});

describe('tagClauseCached', () => {
  const base = {
    id: 'c1',
    sourceText: 'Tenant must pay.',
    tag: 'Obligation' as const,
    explanation: 'Pay up.',
    severity: 'Medium' as const,
    severityReason: 'commitment',
  };

  it('calls the provider on a cache miss and stores the result', async () => {
    const cache = new Map<string, typeof base>();
    const tagOne = vi.fn().mockResolvedValue(base);
    const tagged = await tagClauseCached(cache, tagOne, { ...base, id: 'c9' });
    expect(tagOne).toHaveBeenCalledTimes(1);
    expect(tagged.id).toBe('c9');
    expect(cache.size).toBe(1);
  });

  it('serves cache hits without calling the provider', async () => {
    const cache = new Map<string, typeof base>([[createContentHash('Tenant must pay.'), base]]);
    const tagOne = vi.fn().mockResolvedValue(base);
    const tagged = await tagClauseCached(cache, tagOne, { ...base, id: 'c5' });
    expect(tagOne).not.toHaveBeenCalled();
    expect(tagged.id).toBe('c5');
  });
});

describe('isClauseShape', () => {
  const valid = {
    sourceText: 'text',
    tag: 'Obligation',
    explanation: 'exp',
    severity: 'High',
    severityReason: 'why',
  };

  it('accepts a well-formed clause', () => {
    expect(isClauseShape(valid)).toBe(true);
  });

  it('rejects null and non-objects', () => {
    expect(isClauseShape(null)).toBe(false);
    expect(isClauseShape('text')).toBe(false);
    expect(isClauseShape(undefined)).toBe(false);
  });

  it('rejects missing sourceText or a non-string sourceText', () => {
    const { sourceText: _s, ...rest } = valid;
    expect(isClauseShape(rest)).toBe(false);
    expect(isClauseShape({ ...valid, sourceText: 7 })).toBe(false);
  });

  it('rejects objects missing any other required field', () => {
    const variants: Array<Record<string, unknown>> = [
      { ...valid },
      { ...valid },
      { ...valid },
      { ...valid },
    ];
    delete variants[0].tag;
    delete variants[1].explanation;
    delete variants[2].severity;
    delete variants[3].severityReason;
    for (const variant of variants) {
      expect(isClauseShape(variant)).toBe(false);
    }
  });
});
