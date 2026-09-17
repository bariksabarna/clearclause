import { describe, expect, it, vi } from 'vitest';
import {
  MAX_UPLOAD_BYTES,
  isIntakeErrorCode,
  ApiError,
  consumeSse,
  streamAnalyze,
  chatDocument,
  deriveChecklist,
  compareDocuments,
  exportChecklist,
  downloadBlob,
} from '../client/src/lib/api.js';

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    blob: async () => new Blob([JSON.stringify(body)]),
  };
}

function readerFromChunks(chunks) {
  const queue = [...chunks];
  return {
    read: async () => {
      const value = queue.shift();
      return value === undefined ? { done: true, value: undefined } : { done: false, value };
    },
    releaseLock: () => {},
  };
}

function withFetch(body, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body, ok, status));
  globalThis.fetch = fetchMock;
  return fetchMock;
}

describe('MAX_UPLOAD_BYTES', () => {
  it('is 5 MiB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe('isIntakeErrorCode', () => {
  it('recognizes intake codes and rejects others', () => {
    expect(isIntakeErrorCode('UNSUPPORTED_FILE_TYPE')).toBe(true);
    expect(isIntakeErrorCode('UPLOAD_TOO_LARGE')).toBe(true);
    expect(isIntakeErrorCode('SCANNED_PDF')).toBe(true);
    expect(isIntakeErrorCode('EXTRACTED_TEXT_TOO_LARGE')).toBe(true);
    expect(isIntakeErrorCode('EMPTY_DOCUMENT')).toBe(true);
    expect(isIntakeErrorCode('RATE_LIMITED')).toBe(false);
  });
});

describe('ApiError', () => {
  it('applies defaults when nothing is provided', () => {
    const error = new ApiError({});
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(0);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('The request failed. Please try again.');
    expect(error.retryAfterMs).toBeUndefined();
    expect(error).toBeInstanceOf(Error);
  });

  it('honours explicit fields', () => {
    const error = new ApiError({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too fast',
      retryAfterMs: 1500,
    });
    expect(error.status).toBe(429);
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.message).toBe('Too fast');
    expect(error.retryAfterMs).toBe(1500);
  });
});

describe('consumeSse', () => {
  it('parses and dispatches complete blocks, returning the remainder', () => {
    const events = [];
    const rest = consumeSse(
      'event: status\ndata: {"stage":"reading"}\n\nevent: done\ndata: null\n\npartial',
      (event) => events.push(event)
    );
    expect(events).toEqual([
      { type: 'status', data: { stage: 'reading' } },
      { type: 'done', data: null },
    ]);
    expect(rest).toBe('partial');
  });

  it('keeps parsing when a block has no data and leaves non-block buffers alone', () => {
    const events = [];
    const rest = consumeSse('event: status\n\nno-boundary', (event) => events.push(event));
    expect(events).toEqual([]);
    expect(rest).toBe('no-boundary');
  });

  it('treats a lone message line without events as a message', () => {
    const events = [];
    consumeSse('data: {"raw":true}\n\n', (event) => events.push(event));
    expect(events).toEqual([{ type: 'message', data: { raw: true } }]);
  });

  it('falls back to the raw string when data is not valid JSON', () => {
    const events = [];
    consumeSse('event: message\ndata: hello world\n\n', (event) => events.push(event));
    expect(events).toEqual([{ type: 'message', data: 'hello world' }]);
  });
});

