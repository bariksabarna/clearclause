/**
 * Informational-only notice banner shown above AI-backed screens.
 */
export default function DisclaimerBar({ message, signal = null }) {
  return (
    <div className="flex w-full flex-col items-start justify-between gap-1 bg-surface-container-low px-4 py-2 sm:flex-row sm:items-center sm:px-6">
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-outline">
          verified_user
        </span>
        <span className="font-label-md text-label-md text-on-surface-variant">{message}</span>
      </span>
      {signal ? <span className="font-label-sm text-label-sm text-secondary">{signal}</span> : null}
    </div>
  );
}
