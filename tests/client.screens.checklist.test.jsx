import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChecklistScreen from '../client/src/screens/ChecklistScreen.jsx';
import { useSession, initialState, setClauses } from '../client/src/store/session.jsx';
import { SessionHarness, sampleClause } from './client.utils.jsx';

const deriveJson = (result) => ({
  ok: true,
  status: 200,
  json: async () => result,
});

function stubApi({ derive, exportBody }) {
  globalThis.fetch = vi.fn((url) => {
    if (url === '/api/checklist') {
      return Promise.resolve(deriveJson(derive));
    }
    if (url === '/api/checklist/export') {
      return Promise.resolve({ ok: true, blob: async () => new Blob([exportBody ?? 'file']) });
    }
    return Promise.resolve(deriveJson({}));
  });
  return globalThis.fetch;
}

const clausesWith = () => [sampleClause({ id: 'c1' }), sampleClause({ id: 'c2' })];

function renderChecklist(initial) {
  return render(
    <MemoryRouter initialEntries={['/checklist']}>
      <SessionHarness initial={initial}>
        <ChecklistScreen />
      </SessionHarness>
    </MemoryRouter>
  );
}

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChecklistScreen', () => {
  it('shows an empty state before any analysis', () => {
    renderChecklist(initialState);
    expect(screen.getByRole('heading', { name: 'No checklist yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Analyze a document' })).toHaveAttribute('href', '/');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('derives and renders a checklist with lawyer questions', async () => {
    stubApi({
      derive: {
        checklist: ['Renegotiate indemnity cap', 'Verify renewal notice'],
        lawyerQuestions: ['Ask about penalty fees'],
      },
    });
    renderChecklist({ ...initialState, fileName: 'Lease.pdf', clauses: clausesWith() });
    await waitFor(() => expect(screen.getByText('Renegotiate indemnity cap')).toBeInTheDocument());
    expect(screen.getByText(/Ask about penalty fees/)).toBeInTheDocument();
    expect(screen.getByText(/2 Matters/)).toBeInTheDocument();
    expect(screen.getByText('Pre-formatted').previousElementSibling.textContent).toBe('1');
    expect(screen.getByText(/0 of 2 completed/)).toBeInTheDocument();
  });

  it('toggles checklist items and recomputes readiness', async () => {
    stubApi({
      derive: {
        checklist: ['Item one', 'Item two', 'Item three', 'Item four'],
        lawyerQuestions: [],
      },
    });
    renderChecklist({ ...initialState, fileName: 'Lease.pdf', clauses: clausesWith() });
    await screen.findByText('Item one');
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(4);
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    const percentage = screen.getByText(/50%/);
    expect(percentage).toBeInTheDocument();
    expect(screen.getByText(/2 of 4/)).toBeInTheDocument();
  });

  it('adds custom items and ignores blank input', async () => {
    stubApi({ derive: { checklist: [], lawyerQuestions: [] } });
    renderChecklist({ ...initialState, fileName: 'Lease.pdf', clauses: clausesWith() });
    await waitFor(() =>
      expect(
        screen.getByText('No checklist items were flagged for this document.')
      ).toBeInTheDocument()
    );
    const input = screen.getByPlaceholderText(/Add personal contingency/);
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    fireEvent.change(input, { target: { value: 'Call the landlord' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));
    expect(screen.getByText('Call the landlord')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('shows progress during derivation and an error on failure', async () => {
    let rejectDerive;
    globalThis.fetch = vi.fn(
      () =>
        new Promise((_, reject) => {
          rejectDerive = () => reject(Object.assign(new Error('derive blew up'), { status: 500 }));
        })
    );
    renderChecklist({ ...initialState, fileName: 'Lease.pdf', clauses: clausesWith() });
    await waitFor(() => expect(screen.getByText(/Deriving actionable items/)).toBeInTheDocument());
    await act(async () => rejectDerive());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('derive blew up'));
  });

  it('falls back to a generic derive error message', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue({});
    renderChecklist({ ...initialState, fileName: 'Lease.pdf', clauses: clausesWith() });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to generate the checklist. Please try again.'
      )
    );
  });

  it('skips derivation when a checklist is already in the session', () => {
    renderChecklist({
      ...initialState,
      fileName: 'Lease.pdf',
      clauses: clausesWith(),
      checklist: { checklist: ['Existing item'], lawyerQuestions: ['Existing question'] },
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Existing item')).toBeInTheDocument();
    expect(screen.getByText(/Existing question/)).toBeInTheDocument();
    expect(screen.getByText(/0 of 1/)).toBeInTheDocument();
  });

  it('does not re-derive when clauses change after a failed attempt', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 500 }));
    function Probe() {
      const { dispatch } = useSession();
      return (
        <button
          type="button"
          data-testid="probe"
          onClick={() => dispatch(setClauses([sampleClause({ id: 'c9' })]))}
        >
          probe
        </button>
      );
    }
    render(
      <MemoryRouter initialEntries={['/checklist']}>
        <SessionHarness
          initial={{ ...initialState, fileName: 'Lease.pdf', clauses: clausesWith() }}
        >
          <Probe />
          <ChecklistScreen />
        </SessionHarness>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('x'));
    fireEvent.click(screen.getByTestId('probe'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('x'));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('copies a lawyer question to the clipboard and shows a toast', async () => {
    stubApi({
      derive: { checklist: ['Item'], lawyerQuestions: ['Ask about the penalty clause'] },
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    renderChecklist({ ...initialState, fileName: 'Lease.pdf', clauses: clausesWith() });
    const copyButton = await screen.findByRole('button', { name: /Copy Question/ });
    fireEvent.click(copyButton);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Question copied to clipboard')
    );
    fireEvent.click(copyButton);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Question copied to clipboard')
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Ask about the penalty clause');
  });

  it('exports a checklist PDF and plain text, then clears the toast', async () => {
    stubApi({
      derive: { checklist: ['Item'], lawyerQuestions: [] },
      exportBody: 'checklist content',
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { unmount } = renderChecklist({
      ...initialState,
      fileName: 'Lease.pdf',
      clauses: clausesWith(),
    });
    await screen.findByText('Item');

    fireEvent.click(screen.getByRole('button', { name: /Export Checklist \(PDF\)/ }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Checklist PDF downloaded')
    );
    expect(clickSpy).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Export Plain Text \(\.txt\)/ }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Checklist plain text downloaded')
    );

    expect(JSON.parse(globalThis.fetch.mock.calls[2][1].body)).toEqual({
      checklist: ['Item'],
      lawyerQuestions: [],
      format: 'txt',
    });
    unmount();
  });

  it('defaults lawyer questions to none when the session omits them', async () => {
    stubApi({ derive: { checklist: ['Existing item'] }, exportBody: 'content' });
    renderChecklist({
      ...initialState,
      fileName: 'Lease.pdf',
      clauses: clausesWith(),
      checklist: { checklist: ['Existing item'] },
    });
    await screen.findByText('Existing item');
    fireEvent.click(screen.getByRole('button', { name: /Export Plain Text \(\.txt\)/ }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Checklist plain text downloaded')
    );
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body).toEqual({ checklist: ['Existing item'], lawyerQuestions: [], format: 'txt' });
  });

  it('cancels a pending toast timer when the screen unmounts mid-derivation', async () => {
    globalThis.fetch = vi.fn((url) => {
      if (url === '/api/checklist/export') {
        return Promise.resolve({ ok: true, blob: async () => new Blob(['x']) });
      }
      return new Promise(() => {});
    });
    const { unmount } = renderChecklist({
      ...initialState,
      fileName: 'Lease.pdf',
      clauses: clausesWith(),
    });
    fireEvent.click(screen.getByRole('button', { name: /Export Checklist \(PDF\)/ }));
    await act(async () => {});
    expect(screen.getByRole('status')).toHaveTextContent('Checklist PDF downloaded');
    unmount();
  });

  it('auto-dismisses the toast and clears its timer on unmount', async () => {
    vi.useFakeTimers();
    stubApi({ derive: { checklist: ['Item'], lawyerQuestions: [] }, exportBody: 'x' });
    const { unmount } = renderChecklist({
      ...initialState,
      fileName: 'Lease.pdf',
      clauses: clausesWith(),
    });
    await act(async () => vi.advanceTimersByTime(0));
    expect(screen.getByText('Item')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Export Checklist \(PDF\)/ }));
    await act(async () => {});
    expect(screen.getByRole('status')).toHaveTextContent('Checklist PDF downloaded');
    await act(async () => vi.advanceTimersByTime(2500));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    unmount();
    vi.useRealTimers();
  });

  it('shows a toast message when an export fails', async () => {
    stubApi({
      derive: { checklist: ['Item'], lawyerQuestions: [] },
      exportBody: 'x',
    });
    globalThis.fetch.mockImplementation((url) => {
      if (url === '/api/checklist') {
        return Promise.resolve(deriveJson({ checklist: ['Item'], lawyerQuestions: [] }));
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ message: 'export exploded' }),
      });
    });
    renderChecklist({ ...initialState, fileName: 'Lease.pdf', clauses: clausesWith() });
    await screen.findByText('Item');
    fireEvent.click(screen.getByRole('button', { name: /Export Checklist \(PDF\)/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('export exploded'));
  });

  it('falls back to a generic export failure message', async () => {
    globalThis.fetch = vi.fn((url) => {
      if (url === '/api/checklist') {
        return Promise.resolve(deriveJson({ checklist: ['Item'], lawyerQuestions: [] }));
      }
      return Promise.reject({});
    });
    renderChecklist({ ...initialState, fileName: 'Lease.pdf', clauses: clausesWith() });
    await screen.findByText('Item');
    fireEvent.click(screen.getByRole('button', { name: /Export Checklist \(PDF\)/ }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Export failed. Please try again.')
    );
  });
});
