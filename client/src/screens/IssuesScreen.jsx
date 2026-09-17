import { Link, useSearchParams } from 'react-router-dom';

const GUIDANCE = {
  UPLOAD_TOO_LARGE: {
    case: 'Diagnostic Case 01 // Volume Threshold',
    title: 'Document exceeds the 5 MB limit',
    icon: 'folder_limited',
    badgeText: 'Max 5 MB per file',
    badgeTone: 'bg-tertiary-fixed text-on-tertiary-fixed',
    detail: 'Your file is larger than our secure processing pipeline can analyze in a single pass.',
    whatToDo:
      'Split the PDF into separate chapters or sign-off exhibits, or compress the PDF using standard file optimization before re-uploading.',
    buttonLabel: 'Upload smaller file',
    buttonTo: '/',
  },
  UNSUPPORTED_FILE_TYPE: {
    case: 'Diagnostic Case 02 // Format Incompatibility',
    title: 'File format not supported',
    icon: 'extension_off',
    badgeText: 'PDF or DOCX only',
    badgeTone: 'bg-surface-container-high text-on-surface-variant',
    detail:
      'We can only read contracts formatted as PDF or Word (.docx), or text you paste directly. Image files, spreadsheets, and Apple Pages files cannot be read.',
    whatToDo: 'In your word processor, select File → Export As → PDF, then upload the new PDF.',
    buttonLabel: 'Try another format',
    buttonTo: '/',
  },
  SCANNED_PDF: {
    case: 'Diagnostic Case 03 // Layer Integrity Fail',
    title: 'Text could not be extracted from this scan',
    icon: 'document_scanner',
    badgeText: 'Bitmap scan without embedded text',
    badgeTone: 'bg-error-container text-on-error-container',
    detail:
      'This PDF contains scanned images without an embedded text layer or OCR metadata, making the clauses unreadable to our parser.',
    whatToDo:
      'Request a digital or search-enabled PDF from the sender, or run optical character recognition (OCR) before uploading.',
    buttonLabel: 'Select readable document',
    buttonTo: '/',
  },
  EXTRACTED_TEXT_TOO_LARGE: {
    case: 'Diagnostic Case 04 // Payload Ceiling',
    title: 'The extracted text is too large to process safely',
    icon: 'data_usage',
    badgeText: 'Hard character ceiling exceeded',
    badgeTone: 'bg-error-container text-on-error-container',
    detail:
      'The document contains more text than the analysis pipeline can process safely in a single pass.',
    whatToDo:
      'Upload a shorter version of the document, or split it into logical sections before re-uploading.',
    buttonLabel: 'Upload shorter document',
    buttonTo: '/',
  },
};

const DEFAULT_CASE = {
  case: 'Diagnostic Case 00 // Intake Checklist',
  title: 'Make your document ready for analysis',
  icon: 'rule',
  badgeText: 'Intake Protocol',
  badgeTone: 'bg-surface-container-high text-on-surface-variant',
  detail:
    'Before the pipeline can parse your contract, the file must meet the intake protocol below.',
  whatToDo: 'Upload a PDF or DOCX file under 5 MB, or paste the document text directly.',
  buttonLabel: 'Go to upload desk',
  buttonTo: '/',
};

const PROTOCOL = [
  'Max uncompressed size: 5 MB',
  'Encrypted or DRM-locked files require passwords before upload.',
  'Multi-column layouts are parsed automatically when an OCR layer exists.',
];

const backToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

