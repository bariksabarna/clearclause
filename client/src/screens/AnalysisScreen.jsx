import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../store/session.jsx';
import { scrollToClause } from '../lib/scrollTo.js';
import { deriveOptions } from '../lib/options.js';
import DisclaimerBar from '../components/DisclaimerBar.jsx';
import DocumentPane from '../components/DocumentPane.jsx';
import ClauseBadge from '../components/ClauseBadge.jsx';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'High', label: 'High' },
  { key: 'Medium', label: 'Medium' },
  { key: 'Low', label: 'Low' },
];

export default function AnalysisScreen() {
  const { state } = useSession();
  const [filter, setFilter] = useState('all');

  const clauses = state.clauses;
  const counts = useMemo(() => {
    const result = { High: 0, Medium: 0, Low: 0 };
    for (const clause of clauses) {
      if (clause.severity in result) result[clause.severity] += 1;
    }
    return result;
  }, [clauses]);

  const filtered = useMemo(
    () => (filter === 'all' ? clauses : clauses.filter((clause) => clause.severity === filter)),
    [clauses, filter]
  );

  const options = useMemo(() => deriveOptions(clauses), [clauses]);

  if (clauses.length === 0) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-primary">
          description
        </span>
        <h1 className="mt-3 font-headline-lg text-headline-lg text-primary">No analysis yet</h1>
        <p className="mt-2 font-body-md text-body-md text-secondary">
          Upload a document to build its clause-by-clause analysis.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 bg-primary px-5 py-2.5 font-label-lg text-label-lg font-semibold text-on-primary shadow-sm"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            upload_file
          </span>
          Analyze a document
        </Link>
      </section>
    );
  }

  const jumpToHighestRisk = () => {
    const firstHigh = clauses.find((clause) => clause.severity === 'High');
    if (firstHigh) scrollToClause(firstHigh.id);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <DisclaimerBar
        message="Informational analysis only — does not constitute legal advice or representation."
        signal="Annotated Session Live"
      />

      <section className="w-full bg-surface-container-low px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="inline-block bg-surface-container-high px-1.5 py-0.5 font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">
              Instrument Verified
            </span>
            <h1 className="mt-2 font-headline-lg text-headline-lg tracking-tight text-primary">
              Document Analysis — {state.fileName ?? 'Untitled'}
            </h1>
            <p className="font-body-sm text-body-sm text-secondary">
              {state.summary ?? 'Plain-language summary pending.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={jumpToHighestRisk}
              className="flex items-center gap-1.5 bg-primary px-4 py-2 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-primary-container"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                bolt
              </span>
              Jump to Highest Risk
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-surface-container-lowest px-4 py-2 font-label-md text-label-md font-semibold text-primary shadow-sm transition-colors hover:bg-surface-container"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                print
              </span>
              Export Markup
            </button>
          </div>
        </div>
        <div className="mx-auto mt-4 grid max-w-7xl grid-cols-2 gap-2 pt-2 font-label-md text-label-md sm:grid-cols-4 md:grid-cols-6">
          <div className="flex flex-col justify-between bg-surface-container-lowest p-3 shadow-sm">
            <span className="font-label-sm text-label-sm text-secondary">Clauses Analyzed</span>
            <span className="font-headline-sm text-headline-sm font-bold text-primary">
              {clauses.length}
            </span>
          </div>
          <div className="flex flex-col justify-between border-l-2 border-risk-high bg-surface-container-lowest p-3 shadow-sm">
            <span className="font-label-sm text-label-sm text-secondary">High Risk Flagged</span>
            <span className="font-headline-sm text-headline-sm font-bold text-risk-high">
              {counts.High}
            </span>
          </div>
          <div className="flex flex-col justify-between border-l-2 border-risk-medium bg-surface-container-lowest p-3 shadow-sm">
            <span className="font-label-sm text-label-sm text-secondary">Medium Risk</span>
            <span className="font-headline-sm text-headline-sm font-bold text-risk-medium">
              {counts.Medium}
            </span>
          </div>
          <div className="flex flex-col justify-between border-l-2 border-risk-safe bg-surface-container-lowest p-3 shadow-sm">
            <span className="font-label-sm text-label-sm text-secondary">Low Risk</span>
            <span className="font-headline-sm text-headline-sm font-bold text-risk-safe">
              {counts.Low}
            </span>
          </div>
          <div className="col-span-2 flex items-center justify-between gap-2 bg-surface-container-lowest p-3 shadow-sm">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-secondary">
                Filter Margin Notes:
              </span>
              <div className="mt-1 flex items-center gap-1">
                {FILTERS.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    data-filter={chip.key}
                    aria-pressed={filter === chip.key}
                    onClick={() => setFilter(chip.key)}
                    className={`px-2 py-0.5 font-label-sm text-label-sm uppercase ${
                      filter === chip.key
                        ? 'bg-primary font-semibold text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                    }`}
                  >
                    {chip.label} ({chip.key === 'all' ? clauses.length : counts[chip.key]})
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full bg-surface px-4 py-6 sm:px-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <DocumentPane clauses={clauses} title={state.fileName ?? 'Document'} />
          </div>
          <div className="flex flex-col gap-4 lg:col-span-5">
            {options.length > 0 && (
              <section
                aria-labelledby="options-heading"
                className="bg-surface-container-lowest p-4 shadow-sm"
              >
                <h2
                  id="options-heading"
                  className="flex items-center gap-1 font-label-sm text-label-sm font-bold uppercase tracking-wider text-secondary"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                    checklist
                  </span>
                  What are my options
                </h2>
                <p className="mt-1 font-body-sm text-body-sm text-secondary">
                  Plain-language moves to consider for the highest-risk clauses. Informational only
                  — not legal advice.
                </p>
                <ul className="mt-3 space-y-3">
                  {options.map((entry) => (
                    <li key={entry.clauseId}>
                      <button
                        type="button"
                        onClick={() => scrollToClause(entry.clauseId)}
                        className="flex items-center gap-1 font-label-sm text-label-sm font-semibold text-primary transition-colors hover:text-primary-container"
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                          my_location
                        </span>
                        Clause {entry.clauseId.replace(/^c/, '')}
                      </button>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 font-body-sm text-body-sm text-on-surface">
                        {entry.options.map((option) => (
                          <li key={option}>{option}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="flex items-center justify-between bg-surface-container-high px-4 py-2 shadow-sm">
              <span className="flex items-center gap-1 font-label-sm text-label-sm font-bold uppercase tracking-wider text-secondary">
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                  edit_note
                </span>
                Editorial Marginalia
              </span>
              <span className="font-code-mono text-code-mono text-outline">
                {filtered.length} Active Flags
              </span>
            </div>
            {filtered.map((clause) => (
              <article
                key={clause.id}
                data-risk={clause.severity.toLowerCase()}
                className="cursor-pointer bg-surface-container-lowest p-4 shadow-sm transition-all duration-200 hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-surface-container px-1.5 py-0.5 font-label-sm text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                      {clause.tag}
                    </span>
                    <span className="font-code-mono text-code-mono text-secondary">
                      Clause {clause.id.replace(/^c/, '')}
                    </span>
                  </div>
                  <ClauseBadge severity={clause.severity} />
                </div>
                <h2 className="mb-1 font-headline-sm text-headline-sm text-primary">
                  What this clause means
                </h2>
                <p className="mb-2 font-body-md text-body-md text-on-surface">
                  {clause.explanation}
                </p>
                <div className="space-y-1 bg-surface-container-low p-3">
                  <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">
                    Analysis Note:
                  </span>
                  <p className="text-doc-clause text-doc-clause text-on-surface-variant">
                    {clause.severityReason}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => scrollToClause(clause.id)}
                  className="mt-2 flex items-center gap-1 font-label-sm text-label-sm text-secondary transition-colors hover:text-primary"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                    my_location
                  </span>
                  Pin to Clause {clause.id.replace(/^c/, '')}
                </button>
              </article>
            ))}
            <p className="flex items-center gap-2 bg-surface-container p-3 font-label-sm text-label-sm text-secondary">
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                draw
              </span>
              Click any margin card to navigate and focus the respective contract clause.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
