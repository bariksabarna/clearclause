/**
 * Home screen. Hero, upload dropzone (drag-drop + picker + 5 MB + zero-retention framing), one-tap demo chips for the three samples, and the four-part ClearClause pitch grid. Nothing is stored on a server by design.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession, beginAnalysis } from '../store/session.jsx';
import UploadDropzone from '../components/UploadDropzone.jsx';
import DisclaimerBar from '../components/DisclaimerBar.jsx';
import { SAMPLES } from '../lib/samples.js';

const ANATOMY = [
  {
    index: '01',
    label: 'DECONSTRUCTION',
    icon: 'find_in_page',
    title: 'Plain Equivalents',
    text: 'Translates Latinisms, double-negatives, and run-on indemnities into direct layman phrasing.',
  },
  {
    index: '02',
    label: 'LIABILITY',
    icon: 'gavel',
    title: 'Obligation Auditing',
    text: 'Identifies mandatory timeline triggers, forfeiture clauses, and implicit unilateral rights.',
  },
  {
    index: '03',
    label: 'REDLINES',
    icon: 'rule',
    title: 'Omission Detection',
    text: 'Highlights standard protections visibly absent from the counter-draft.',
  },
  {
    index: '04',
    label: 'ARCHIVAL',
    icon: 'security',
    title: 'Ephemeral Sandbox',
    text: 'Every document stays pinned strictly in your current session memory; no public LLM ingestion.',
  },
];

export default function HomeScreen() {
  const navigate = useNavigate();
  const { dispatch } = useSession();
  const [busy, setBusy] = useState(false);

  const startAnalysis = (fileName, payload) => {
    setBusy(true);
    dispatch(beginAnalysis(fileName, payload));
    navigate('/analyzing');
  };

  const handleFile = (file) => startAnalysis(file.name, { kind: 'file', file });

  const handleSample = (sample) =>
    startAnalysis(sample.fileName, { kind: 'text', text: sample.text });

  return (
    <>
      <DisclaimerBar message="ClearClause provides document summaries and informational explanations only, not legal advice." />

      <section className="w-full bg-surface-container-low px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 bg-surface-container px-4 py-1 shadow-sm">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[16px] text-secondary"
            >
              verified_user
            </span>
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
              Editorial Intake System
            </span>
          </div>
          <h1 className="mb-3 font-headline-xl text-headline-xl font-semibold tracking-tight text-primary">
            Understand your contract in plain English.
          </h1>
          <p className="mb-10 max-w-2xl font-body-lg text-body-lg text-secondary">
            Upload a lease, offer letter, or policy to identify your obligations, rights, and
            potential risks.
          </p>

          <UploadDropzone onFile={handleFile} busy={busy} />

          <p className="mt-4 font-label-sm text-label-sm text-on-surface-variant">
            Accepts PDF or DOCX up to 5 MB, or paste the text. It is processed securely and never
            retained.
          </p>

          <div className="mt-10 flex w-full flex-col items-center pt-6">
            <span className="mb-4 font-label-sm text-label-sm uppercase tracking-wider text-secondary">
              Or load a sample legal record to explore:
            </span>
            <div className="grid w-full max-w-3xl grid-cols-1 gap-4 md:grid-cols-3">
              {SAMPLES.map((sample) => (
                <button
                  key={sample.key}
                  type="button"
                  data-sample={sample.key}
                  onClick={() => handleSample(sample)}
                  disabled={busy}
                  className="flex flex-col justify-between bg-surface-container-lowest p-4 text-left shadow-sm transition-all hover:shadow-md disabled:opacity-60"
                >
                  <div className="mb-2 flex w-full items-center justify-between">
                    <span className="font-label-sm text-label-sm uppercase tracking-tight text-secondary">
                      {sample.category}
                    </span>
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined text-[16px] text-outline"
                    >
                      arrow_forward
                    </span>
                  </div>
                  <div>
                    <div className="mb-1 font-headline-sm text-[16px] font-semibold leading-snug text-primary">
                      {sample.title}
                    </div>
                    <div className="truncate font-label-sm text-label-sm text-on-surface-variant">
                      {sample.fileName}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {SAMPLES.map((sample) => (
                <a
                  key={sample.key}
                  href={`/samples/${sample.fileName.replace(/ /g, '-')}`}
                  download
                  className="inline-flex items-center gap-1 font-label-sm text-label-sm text-secondary transition-colors hover:text-primary"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[15px]">
                    download
                  </span>
                  Download {sample.title.toLowerCase()} as PDF
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="w-full bg-surface px-4 py-10 sm:px-6" aria-labelledby="anatomy-heading">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="mb-1 block font-label-sm text-label-sm uppercase tracking-widest text-tertiary">
                Analysis Taxonomy
              </span>
              <h2 id="anatomy-heading" className="font-headline-lg text-headline-lg text-primary">
                Precision reading instruments
              </h2>
            </div>
            <p className="mt-2 max-w-md font-body-sm text-body-sm text-secondary md:mt-0">
              ClearClause indexes standard boilerplate clauses against verified statutory
              precedents, isolating hidden liabilities before you execute.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ANATOMY.map((item) => (
              <div key={item.index} className="bg-surface-container-lowest p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-secondary">
                    {item.index} / {item.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined text-[18px] text-primary"
                  >
                    {item.icon}
                  </span>
                </div>
                <h3 className="mb-1 font-headline-sm text-headline-sm text-primary">
                  {item.title}
                </h3>
                <p className="font-body-sm text-body-sm text-secondary">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