describe('streamAnalyze', () => {
  it('streams an empty SSE body when the stream ends immediately', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => readerFromChunks([]) },
    });
    const handlers = { status: vi.fn(), clauses: vi.fn() };
    await streamAnalyze({ text: 'hello' }, handlers);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(handlers.status).not.toHaveBeenCalled();
    expect(handlers.clauses).not.toHaveBeenCalled();
  });

  it('dispatches every event across chunk boundaries', async () => {
    const payload = { text: 'hello' };
    const events = [
      sseChunk('status', { stage: 'reading' }),
      sseChunk('status', { stage: 'analyzing' }),
      sseChunk('clauses', [{ id: 'c1', tag: 'Non-Compete' }]),
      sseChunk('done', null),
    ];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () =>
          readerFromChunks([
            new TextEncoder().encode(events[0].slice(0, 7)),
            new TextEncoder().encode(events[0].slice(7) + events[1]),
            new TextEncoder().encode(events[2] + events[3]),
          ]),
      },
    });
    const handlers = { status: vi.fn(), clauses: vi.fn(), done: vi.fn() };
    await streamAnalyze(payload, handlers);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(handlers.status).toHaveBeenNthCalledWith(1, { stage: 'reading' });
    expect(handlers.status).toHaveBeenNthCalledWith(2, { stage: 'analyzing' });
    expect(handlers.clauses).toHaveBeenCalledWith([{ id: 'c1', tag: 'Non-Compete' }]);
    expect(handlers.done).toHaveBeenCalledWith(null);
  });

  it('uses the multipart form for FormData payloads', async () => {
    const formData = new FormData();
    formData.append('document', new Blob(['pdf'], { type: 'application/pdf' }), 'doc.pdf');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => readerFromChunks([]) },
    });
    await streamAnalyze(formData, {});
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/analyze', {
      method: 'POST',
      body: formData,
    });
  });

  it('throws ApiError when the response is not ok', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'RATE_LIMITED', message: 'hold on' }, false, 429));
    await expect(streamAnalyze({ text: 'x' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      message: 'hold on',
    });
  });

  it('throws ApiError when the response has no body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: null, json: async () => ({}) });
    await expect(streamAnalyze({ text: 'x' })).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('ignores SSE lines that are neither event nor data', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () =>
          readerFromChunks([
            new TextEncoder().encode(`event: status\nid: 7\ndata: {"stage":"reading"}\n\n`),
          ]),
      },
    });
    const handlers = { status: vi.fn() };
    await streamAnalyze({ text: 'x' }, handlers);
    expect(handlers.status).toHaveBeenCalledWith({ stage: 'reading' });
  });

  it('ignores events whose handler is missing and tolerates a missing releaseLock', async () => {
    let called = false;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (called) return { done: true, value: undefined };
            called = true;
            const value = new TextEncoder().encode(sseChunk('status', { stage: 'done' }));
            return { done: false, value };
          },
        }),
      },
    });
    const handlers = { clauses: vi.fn() };
    await expect(streamAnalyze({ text: 'x' }, handlers)).resolves.toBeUndefined();
    expect(handlers.clauses).not.toHaveBeenCalled();
  });

  it('reads the trailing decoder flush after the stream ends', async () => {
    const encoder = new TextEncoder();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => readerFromChunks([encoder.encode('event: summary\ndata: "wrapped"\n\n')]),
      },
    });
    const handlers = { summary: vi.fn() };
    await streamAnalyze({ text: 'x' }, handlers);
    expect(handlers.summary).toHaveBeenCalledWith('wrapped');
  });
});

describe('chatDocument', () => {
  it('normalizes answer and citedClauseIds from the response', async () => {
    withFetch({ answer: 'hi', citedClauseIds: ['c1'] });
    await expect(chatDocument('text', 'question')).resolves.toEqual({
      answer: 'hi',
      citedClauseIds: ['c1'],
    });
    const call = globalThis.fetch.mock.calls[0];
    expect(call[0]).toBe('/api/chat');
    expect(JSON.parse(call[1].body)).toEqual({ sessionText: 'text', question: 'question' });
  });

  it('falls back when answer/citedClauseIds are missing', async () => {
    withFetch({});
    await expect(chatDocument('text', 'question')).resolves.toEqual({
      answer: '',
      citedClauseIds: [],
    });
  });

  it('throws ApiError on failure', async () => {
    withFetch({ code: 'X', message: 'nope' }, false, 500);
    await expect(chatDocument('text', 'q')).rejects.toMatchObject({ code: 'X', message: 'nope' });
  });
});

