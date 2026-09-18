# ClearClause — Feature Verification Checklist

Use this list to test every feature one by one. Tick each checkbox when you have
confirmed the behavior. Everything below runs against the local dev server
(http://localhost:5173) using the API key in `.env`.

## How to run

```bash
npm run dev        # starts client (5173) and server (8080)
npm run build && npm run smoke   # 9 automated checks, no LLM needed
```

No-LLM smoke checks: SPA shell, SPA fallback, 404 handling, analyze-without-key
degradation, empty text (400), `.txt` upload (415), oversized upload (413),
checklist derivation, checklist export.

---

## 1. Analyze — Home (`/`)

- [ ] Header nav shows: Analyze / Q&A / Lawyer Prep / Compare / Help
- [ ] Info bar: "document summaries and informational explanations only, not
      legal advice" and the "Editorial Intake System" pill are visible
- [ ] Dropzone shows the "CALIBRATED VIEWPORT • STAGE 01" corner tag
- [ ] Dragging a PDF onto the dropzone starts analysis
- [ ] Clicking the dropzone opens the file picker (Enter / Space also work)
- [ ] Format info reads "Accepts PDF or DOCX up to 5 MB, or paste the text."
- [ ] Feature chips visible: Zero Cloud Retention • Up to 5 MB • High-Fidelity OCR
- [ ] Sample chip "A job offer letter" starts an analysis
- [ ] Sample chip "A rental lease" starts an analysis
- [ ] Sample chip "A terms of service page" starts an analysis
- [ ] "Download sample lease as PDF" link downloads
      `/samples/12-Month-Apartment-Lease.pdf` (uploading it produces the same
      analysis as the rental-lease sample chip)
- [ ] Anatomy strip shows the four instruments (Plain Equivalents / Obligation
      Auditing / Omission Detection / Ephemeral Sandbox)

### Upload edge cases

- [ ] Uploading a file over 5 MB shows an inline "too large" error — no request
      is sent
- [ ] Uploading a `.txt` file reaches the server and is rejected (see `/issues?code=UNSUPPORTED_FILE_TYPE`)
- [ ] Uploading an image-only (scanned) PDF lands on the SCANNED_PDF guidance
      instead of crashing

## 2. Analyzing — streaming screen (`/analyzing`)

- [ ] Status bar shows "ENGINE PASS: 1/04" progressing to "4/04" with a live
      token count
- [ ] Progress ring advances through Phase 1 of 4 → Phase 4 of 4
- [ ] Four-step rail marks steps Complete / In Progress / Pending as it runs
- [ ] Left pane streams the extracted clauses onto the "paper" as they arrive
- [ ] Right rail shows "Marginalia Projection" and the Intake Protocol Checklist
- [ ] "Abort Inspection" stops the run and returns home
- [ ] On success the app automatically moves to the Analysis workspace
- [ ] Simulating a failure shows retry / another-document options, and intake
      failures offer "See guidance"

## 3. Analysis workspace (`/analysis`)

- [ ] Heading shows "Document Analysis — {file name}" plus the plain-language
      summary line
- [ ] "Instrument Verified" badge and PROOF COPY watermark are present
- [ ] Metric cards: Clauses Analyzed, High Risk, Medium Risk, Low Risk
- [ ] Filter chips (All / High / Medium / Low) narrow the margin-note cards
- [ ] "Jump to Highest Risk" scrolls to the highest-risk clause (disabled when
      none exist)
- [ ] "Export Markup" opens the browser print dialog
- [ ] Each margin card shows: tag, clause number, risk badge, "What this clause
      means", "Analysis Note", "Pin to Clause"
- [ ] Level footers render correctly — SEVERE (red), MODERATE, NEUTRAL
- [ ] On a High-risk clause, "Propose Redline Revision" links to the Compare
      workspace
- [ ] "What are my options" panel lists moves for high-risk clauses and pins
      back to the clause
- [ ] Empty state ("No analysis yet") shows before any document is analyzed

## 4. Q&A (`/qa`)

- [ ] Header shows "Document Q&A — {file name}" and "Grounded on N Clauses ·
      Index Strict"
- [ ] Source draft pane labeled "Source Draft" renders with clause tags
- [ ] Suggestion chips render; clicking one fills the input
- [ ] Asking a question streams a typed reply
- [ ] Answers that cite a clause render a "[Citation: Clause n]" chip
- [ ] Empty input does not send; contacting the API with no clauses shows the
      "Nothing to ask about yet" state
- [ ] A failed API call shows an inline error with a retry affordance

## 5. Lawyer Prep — Checklist (`/checklist`)

- [ ] Header: "Phase 04 // Consultation Prep" + "Action Checklist & Lawyer
      Consultation Brief" + "Generated from {file name}"
- [ ] "Export Checklist (PDF)" downloads a real PDF
- [ ] "Export Plain Text (.txt)" downloads a real text file
- [ ] "Pre-Sign Readiness" percentage ticks up as you check items off
- [ ] Stat card counts: Checklist Items (matters), Lawyer Questions, Applicable
      Jurisdiction (Local / Housing Act)
- [ ] Checkbox toggling updates the readiness bar and strikes through items
- [ ] "Add personal contingency or rider request" appends a custom item
- [ ] Lawyer questions show as "Issue 01/02/…" with a "Copy Question" button
      (clipboard)
- [ ] "Attorney Prep Tip" panel is visible
- [ ] "Draft Counter-Proposal" button navigates to the Compare workspace
- [ ] Empty state ("No checklist yet") before any document is analyzed

## 6. Compare (`/compare`)

- [ ] Header: "Analytical Redline Workspace" + "Draft Comparison — Original vs.
      Counter-Draft"
- [ ] Two slots, A (Base Baseline) and B (In-Review Markup), each accepting a
      file or pasted text
- [ ] Submitting with both slots empty shows "Provide two documents…"
- [ ] Mixing one file with one pasted text is rejected
- [ ] Two pasted texts (or two files) produce a clause-level diff
- [ ] Summary badges appear: Status: Reconciled, modified / added / removed /
      unchanged counts
- [ ] Filters work: All Provisions / Changes (+/−/~) / Unchanged
- [ ] Each diff card shows the clause id, status badge, and a Review Note
- [ ] A failed comparison shows the server error and recovers on retry
- [ ] Placeholder text ("Provide two drafts above…") shows before the first run
- [ ] Info bar reads "…Diff Engine v4.1 (Bi-directional Token Scan) • Synced
      Scrolling Enabled"

## 7. Help / Issues (`/issues?code=…`)

Each known code renders its own diagnostic card with a "what to do" and a button
back to the upload desk:

- [ ] `EMPTY_DOCUMENT` — "There was no text to analyze"
- [ ] `UPLOAD_TOO_LARGE` — "Document exceeds the 5 MB limit"
- [ ] `UNSUPPORTED_FILE_TYPE` — "File format not supported"
- [ ] `SCANNED_PDF` — "Text could not be extracted from this scan"
- [ ] `EXTRACTED_TEXT_TOO_LARGE` — "The extracted text is too large…"
- [ ] No code / unknown code falls back to the generic "Make your document ready"
      card
- [ ] Right rail shows Pipeline Telemetry / Intake Protocol Checklist and the
      "Paralegal Desk Dispatch" link
- [ ] Footer shows the secure-purge notice and "Back to Top"

## 8. Cross-cutting

- [ ] Deep links work: opening `/compare`, `/qa`, `/analysis`, `/issues` directly
      reloads the SPA (Vite fallback)
- [ ] Unknown `/api/*` paths return a JSON `NOT_FOUND` (404)
- [ ] Every AI screen carries an informational-only disclaimer
- [ ] Public-facing mobility: the corner tag and sync signals hide on small
      screens without breaking interaction

---

## Notes on intentional behavior

- There is **no OCR engine** — text extraction only. Scanned image PDFs without a
  text layer deliberately fail into the `SCANNED_PDF` guidance.
- The home screen advertises "…or paste the text", but pasting is available
  through the three sample chips (same pipeline) and, for comparisons, on the
  Compare screen. There is not yet a dedicated paste box on Home.
- On Render free tier expect a cold start (~30–60 s) after ~15 min of idle.
  Gemini free tier may throttle (429) if you analyze very large documents
  repeatedly — wait a minute and retry.
