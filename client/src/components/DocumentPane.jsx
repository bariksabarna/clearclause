import ClauseBadge from './ClauseBadge.jsx';

const SEVERITY_PANE = {
  High: 'border-risk-high bg-risk-high/5',
  Medium: 'border-risk-medium bg-risk-medium/5',
  Low: 'border-risk-safe',
};

/**
 * Bond-paper document pane. Renders each tagged clause verbatim with a risk
 * border, its classification tag, and the ClauseBadge, anchored by clause id
 * so margin cards and citations can scroll to them.
 */
export default function DocumentPane({ clauses, title = null, subtitle = null }) {
  if (!clauses || clauses.length === 0) {
    return (
      <div className="bg-surface-container-lowest p-6 shadow-sm">
        <p className="font-body-md text-body-md text-secondary">
          No clauses to display yet. Run an analysis to populate this pane.
        </p>
      </div>
    );
  }

  return (
    <div className="relative bg-surface-container-lowest p-6 shadow-sm sm:p-8">
      {title || subtitle ? (
        <div className="mb-6 border-b border-surface-dim pb-4">
          {title ? (
            <div className="font-headline-md text-headline-md font-bold uppercase tracking-wide text-primary">
              {title}
            </div>
          ) : null}
          {subtitle ? (
            <p className="mt-1 font-code-mono text-code-mono text-secondary">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      <div className="max-w-[68ch] space-y-6 leading-relaxed">
        {clauses.map((clause) => {
          const pane = SEVERITY_PANE[clause.severity] ?? SEVERITY_PANE.Low;
          return (
            <div
              id={`clause-${clause.id}`}
              key={clause.id}
              className={`border-l-2 py-1 pl-4 pr-2 ${pane}`}
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="font-label-lg text-label-lg font-bold uppercase tracking-tight text-primary">
                  {clause.tag}
                </span>
                <ClauseBadge severity={clause.severity} />
              </div>
              <p className="text-doc-clause text-doc-clause text-on-surface">{clause.sourceText}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
