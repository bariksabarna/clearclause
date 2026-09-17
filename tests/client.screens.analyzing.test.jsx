import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useSession, initialState, beginAnalysis } from '../client/src/store/session.jsx';
import AnalyzingScreen from '../client/src/screens/AnalyzingScreen.jsx';
import { SessionHarness, installSseFetcher, sseEvent } from './client.utils.jsx';

const emptyReader = {
  getReader: () => ({
    read: async () => ({ done: true, value: undefined }),
    releaseLock: () => {},
  }),
};

function Readout() {
  const { state } = useSession();
  return (
    <p data-testid="readout">
      {JSON.stringify({
        clauses: state.clauses.length,
        inconsistencies: state.inconsistencies.length,
        summary: state.summary,
        completed: state.completed,
        describing: state.describing,
        error: state.error,
        fileName: state.fileName,
      })}
    </p>
  );
}

function renderAnalyzing(initial, { withProbe = true } = {}) {
  function Probe() {
    const { dispatch } = useSession();
    return (
      <button
        type="button"
        data-testid="probe"
        onClick={() =>
          dispatch(beginAnalysis('probe.pdf', { kind: 'file', file: new File(['x'], 'p.pdf') }))
        }
      >
        probe
      </button>
    );
  }
  return render(
    <MemoryRouter initialEntries={['/analyzing']}>
      <SessionHarness initial={initial}>
        {withProbe ? <Probe /> : null}
        <Readout />
        <Routes>
          <Route path="/analyzing" element={<AnalyzingScreen />} />
          <Route path="/analysis" element={<p data-testid="analysis-dest">ANALYSIS</p>} />
          <Route path="/" element={<p data-testid="home-dest">HOME</p>} />
        </Routes>
      </SessionHarness>
    </MemoryRouter>
  );
}

const textState = (overrides = {}) => ({
  ...initialState,
  describing: true,
  fileName: 'Lease.pdf',
  payload: { kind: 'text', text: 'lease body' },
  ...overrides,
});

const clause = (id, sourceText) => ({
  id,
  tag: `Clause ${id}`,
  severity: 'High',
  sourceText,
  explanation: 'x',
  severityReason: 'y',
});

