/**
 * Risk chip with icon + text. Severity is never conveyed by color alone.
 */
const RISK_META = {
  High: {
    label: 'High risk',
    icon: 'warning',
    chip: 'border-risk-high bg-risk-high/10 text-risk-high',
  },
  Medium: {
    label: 'Medium risk',
    icon: 'info',
    chip: 'border-risk-medium bg-risk-medium/10 text-risk-medium',
  },
  Low: {
    label: 'Low risk',
    icon: 'check_circle',
    chip: 'border-risk-safe bg-risk-safe/10 text-risk-safe',
  },
};

export default function ClauseBadge({ severity }) {
  const meta = RISK_META[severity] ?? RISK_META.Medium;
  return (
    <span
      className={`inline-flex items-center gap-1 border px-2 py-0.5 font-label-md text-label-md font-semibold ${meta.chip}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}
