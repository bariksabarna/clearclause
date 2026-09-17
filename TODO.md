# ClearClause — Build Todo Tracker

> Vertical: **AI for Legal Assistance & Access**
> Source of truth: `files_elaborated/` (PRD-1, SRS v1.1, Stitch prompt) + `stitch_export/` screens
> Rubric target: reuse EcoTrace patterns — Security/Efficiency/Testing/A11y matters, **Code Quality via JSDoc-first**.
> Rule of thumb: a task is only `[x]` when the code + its test + JSDoc exist, and lint/typecheck pass.

---

## Get this repo going

- [x] Unzip `files.zip` → `files_basic/`
- [x] Unzip `files (1).zip` → `files_elaborated/`
- [x] Unzip `stitch_clearclause_legal_document_analyzer.zip` → `stitch_export/` (8 screens + DESIGN.md + code.html per screen)
- [x] Decide DTO format → **TypeScript in `shared/dto/`** (TS matches PRD-1 §6, Vite/Vitest native, no runtime deps)
- [x] DTOs for all SRS §6 API contracts (see below)
- [x] `package.json` — deps/devDeps split per `00-overview` table (`compression` in **dependencies**; `tsx` runtime, `multer@2`, `file-type@22`, `vite@8`/`vitest@5` — 0 audit vulnerabilities)
- [x] `tsconfig.json` (strict) + ESLint `--max-warnings 0` + Prettier (flat config; `ignoreRestSiblings` for omit-pattern tests)
- [x] Vitest with 100% coverage thresholds, `coverage.exclude` for configs/entry (vitest 5 removed `all:true` — include-all is now default)
- [x] `Dockerfile` multistage + `.dockerignore` (excludes `node_modules`, `dist`, `.env`, `.git`, `coverage`, `tests`); runner stage installs prod deps as root **before** `USER node` (avoids EACCES on the root-owned WORKDIR), and `tsx` is a production dependency so the CMD resolves under `--omit=dev`
- [x] `.env.example` + README skeleton (architecture diagram, assumptions)
- [x] Minimal Vite + React scaffold (root `client/`, `outDir ../dist`) so `npm run build`/+Docker work end-to-end
- [x] Unit tests for `validators.ts` (valid/invalid/empty/malformed) + `App.test.jsx` — 28 tests, 100% gate green → feed the 100% gate

## DTO layer — `shared/dto/`

- [x] `enums.ts` — ClauseTag, RiskSeverity, DiffStatus, ExportFormat, Language, API_VERSION
- [x] `clause.dto.ts` — ClauseDto, InconsistencyDto, ChatTurnDto
- [x] `request.dto.ts` — Analyze/Chat/Checklist/Export/Compare request bodies
- [x] `response.dto.ts` — Analyze/Chat/Checklist/Compare/Error responses + DiffItemDto
- [x] `validators.ts` — zero-dep runtime guards for every shape
- [x] `index.ts` barrel
- [x] Validators unit tests — ✅ done (28 tests, 100%)
- [x] Server-side import strategy: **`tsx` runtime** (DTOs are `.ts`, server runs them directly, no build step; `tsx` in `dependencies` so `npm ci --omit=dev` keeps it)

## Server — `server/`

