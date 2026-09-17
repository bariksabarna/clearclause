import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App, { ScreenFallback } from '../client/src/App.jsx';

function renderApp(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>
  );
}

describe('App', () => {
  it('renders the shell with header, footer, and skip link', async () => {
    renderApp('/');
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content'
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Understand your contract in plain English.' });
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(
      screen.getByText('© 2024 ClearClause Analytical Systems. All rights reserved.')
    ).toBeInTheDocument();
  });

  it('navigates between screens from the header', async () => {
    renderApp('/');
    await screen.findByRole('heading', { name: 'Understand your contract in plain English.' });
    fireEvent.click(screen.getByRole('link', { name: 'Q&A' }));
    await screen.findByRole('heading', { name: 'Nothing to ask about yet' });
    fireEvent.click(screen.getByRole('link', { name: 'Analyze' }));
    await screen.findByRole('heading', { name: 'Understand your contract in plain English.' });
  });

  it('shows the fallback while lazy screens load', async () => {
    renderApp('/compare');
    expect(screen.getByText('Loading ClearClause…')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Draft Comparison — Original vs. Counter-Draft' })
      ).toBeInTheDocument()
    );
  });

  it('renders a not-found page for unknown routes', async () => {
    renderApp('/definitely-not-a-route');
    await screen.findByRole('heading', { name: 'Page not found' });
    expect(screen.getByRole('link', { name: 'Back to upload' })).toHaveAttribute('href', '/');
  });

  it('lazy-mounts every remaining route without the fallback staying behind', async () => {
    for (const route of ['/analyzing', '/analysis', '/checklist', '/issues']) {
      const { unmount } = renderApp(route);
      await waitFor(() =>
        expect(screen.queryByText('Loading ClearClause…')).not.toBeInTheDocument()
      );
      unmount();
    }
  });

  it('can render the fallback directly for reuse', () => {
    render(<ScreenFallback />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading ClearClause…');
  });
});
