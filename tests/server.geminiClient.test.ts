import { describe, expect, it, vi } from 'vitest';
import {
  buildChatPrompt,
  buildChecklistPrompt,
  buildSummaryPrompt,
  buildTaggingPrompt,
  parseChatResponse,
  parseChecklistResponse,
  parseJsonBlock,
  parseSummaryResponse,
  parseTaggingResponse,
  requestText,
} from '../server/services/geminiClient';

describe('parseJsonBlock', () => {
  it('parses plain JSON', () => {
    expect(parseJsonBlock('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses fenced JSON with and without a language tag', () => {
    expect(parseJsonBlock('```json\n[1,2]\n```')).toEqual([1, 2]);
    expect(parseJsonBlock('```\n{"x":true}\n```')).toEqual({ x: true });
  });

  it('extracts a JSON object from prose when the object closes last', () => {
    const parsed = parseJsonBlock('Sure, here is the result: {"answer":"yes"} thank you');
    expect(parsed).toEqual({ answer: 'yes' });
  });

  it('extracts a JSON array from prose when no object is present', () => {
    expect(parseJsonBlock('pre text [1, 2, 3] post text')).toEqual([1, 2, 3]);
  });

  it('handles an object that contains an array and closes after it', () => {
    const parsed = parseJsonBlock('xxx {"a": [1, 2]} wrap');
    expect(parsed).toEqual({ a: [1, 2] });
  });

  it('throws when an array closes after an object in flat prose', () => {
    expect(() => parseJsonBlock('xx {"a":1} then [2,3]')).toThrow();
  });

  it('throws when no JSON-like structure exists', () => {
    expect(() => parseJsonBlock('just some prose without json')).toThrow('NO_JSON_IN_RESPONSE');
  });
});

describe('prompt builders', () => {
  it('buildSummaryPrompt fences the document and demands data-only treatment', () => {
    const prompt = buildSummaryPrompt('LEASE TEXT');
    expect(prompt).toContain('<document>\nLEASE TEXT\n</document>');
    expect(prompt).toContain('never as instructions');
    expect(prompt).toContain('not a legal or contractual document');
  });

  it('buildTaggingPrompt demands strict JSON and the four tags', () => {
    const prompt = buildTaggingPrompt('CLAUSE');
    expect(prompt).toContain('<document>\nCLAUSE\n</document>');
    expect(prompt).toContain('Obligation');
    expect(prompt).toContain('severityReason');
  });

  it('buildChatPrompt embeds the question and demands citations', () => {
    const prompt = buildChatPrompt('DOC', 'Can I end early?');
    expect(prompt).toContain('Can I end early?');
    expect(prompt).toContain('citedClauseIds');
    expect(prompt).toContain('fabricate an answer');
  });

  it('buildChecklistPrompt references the tagged clauses JSON', () => {
    const prompt = buildChecklistPrompt('[tagged]');
    expect(prompt).toContain('<clauses>\n[tagged]\n</clauses>');
    expect(prompt).toContain('lawyerQuestions');
  });
});

describe('parseTaggingResponse', () => {
  it('maps a clean array, falling back to positional ids when missing', () => {
    const raw = JSON.stringify([
      {
        id: 'x1',
        sourceText: 'A',
        tag: 'Risk',
        explanation: 'e',
        severity: 'High',
        severityReason: 'r',
      },
      { sourceText: 'B', tag: 'Obligation', explanation: 'e2', severity: 'Medium' },
    ]);
    const clauses = parseTaggingResponse(raw);
    expect(clauses[0].id).toBe('x1');
    expect(clauses[1].id).toBe('c2');
    expect(clauses[1].severityReason).toBe('');
  });

  it('tolerates an invalid tag/severity by coercion', () => {
    const raw = JSON.stringify([{ sourceText: 'T', tag: 'Bogus', severity: 'Oops' }]);
    const [clause] = parseTaggingResponse(raw);
    expect(clause.tag).toBe('Bogus');
    expect(clause.severity).toBe('Oops');
  });

  it('tolerates non-object and null array items', () => {
    const raw = JSON.stringify([null, 7, { sourceText: 'OK', tag: 'Right', severity: 'Low' }]);
    const clauses = parseTaggingResponse(raw);
    expect(clauses[0]).toMatchObject({
      id: 'c1',
      sourceText: '',
      tag: 'Standard',
      severity: 'Low',
    });
    expect(clauses[1]).toMatchObject({ id: 'c2' });
    expect(clauses[2]).toMatchObject({ id: 'c3' });
  });

  it('returns an empty list when the payload is not an array', () => {
    expect(parseTaggingResponse('{"clauses":"not a list"}')).toEqual([]);
    expect(parseTaggingResponse('"a bare string"')).toEqual([]);
  });
});

describe('parseChatResponse', () => {
  it('reads answer and cited clause ids', () => {
    const parsed = parseChatResponse('{"answer":"Yes.","citedClauseIds":["c1","c2",7]}');
    expect(parsed.answer).toBe('Yes.');
    expect(parsed.citedClauseIds).toEqual(['c1', 'c2']);
  });

  it('defaults when the payload is not an object', () => {
    expect(parseChatResponse('"nope"')).toEqual({ answer: '', citedClauseIds: [] });
  });
});

describe('parseChecklistResponse', () => {
  it('reads both string arrays', () => {
    const parsed = parseChecklistResponse('{"checklist":["a"],"lawyerQuestions":["b"]}');
    expect(parsed).toEqual({ checklist: ['a'], lawyerQuestions: ['b'] });
  });

  it('defaults non-array fields to []', () => {
    expect(parseChecklistResponse('{}')).toEqual({ checklist: [], lawyerQuestions: [] });
    expect(parseChecklistResponse('{"checklist":"x"}')).toEqual({
      checklist: [],
      lawyerQuestions: [],
    });
  });

  it('defaults when the payload is not an object', () => {
    expect(parseChecklistResponse('"oops"')).toEqual({ checklist: [], lawyerQuestions: [] });
    expect(parseChecklistResponse('null')).toEqual({ checklist: [], lawyerQuestions: [] });
  });
});

describe('parseSummaryResponse', () => {
  it('strips fences', () => {
    expect(parseSummaryResponse('```\nA short summary.\n```')).toBe('A short summary.');
  });

  it('keeps plain text intact', () => {
    expect(parseSummaryResponse('A plain summary.')).toBe('A plain summary.');
  });
});

describe('requestText', () => {
  const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const textResponse = (text: string): Response =>
    jsonResponse({ candidates: [{ content: { parts: [{ text }] } }] });

  it('returns the joined candidate text on success', async () => {
    const fetchFn = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> =>
        jsonResponse({ candidates: [{ content: { parts: [{ text: 'one' }, { text: 'two' }] } }] })
    );
    const result = await requestText('prompt', { apiKey: 'k', fetchFn, retries: 0 });
    expect(result).toBe('onetwo');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain('models/gemini-2.0-flash:generateContent');
    expect((init as RequestInit).body).toContain('prompt');
  });

  it('retries a 500 once with backoff then succeeds', async () => {
    const fetchFn = vi
      .fn(async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> =>
        textResponse('recovered')
      )
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'busy' } }, 500));
    const result = await requestText('prompt', { apiKey: 'k', fetchFn, retries: 1, backoffMs: 0 });
    expect(result).toBe('recovered');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('exhausts retries and throws aiUnreachable on persistent 500s', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: { message: 'down' } }, 500));
    await expect(
      requestText('p', { apiKey: 'k', fetchFn, retries: 1, backoffMs: 0 })
    ).rejects.toMatchObject({
      name: 'AppError',
      code: 'AI_UNREACHABLE',
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('throws aiUnreachable for a safety-blocked response without retrying', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ error: { message: 'Request blocked by SAFETY filters' } }, 400)
    );
    await expect(requestText('p', { apiKey: 'k', fetchFn, retries: 0 })).rejects.toMatchObject({
      code: 'AI_UNREACHABLE',
    });
  });

  it('throws aiUnreachable when a non-retryable error body is not JSON', async () => {
    const fetchFn = vi.fn(async () => new Response('<html>oops</html>', { status: 400 }));
    await expect(requestText('p', { apiKey: 'k', fetchFn, retries: 0 })).rejects.toMatchObject({
      name: 'AppError',
    });
  });

  it('throws aiUnreachable when the model returns no text', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ candidates: [] }));
    await expect(requestText('p', { apiKey: 'k', fetchFn, retries: 0 })).rejects.toMatchObject({
      name: 'AppError',
    });
  });

  it('throws aiUnreachable when the network call fails outright', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(requestText('p', { apiKey: 'k', fetchFn, retries: 0 })).rejects.toMatchObject({
      name: 'AppError',
    });
  });

  it('joins parts, treating missing part text as empty', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: 'head ' }, {}, { text: 'tail' }] } }],
      })
    );
    await expect(requestText('p', { apiKey: 'k', fetchFn, retries: 0 })).resolves.toBe('head tail');
  });

  it('falls back to global fetch and default options when none are provided', async () => {
    await expect(requestText('p', { apiKey: 'k' })).rejects.toMatchObject({ name: 'AppError' });
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('aborts in-flight requests after the timeout and throws aiUnreachable', async () => {
    const fetchFn = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    await expect(
      requestText('p', { apiKey: 'k', fetchFn, retries: 0, timeoutMs: 5 })
    ).rejects.toMatchObject({ name: 'AppError' });
  });
});
