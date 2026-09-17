/**
 * Post-build smoke test against a real server process (`npm run smoke`).
 *
 * Boots `server/index.ts` on a throwaway port with an empty GEMINI_API_KEY and
 * checks the routes that do not need an LLM — SPA serving, SPA fallback, intake
 * validation, graceful AI failure, and the deterministic checklist/export
 * endpoints. Intended as the deployed-URL smoke test too; override the target
 * with `SMOKE_BASE_URL=https://...` to skip spawning a local server.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const externalBase = process.env.SMOKE_BASE_URL;
const port = Number(process.env.SMOKE_PORT) || 20000 + Math.floor(Math.random() * 25000);
const base = externalBase || `http://127.0.0.1:${port}`;

const SAMPLE_CLAUSE = {
  id: 'c1',
  tag: 'Risk',
  severity: 'High',
  explanation: 'You may owe the full amount early.',
  severityReason: 'No grace period is stated.',
  sourceText: 'Payment of $500 is due within 30 days.',
};

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

async function codeOf(res) {
  try {
    return (await res.json()).code;
  } catch {
    return undefined;
  }
}

async function waitForReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/`);
      if (res.ok) return true;
    } catch {
      // server not listening yet
    }
    await new Promise((done) => setTimeout(done, 300));
  }
  return false;
}

async function runChecks() {
  const home = await fetch(`${base}/`);
  const homeBody = await home.text();
  check(
    'GET / serves the SPA shell',
    home.status === 200 &&
      (home.headers.get('content-type') || '').includes('text/html') &&
      homeBody.includes('id="root"'),
    `status=${home.status}`
  );

  const fallback = await fetch(`${base}/compare`);
  check(
    'GET /compare falls back to index.html',
    fallback.status === 200 && (fallback.headers.get('content-type') || '').includes('text/html'),
    `status=${fallback.status}`
  );

  const unknown = await fetch(`${base}/api/nope`);
  check(
    'unknown API route returns 404 NOT_FOUND',
    unknown.status === 404 && (await codeOf(unknown)) === 'NOT_FOUND',
    `status=${unknown.status}`
  );

  const analyzed = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Party A shall pay $500 within 30 days.' }),
  });
  const stream = await analyzed.text();
  check(
    'analyze without a key degrades to an SSE error event',
    analyzed.status === 200 && stream.includes('event: error'),
    `status=${analyzed.status}`
  );

  const emptyText = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '' }),
  });
  check(
    'empty pasted text returns 400 EMPTY_DOCUMENT',
    emptyText.status === 400 && (await codeOf(emptyText)) === 'EMPTY_DOCUMENT',
    `status=${emptyText.status}`
  );

  const txtForm = new FormData();
  txtForm.append('document', new Blob(['plain text'], { type: 'text/plain' }), 'notes.txt');
  const txt = await fetch(`${base}/api/analyze`, { method: 'POST', body: txtForm });
  check(
    'plain-text upload rejected with 415',
    txt.status === 415 && (await codeOf(txt)) === 'UNSUPPORTED_FILE_TYPE',
    `status=${txt.status}`
  );

  const bigForm = new FormData();
  bigForm.append(
    'document',
    new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'application/pdf' }),
    'big.pdf'
  );
  const big = await fetch(`${base}/api/analyze`, { method: 'POST', body: bigForm });
  check(
    'oversized upload rejected with 413',
    big.status === 413 && (await codeOf(big)) === 'UPLOAD_TOO_LARGE',
    `status=${big.status}`
  );

  const checklist = await fetch(`${base}/api/checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clauses: [SAMPLE_CLAUSE] }),
  });
  const checklistBody = await checklist.json().catch(() => ({}));
  check(
    'checklist derives items and lawyer questions',
    checklist.status === 200 &&
      Array.isArray(checklistBody.checklist) &&
      checklistBody.checklist.length > 0 &&
      Array.isArray(checklistBody.lawyerQuestions) &&
      checklistBody.lawyerQuestions.length > 0,
    `status=${checklist.status}`
  );

  const exported = await fetch(`${base}/api/checklist/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      checklist: ['Review the payment clause'],
      lawyerQuestions: ['Is the 30-day window negotiable?'],
      format: 'txt',
    }),
  });
  const exportText = await exported.text();
  check(
    'checklist export returns a downloadable body',
    exported.status === 200 && exportText.length > 0,
    `status=${exported.status}`
  );
}

async function main() {
  let server;
  let serverLog = '';
  if (!externalBase) {
    if (!existsSync(resolve(root, 'dist', 'index.html'))) {
      console.error('dist/index.html not found — run `npm run build` first.');
      process.exit(1);
    }
    server = spawn(resolve(root, 'node_modules', '.bin', 'tsx'), ['server/index.ts'], {
      cwd: root,
      env: { ...process.env, PORT: String(port), NODE_ENV: 'production', GEMINI_API_KEY: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', (chunk) => (serverLog += chunk));
    server.stderr.on('data', (chunk) => (serverLog += chunk));
  }

  try {
    if (!(await waitForReady(20000))) {
      throw new Error(`server did not become ready at ${base}`);
    }
    await runChecks();
  } catch (error) {
    if (serverLog) console.error(serverLog.trimEnd());
    throw error;
  } finally {
    if (server) server.kill('SIGTERM');
  }

  for (const result of results) {
    console.log(
      `${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` (${result.detail})` : ''}`
    );
  }
  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    if (serverLog) console.error(serverLog.trimEnd());
    console.error(`\n${failed.length} of ${results.length} smoke checks failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} smoke checks passed against ${base}.`);
}

main().catch((error) => {
  console.error(`Smoke test failed: ${error.message}`);
  process.exit(1);
});