describe('AnalyzingScreen', () => {
  it('skips the pipeline when describing is false', () => {
    globalThis.fetch = vi.fn();
    renderAnalyzing(textState({ describing: false }));
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Analyzing Lease.pdf' })).toBeInTheDocument();
  });

  it('resolves a text payload through the JSON endpoint and streams events to completion', async () => {
    const clauses = [clause('c1', 'Alpha beta gamma'), clause('c2', 'Delta epsilon zeta eta')];
    installSseFetcher([
      ['status', { stage: 'analyzing' }],
      ['clauses', { clauses }],
      ['inconsistencies', { inconsistencies: [{ id: 'i1' }] }],
      ['summary', { summary: 'A plain summary' }],
      ['done', null],
    ]);
    renderAnalyzing(textState());
    await waitFor(() => expect(screen.getByTestId('analysis-dest')).toBeInTheDocument());
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'lease body' }),
    });
    const readout = screen.getByTestId('readout').textContent;
    expect(readout).toContain('"clauses":2');
    expect(readout).toContain('"inconsistencies":1');
    expect(readout).toContain('"summary":"A plain summary"');
    expect(readout).toContain('"completed":true');
    expect(readout).toContain('"describing":false');
  });

  it('advances phases, progress, and token counts from status and clause events', async () => {
    installSseFetcher([
      ['status', { stage: 'analyzing' }],
      ['clauses', { clauses: [clause('c1', 'Alpha beta gamma')] }],
      ['status', { stage: 'chunking' }],
    ]);
    renderAnalyzing(textState());
    await waitFor(() => expect(screen.getByText('Phase 2 of 4')).toBeInTheDocument());
    expect(screen.getByText(/ENGINE PASS: 2\/04/)).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText(/TOKENS PARSED/)).toHaveTextContent('3');
  });

  it('runs an unknown stage through the fallback progress and phase defaults', async () => {
    installSseFetcher([['status', { stage: 'weird' }]]);
    renderAnalyzing(textState());
    await waitFor(() => expect(screen.getByText('12%')).toBeInTheDocument());
    expect(screen.getByText('Phase 1 of 4')).toBeInTheDocument();
  });

  it('handles the done status phase without navigating', async () => {
    installSseFetcher([['status', { stage: 'done' }]]);
    renderAnalyzing(textState());
    await waitFor(() => expect(screen.getByText('100%')).toBeInTheDocument());
    expect(screen.getByText('Phase 4 of 4')).toBeInTheDocument();
    expect(screen.getByText(/ENGINE PASS: 4\/04/)).toBeInTheDocument();
    expect(screen.queryByTestId('analysis-dest')).not.toBeInTheDocument();
  });

  it('shows a live clause stream once clauses arrive', async () => {
    installSseFetcher([['clauses', { clauses: [clause('c9', 'Most recent clause')] }]]);
    renderAnalyzing(textState());
    await waitFor(() => expect(screen.getByText('Most recent clause')).toBeInTheDocument());
    expect(screen.getByText(/1 ANNOTATIONS QUEUED/)).toBeInTheDocument();
    expect(screen.queryByText(/Initializing optical text extraction/)).not.toBeInTheDocument();
  });

  it('posts a multipart form for file payloads', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: emptyReader });
    renderAnalyzing(
      textState({
        payload: { kind: 'file', file: new File(['pdf'], 'doc.pdf', { type: 'application/pdf' }) },
      })
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    const [, init] = globalThis.fetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('falls back to an empty text payload when no payload is recorded', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: emptyReader });
    renderAnalyzing(textState({ payload: null, fileName: null }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    const [, init] = globalThis.fetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ text: '' });
    expect(screen.getByRole('heading', { name: 'Analyzing document' })).toBeInTheDocument();
  });

  it('defends against malformed clauses, statuses, summaries, and inconsistency payloads', async () => {
    installSseFetcher([
      ['status', null],
      ['status', { stage: 5 }],
      ['clauses', { clauses: 'oops' }],
      ['inconsistencies', { inconsistencies: 'nope' }],
      ['clauses', { clauses: [clause('c11', null), clause('c12', 'Word')] }],
      ['summary', { summary: 5 }],
    ]);
    renderAnalyzing(textState());
    await waitFor(() => expect(screen.getByText('Word')).toBeInTheDocument());
    expect(screen.getByText(/TOKENS PARSED/)).toHaveTextContent('1');
    const readout = screen.getByTestId('readout').textContent;
    expect(readout).toContain('"clauses":2');
    expect(readout).toContain('"inconsistencies":0');
    expect(readout).toContain('"summary":null');
  });

  it('aborts inspection and ignores late stream events', async () => {
    let resolveFetch;
    globalThis.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    renderAnalyzing(textState());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Abort Inspection' }));
    expect(screen.getByTestId('home-dest')).toBeInTheDocument();
    await waitFor(async () => {
      resolveFetch({
        ok: true,
        body: {
          getReader: () => {
            let n = 0;
            return {
              read: async () => {
                n += 1;
                if (n === 1)
                  return {
                    done: false,
                    value: new TextEncoder().encode(sseEvent('status', { stage: 'analyzing' })),
                  };
                if (n === 2)
                  return { done: false, value: new TextEncoder().encode(sseEvent('done', null)) };
                return { done: true, value: undefined };
              },
              releaseLock: () => {},
            };
          },
        },
      });
    });
    await waitFor(() => expect(screen.getByTestId('home-dest')).toBeInTheDocument());
    expect(screen.queryByTestId('analysis-dest')).not.toBeInTheDocument();
  });

  it('does not restart the stream when a probe re-dispatches a begin step', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: emptyReader });
    renderAnalyzing(textState());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('probe'));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
  });

  it('renders intake guidance for intake-class failures', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('Your file is too large.'), { code: 'UPLOAD_TOO_LARGE' })
      );
    renderAnalyzing(textState());
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'See guidance' })).toBeInTheDocument()
    );
    expect(screen.getByRole('link', { name: 'See guidance' })).toHaveAttribute(
      'href',
      '/issues?code=UPLOAD_TOO_LARGE'
    );
  });

  it('renders a try-again screen for generic API failures', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('Analyzer is overloaded.'), { code: 'RATE_LIMITED' })
      );
    renderAnalyzing(textState());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Analyzer is overloaded.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByTestId('home-dest')).toBeInTheDocument());
  });

  it('ignores a stream failure after the screen has unmounted', async () => {
    let rejectStream;
    globalThis.fetch = vi.fn(
      () =>
        new Promise((_, reject) => {
          rejectStream = () =>
            reject(Object.assign(new Error('late failure'), { code: 'AI_UNREACHABLE' }));
        })
    );
    function ToggleProbe() {
      const { dispatch } = useSession();
      return (
        <button
          type="button"
          data-testid="probe"
          onClick={() =>
            dispatch(beginAnalysis('probe.pdf', { kind: 'file', file: new File(['x'], 'p.pdf') }))
          }
        >
          probe
        </button>
      );
    }
    function Harness() {
      const [show, setShow] = useState(true);
      return (
        <MemoryRouter initialEntries={['/analyzing']}>
          <SessionHarness initial={textState()}>
            {show ? <ToggleProbe /> : null}
            <button type="button" data-testid="hide" onClick={() => setShow(false)}>
              hide
            </button>
            <Readout />
            <Routes>
              <Route path="/analyzing" element={show ? <AnalyzingScreen /> : null} />
              <Route path="/analysis" element={<p data-testid="analysis-dest">ANALYSIS</p>} />
              <Route path="/" element={<p data-testid="home-dest">HOME</p>} />
            </Routes>
          </SessionHarness>
        </MemoryRouter>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByTestId('probe'));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('hide'));
    expect(screen.queryByTestId('probe')).not.toBeInTheDocument();
    await act(async () => rejectStream());
    expect(screen.getByTestId('readout')).not.toHaveTextContent('AI_UNREACHABLE');
  });

  it('falls back to default codes and messages when the error object is bare', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('boom'));
    renderAnalyzing(textState());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'));
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('uses a generic failure message when the rejection has no message', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue({});
    renderAnalyzing(textState());
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The analysis service encountered an error. Please try again.'
      )
    );
  });

  it('surfaces SSE error events with their message', async () => {
    installSseFetcher([['error', { message: 'service hiccup' }]]);
    renderAnalyzing(textState());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('service hiccup'));
    expect(screen.getByText(/We could not finish analyzing this document/)).toBeInTheDocument();
  });

  it('uses a generic message for SSE errors without a usable message', async () => {
    installSseFetcher([
      ['error', { message: 7 }],
      ['error', null],
    ]);
    renderAnalyzing(textState());
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Analysis interrupted.')
    );
  });
});
