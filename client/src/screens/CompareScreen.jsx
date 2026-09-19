/**
 * Compare screen. Clause-level diff between two documents with added/removed/modified statuses, severity counts, and per-diff helper explanations - plus an empty state for no comparison yet.
 */
import { useState } from 'react';
import { compareDocuments } from '../lib/api.js';
import DisclaimerBar from '../components/DisclaimerBar.jsx';

const STATUS_META = {
  added: {
    glyph: '+',
    label: 'Added clause',
    badge: 'bg-secondary-container text-on-secondary-container',
  },
  removed: {
    glyph: '−',
    label: 'Removed obligation',
    badge: 'bg-error-container text-on-error-container',
  },
  modified: {
    glyph: '~',
    label: 'Modified clause',
    badge: 'bg-tertiary-container text-on-tertiary-container',
  },
  unchanged: {
    glyph: '=',
    label: 'Unchanged',
    badge: 'bg-surface-container-high text-on-surface-variant',
  },
};

const FILTERS = [
  { key: 'all', label: 'All Provisions' },
  { key: 'changed', label: 'Changes (+/−/~)' },
  { key: 'unchanged', label: 'Unchanged' },
];

function DocSlot({ label, note, icon, fileName, onFile, text, onText }) {
  return (
    <div className="bg-surface-container-low p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-primary">
          {icon}
        </span>
        <span className="font-label-sm text-label-sm uppercase text-secondary">
          {label} <span className="text-outline-variant">•</span> {note}
        </span>
      </div>
      <p className="mb-3 truncate font-label-lg text-label-lg font-semibold text-primary">
        {fileName ?? 'No file selected'}
      </p>
      <input
        type="file"
        aria-label={`Choose ${label}`}
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />
      <textarea
        aria-label={`Paste ${label} text`}
        value={text}
        onChange={(event) => onText(event.target.value)}
        placeholder={`Paste ${label} plain text…`}
        rows={6}
        className="mt-3 w-full resize-y bg-surface-container-lowest p-3 font-label-md text-label-md text-on-surface shadow-inner placeholder:text-outline"
      />
    </div>
  );
}

