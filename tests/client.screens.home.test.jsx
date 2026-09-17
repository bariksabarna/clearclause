import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HomeScreen from '../client/src/screens/HomeScreen.jsx';
import { useSession } from '../client/src/store/session.jsx';
import { SessionHarness, renderAt } from './client.utils.jsx';

function renderHome() {
  function Destination() {
    const { state } = useSession();
    return (
      <p data-testid="dest">
        {state.fileName}|{state.payload?.kind}|{String(state.describing)}
      </p>
    );
  }
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionHarness initial={{}}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/analyzing" element={<Destination />} />
        </Routes>
      </SessionHarness>
    </MemoryRouter>
  );
}

describe('HomeScreen', () => {
  it('renders the hero, disclaimer, sample chips, and analysis taxonomy', () => {
    renderAt(<HomeScreen />);
    expect(
      screen.getByRole('heading', { name: 'Understand your contract in plain English.' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /ClearClause provides document summaries and informational explanations only, not legal advice/
      )
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', {
        name: /A job offer letter|A rental lease|A terms of service page/,
      })
    ).toHaveLength(3);
    expect(
      screen.getByRole('heading', { name: 'Precision reading instruments' })
    ).toBeInTheDocument();
    expect(screen.getByText('Plain Equivalents')).toBeInTheDocument();
    expect(screen.getByText(/Max uncompressed size|Ephemeral Sandbox/i)).toBeInTheDocument();
  });

  it('starts a text analysis from a sample and navigates to /analyzing', async () => {
    renderHome();
    const sampleButton = screen.getByText('A rental lease').closest('button');
    fireEvent.click(sampleButton);
    await waitFor(() =>
      expect(screen.getByTestId('dest').textContent).toBe('12-Month Apartment Lease.pdf|text|true')
    );
  });

  it('starts a file analysis from the dropzone and navigates to /analyzing', async () => {
    renderHome();
    const input = await screen.findByTestId('file-input');
    const file = new File(['contract body'], 'offer.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('dest').textContent).toBe('offer.pdf|file|true'));
  });

  it('rejects a file over the upload limit before navigating', async () => {
    renderHome();
    const input = await screen.findByTestId('file-input');
    const tooBig = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(tooBig, 'size', { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [tooBig] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/too large/i));
    expect(screen.queryByTestId('dest')).not.toBeInTheDocument();
  });
});
