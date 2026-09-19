/**
 * Analyzing screen. Streams the analyze endpoint over SSE, advances a four-stage progress stepper as tagged clauses arrive, supports user abort (AbortController) for in-flight requests, and navigates to the analysis on completion.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { streamAnalyze, isIntakeErrorCode } from '../lib/api.js';
import {
  useSession,
  setClauses,
  setDocumentText,
  setInconsistencies,
  setSummary,
  completeAnalysis,
  failAnalysis,
} from '../store/session.jsx';

const PHASES = [
  {
    label: 'Structure & Headers',
    activeNote: 'Reading document structure',
    doneNote: 'Identified base sections',
  },
  {
    label: 'Clause Extraction',
    activeNote: 'Splitting into clauses',
    doneNote: 'Clauses mapped to DOM',
  },
  {
    label: 'Risk & Obligations',
    activeNote: 'Tagging severities',
    doneNote: 'Targeting indemnity covenants',
  },
  { label: 'Plain Translations', activeNote: 'Writing summary', doneNote: 'Awaiting risk matrix' },
];

const PROGRESS_BY_STAGE = { reading: 15, chunking: 40, analyzing: 70, done: 100 };

function phaseIndexForStage(stage) {
  if (stage === 'done') return 3;
  if (stage === 'analyzing') return 2;
  if (stage === 'chunking') return 1;
  return 0;
}

function buildAnalyzePayload(payload) {
  if (payload?.kind === 'file') {
    const form = new FormData();
    form.append('document', payload.file);
    return form;
  }
  return { text: payload?.text ?? '' };
}

export default function AnalyzingScreen() {
  const { state, dispatch } = useSession();
  const navigate = useNavigate();
  const [stage, setStage] = useState('reading');
  const [tokenCount, setTokenCount] = useState(0);
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);
  const controllerRef = useRef(null);

  const phaseIndex = phaseIndexForStage(stage);
  const progress = PROGRESS_BY_STAGE[stage] ?? 12;

  const abortInspection = () => {
    cancelledRef.current = true;
    controllerRef.current?.abort();
    navigate('/');
  };

  useEffect(() => {
    if (!state.describing || startedRef.current) return;
    startedRef.current = true;
    const payload = buildAnalyzePayload(state.payload);
    const controller = new AbortController();
    controllerRef.current = controller;
    let cancelled = false;

    streamAnalyze(
      payload,
      {
        status: (data) => {
          if (cancelled || cancelledRef.current) return;
          if (typeof data?.stage === 'string') setStage(data.stage);
        },
        clauses: (data) => {
          const clauses = Array.isArray(data.clauses) ? data.clauses : [];
          dispatch(setClauses(clauses));
          dispatch(
            setDocumentText(
              clauses
                .map((clause) => clause.sourceText ?? '')
                .filter(Boolean)
                .join('\n\n')
            )
          );
          setTokenCount(
            clauses.reduce(
              (sum, clause) =>
                sum +
                String(clause.sourceText ?? '')
                  .split(/\s+/)
                  .filter(Boolean).length,
              0
            )
          );
        },
        inconsistencies: (data) => {
          dispatch(
            setInconsistencies(Array.isArray(data.inconsistencies) ? data.inconsistencies : [])
          );
        },
        summary: (data) => {
          if (!cancelled && typeof data?.summary === 'string') dispatch(setSummary(data.summary));
        },
        done: () => {
          if (cancelled || cancelledRef.current) return;
          dispatch(completeAnalysis());
          navigate('/analysis', { replace: true });
        },
        error: (data) => {
          if (cancelled || cancelledRef.current) return;
          dispatch(
            failAnalysis({
              code: typeof data?.code === 'string' ? data.code : 'AI_UNREACHABLE',
              message: typeof data?.message === 'string' ? data.message : 'Analysis interrupted.',
            })
          );
        },
      },
      { signal: controller.signal }
    ).catch((error) => {
      if (cancelled || cancelledRef.current) return;
      setStage('done');
      dispatch(
        failAnalysis({
          code: error?.code ?? 'AI_UNREACHABLE',
          message: error?.message ?? 'The analysis service encountered an error. Please try again.',
        })
      );
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [state.describing, state.payload, dispatch, navigate]);

  const failure = state.error;
  const isIntake = failure ? isIntakeErrorCode(failure.code) : false;

  if (failure) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-error">
          error
        </span>
        <h1 className="mt-3 font-headline-lg text-headline-lg text-primary">
          We could not finish analyzing this document
        </h1>
        <p role="alert" className="mt-2 font-body-md text-body-md text-secondary">
          {failure.message}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {isIntake ? (
            <Link
              to={`/issues?code=${failure.code}`}
              className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 font-label-lg text-label-lg font-semibold text-on-primary shadow-sm"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                support_agent
              </span>
              See guidance
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 font-label-lg text-label-lg font-semibold text-on-primary shadow-sm"
            >
              Try again
            </button>
          )}
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-surface-container-lowest px-5 py-2.5 font-label-lg text-label-lg font-semibold text-primary shadow-sm"
          >
            Choose another document
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="flex w-full flex-wrap items-center justify-between gap-3 bg-surface-container-low px-4 py-3 shadow-sm sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1 font-label-md text-label-md font-medium text-on-surface-variant">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[16px] text-tertiary animate-spin"
              style={{ animationDuration: '3s' }}
            >
              sync
            </span>
            ENGINE PASS: {phaseIndex + 1}/04 • {PHASES[phaseIndex].label.toUpperCase()}
          </span>
          <span className="font-label-md text-label-md text-outline-variant">|</span>
          <span className="font-code-mono text-code-mono text-secondary">
            ENCODING: UTF-8 • TOKENS PARSED:{' '}
            <span className="font-semibold text-on-surface">{tokenCount.toLocaleString()}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={abortInspection}
          className="flex items-center gap-1.5 px-3 py-1.5 font-label-md text-label-md text-secondary transition-colors hover:bg-surface-container-highest hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
            cancel
          </span>
          Abort Inspection
        </button>
      </div>

      <section className="mx-auto w-full max-w-7xl px-4 pt-8 pb-6 sm:px-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 font-label-sm text-label-sm font-semibold uppercase tracking-widest text-tertiary">
              <span className="h-2 w-2 rounded-full bg-tertiary animate-pulse" />
              Active Ingestion Pipeline
            </p>
            <h1 className="mt-2 font-headline-xl text-headline-xl font-semibold tracking-tight text-primary">
              Analyzing {state.fileName ?? 'document'}
            </h1>
            <p className="mt-1 font-body-md text-body-md text-secondary">
              Deconstructing structural tenure, liability covenants, and risk markers into
              plain-language analytical records.
            </p>
          </div>
          <div className="flex min-w-[260px] items-center gap-6 bg-surface-container-lowest p-4 shadow-sm">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-surface-container-high"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeDasharray={`${progress}, 100`}
                  className="text-primary"
                />
              </svg>
              <span className="absolute font-label-md text-label-md font-bold text-primary">
                {progress}%
              </span>
            </div>
            <div>
              <span className="block font-label-sm text-label-sm font-semibold uppercase text-secondary">
                Corpus Scan
              </span>
              <span className="block font-label-lg text-label-lg font-bold text-on-surface">
                Phase {phaseIndex + 1} of 4
              </span>
              <span className="block font-code-mono text-code-mono text-outline">
                {PHASES[phaseIndex].label.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-live="polite"
        role="status"
        className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6"
      >
        <div className="grid grid-cols-1 gap-4 bg-surface-container-lowest p-4 shadow-sm md:grid-cols-4">
          {PHASES.map((phase, index) => {
            const done = index < phaseIndex || stage === 'done';
            const active = index === phaseIndex && stage !== 'done';
            return (
              <div
                key={phase.label}
                className={`flex items-start gap-3 p-2 ${active ? 'bg-secondary-container shadow-sm' : 'bg-surface-container-low'} ${!done && !active ? 'opacity-60' : ''}`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    done
                      ? 'bg-primary'
                      : active
                        ? 'bg-primary-container animate-pulse'
                        : 'bg-surface-container-highest'
                  }`}
                >
                  {done ? (
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined text-[14px] text-on-primary"
                    >
                      check
                    </span>
                  ) : active ? (
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined text-[14px] text-on-primary-container"
                    >
                      radar
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined text-[14px] text-outline"
                    >
                      pending
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`font-label-md text-label-md ${active ? 'font-bold text-primary' : 'font-semibold text-primary'}`}
                    >
                      {phase.label}
                    </span>
                    <span
                      className={`font-label-sm text-label-sm ${active ? 'font-bold uppercase tracking-wider text-primary' : 'font-medium text-on-surface-variant'}`}
                    >
                      {done ? 'Complete' : active ? 'In Progress' : 'Pending'}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 truncate font-body-sm text-body-sm ${active ? 'text-on-secondary-container' : 'text-secondary'}`}
                  >
                    {active ? phase.activeNote : done ? phase.doneNote : 'Queued'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="relative overflow-hidden bg-surface-container-lowest p-6 shadow-md sm:p-8 lg:col-span-7">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 right-0 h-0.5 animate-pulse bg-gradient-to-r from-transparent via-tertiary-container to-transparent opacity-80"
              style={{ top: '48%' }}
            />
            <div className="mb-6 flex items-center justify-between border-b border-surface-dim pb-4">
              <span className="font-label-md text-label-md font-semibold text-primary">
                LIVE DOCUMENT STREAM
              </span>
              <span className="bg-surface-container-low px-2 py-1 font-code-mono text-code-mono text-outline-variant">
                PAGE 01 / 04
              </span>
            </div>
            <article className="max-w-[68ch] space-y-6 text-body-md text-body-md text-on-surface leading-relaxed">
              {state.clauses.length === 0 ? (
                <>
                  <h2 className="font-headline-sm text-headline-sm font-bold uppercase tracking-wide text-primary">
                    {state.fileName ?? 'Untitled document'}
                  </h2>
                  <p className="text-doc-clause text-doc-clause text-secondary">
                    Initializing optical text extraction and clause indexing…
                  </p>
                </>
              ) : (
                state.clauses.slice(-3).map((clause) => (
                  <div
                    key={clause.id}
                    className="border-l-2 border-primary bg-surface-container-low px-4 py-2"
                  >
                    <span className="font-label-sm text-label-sm font-bold uppercase tracking-wide text-primary">
                      {clause.tag}
                    </span>
                    <p className="text-doc-clause text-doc-clause text-on-surface">
                      {clause.sourceText}
                    </p>
                  </div>
                ))
              )}
            </article>
          </div>
          <aside className="space-y-4 lg:col-span-5" aria-label="Analysis & Marginalia Rail">
            <div className="flex items-center justify-between bg-surface-container-lowest p-4 shadow-sm">
              <span className="flex items-center gap-2 font-label-lg text-label-lg font-bold text-primary">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                  edit_note
                </span>
                Marginalia Projection
              </span>
              <span className="bg-surface-container-low px-2 py-0.5 font-code-mono text-code-mono text-secondary">
                {state.clauses.length} ANNOTATIONS QUEUED
              </span>
            </div>
            <div className="bg-surface-container-lowest p-4 shadow-sm">
              <span className="mb-2 block font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">
                Intake Protocol Checklist
              </span>
              <ul className="space-y-2 font-label-md text-label-md text-on-surface">
                <li className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined text-[16px] text-outline"
                  >
                    check_box_outline_blank
                  </span>
                  Max uncompressed size: <strong className="text-primary">5 MB</strong>
                </li>
                <li className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined text-[16px] text-outline"
                  >
                    check_box_outline_blank
                  </span>
                  Encrypted or DRM-locked files require passwords before upload.
                </li>
                <li className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined text-[16px] text-outline"
                  >
                    check_box_outline_blank
                  </span>
                  Multi-column layouts parsed automatically when OCR layer exists.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