export default function CompareScreen() {
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [diffs, setDiffs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const handleCompare = async (event) => {
    event.preventDefault();
    setError(null);
    if ((!fileA && !textA.trim()) || (!fileB && !textB.trim())) {
      setError('Provide two documents: paste both texts, or pick two files.');
      return;
    }
    if ((fileA && !fileB) || (!fileA && fileB)) {
      setError('Pick two files, or paste two texts — not a mix of both.');
      return;
    }
    setBusy(true);
    try {
      const payload =
        fileA && fileB
          ? (() => {
              const form = new FormData();
              form.append('documents', fileA);
              form.append('documents', fileB);
              return form;
            })()
          : { documentA: textA, documentB: textB };
      const result = await compareDocuments(payload);
      setDiffs(Array.isArray(result.diffs) ? result.diffs : []);
    } catch (err) {
      setError(err?.message ?? 'Comparison failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const counts = { added: 0, removed: 0, modified: 0, unchanged: 0 };
  for (const diff of diffs ?? []) {
    if (diff.status in counts) counts[diff.status] += 1;
  }
  const visibleDiffs = (diffs ?? []).filter((diff) =>
    filter === 'all'
      ? true
      : filter === 'changed'
        ? diff.status !== 'unchanged'
        : diff.status === 'unchanged'
  );

  return (
    <>
      <DisclaimerBar
        message="Informational comparison only — not legal advice."
        signal="Diff Engine v4.1 (Bi-directional Token Scan) • Synced Scrolling Enabled"
      />
      <section className="w-full bg-surface-container-lowest px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <span className="font-label-md text-label-md uppercase tracking-wider text-secondary">
                Analytical Redline Workspace
              </span>
              <h1 className="font-headline-xl text-headline-xl tracking-tight text-primary">
                Draft Comparison — Original vs. Counter-Draft
              </h1>
            </div>
            <form className="flex flex-col gap-3" onSubmit={handleCompare}>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center justify-center gap-2 bg-primary px-6 py-2.5 font-label-lg text-label-lg font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-60"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                  difference
                </span>
                {busy ? 'Comparing…' : 'Compare Drafts'}
              </button>
              {error ? (
                <p
                  role="alert"
                  className="bg-error-container px-3 py-2 font-label-sm text-label-sm text-on-error-container"
                >
                  {error}
                </p>
              ) : null}
            </form>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DocSlot
              label="Document A"
              note="Base Baseline"
              icon="description"
              fileName={fileA?.name ?? null}
              onFile={setFileA}
              text={textA}
              onText={setTextA}
            />
            <DocSlot
              label="Document B"
              note="In-Review Markup"
              icon="edit_document"
              fileName={fileB?.name ?? null}
              onFile={setFileB}
              text={textB}
              onText={setTextB}
            />
          </div>
        </div>
      </section>

      <main className="w-full bg-surface px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          {diffs ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container px-4 py-2">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-wrap items-center gap-3 font-label-sm text-label-sm text-secondary">
                    <span className="flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1 shadow-sm">
                      <span className="font-semibold text-primary">Status:</span>
                      <span className="text-on-surface-variant">Reconciled</span>
                    </span>
                    <span className="flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1 font-semibold text-primary shadow-sm">
                      <span className="flex h-4 w-4 items-center justify-center bg-tertiary-container text-[11px] font-bold text-on-tertiary-container">
                        ~
                      </span>
                      {counts.modified} modified
                    </span>
                    <span className="flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1 font-semibold text-primary shadow-sm">
                      <span className="flex h-4 w-4 items-center justify-center bg-secondary-container text-[11px] font-bold">
                        +
                      </span>
                      {counts.added} added
                    </span>
                    <span className="flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1 font-semibold text-primary shadow-sm">
                      <span className="flex h-4 w-4 items-center justify-center bg-error-container text-[11px] font-bold">
                        −
                      </span>
                      {counts.removed} removed
                    </span>
                    <span className="flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1 font-semibold text-primary shadow-sm">
                      <span className="flex h-4 w-4 items-center justify-center bg-surface-container-high text-[11px] font-bold">
                        =
                      </span>
                      {counts.unchanged} unchanged
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    data-filter={chip.key}
                    aria-pressed={filter === chip.key}
                    onClick={() => setFilter(chip.key)}
                    className={`px-4 py-1 font-label-sm text-label-sm shadow-sm ${
                      filter === chip.key
                        ? 'bg-primary font-semibold text-on-primary'
                        : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {visibleDiffs.length === 0 ? (
                <p className="bg-surface-container-lowest p-6 font-body-md text-body-md text-secondary shadow-sm">
                  No provisions match this filter.
                </p>
              ) : (
                visibleDiffs.map((diff) => {
                  const meta = STATUS_META[diff.status] ?? STATUS_META.unchanged;
                  return (
                    <section
                      key={`${diff.clauseId}-${diff.status}`}
                      data-type={diff.status}
                      className="flex flex-col overflow-hidden bg-surface-container-lowest shadow-md"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span className="bg-surface-container-highest px-2 py-0.5 font-code-mono text-code-mono font-bold text-primary">
                            CLAUSE {diff.clauseId.replace(/^c/, '')}
                          </span>
                          <span className="font-headline-sm text-headline-sm text-primary">
                            {meta.label}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-label-sm text-label-sm font-semibold ${meta.badge}`}
                        >
                          <span>{meta.glyph}</span>
                          <span>{meta.label}</span>
                        </span>
                      </div>
                      <div className="flex flex-col gap-3 bg-surface-container-lowest p-6 md:flex-row">
                        <div className="flex flex-1 flex-col justify-between">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-label-sm text-label-sm font-semibold uppercase text-secondary">
                              {diff.status === 'added' ? 'Document A' : 'Document A • Original'}
                            </span>
                            {diff.status === 'added' ? (
                              <span className="flex items-center gap-1 bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-secondary">
                                <span
                                  aria-hidden="true"
                                  className="material-symbols-outlined text-[16px]"
                                >
                                  do_not_disturb_on
                                </span>
                                Clause omitted
                              </span>
                            ) : null}
                          </div>
                          <p className="text-doc-clause text-doc-clause text-on-surface">
                            {diff.status === 'added'
                              ? 'This clause is absent from Document A.'
                              : diff.status === 'unchanged'
                                ? 'This clause is identical in both documents.'
                                : 'Review the original phrasing in Document A against the counter-draft in Document B.'}
                          </p>
                        </div>
                        <div className="flex flex-1 flex-col justify-between bg-surface-container-low p-4">
                          <span className="font-label-sm text-label-sm font-semibold uppercase text-primary">
                            {diff.status === 'removed'
                              ? 'Document B • Counter-Draft'
                              : 'What changed'}
                          </span>
                          <p className="text-doc-clause text-doc-clause text-on-surface">
                            {diff.explanation}
                          </p>
                          <div className="mt-3 bg-surface-container-lowest p-3">
                            <p className="font-label-sm text-label-sm text-secondary">
                              <strong>Review Note:</strong> Confirm the change against the signed
                              baseline before executing either version.
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  );
                })
              )}
            </>
          ) : (
            <p className="bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-secondary shadow-sm">
              Provide two drafts above, then compare them. A clause-level diff will appear here.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