describe('deriveChecklist', () => {
  it('normalizes checklist and lawyerQuestions', async () => {
    withFetch({ checklist: [{ id: 'k1' }], lawyerQuestions: ['q1'] });
    await expect(deriveChecklist([{ id: 'c1' }])).resolves.toEqual({
      checklist: [{ id: 'k1' }],
      lawyerQuestions: ['q1'],
    });
    const call = globalThis.fetch.mock.calls[0];
    expect(call[0]).toBe('/api/checklist');
    expect(JSON.parse(call[1].body)).toEqual({ clauses: [{ id: 'c1' }] });
  });

  it('falls back to empty arrays when keys are missing', async () => {
    withFetch({});
    await expect(deriveChecklist([])).resolves.toEqual({ checklist: [], lawyerQuestions: [] });
  });
});

describe('compareDocuments', () => {
  it('posts multipart payloads directly without JSON headers', async () => {
    withFetch({ diffs: [] });
    const formData = new FormData();
    formData.append('documents', new Blob(['a']));
    formData.append('documents', new Blob(['b']));
    await expect(compareDocuments(formData)).resolves.toEqual({ diffs: [] });
    const call = globalThis.fetch.mock.calls[0];
    expect(call[0]).toBe('/api/compare');
    expect(call[1]).toEqual({ method: 'POST', body: formData });
  });

  it('throws ApiError for a failed multipart response', async () => {
    withFetch({ code: 'BAD', message: 'no' }, false, 400);
    const formData = new FormData();
    await expect(compareDocuments(formData)).rejects.toMatchObject({ code: 'BAD', message: 'no' });
  });

  it('posts JSON payloads through postJson', async () => {
    withFetch({ diffs: [{ id: 'd1' }] });
    await expect(compareDocuments({ leftText: 'a', rightText: 'b' })).resolves.toEqual({
      diffs: [{ id: 'd1' }],
    });
    const call = globalThis.fetch.mock.calls[0];
    expect(call[0]).toBe('/api/compare');
    expect(call[1].headers['Content-Type']).toBe('application/json');
  });

  it('throws ApiError for a failed JSON response', async () => {
    withFetch({}, false, 503);
    await expect(compareDocuments({})).rejects.toMatchObject({ status: 503 });
  });

  it('surfaces a numeric retryAfterMs hint from the failed response', async () => {
    withFetch({ message: 'rate limited', retryAfterMs: 2500 }, false, 429);
    await expect(compareDocuments({})).rejects.toMatchObject({ status: 429, retryAfterMs: 2500 });
  });

  it('falls back to defaults when the failed body cannot be parsed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    });
    await expect(compareDocuments({})).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'The request failed. Please try again.',
    });
  });
});

describe('exportChecklist', () => {
  it('requires JSON headers on the export call and returns a blob', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['file'], { type: 'text/plain' }),
    });
    const blob = await exportChecklist({ checklist: [], lawyerQuestions: [], format: 'markdown' });
    expect(blob).toBeInstanceOf(Blob);
    const call = globalThis.fetch.mock.calls[0];
    expect(call[0]).toBe('/api/checklist/export');
    expect(call[1].headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(call[1].body)).toEqual({
      checklist: [],
      lawyerQuestions: [],
      format: 'markdown',
    });
  });

  it('throws ApiError when the export response is not ok', async () => {
    withFetch({ code: 'EXPORT_FAILED', message: 'boom' }, false, 500);
    await expect(
      exportChecklist({ checklist: [], lawyerQuestions: [], format: 'pdf' })
    ).rejects.toMatchObject({ code: 'EXPORT_FAILED', message: 'boom' });
  });
});

describe('downloadBlob', () => {
  it('creates an anchor, downloads, and cleans up', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const removeSpy = vi.spyOn(HTMLAnchorElement.prototype, 'remove').mockImplementation(() => {});
    const blob = new Blob(['x']);
    downloadBlob(blob, 'report.md');
    expect(createSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock');
    expect(removeSpy).toHaveBeenCalled();
    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

function sseChunk(type, data) {
  return `event: ${type}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`;
}
