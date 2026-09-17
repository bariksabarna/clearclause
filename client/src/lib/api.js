/**
 * ClearClause API client.
 *
 * Thin fetch wrapper around the four backend endpoints (analyze, chat,
 * checklist + export, compare). The analyze endpoint streams Server-Sent
 * Events, so every other call is a JSON POST that returns JSON.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Error codes whose documents were rejected at intake, deserving guidance. */
export const INTAKE_ERROR_CODES = new Set([
  'UNSUPPORTED_FILE_TYPE',
  'UPLOAD_TOO_LARGE',
  'SCANNED_PDF',
  'EXTRACTED_TEXT_TOO_LARGE',
  'EMPTY_DOCUMENT',
]);

export function isIntakeErrorCode(code) {
  return INTAKE_ERROR_CODES.has(code);
}

export class ApiError extends Error {
  constructor({
    status = 0,
    code = 'INTERNAL_ERROR',
    message = 'The request failed. Please try again.',
    retryAfterMs,
  }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

async function readError(res) {
  const body = await res.json().catch(() => null);
  return new ApiError({
    status: res.status,
    code: typeof body?.code === 'string' ? body.code : 'INTERNAL_ERROR',
    message:
      typeof body?.message === 'string' ? body.message : 'The request failed. Please try again.',
    retryAfterMs: typeof body?.retryAfterMs === 'number' ? body.retryAfterMs : undefined,
  });
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await readError(res);
  return res.json();
}

function parseEventBlock(block) {
  let type = 'message';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event: ')) type = line.slice('event: '.length);
    else if (line.startsWith('data: ')) data = line.slice('data: '.length);
  }
  if (!data) return null;
  try {
    return { type, data: JSON.parse(data) };
  } catch {
    return { type, data };
  }
}

/** Consumes complete SSE blocks from a buffer, dispatching and returning the remainder. */
export function consumeSse(buffer, onEvent) {
  let rest = buffer;
  let boundary;
  while ((boundary = rest.indexOf('\n\n')) !== -1) {
    const block = rest.slice(0, boundary);
    rest = rest.slice(boundary + 2);
    const event = parseEventBlock(block);
    if (event) onEvent(event);
  }
  return rest;
}

/**
 * Stream a document (multipart file) or pasted text ({ text }) through
 * /api/analyze, dispatching `status`, `clauses`, `inconsistencies`, `summary`,
 * `done`, and `error` events to the provided handlers.
 */
export async function streamAnalyze(payload, handlers = {}) {
  const isMultipart = payload instanceof FormData;
  const init = isMultipart
    ? { method: 'POST', body: payload }
    : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      };

  const res = await fetch('/api/analyze', init);
  if (!res.ok || !res.body) {
    throw await readError(res);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const dispatch = (event) => {
    const handler = handlers[event.type];
    if (typeof handler === 'function') handler(event.data);
  };

  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = consumeSse(buffer, dispatch);
    }
    buffer += decoder.decode();
    consumeSse(buffer, dispatch);
  } finally {
    if (typeof reader.releaseLock === 'function') reader.releaseLock();
  }
}

/** Grounded Q&A against the upload session text (POST /api/chat). */
export async function chatDocument(sessionText, question) {
  const result = await postJson('/api/chat', { sessionText, question });
  return {
    answer: typeof result.answer === 'string' ? result.answer : '',
    citedClauseIds: Array.isArray(result.citedClauseIds) ? result.citedClauseIds : [],
  };
}

/** Derive an actionable checklist and lawyer questions (POST /api/checklist). */
export async function deriveChecklist(clauses) {
  const result = await postJson('/api/checklist', { clauses });
  return {
    checklist: Array.isArray(result.checklist) ? result.checklist : [],
    lawyerQuestions: Array.isArray(result.lawyerQuestions) ? result.lawyerQuestions : [],
  };
}

/** Compare two documents by text or by multipart file pair (POST /api/compare). */
export async function compareDocuments(payload) {
  if (payload instanceof FormData) {
    const res = await fetch('/api/compare', { method: 'POST', body: payload });
    if (!res.ok) throw await readError(res);
    return res.json();
  }
  return postJson('/api/compare', payload);
}

/** Fetch a checklist export blob (POST /api/checklist/export). */
export async function exportChecklist({ checklist, lawyerQuestions, format }) {
  const res = await fetch('/api/checklist/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checklist, lawyerQuestions, format }),
  });
  if (!res.ok) throw await readError(res);
  return res.blob();
}

/** Trigger a browser download for a blob using a temporary anchor. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
