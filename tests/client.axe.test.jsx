import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'jest-axe';
import App from '../client/src/App.jsx';
import AnalysisScreen from '../client/src/screens/AnalysisScreen.jsx';
import ChecklistScreen from '../client/src/screens/ChecklistScreen.jsx';
import { initialState } from '../client/src/store/session.jsx';
import { renderAt, sampleClause } from './client.utils.jsx';

const shellState = {
  ...initialState,
  fileName: 'Lease.pdf',
  summary: 'Three key risk areas stand out.',
  clauses: [
    sampleClause({ id: 'c1', severity: 'High', tag: 'Indemnity' }),
    sampleClause({ id: 'c2', severity: 'Medium', tag: 'Termination' }),
  ],
};

describe('axe accessibility (critical violations only)', () => {
  it('finds no critical violations on the routed home shell', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    await screen.findByRole(
      'heading',
      { name: 'Understand your contract in plain English.' },
      {
        timeout: 10_000,
      }
    );
    const results = await axe(container);
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });

  it('finds no critical violations on the analysis screen', async () => {
    renderAt(<AnalysisScreen />, { initial: shellState });
    await screen.findByRole('heading', { name: 'Document Analysis — Lease.pdf' });
    const results = await axe(document.body);
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });

  it('finds no critical violations on the checklist empty state', async () => {
    globalThis.fetch = vi.fn();
    renderAt(<ChecklistScreen />, { initial: initialState });
    await screen.findByRole('heading', { name: 'No checklist yet' });
    const results = await axe(document.body);
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
