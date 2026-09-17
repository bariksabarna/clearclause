import { Link } from 'react-router-dom';
import { useSession, appendChat } from '../store/session.jsx';
import { scrollToClause } from '../lib/scrollTo.js';
import DisclaimerBar from '../components/DisclaimerBar.jsx';
import DocumentPane from '../components/DocumentPane.jsx';
import ChatPanel from '../components/ChatPanel.jsx';

export default function QaScreen() {
  const { state, dispatch } = useSession();
  const { clauses, documentText, chatTurns } = state;

  const sessionText = documentText ?? clauses.map((clause) => clause.sourceText).join('\n\n');

  if (clauses.length === 0) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-primary">
          quick_reference_all
        </span>
        <h1 className="mt-3 font-headline-lg text-headline-lg text-primary">
          Nothing to ask about yet
        </h1>
        <p className="mt-2 font-body-md text-body-md text-secondary">
          Analyze a document first, then ask grounded questions about it.
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

  return (
    <>
      <DisclaimerBar
        message="Grounding Engine — answers use only the text in your uploaded document."
        signal={`Grounded on ${clauses.length} Clauses · Index Strict`}
      />

      <div className="w-full bg-surface-container-low px-4 py-3 sm:px-6">
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
          <h1 className="font-headline-sm text-headline-sm text-primary">
            Document Q&A — {state.fileName ?? 'Document'}
          </h1>
          <span className="w-fit rounded bg-surface-container px-3 py-1 font-label-sm text-label-sm text-on-surface-variant">
            Strict Grounding · Informational only
          </span>
        </div>
      </div>

      <div className="w-full grid grid-cols-1 gap-6 p-4 lg:grid-cols-12 sm:px-6">
        <div className="lg:col-span-7">
          <DocumentPane
            clauses={clauses}
            title="Source Draft"
            subtitle="Clauses indexed for grounded answers"
          />
        </div>
        <div className="lg:col-span-5">
          <ChatPanel
            sessionText={sessionText}
            turns={chatTurns}
            onAppend={(turn) => dispatch(appendChat(turn))}
            onCite={scrollToClause}
          />
        </div>
      </div>
    </>
  );
}
