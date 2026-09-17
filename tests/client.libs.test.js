import { describe, expect, it, vi } from 'vitest';
import { SAMPLES, SAMPLE_BY_KEY, sampleByKey } from '../client/src/lib/samples.js';
import { copyText } from '../client/src/lib/clipboard.js';
import { scrollToClause } from '../client/src/lib/scrollTo.js';
import { deriveOptions } from '../client/src/lib/options.js';

describe('samples', () => {
  it('exposes three sample documents with the expected shape', () => {
    expect(SAMPLES).toHaveLength(3);
    for (const sample of SAMPLES) {
      expect(sample).toHaveProperty('key');
      expect(sample).toHaveProperty('category');
      expect(sample).toHaveProperty('title');
      expect(sample).toHaveProperty('fileName');
      expect(sample).toHaveProperty('text');
      expect(sample.text.length).toBeGreaterThan(100);
    }
  });

  it('has a lookup index covering every sample', () => {
    expect(Object.keys(SAMPLE_BY_KEY).sort()).toEqual(SAMPLES.map((sample) => sample.key).sort());
    expect(SAMPLE_BY_KEY['job-offer'].title).toContain('job offer');
    expect(SAMPLE_BY_KEY['rental-lease'].title).toContain('lease');
    expect(SAMPLE_BY_KEY['saas-tos'].title).toContain('terms of service');
  });

  it('returns the matching sample or null for unknown keys', () => {
    expect(sampleByKey('job-offer')).toBe(SAMPLE_BY_KEY['job-offer']);
    expect(sampleByKey('missing')).toBeNull();
  });
});

describe('copyText', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    await copyText('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
    delete navigator.clipboard;
  });

  it('falls back to a temporary textarea when the Clipboard API is missing', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const execSpy = vi.fn().mockReturnValue(true);
    document.execCommand = execSpy;
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    await copyText('fallback');
    expect(appendSpy).toHaveBeenCalled();
    const textarea = appendSpy.mock.calls.find(([node]) => node.tagName === 'TEXTAREA')?.[0];
    expect(textarea).toBeDefined();
    expect(textarea.value).toBe('fallback');
    expect(execSpy).toHaveBeenCalledWith('copy');
    expect(document.body.contains(textarea)).toBe(false);
    appendSpy.mockRestore();
    delete document.execCommand;
  });

  it('prefers the Clipboard API when it exists but writeText is absent', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: {}, configurable: true });
    const execSpy = vi.fn().mockReturnValue(true);
    document.execCommand = execSpy;
    await copyText('old-browser');
    expect(execSpy).toHaveBeenCalledWith('copy');
    delete document.execCommand;
    delete navigator.clipboard;
  });
});

describe('scrollToClause', () => {
  it('scrolls an existing clause element into view', () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    const element = document.createElement('div');
    element.id = 'clause-c42';
    document.body.appendChild(element);
    scrollToClause('c42');
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    scrollSpy.mockRestore();
  });

  it('does nothing when the clause element is missing', () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    scrollToClause('ghost');
    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });
});

describe('deriveOptions', () => {
  const clause = (id, tag, severity) => ({ id, tag, severity });

  it('surfaces one entry per high-severity clause only', () => {
    const result = deriveOptions([
      clause('c1', 'Risk', 'High'),
      clause('c2', 'Obligation', 'Medium'),
      clause('c3', 'Right', 'Low'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].clauseId).toBe('c1');
    expect(result[0].options).toContain('Ask for this clause to be removed or narrowed.');
  });

  it('maps each known tag to its own options', () => {
    const result = deriveOptions([
      clause('c1', 'Risk', 'High'),
      clause('c2', 'Obligation', 'High'),
      clause('c3', 'Right', 'High'),
      clause('c4', 'Standard', 'High'),
    ]);
    expect(result.map((entry) => entry.options[0])).toEqual([
      'Ask for this clause to be removed or narrowed.',
      'Ask whether this obligation can be capped or time-limited.',
      'Confirm how this right is exercised and by when.',
      'Ask the other party to justify why this term is needed.',
    ]);
  });

  it('falls back to neutral options for an unrecognised tag', () => {
    const result = deriveOptions([clause('c1', 'Non-Compete', 'High')]);
    expect(result[0].options).toEqual([
      'Note this clause and ask what it would take to change it.',
      'Ask your lawyer how this clause affects the rest of the agreement.',
    ]);
  });

  it('returns an empty list when nothing is high severity', () => {
    expect(deriveOptions([clause('c1', 'Risk', 'Low')])).toEqual([]);
    expect(deriveOptions([])).toEqual([]);
  });
});
