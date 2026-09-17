import { describe, expect, it, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import AnalysisScreen from '../client/src/screens/AnalysisScreen.jsx';
import QaScreen from '../client/src/screens/QaScreen.jsx';
import { initialState } from '../client/src/store/session.jsx';
import { renderAt, sampleClause } from './client.utils.jsx';

const stateWithClauses = (clauses, extra = {}) => ({
  ...initialState,
  fileName: 'Lease.pdf',
  summary: 'Three key risk areas stand out.',
  clauses,
  ...extra,
});

const high = sampleClause({ id: 'c1', severity: 'High' });
const medium = sampleClause({ id: 'c2', tag: 'Waiver', severity: 'Medium' });
const low = sampleClause({
  id: 'c3',
  tag: 'Governing Law',
  severity: 'Low',
  sourceText: 'Governing law text',
});
const odd = sampleClause({ id: 'c4', tag: 'Miscellaneous', severity: 'Bizarre' });

describe('AnalysisScreen', () => {
  it('shows an empty state when there are no clauses', () => {
    renderAt(<AnalysisScreen />, { initial: initialState });
    expect(screen.getByRole('heading', { name: 'No analysis yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Analyze a document' })).toHaveAttribute('href', '/');
  });

  it('renders counts, filters, and margins for all severities', () => {
    renderAt(<AnalysisScreen />, {
      initial: stateWithClauses([high, medium, low, odd]),
    });
    expect(
      screen.getByRole('heading', { name: 'Document Analysis — Lease.pdf' })
    ).toBeInTheDocument();
    expect(screen.getByText('Three key risk areas stand out.')).toBeInTheDocument();
    expect(screen.getByText('Clauses Analyzed').nextElementSibling.textContent).toBe('4');
    expect(screen.getAllByText('High risk').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Medium risk').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Low risk').length).toBeGreaterThan(0);

    expect(screen.getByText('4 Active Flags')).toBeInTheDocument();
    const allCards = () => document.querySelectorAll('[data-risk]');
    expect(allCards()).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: /^High \(1\)$/ }));
    expect(allCards()).toHaveLength(1);
    expect(allCards()[0]).toHaveAttribute('data-risk', 'high');

    fireEvent.click(screen.getByRole('button', { name: /^Medium \(1\)$/ }));
    expect(allCards()).toHaveLength(1);
    expect(screen.getByText('1 Active Flags')).toBeInTheDocument();
    expect(allCards()[0]).toHaveAttribute('data-risk', 'medium');

    fireEvent.click(screen.getByRole('button', { name: /^Low \(1\)$/ }));
    expect(allCards()[0]).toHaveAttribute('data-risk', 'low');
  });

  it('jumps to the highest-risk clause and prints the markup', () => {
    const scrollIntoViewSpy = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => {});
    window.print = vi.fn();
    renderAt(<AnalysisScreen />, {
      initial: stateWithClauses([low, medium, high]),
    });
    fireEvent.click(screen.getByRole('button', { name: /Jump to Highest Risk/ }));
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    fireEvent.click(screen.getByRole('button', { name: /Export Markup/ }));
    expect(window.print).toHaveBeenCalled();
    scrollIntoViewSpy.mockRestore();
  });

  it('does not scroll when no high-risk clause exists', () => {
    const scrollIntoViewSpy = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => {});
    renderAt(<AnalysisScreen />, {
      initial: stateWithClauses([low, medium]),
    });
    fireEvent.click(screen.getByRole('button', { name: /Jump to Highest Risk/ }));
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    scrollIntoViewSpy.mockRestore();
  });

  it('pins to a specific clause from a margin card', () => {
    const scrollIntoViewSpy = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => {});
    renderAt(<AnalysisScreen />, {
      initial: stateWithClauses([medium]),
    });
    fireEvent.click(screen.getByRole('button', { name: /Pin to Clause 2/ }));
    expect(scrollIntoViewSpy).toHaveBeenCalled();
    scrollIntoViewSpy.mockRestore();
  });

  it('falls back to Untitled document and a pending summary message', () => {
    renderAt(<AnalysisScreen />, {
      initial: stateWithClauses([medium], { fileName: null, summary: null }),
    });
    expect(
      screen.getByRole('heading', { name: 'Document Analysis — Untitled' })
    ).toBeInTheDocument();
    expect(screen.getByText('Plain-language summary pending.')).toBeInTheDocument();
  });
});

describe('QaScreen', () => {
  it('shows an empty state when there are no clauses', () => {
    renderAt(<QaScreen />, { initial: initialState });
    expect(screen.getByRole('heading', { name: 'Nothing to ask about yet' })).toBeInTheDocument();
  });

  it('falls back to a generic heading when the file name is unknown', () => {
    renderAt(<QaScreen />, {
      initial: stateWithClauses([sampleClause({ id: 'c1' })], { fileName: undefined }),
    });
    expect(screen.getByRole('heading', { name: 'Document Q&A — Document' })).toBeInTheDocument();
  });

  it('grounds a chat turn on the session text and appends it', async () => {
    const clauses = [sampleClause({ id: 'c1' })];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ answer: 'You own that liability.', citedClauseIds: ['c1'] }),
    });
    renderAt(<QaScreen />, {
      initial: stateWithClauses(clauses, { documentText: 'Full session text.' }),
    });
    expect(screen.getByRole('heading', { name: 'Document Q&A — Lease.pdf' })).toBeInTheDocument();
    expect(screen.getByText(/Grounded on 1 Clauses/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), {
      target: { value: 'Who is liable?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ask/ }));
    await waitFor(() => expect(screen.getByText('User Query')).toBeInTheDocument());
    expect(screen.getByText('You own that liability.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\[Citation: Clause 1\]/ })).toBeInTheDocument();
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body).toEqual({ sessionText: 'Full session text.', question: 'Who is liable?' });
  });

  it('falls back to joining clause source text when documentText is absent', async () => {
    const clauses = [
      sampleClause({ id: 'c1', sourceText: 'First clause body' }),
      sampleClause({ id: 'c2', sourceText: 'Second clause body' }),
    ];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ answer: 'x', citedClauseIds: [] }),
    });
    renderAt(<QaScreen />, {
      initial: stateWithClauses(clauses, { documentText: null }),
    });
    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), {
      target: { value: 'One more?' },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Ask anything/).closest('form'));
    await waitFor(() => {
      const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(body.sessionText).toBe('First clause body\n\nSecond clause body');
    });
  });
});
