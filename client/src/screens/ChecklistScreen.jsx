/**
 * Checklist screen. Derives a pre-meeting lawyer checklist from the tagged clauses, lets the user tick items and add custom items, exports to PDF/TXT or copies to the clipboard, and shows a derive-progress state.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession, setChecklist } from '../store/session.jsx';
import { deriveChecklist, exportChecklist, downloadBlob } from '../lib/api.js';
import { copyText } from '../lib/clipboard.js';
import DisclaimerBar from '../components/DisclaimerBar.jsx';

function initialItems(strings) {
  return strings.map((text, index) => ({
    key: `checklist-${index}`,
    text,
    checked: false,
  }));
}

export default function ChecklistScreen() {
  const { state, dispatch } = useSession();
  const [items, setItems] = useState(() => initialItems(state.checklist?.checklist ?? []));
  const [custom, setCustom] = useState('');
  const [toast, setToast] = useState(null);
  const [deriving, setDeriving] = useState(false);
  const [deriveError, setDeriveError] = useState(null);
  const startedRef = useRef(false);
  const toastTimerRef = useRef(null);

  const clauses = state.clauses;
  const checklist = state.checklist;

  const showToast = (message) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    if (checklist || startedRef.current || clauses.length === 0) return;
    startedRef.current = true;
    setDeriving(true);
    deriveChecklist(clauses)
      .then((result) => {
        dispatch(
          setChecklist({ checklist: result.checklist, lawyerQuestions: result.lawyerQuestions })
        );
        setItems(initialItems(result.checklist));
      })
      .catch((error) => {
        setDeriveError(error?.message ?? 'Failed to generate the checklist. Please try again.');
      })
      .finally(() => setDeriving(false));

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [checklist, clauses, dispatch]);

  if (clauses.length === 0) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-primary">
          checklist
        </span>
        <h1 className="mt-3 font-headline-lg text-headline-lg text-primary">No checklist yet</h1>
        <p className="mt-2 font-body-md text-body-md text-secondary">
          Analyze a document to generate action items and lawyer-prep questions.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 bg-primary px-5 py-2.5 font-label-lg text-label-lg font-semibold text-on-primary shadow-sm"
        >
          Analyze a document
        </Link>
      </section>
    );
  }

  const completed = items.filter((item) => item.checked).length;
  const percentage = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  const toggleItem = (key) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, checked: !item.checked } : item))
    );
  };

  const addCustomItem = () => {
    const text = custom.trim();
    if (!text) return;
    setItems((current) => [...current, { key: `custom-${Date.now()}`, text, checked: false }]);
    setCustom('');
  };

  const handleCopy = async (text) => {
    try {
      await copyText(text);
      showToast('Question copied to clipboard');
    } catch {
      showToast('Could not copy automatically — please copy manually.');
    }
  };

  const handleExport = async (format) => {
    const body = {
      checklist: items.map((item) => item.text),
      lawyerQuestions: checklist?.lawyerQuestions ?? [],
      format,
    };
    try {
      const blob = await exportChecklist(body);
      downloadBlob(
        blob,
        format === 'pdf' ? 'clearclause-checklist.pdf' : 'clearclause-checklist.txt'
      );
      showToast(format === 'pdf' ? 'Checklist PDF downloaded' : 'Checklist plain text downloaded');
    } catch (error) {
      showToast(error?.message ?? 'Export failed. Please try again.');
    }
  };

  const lawyerQuestions = checklist?.lawyerQuestions ?? [];

  return (
    <>
      <DisclaimerBar
        message="Informational summary only — not legal advice. Consult an attorney for formal representation."
        signal="Prepared from a deterministic clause review"
      />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <span className="inline-block bg-surface-container-low px-3 py-0.5 font-label-sm text-label-sm uppercase tracking-widest text-secondary">
              Phase 04 // Consultation Prep
            </span>
            <h1 className="mt-2 font-headline-xl text-headline-xl font-semibold tracking-tight text-primary">
              Action Checklist & Lawyer Consultation Brief
            </h1>
            <p className="font-body-md text-body-md text-secondary">
              Generated from{' '}
              <span className="bg-surface-container px-1 py-0.5 font-label-md text-label-md font-medium text-primary">
                {state.fileName}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              id="export-pdf-btn"
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-2 bg-primary-container px-4 py-2.5 font-label-lg text-label-lg text-on-primary transition-all hover:bg-primary"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                picture_as_pdf
              </span>
              Export Checklist (PDF)
            </button>
            <button
              type="button"
              id="export-txt-btn"
              onClick={() => handleExport('txt')}
              className="flex items-center gap-2 bg-surface-container-lowest px-4 py-2.5 font-label-lg text-label-lg text-primary shadow-sm transition-all hover:bg-surface-container-low"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                terminal
              </span>
              Export Plain Text (.txt)
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 bg-surface-container-lowest p-6 shadow-sm md:grid-cols-4">
          <div>
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
              Pre-Sign Readiness
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-bold text-primary">
                {percentage}%
              </span>
              <span className="font-label-md text-label-md text-secondary">
                ({completed} of {items.length} completed)
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden bg-surface-container-low">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
          <div className="border-surface-dim md:border-r md:pr-4">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
              Checklist Items
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-bold text-primary">
                {items.length} Matters
              </span>
              <span className="bg-error-container px-1 py-0.5 font-label-sm text-label-sm text-on-error-container">
                High Risk
              </span>
            </div>
          </div>
          <div className="border-surface-dim md:border-r md:pr-4">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
              Lawyer Questions
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-bold text-primary">
                {lawyerQuestions.length}
              </span>
              <span className="font-label-sm text-label-sm text-secondary">Pre-formatted</span>
            </div>
          </div>
          <div>
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
              Applicable Jurisdiction
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-bold text-primary">
                Local
              </span>
              <span className="bg-secondary-container px-1 py-0.5 font-label-sm text-label-sm text-on-secondary-container">
                Housing Act
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-secondary">
              Consult counsel for your state&apos;s laws.
            </span>
          </div>
        </div>

        <div className="mb-6 flex flex-col items-start justify-between gap-4 bg-surface-container-lowest p-6 shadow-sm sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="material-symbols-outlined text-[24px] text-primary">
              rule
            </span>
            <div>
              <span className="font-label-md text-label-md font-semibold uppercase tracking-wide text-primary">
                Want a Counter-Draft?
              </span>
              <p className="mt-0.5 font-body-sm text-body-sm text-secondary">
                Draft alternative clause language against the original in the redline workspace,
                then verify every proposed change clause by clause.
              </p>
            </div>
          </div>
          <Link
            to="/compare"
            className="flex shrink-0 items-center gap-2 bg-primary px-5 py-2.5 font-label-lg text-label-lg font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-container"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              difference
            </span>
            Draft Counter-Proposal
          </Link>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <section className="flex flex-col gap-4 bg-surface-container-lowest p-6 shadow-sm lg:col-span-6">
            <div className="flex items-center justify-between border-b border-surface-dim pb-4">
              <div>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                  Checklist 01
                </span>
                <h2 className="font-headline-lg text-headline-lg text-primary">
                  Action Items & Deadlines
                </h2>
              </div>
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[24px] text-secondary"
              >
                assignment_turned_in
              </span>
            </div>
            {deriving ? (
              <p className="font-body-sm text-body-sm text-secondary">
                Deriving actionable items from your clauses…
              </p>
            ) : null}
            {deriveError ? (
              <p
                role="alert"
                className="bg-error-container px-4 py-3 font-label-md text-label-md text-on-error-container"
              >
                {deriveError}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-start gap-4 bg-surface-container-low p-4 transition-colors hover:bg-surface-container"
                >
                  <input
                    type="checkbox"
                    className="mt-1.5 h-4 w-4 accent-primary"
                    checked={item.checked}
                    onChange={() => toggleItem(item.key)}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`font-body-md text-body-md font-medium leading-normal text-primary ${item.checked ? 'line-through text-secondary' : ''}`}
                    >
                      {item.text}
                    </span>
                  </span>
                </label>
              ))}
              {!deriving && items.length === 0 && !deriveError ? (
                <p className="font-body-sm text-body-sm text-secondary">
                  No checklist items were flagged for this document.
                </p>
              ) : null}
            </div>
            <div className="flex gap-3 pt-2">
              <input
                type="text"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                id="custom-item-input"
                aria-label="Add a personal contingency or rider request"
                placeholder="Add personal contingency or rider request..."
                className="flex-1 bg-surface-container-low px-4 py-2 font-label-md text-label-md text-primary placeholder:text-secondary"
              />
              <button
                type="button"
                id="add-item-btn"
                onClick={addCustomItem}
                className="flex items-center gap-1 bg-surface-container-highest px-4 py-2 font-label-md text-label-md text-primary transition-colors hover:bg-primary hover:text-on-primary"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                  add
                </span>
                Add Item
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-4 bg-surface-container-lowest p-6 shadow-sm lg:col-span-6">
            <div className="flex items-center justify-between border-b border-surface-dim pb-4">
              <div>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                  Briefing Memo 02
                </span>
                <h2 className="font-headline-lg text-headline-lg text-primary">
                  Questions to Ask a Lawyer
                </h2>
              </div>
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[24px] text-secondary"
              >
                contact_support
              </span>
            </div>
            {lawyerQuestions.length === 0 ? (
              <p className="font-body-sm text-body-sm text-secondary">
                No questions were flagged. Your document looks procedurally clean.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {lawyerQuestions.map((question, index) => (
                  <div
                    key={`${index}-${question}`}
                    className="flex flex-col gap-2 bg-surface-container-low p-5"
                  >
                    <span className="font-label-sm text-label-sm font-semibold uppercase text-primary">
                      Issue 0{index + 1}
                    </span>
                    <p className="font-headline-sm text-headline-sm font-semibold leading-snug text-primary">
                      “{question}”
                    </p>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        className="flex items-center gap-1 font-label-sm text-label-sm text-secondary transition-colors hover:text-primary"
                        onClick={() => handleCopy(question)}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                          content_copy
                        </span>
                        Copy Question
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-start gap-4 bg-surface-container-highest p-4">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[20px] text-primary"
              >
                balance
              </span>
              <div>
                <span className="font-label-md text-label-md font-semibold uppercase tracking-wide text-primary">
                  Attorney Prep Tip
                </span>
                <p className="font-body-sm text-body-sm text-secondary">
                  Provide these exact questions to your attorney in advance. This avoids exploratory
                  research fees and focuses the consult strictly on flagged risks.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {toast ? (
        <div
          role="status"
          id="toast"
          className="fixed bottom-6 right-6 flex items-center gap-2 bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-lg"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            check_circle
          </span>
          <span>{toast}</span>
        </div>
      ) : null}
    </>
  );
}
