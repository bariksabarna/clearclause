import { useState } from 'react';
import { chatDocument } from '../lib/api.js';

const SUGGESTIONS = [
  'What does this document make me responsible for?',
  'Which clause could hurt me the most?',
  'Can I exit this agreement early?',
];

/**
 * Grounded Q&A panel. Sends the full session text plus the question to
 * /api/chat, then surfaces the answer with citation chips that jump to their
 * clause in the document pane.
 */
export default function ChatPanel({ sessionText, turns, onAppend, onCite }) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const ask = async (questionText) => {
    const trimmed = questionText.trim();
    if (!trimmed || busy) return;
    setErrorMessage(null);
    setBusy(true);
    try {
      const result = await chatDocument(sessionText, trimmed);
      onAppend({ question: trimmed, answer: result.answer, citedClauseIds: result.citedClauseIds });
      setQuestion('');
    } catch (error) {
      setErrorMessage(error.message || 'The assistant is unavailable right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    ask(question);
  };

  const applySuggestion = (suggestion) => setQuestion(suggestion);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-container-lowest shadow-md">
      <div className="bg-primary-container p-4 text-on-primary">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[20px] text-tertiary-fixed"
            >
              smart_toy
            </span>
            <span className="font-label-lg text-label-lg font-bold tracking-tight">
              ClearClause Assistant
            </span>
          </div>
          <span className="rounded bg-surface-container/20 px-2 py-0.5 font-label-sm text-label-sm uppercase text-surface-bright">
            Strict Grounding
          </span>
        </div>
        <p className="font-label-sm text-label-sm text-surface-variant">
          Answers use only the text in your uploaded document. Informational only.
        </p>
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="max-h-[520px] flex-1 space-y-6 overflow-y-auto p-4"
      >
        {turns.length === 0 ? (
          <p className="font-body-sm text-body-sm text-secondary">
            Ask a question about your document and the assistant will answer with exact clause
            citations.
          </p>
        ) : null}
        {turns.map((turn, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-end">
              <div className="max-w-[85%] bg-surface-container-high p-3 text-on-surface shadow-sm">
                <span className="mb-1 block font-label-sm text-label-sm font-semibold uppercase text-secondary">
                  User Query
                </span>
                <p className="font-label-md text-label-md leading-normal">{turn.question}</p>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[92%] space-y-2 bg-surface-container-low p-4 text-on-surface shadow-sm">
                <span className="font-label-sm text-label-sm font-bold uppercase tracking-wide text-primary">
                  Synthesized Grounded Answer
                </span>
                <p className="text-body-md text-body-md leading-relaxed">{turn.answer}</p>
                {turn.citedClauseIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {turn.citedClauseIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onCite(id)}
                        className="inline-flex items-center gap-1 bg-surface-container-lowest px-2 py-1 text-left font-label-md text-label-md font-semibold text-primary shadow-sm transition-colors hover:bg-surface-container-highest"
                      >
                        <span
                          aria-hidden="true"
                          className="material-symbols-outlined text-[16px] text-secondary"
                        >
                          bookmark
                        </span>
                        [Citation: Clause {id.replace(/^c/, '')}]
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {busy ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 bg-surface-container-low p-4 font-label-md text-label-md text-secondary shadow-sm">
              <span
                aria-hidden="true"
                className="material-symbols-outlined animate-spin text-[18px]"
                style={{ animationDuration: '1.6s' }}
              >
                sync
              </span>
              Reviewing the document…
            </div>
          </div>
        ) : null}
        {errorMessage ? (
          <p
            role="alert"
            className="bg-error-container px-4 py-3 font-label-md text-label-md text-on-error-container"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className="bg-surface-container-low px-4 py-3">
        <span className="mb-2 flex items-center gap-1 font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
            psychology
          </span>
          Suggested Document Inquiries
        </span>
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => applySuggestion(suggestion)}
              className="flex items-center gap-1 bg-surface-container-lowest px-3 py-1 text-left font-label-sm text-label-sm text-on-surface shadow-sm transition-colors hover:bg-surface-container-high"
            >
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[13px] text-secondary"
              >
                help_outline
              </span>
              “{suggestion}”
            </button>
          ))}
        </div>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
          <label className="flex-1">
            <span className="sr-only">Ask a question</span>
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask anything about this document..."
              className="w-full bg-surface-container-lowest px-4 py-2.5 font-label-lg text-label-lg text-on-surface shadow-sm placeholder:text-outline focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center justify-center gap-2 bg-primary px-6 py-2.5 font-label-lg text-label-lg font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-60"
          >
            <span>Ask</span>
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              send
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
