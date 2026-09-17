import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SessionProvider,
  useSession,
  sessionReducer,
  initialState,
  beginAnalysis,
  setClauses,
  setDocumentText,
  setInconsistencies,
  setSummary,
  completeAnalysis,
  failAnalysis,
  appendChat,
  setChecklist,
  resetSession,
} from '../client/src/store/session.jsx';
import { SessionHarness } from './client.utils.jsx';

describe('sessionReducer', () => {
  it('starts with an empty initial state', () => {
    expect(initialState).toEqual({
      fileName: null,
      documentText: null,
      summary: null,
      clauses: [],
      inconsistencies: [],
      chatTurns: [],
      checklist: null,
      payload: null,
      describing: false,
      completed: false,
      error: null,
    });
  });

  it('resets to initial state on BEGIN_ANALYSIS while marking describing', () => {
    const state = {
      ...initialState,
      clauses: [{ id: 'old' }],
      completed: true,
      fileName: 'old.pdf',
      payload: { kind: 'file', file: {} },
      documentText: 'old text',
      summary: 'old summary',
      inconsistencies: [{ id: 'old' }],
      chatTurns: [{ role: 'user' }],
      checklist: [{ id: 'old' }],
      describing: false,
      error: 'old error',
    };
    const payload = { kind: 'text', text: 'New text' };
    expect(sessionReducer(state, beginAnalysis('new.pdf', payload))).toEqual({
      ...initialState,
      fileName: 'new.pdf',
      payload,
      describing: true,
    });
  });

  it('sets clauses, documentText, inconsistencies, and summary separately', () => {
    let state = sessionReducer(initialState, setClauses([{ id: 'c1' }]));
    expect(state.clauses).toEqual([{ id: 'c1' }]);

    state = sessionReducer(state, setDocumentText('body text'));
    expect(state.documentText).toBe('body text');

    state = sessionReducer(state, setInconsistencies([{ id: 'i1' }]));
    expect(state.inconsistencies).toEqual([{ id: 'i1' }]);

    state = sessionReducer(state, setSummary('a summary'));
    expect(state.summary).toBe('a summary');
  });

  it('completes analysis and clears error', () => {
    const state = { ...initialState, describing: true, completed: false, error: 'boom' };
    const next = sessionReducer(state, completeAnalysis());
    expect(next).toEqual({ ...state, describing: false, completed: true, error: null });
  });

  it('fails analysis without clearing earlier clauses', () => {
    const state = { ...initialState, describing: true, clauses: [{ id: 'c1' }] };
    const next = sessionReducer(state, failAnalysis('exploded'));
    expect(next).toEqual({ ...state, describing: false, error: 'exploded' });
  });

  it('appends a chat turn', () => {
    const state = { ...initialState, chatTurns: [{ role: 'user', content: 'hi' }] };
    const next = sessionReducer(state, appendChat({ role: 'assistant', content: 'hello' }));
    expect(next.chatTurns).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);
  });

  it('sets the checklist', () => {
    const state = sessionReducer(initialState, setChecklist([{ id: 'k1' }]));
    expect(state.checklist).toEqual([{ id: 'k1' }]);
  });

  it('resets the session to initial state', () => {
    const state = {
      ...initialState,
      clauses: [{ id: 'c1' }],
      completed: true,
      describing: true,
      fileName: 'x.pdf',
      payload: { kind: 'file', file: {} },
    };
    expect(sessionReducer(state, resetSession())).toEqual(initialState);
  });

  it('returns the same state for an unknown action', () => {
    const state = { ...initialState, clauses: [{ id: 'c1' }] };
    expect(sessionReducer(state, { type: 'NOPE' })).toBe(state);
  });
});

describe('action creators', () => {
  it('create the expected actions', () => {
    const payload = { kind: 'text', text: 't' };
    expect(beginAnalysis('f.pdf', payload)).toEqual({
      type: 'BEGIN_ANALYSIS',
      fileName: 'f.pdf',
      payload,
    });
    expect(setClauses([])).toEqual({ type: 'SET_CLAUSES', clauses: [] });
    expect(setDocumentText('x')).toEqual({ type: 'SET_DOCUMENT_TEXT', documentText: 'x' });
    expect(setInconsistencies([])).toEqual({ type: 'SET_INCONSISTENCIES', inconsistencies: [] });
    expect(setSummary('s')).toEqual({ type: 'SET_SUMMARY', summary: 's' });
    expect(completeAnalysis()).toEqual({ type: 'COMPLETE_ANALYSIS' });
    expect(failAnalysis('e')).toEqual({ type: 'FAIL_ANALYSIS', error: 'e' });
    expect(appendChat({ role: 'user' })).toEqual({ type: 'APPEND_CHAT', turn: { role: 'user' } });
    expect(setChecklist([])).toEqual({ type: 'SET_CHECKLIST', checklist: [] });
    expect(resetSession()).toEqual({ type: 'RESET_SESSION' });
  });
});

describe('SessionProvider', () => {
  it('provides state and dispatch through the context', () => {
    function Probe() {
      const { state, dispatch } = useSession();
      return (
        <div>
          <span data-testid="clauses">{state.clauses.length}</span>
          <button type="button" onClick={() => dispatch(setClauses([{ id: 'c1' }]))}>
            add
          </button>
        </div>
      );
    }

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>
    );

    expect(screen.getByTestId('clauses').textContent).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.getByTestId('clauses').textContent).toBe('1');
  });
});

describe('useSession', () => {
  it('throws when used outside a provider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken() {
      useSession();
      return null;
    }
    expect(() => render(<Broken />)).toThrow('useSession must be used within a SessionProvider');
    errorSpy.mockRestore();
  });
});

describe('SessionHarness', () => {
  it('reads state from an initial value and supports dispatch', () => {
    function Probe() {
      const { state, dispatch } = useSession();
      return (
        <div>
          <span data-testid="summary">{state.summary}</span>
          <button type="button" onClick={() => dispatch(setClauses([{ id: 'x' }]))}>
            set
          </button>
        </div>
      );
    }
    render(
      <SessionHarness initial={{ ...initialState, summary: 'hello' }}>
        <Probe />
      </SessionHarness>
    );
    expect(screen.getByTestId('summary').textContent).toBe('hello');
    fireEvent.click(screen.getByRole('button', { name: 'set' }));
  });
});