- [x] `index.ts` — Express, Helmet (strict CSP), global + AI rate limiters, CORS whitelist, compression-first, error-handling middleware, never log document text
- [x] `middleware/validateUpload.ts` — size ceiling + magic-byte check via `file-type` (FR-1, FR-17)
- [x] `services/extractText.ts` — `pdf-parse@2` / `mammoth`; detect near-empty → "can't read scanned file" (FR-2)
- [x] `services/sanitize.ts` — charCode-based control-char strip + char ceiling 200k (FR-18)
- [x] `services/clauseTagger.ts` — severity scoring + keyword flags, hash-cached LLM tags + deterministic severity overrides (FR-4, NFE)
- [x] `services/geminiClient.ts` — delimited `<document>` prompt shells from PRD-1 §7, retry-with-backoff, injectable fetch
- [x] `services/chunker.ts` — overlap chunking + id re-sequencing for long docs (FR-13)
- [x] `services/inconsistencyChecker.ts` — deterministic date/number/currency cross-check (FR-5)
- [x] `services/alignDiff.ts` — edit-distance clause alignment with similarity threshold boundary (FR-9, PRD-2 §algorithms)
- [x] `services/checklist.ts` — derive checklist + lawyer questions from tagged clauses (FR-7, FR-8)
- [x] `routes/analyze.ts` — `/api/analyze` (multipart + text), aiLimiter
- [x] `routes/chat.ts` — `/api/chat`, aiLimiter, grounded + cited (FR-6)
- [x] `routes/checklist.ts` — `/api/checklist` + `/api/checklist/export` (global limiter only)
- [x] `routes/compare.ts` — `/api/compare`, aiLimiter
- [x] Injection-sanity check (log non-executing flag) for "ignore previous instructions" patterns (PRD-1 §7)
- [x] Error-code consistency — `emptyDocument()` was defined/tested/client-anticipated but never emitted; now returned for empty or too-short **pasted text** (analyze + compare JSON) while unreadable **file** extraction stays `SCANNED_PDF`; `errorHandler` reuses `uploadTooLarge()` instead of duplicating it; `EMPTY_DOCUMENT` guidance added to IssuesScreen + smoke check

## Client — `client/`

- [x] Vite + React scaffold (root `client/`, `outDir ../dist`) — Tailwind + route code-splitting (lazy chunks per screen, Suspense fallback + skip link)
- [x] Screens wired from `stitch_export/` (Home/Upload, Analyzing Readiness, Analysis, Q&A, Checklist, Compare, Issues, 404) — DESIGN.md followed
- [x] `components/UploadDropzone.jsx` — Home hero, drag/drop + file picker, error states (oversized/type/scanned); file input lives outside the `role="button"` element (no nested-interactive, axe-clean)
- [x] `components/DocumentPane.jsx` — serif document text, severity-mapped clause panes, per-clause anchors for citation scrolling
- [x] Analysis margins + severity badges — `ClauseBadge.jsx` + AnalysisScreen marginalia (icon + text, never color alone)
- [x] `components/ChatPanel.jsx` — grounded chat, citation chips → `scrollToClause`, suggestion chips, empty/no-answer states
- [x] Checklist view — inline in `ChecklistScreen.jsx` (checkable list + lawyer questions + Export PDF/txt + clipboard copy + toasts)
- [x] Compare view — inline in `CompareScreen.jsx` (side-by-side slots, +/−/~ glyphs, counts, filter chips, per-diff explanations)
- [x] `components/DisclaimerBar.jsx` — persistent, on every AI-output screen (Analyzing/Analysis/Q&A/Compare)
- [x] Client-side rate-limit/SSE handling — `lib/api.js` (`streamAnalyze`/`consumeSse`, backoff-friendly `ApiError.retryAfterMs`) + `AnalyzingScreen` restart guard (`cancelled`/`startedRef`)
- [x] A11y — Skip link (`#main-content`), single `<h1>`/screen, `role="status"`/`role="alert"` regions, keyboard-operable dropzone, focus states, `aria-busy`/`aria-live` streaming regions
- [x] FR-1 alignment — file picker/sample copy accept PDF/DOCX only; plain text is paste-only (removed the `TXT` upload affordance the server rejects with 415)
- [x] "What are my options" panel (PRD-1 §3/§4 Should-have) — `lib/options.js` derives non-advisory options per High-severity clause; rendered in the Analysis right column with pin-to-clause, hidden when no High clauses

## Tests — `tests/` (rubric: validation just as important as coverage)

- [x] Unit: validators (all guards, all branches)
- [x] Unit: clauseTagger severity edge cases, chunker merge, alignDiff (reorder/renumber/threshold boundaries)
- [x] Integration: upload valid/oversized/wrong-ext/wrong-magic/corrupted, rate-limit-exceeded
- [x] Integration: chat with-answer / without-answer / injection-style question
- [x] Integration: FR-12 no-persistence + FR-15 no-document-text-in-logs
- [x] Integration: export endpoint produces a download
- [x] Component/screen suite: `client.store`, `client.api`, `client.libs`, `client.components`, `client.screens.*`, `App` routes/lazy-shell, `client.axe` — **385 tests across 27 files, 100% statements/branches/functions/lines**, lint/typecheck/format/build green
- [x] `jest-axe` pass; zero critical violations (nested-interactive in UploadDropzone fixed)
- [x] Seed check: `tests/samples.test.ts` (demo docs still trigger their intended inconsistencies)
- [x] Full UI suite runs green under `CI=true` (`npm run test:coverage` = 100/100/100/100)