export default function IssuesScreen() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const entry = GUIDANCE[code] ?? DEFAULT_CASE;

  return (
    <div className="w-full bg-surface-container-low px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 max-w-3xl">
          <p className="mb-1 flex items-center gap-1 font-label-sm text-label-sm uppercase tracking-widest text-secondary">
            Editorial Intake System <span aria-hidden="true">•</span> Exception Ledger
          </p>
          <h1 className="font-headline-xl text-headline-xl tracking-tight text-primary">
            File Processing Status & Support
          </h1>
          <p className="mt-1 font-body-lg text-body-lg text-secondary">
            Clear explanations and immediate next steps for document processing issues.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <article className="relative overflow-hidden bg-surface-container-lowest p-6 shadow-sm transition-all duration-200 hover:shadow-md">
              <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-surface-container-low text-primary">
                    <span aria-hidden="true" className="material-symbols-outlined text-[22px]">
                      {entry.icon}
                    </span>
                  </span>
                  <div>
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                      {entry.case}
                    </span>
                    <h2 className="mt-0.5 font-headline-md text-headline-md text-primary">
                      {entry.title}
                    </h2>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 self-start px-2.5 py-1 font-label-sm text-label-sm font-semibold tracking-wide ${entry.badgeTone}`}
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[15px]">
                    warning
                  </span>
                  {entry.badgeText}
                </span>
              </div>
              <div className="space-y-4">
                <div className="bg-surface-container-low p-4">
                  <span className="mb-1 block font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                    Observed Source File
                  </span>
                  <p className="text-doc-clause text-doc-clause text-on-surface">{entry.detail}</p>
                </div>
                <div className="grid grid-cols-1 items-center gap-4 py-1 sm:grid-cols-12">
                  <div className="sm:col-span-8">
                    <span className="mb-1 block font-label-md text-label-md font-semibold uppercase tracking-wide text-primary">
                      What to do:
                    </span>
                    <p className="text-doc-clause text-doc-clause text-on-surface">
                      {entry.whatToDo}
                    </p>
                  </div>
                  <div className="flex sm:col-span-4 sm:justify-end">
                    <Link
                      to={entry.buttonTo}
                      className="flex w-full items-center justify-center gap-2 bg-primary px-4 py-2.5 font-label-lg text-label-lg font-semibold text-on-primary transition-colors hover:bg-primary-container sm:w-auto"
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                        upload_file
                      </span>
                      {entry.buttonLabel}
                    </Link>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2 font-code-mono text-code-mono text-secondary">
                <span>FAILED INTAKE • SECURE PURGE COMPLETE</span>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                  Zero retention on error
                </span>
              </div>
            </article>

            <div className="flex flex-col items-center justify-between gap-4 bg-surface-container-low p-4 font-label-sm text-label-sm text-secondary md:flex-row">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-[18px] text-outline"
                >
                  lock
                </span>
                <span>
                  All uploaded files are purged immediately from temporary scratch storage following
                  a failure.
                </span>
              </div>
              <button
                type="button"
                onClick={backToTop}
                className="font-label-sm text-label-sm font-semibold text-primary underline hover:text-secondary"
              >
                Back to Top
              </button>
            </div>
          </div>

          <aside className="space-y-4 lg:col-span-4">
            <div className="bg-surface-container-lowest p-6 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                  Pipeline Telemetry
                </span>
                <span className="flex items-center gap-1 font-label-sm text-label-sm font-semibold text-tertiary">
                  <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />
                  Awaiting Input
                </span>
              </div>
              <h2 className="mb-4 font-headline-sm text-headline-sm text-primary">
                Intake Protocol Checklist
              </h2>
              <ul className="space-y-2 font-label-md text-label-md text-on-surface">
                {PROTOCOL.map((line, index) => (
                  <li key={line} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined text-[16px] text-outline"
                    >
                      check_box_outline_blank
                    </span>
                    <span>{line}</span>
                    {index === 0 ? (
                      <strong className="text-primary">— the limit for this session</strong>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-surface-container-high p-6">
              <div className="mb-1 flex items-center gap-2 text-primary">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                  support_agent
                </span>
                <span className="font-label-lg text-label-lg font-semibold">
                  Paralegal Desk Dispatch
                </span>
              </div>
              <p className="mb-4 font-body-sm text-body-sm text-on-surface-variant">
                Need urgent assistance with an encrypted redline or sealed court filing that failed
                validation?
              </p>
              <Link
                to="/"
                className="flex items-center justify-between font-label-sm text-label-sm font-semibold text-primary hover:underline"
              >
                Request Manual Document Ingestion
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                  arrow_forward
                </span>
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
