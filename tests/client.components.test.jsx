import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MAX_UPLOAD_BYTES } from '../client/src/lib/api.js';
import Logo from '../client/src/components/Logo.jsx';
import SkipLink from '../client/src/components/SkipLink.jsx';
import AppFooter from '../client/src/components/AppFooter.jsx';
import AppHeader from '../client/src/components/AppHeader.jsx';
import DisclaimerBar from '../client/src/components/DisclaimerBar.jsx';
import ClauseBadge from '../client/src/components/ClauseBadge.jsx';
import UploadDropzone from '../client/src/components/UploadDropzone.jsx';
import DocumentPane from '../client/src/components/DocumentPane.jsx';
import ChatPanel from '../client/src/components/ChatPanel.jsx';
import { sampleClause } from './client.utils.jsx';

const wrap = (ui, initialEntry = '/') =>
  render(<MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>);

describe('Logo', () => {
  it('renders the ClearClause wordmark', () => {
    const { container } = render(<Logo className="h-6" />);
    expect(container.querySelector('svg')).toHaveAttribute('role', 'img');
    expect(container.querySelector('svg')).toHaveAccessibleName('ClearClause');
  });

  it('renders without a className', () => {
    const { container } = render(<Logo />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('SkipLink', () => {
  it('links to the main content region', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveAttribute('href', '#main-content');
  });
});

describe('AppFooter', () => {
  it('renders the copyright and legal links', () => {
    wrap(<AppFooter />);
    expect(
      screen.getByText(/© \d{4} ClearClause Analytical Systems\. All rights reserved\./)
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('navigation', { name: 'Site links' })).toBeInTheDocument();
  });

  it('links to real destinations instead of dead anchors', () => {
    wrap(<AppFooter />);
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/issues',
      '/issues',
      '/samples/12-Month-Apartment-Lease.pdf',
    ]);
    expect(screen.getByRole('link', { name: 'Download Sample Lease' })).toHaveAttribute(
      'download',
      ''
    );
  });
});

describe('AppHeader', () => {
  it('marks the current route link as active', () => {
    wrap(<AppHeader />, '/qa');
    const qa = screen.getByRole('link', { name: 'Q&A' });
    const analyze = screen.getByRole('link', { name: 'Analyze' });
    expect(qa.className).toContain('bg-primary');
    expect(analyze.className).not.toContain('bg-primary');
  });

  it('marks the home link active on the root path', () => {
    wrap(<AppHeader />, '/');
    expect(screen.getByRole('link', { name: 'Analyze' }).className).toContain('bg-primary');
    expect(screen.getByRole('link', { name: 'ClearClause home' })).toBeInTheDocument();
  });
});

describe('DisclaimerBar', () => {
  it('renders a message and an optional signal', () => {
    render(<DisclaimerBar message="Read this" signal="Live now" />);
    expect(screen.getByText(/Read this/)).toBeInTheDocument();
    expect(screen.getByText(/Live now/)).toBeInTheDocument();
  });

  it('omits the signal when not provided', () => {
    render(<DisclaimerBar message="Read this" />);
    expect(screen.getByText(/Read this/)).toBeInTheDocument();
    expect(screen.queryByText(/Live now/)).not.toBeInTheDocument();
  });
});

describe('ClauseBadge', () => {
  it('renders High, Medium, and Low risk chips', () => {
    render(
      <>
        <ClauseBadge severity="High" />
        <ClauseBadge severity="Medium" />
        <ClauseBadge severity="Low" />
      </>
    );
    expect(screen.getByText('High risk')).toBeInTheDocument();
    expect(screen.getByText('Medium risk')).toBeInTheDocument();
    expect(screen.getByText('Low risk')).toBeInTheDocument();
  });

  it('falls back to Medium for unknown severities', () => {
    render(<ClauseBadge severity="Catastrophic" />);
    expect(screen.getByText('Medium risk')).toBeInTheDocument();
  });
});

describe('UploadDropzone', () => {
  const bigFile = new File(['x'], 'big.pdf', { type: 'application/pdf' });
  Object.defineProperty(bigFile, 'size', { value: MAX_UPLOAD_BYTES + 1 });

  it('accepts a dropped file', () => {
    const onFile = vi.fn();
    render(<UploadDropzone onFile={onFile} />);
    const dropzone = screen.getByRole('button', { name: 'Choose a file' });
    const file = new File(['hello'], 'lease.pdf', { type: 'application/pdf' });
    fireEvent.dragOver(dropzone);
    expect(dropzone.className).toContain('bg-surface-container-low');
    fireEvent.dragLeave(dropzone);
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('ignores a drop without a file', () => {
    const onFile = vi.fn();
    render(<UploadDropzone onFile={onFile} />);
    const dropzone = screen.getByRole('button', { name: 'Choose a file' });
    fireEvent.drop(dropzone, { dataTransfer: { files: [] } });
    expect(onFile).not.toHaveBeenCalled();
  });

  it('accepts a file chosen via the file input and clears a previous size error', () => {
    const onFile = vi.fn();
    render(<UploadDropzone onFile={onFile} />);
    const input = screen.getByTestId('file-input');

    fireEvent.change(input, { target: { files: [bigFile] } });
    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('This file is too large');

    const okFile = new File(['ok'], 'small.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [okFile] } });
    expect(onFile).toHaveBeenCalledWith(okFile);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores an empty file selection', () => {
    const onFile = vi.fn();
    render(<UploadDropzone onFile={onFile} />);
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: {} });
    expect(onFile).not.toHaveBeenCalled();
  });

  it('opens the picker on click and via keyboard', () => {
    const onFile = vi.fn();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    render(<UploadDropzone onFile={onFile} />);
    const dropzone = screen.getByRole('button', { name: 'Choose a file' });

    fireEvent.click(dropzone);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(dropzone, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(dropzone, { key: ' ' });
    expect(clickSpy).toHaveBeenCalledTimes(3);

    fireEvent.keyDown(dropzone, { key: 'x' });
    expect(clickSpy).toHaveBeenCalledTimes(3);
    clickSpy.mockRestore();
  });

  it('announces a file-size error and shows the busy hint', () => {
    const onFile = vi.fn();
    const { rerender } = render(<UploadDropzone onFile={onFile} busy />);
    expect(screen.getByText(/Preparing document/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a file' })).toBeInTheDocument();
    rerender(<UploadDropzone onFile={onFile} busy={false} />);
    expect(screen.queryByText(/Preparing document/)).not.toBeInTheDocument();
  });
});

describe('DocumentPane', () => {
  it('shows an empty hint when there are no clauses', () => {
    render(<DocumentPane clauses={[]} />);
    expect(screen.getByText(/No clauses to display yet/)).toBeInTheDocument();
    render(<DocumentPane clauses={null} title="ignored" />);
    expect(screen.getAllByText(/No clauses to display yet/)).toHaveLength(2);
  });

  it('renders clauses without a header when title and subtitle are missing', () => {
    const clauses = [sampleClause({ id: 'c1', severity: 'High' })];
    render(<DocumentPane clauses={clauses} />);
    expect(screen.getByText('Non-Compete')).toBeInTheDocument();
    expect(screen.getByText('High risk')).toBeInTheDocument();
    expect(screen.queryByText('All analysis')).not.toBeInTheDocument();
  });

  it('shows a subtitle on its own without a title header', () => {
    const clauses = [sampleClause({ id: 'c1' })];
    render(<DocumentPane clauses={clauses} subtitle="Revised draft" />);
    expect(screen.getByText('Revised draft')).toBeInTheDocument();
    expect(document.querySelector('.font-headline-md')).not.toBeInTheDocument();
  });

  it('renders a title and subtitle plus every severity pane, defaulting unknown severities', () => {
    const clauses = [
      sampleClause({ id: 'c1', severity: 'High' }),
      sampleClause({ id: 'c2', severity: 'Medium' }),
      sampleClause({ id: 'c3', severity: 'Low' }),
      sampleClause({ id: 'c4', severity: 'Weird' }),
    ];
    const { container } = render(
      <DocumentPane clauses={clauses} title="Document A" subtitle="Rev 2" />
    );
    expect(screen.getByText('Document A')).toBeInTheDocument();
    expect(screen.getByText('Rev 2')).toBeInTheDocument();
    expect(screen.getByText('Low risk')).toBeInTheDocument();
    expect(container.querySelector('#clause-c1')).toHaveClass('bg-risk-high/5');
    expect(container.querySelector('#clause-c2')).toHaveClass('bg-risk-medium/5');
    expect(container.querySelector('#clause-c3')).toHaveClass('border-l-2');
  });
});

describe('ChatPanel', () => {
  function Harness({ initialTurns = [], onCite = vi.fn() }) {
    const [turns, setTurns] = useState(initialTurns);
    return (
      <ChatPanel
        sessionText="Lease text"
        turns={turns}
        onAppend={(turn) => setTurns((current) => [...current, turn])}
        onCite={onCite}
      />
    );
  }

  function stubFetch(body) {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    });
  }

  it('shows an intro prompt when there are no turns', () => {
    stubFetch({});
    render(<Harness />);
    expect(screen.getByText(/Ask a question about your document/)).toBeInTheDocument();
  });

  it('asks a question, appends the turn, clears the input, and restores the button', async () => {
    stubFetch({ answer: 'You own that.', citedClauseIds: ['c12'] });
    render(<Harness onCite={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), {
      target: { value: 'What does this enforce?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ask/ }));
    await waitFor(() => expect(screen.getByText('User Query')).toBeInTheDocument());
    expect(screen.getByText(/You own that/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\[Citation: Clause 12\]/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask anything/)).toHaveValue('');
  });

  it('supports suggestion chips and cites by clicking a citation chip', async () => {
    stubFetch({ answer: 'A.', citedClauseIds: ['c7'] });
    const onCite = vi.fn();
    render(<Harness onCite={onCite} />);
    fireEvent.click(
      screen.getByRole('button', { name: /What does this document make me responsible for\?/ })
    );
    expect(screen.getByPlaceholderText(/Ask anything/)).toHaveValue(
      'What does this document make me responsible for?'
    );
    fireEvent.click(screen.getByRole('button', { name: /Ask/ }));
    const cite = await screen.findByRole('button', { name: /\[Citation: Clause 7\]/ });
    fireEvent.click(cite);
    expect(onCite).toHaveBeenCalledWith('c7');
  });

  it('submits the form with Enter and shows an optional empty answer without citations', async () => {
    stubFetch({ answer: '', citedClauseIds: [] });
    render(<Harness />);
    const input = screen.getByPlaceholderText(/Ask anything/);
    fireEvent.change(input, { target: { value: 'Anything new?' } });
    fireEvent.submit(input.closest('form'));
    await waitFor(() =>
      expect(screen.getByText(/Synthesized Grounded Answer/)).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: /\[Citation:/ })).not.toBeInTheDocument();
  });

  it('does not submit blank questions', () => {
    stubFetch({});
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), { target: { value: '   ' } });
    fireEvent.submit(screen.getByPlaceholderText(/Ask anything/).closest('form'));
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('shows a busy state and ignores requests while one is pending', async () => {
    let resolveFetch;
    globalThis.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ answer: 'done', citedClauseIds: [] }),
            });
        })
    );
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), { target: { value: 'Busy?' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask/ }));
    expect(screen.getByText(/Reviewing the document/)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Ask/ });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), { target: { value: 'Second' } });
    fireEvent.click(button);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    await act(async () => resolveFetch());
    await waitFor(() =>
      expect(screen.queryByText(/Reviewing the document/)).not.toBeInTheDocument()
    );
  });

  it('surfaces a message from a rejected request', async () => {
    globalThis.fetch.mockRejectedValue(Object.assign(new Error('Rate limited'), { status: 429 }));
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), { target: { value: 'Why?' } });
    fireEvent.submit(screen.getByPlaceholderText(/Ask anything/).closest('form'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Rate limited'));
  });

  it('falls back to a generic message when the rejection carries no message', async () => {
    globalThis.fetch.mockRejectedValue({});
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), { target: { value: 'Why?' } });
    fireEvent.submit(screen.getByPlaceholderText(/Ask anything/).closest('form'));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'The assistant is unavailable right now'
      )
    );
  });

  it('renders prior conversation turns and omits the intro once turns exist', () => {
    stubFetch({});
    const initialTurns = [
      { question: 'Old q', answer: 'Old a', citedClauseIds: ['c1'] },
      { question: 'A second q', answer: 'Another a', citedClauseIds: [] },
    ];
    render(<Harness initialTurns={initialTurns} />);
    expect(screen.getByText('Old q')).toBeInTheDocument();
    expect(screen.getByText('Old a')).toBeInTheDocument();
    expect(screen.getByText('A second q')).toBeInTheDocument();
    expect(screen.queryByText(/Ask a question about your document/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /\[Citation:/ })).toHaveLength(1);
  });
});
