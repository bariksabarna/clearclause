import { useRef, useState } from 'react';
import { MAX_UPLOAD_BYTES } from '../lib/api.js';

const TOO_LARGE = {
  code: 'UPLOAD_TOO_LARGE',
  message: 'This file is too large. Maximum upload size is 5 MB.',
};

/**
 * Editorial dropzone: drag a file onto the desk or browse manually.
 * Validates size client-side before handing the file to `onFile`.
 */
export default function UploadDropzone({ onFile, busy = false }) {
  const [dragging, setDragging] = useState(false);
  const [clientError, setClientError] = useState(null);
  const inputRef = useRef(null);

  const acceptFile = (file) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setClientError(TOO_LARGE);
      return;
    }
    setClientError(null);
    onFile(file);
  };

  const openPicker = () => {
    inputRef.current?.click();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        aria-label="Upload document file"
        className="hidden"
        data-testid="file-input"
        onChange={(event) => acceptFile(event.target.files?.[0])}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label={clientError ? `Choose a file. ${clientError.message}` : 'Choose a file'}
        onKeyDown={handleKeyDown}
        onClick={openPicker}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex min-h-[380px] w-full cursor-pointer flex-col items-center justify-center bg-surface-container-lowest p-6 text-center shadow-md transition-all ${
          dragging ? 'bg-surface-container-low' : ''
        }`}
      >
        <div className="flex max-w-md flex-col items-center">
          <div className="mb-6 flex h-20 w-16 flex-col items-center justify-between bg-surface-container-low p-2.5 shadow-sm">
            <div className="flex w-full items-center justify-between opacity-40">
              <span className="h-0.5 w-4 bg-primary" />
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[14px] text-primary"
              >
                attach_file
              </span>
            </div>
            <div className="w-full space-y-1 opacity-25">
              <div className="h-0.5 w-full bg-primary" />
              <div className="h-0.5 w-5/6 bg-primary" />
              <div className="h-0.5 w-4/6 bg-primary" />
            </div>
            <span className="bg-surface-container-highest px-1 font-label-sm text-[9px] font-semibold uppercase tracking-tighter text-primary">
              DOC
            </span>
          </div>
          <p className="mb-1 font-headline-sm text-headline-sm font-medium text-primary">
            Slide paper document onto desk
          </p>
          <p className="mb-6 font-body-sm text-body-sm text-secondary">
            Drag and drop your file directly here, or browse files manually
          </p>
          <span className="flex items-center gap-2 bg-primary px-6 py-2.5 font-label-lg text-label-lg font-semibold text-on-primary shadow-sm transition-colors">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              upload_file
            </span>
            Select document
          </span>
        </div>
        <div className="pointer-events-none mt-6 flex flex-wrap items-center justify-center gap-2 pt-4 font-label-sm text-label-sm text-secondary">
          <span className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[15px] text-tertiary"
            >
              lock
            </span>
            Zero Cloud Retention
          </span>
          <span className="text-outline-variant">•</span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="material-symbols-outlined text-[15px]">
              straighten
            </span>
            Up to 5 MB
          </span>
          <span className="text-outline-variant">•</span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="material-symbols-outlined text-[15px]">
              spellcheck
            </span>
            High-Fidelity OCR
          </span>
        </div>
      </div>
      {clientError ? (
        <p
          role="alert"
          className="mt-3 flex items-center gap-2 bg-error-container px-4 py-2 font-label-md text-label-md text-on-error-container"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
            warning
          </span>
          {clientError.message}
        </p>
      ) : null}
      {busy ? (
        <p className="mt-3 font-label-md text-label-md text-secondary">Preparing document…</p>
      ) : null}
    </div>
  );
}
