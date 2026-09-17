# ClearClause

AI-powered legal document analysis for non-lawyers. Upload a contract (PDF, DOCX, or pasted text), get a plain-language summary, clause-by-clause tagging with risk flags, grounded Q&A with citations, and an actionable checklist of questions for your lawyer.

> **This tool provides information, not legal advice. Always review important documents with a qualified professional.**

## The Challenge

"AI for Legal Assistance & Access" — reducing the barrier between ordinary people and legal documents.

## How it works

1. **Upload** a PDF, DOCX, or pasted text (≤ 5 MB).
2. **Analyze** — the server extracts text, validates file signatures (magic bytes, not just extensions), sanitises input, and chunks long documents.
3. **Tag** — every clause is classified as an Obligation / Right / Risk / Standard with a severity badge and a one-line plain-English explanation.
4. **Chat** — ask questions; answers are grounded in your document and cite the clauses used.
5. **Checklist** — export an actionable checklist and lawyer-prep questions as text or PDF.

### Demo samples

`samples/` ships three demo documents with **seeded inconsistencies** so a reviewer can watch the deterministic cross-check (FR-5) fire end to end:

| File                  | Seeded conflict                                            |
| --------------------- | ---------------------------------------------------------- |
| `job-offer.txt`       | term of `18 months` vs `12 months`; `$140,000` vs `$8,000` |
| `apartment-lease.txt` | notice of `90 days` vs `30 days`                           |
| `saas-tos.txt`        | rate of `$49` vs liability cap of `$500`                   |

Uploads accept PDF/DOCX only (per FR-1); to try a sample, paste its contents into the Home text box, or click the matching sample chip (`client/src/lib/samples.js`) to run the same text through the analyze pipeline without a file. `tests/samples.test.ts` asserts each file still yields its expected inconsistency.

## Architecture

```
┌──────────────┐   HTTPS/JSON    ┌──────────────────────────────┐     ┌──────────────┐
│  React SPA   │ ───────────────▶│  Express API (server/)       │────▶│  Gemini API  │
│  (client/)   │ ◀───────────────│  routes/ → services/         │◀────│  (LLM)       │
└──────────────┘                 │  shared/dto/ validators      │     └──────────────┘
                                 └──────────────────────────────┘
```

- **`client/`** — Vite + React SPA. Screens wired from the Google Stitch design export.
- **`server/`** — Express. Security-first (Helmet CSP, rate limiting, CORS whitelist, magic-byte upload validation). Runs TypeScript directly via `tsx`.
- **`shared/dto/`** — Dependency-free TypeScript DTOs and runtime validators, the single contract between client and server.
- **`tests/`** — Vitest with 100% coverage thresholds enforced (statements/branches/functions/lines).

## Prerequisites

- Node.js 20+
- A Gemini API key (free tier) exported as `GEMINI_API_KEY`

## Getting started

```bash
npm install
cp .env.example .env   # set GEMINI_API_KEY

npm run dev            # server on :8080 + Vite on :5173 (proxies /api)
```

Production checks:

```bash
npm run lint              # ESLint, zero warnings allowed
npm run test:coverage     # Vitest, 100% enforced
npm run build             # tsc --noEmit + vite build
npm run smoke             # boot the real server and check routes end to end
npm run format:check      # Prettier
npm start                 # serve dist/ + API from :8080
```

`npm run smoke` boots `server/index.ts` on a throwaway port with no AI key and verifies SPA serving, SPA fallback, intake validation (413/415/400 empty document), graceful AI failure, and the deterministic checklist/export endpoints. Point it at a deployment with `SMOKE_BASE_URL=https://your-app npm run smoke`.

## Deployment (Google Cloud Run)

The target project must have billing enabled — Cloud Run, Cloud Build, and Artifact Registry all reject requests with `BILLING_DISABLED` otherwise.

```bash
gcloud run deploy clearclause \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=<key>,GEMINI_MODEL=gemini-2.0-flash
```

`--source .` builds the repo's `Dockerfile` on Cloud Build; the container serves the SPA from `dist/` and the `/api/*` routes, listening on the `$PORT` Cloud Run injects. Because the SPA and API are same-origin, `ALLOWED_ORIGINS` is only needed if you split them.

Verify the live deployment with the same suite used locally:

```bash
SMOKE_BASE_URL=https://<service-url> npm run smoke
```

## Environment variables

| Variable                | Purpose                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `GEMINI_API_KEY`        | AI provider key, server-side only (secret, never committed)        |
| `GEMINI_MODEL`          | Gemini model id (default `gemini-2.0-flash`, locked at build time) |
| `PORT`                  | Server port (default 8080)                                         |
| `ALLOWED_ORIGINS`       | Comma-separated CORS whitelist                                     |
| `TRUST_PROXY`           | `true` behind a reverse proxy so rate limits use the client IP     |
| `RATE_LIMIT_WINDOW_MS`  | Rate-limit window                                                  |
| `RATE_LIMIT_MAX_GLOBAL` | Global request cap per window                                      |
| `RATE_LIMIT_MAX_AI`     | AI-endpoint cap per window                                         |
| `MAX_UPLOAD_MB`         | Upload size ceiling (5)                                            |
| `MAX_EXTRACTED_CHARS`   | Extracted-text ceiling (2,000,000)                                 |

## Design decisions and assumptions

- **TypeScript on the server, JSX components in the client.** DTOs are `.ts` in `shared/dto/`; the server runs them directly via `tsx` (no build step). Client components are `.jsx` checked by ESLint + jsx-a11y discipline rather than TS.
- **Documents are text-extractable** (native PDF/DOCX/plain text). Scanned/image-only PDFs are out of scope — the user gets a clear "can't read this file" message (FR-2).
- **No persistence.** Session content lives in the browser between calls; the server is stateless and discards document content after each response (FR-12). No document text is ever logged (FR-15).
- **Grounded answers only.** Chat citations come from the tagged clauses; if the document doesn't address the question, the answer says so (FR-6).
- **AI model locked at build time.** `gemini-2.0-flash` (free tier) is the single model id for every AI call; `GEMINI_MODEL` overrides it per deployment with no code change.
- **Language:** English primary. The Hindi/Bengali toggle is a documented Could-have and is intentionally not shipped in this build (`LANGUAGES`/`Language` stay in the DTO contract for future use).

## Repository layout

```
clearclause/
├── client/               UI (Vite + React)
├── server/               Express API (TypeScript via tsx)
│   ├── middleware/       security, validation
│   ├── routes/           analyze / chat / checklist / compare
│   └── services/         extraction, tagging, diffing, Gemini client
├── shared/dto/           DTOs + validators (client & server contract)
├── samples/              demo documents with seeded inconsistencies
├── tests/                unit + integration + component tests
├── Dockerfile            multistage build (builder → lean runner)
└── .env.example
```

## License

Not specified.