## Final stretch

- [x] `npm run lint` zero warnings, `npm run test:coverage` 100%, `npm run build` clean
- [x] Sample docs for demo (job offer, lease, ToS) with seeded inconsistency — `samples/*.txt`, mirrored by the Home sample chips; `tests/samples.test.ts` asserts each seeded conflict fires through `findInconsistencies`
- [x] Local production smoke test — automated as `npm run smoke` (`scripts/smoke.mjs`, 9 checks): SPA `200`, SPA fallback `200`, unknown API `404` JSON, empty pasted text `400 EMPTY_DOCUMENT`, oversized upload `413`, `.txt` upload `415` (FR-1), AI-without-key graceful SSE error, checklist derive + export; also accepts `SMOKE_BASE_URL=…` to test a deployment (no crash, no document text logged)
- [ ] Deploy (Cloud Run/Vercel), live smoke test of upload → summary → chat → checklist — blocked: a real `gcloud run deploy --source .` attempt returns `PERMISSION_DENIED … This API method requires billing to be enabled` / `reason: BILLING_DISABLED` (Artifact Registry), and all visible billing accounts are closed trials; no alternative host token (Vercel/Render/Fly) or `GEMINI_API_KEY` is present. `gcloud` is authenticated and `npm run smoke` accepts `SMOKE_BASE_URL`, so once a billing account is linked the exact deploy + live-verify commands in README §"Deployment (Cloud Run)" finish this in one step.
- [~] Walk every traceability-matrix row (PRD-1 §3) against the live URL — **local code walk done** (evidence below); re-run against the deployed URL once deploy lands
  - [x] Plain-language summary (Must) — `routes/analyze.ts` SSE `summary`; `AnalysisScreen` header; `server.routes.test.ts`
  - [x] Clause tagging + red-flag detector (Must) — `clauseTagger.ts`, `inconsistencyChecker.ts`, `ClauseBadge`; `clauseTagger`/`inconsistency` tests
  - [x] Grounded Q&A with clause citations (Must) — `routes/chat.ts`, `ChatPanel`; `server.routes.test.ts`, `client.screens.analysis.test.jsx`
  - [x] "What are my options" panel (Should) — `lib/options.js` + Analysis panel; `client.libs`/`client.screens.analysis` tests _(was the only gap)_
  - [x] One-click checklist generator (Must) — `services/checklist.ts`, `routes/checklist.ts`, `ChecklistScreen`; `server.checklist.test.ts`
  - [x] Lawyer-prep questions export PDF/text (Must) — `deriveLawyerQuestions`, `/api/checklist/export`; `server.export.test.ts`
  - [x] Compare tab clause-level diff (Should) — `alignDiff.ts`, `routes/compare.ts`, `CompareScreen`; `server.alignDiff.test.ts`
  - [x] Error/edge matrix (PRD-1 §8) — all 8 rows mapped: >5 MB (413 + client guard), unsupported/scanned/too-large intake → IssuesScreen, AI retry+backoff → plain message + Try again, 429 `RATE_LIMITED` message carries the retry window, injection logged, chat no-answer state, long-doc chunking
- [x] Repo public, single branch, < 10 MB; README states vertical/approach/assumptions — published at **https://github.com/bariksabarna/clearclause** (`main` only, 101 files / 1.5 MB `.git`, secret scan clean, `.env`/`node_modules`/`dist`/`coverage` ignored)

---

## Open decisions (from SRS §2.6 + PRD-1 §13)

- Which Gemini free-tier model to lock at build time (confirm before Day 1) → **resolved: `gemini-2.0-flash` is the built-in default (`DEFAULT_GEMINI_MODEL`), overridable via `GEMINI_MODEL`; documented in README + `.env.example`, asserted in `server.config.errors.test.ts`**
- Server-side TS strategy (tsx vs compiled `dist-server/`) since DTOs are `.ts` → **resolved: tsx runtime**
- Whether Hindi/Bengali toggle ships (Could / stretch) → **resolved: not shipping this build (English primary); `LANGUAGES`/`Language` retained in the DTO contract for future work, decision recorded in README**
