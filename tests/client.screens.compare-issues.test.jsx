import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import CompareScreen from '../client/src/screens/CompareScreen.jsx';
import IssuesScreen from '../client/src/screens/IssuesScreen.jsx';
import { renderAt } from './client.utils.jsx';

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CompareScreen', () => {
  it('shows a placeholder before any comparison runs', () => {
    renderAt(<CompareScreen />);
    expect(screen.getByText(/Provide two drafts above/)).toBeInTheDocument();
  });

  it('keeps a slot empty when the file picker is dismissed', () => {
    renderAt(<CompareScreen />);
    const [fileA] = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileA, { target: { files: [] } });
    expect(screen.getAllByText('No file selected')).toHaveLength(2);
  });

  it('requires two pasted texts or two files', () => {
    renderAt(<CompareScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Compare Drafts/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Provide two documents: paste both texts, or pick two files.'
    );
  });

  it('rejects pairing a single file with pasted text on the other slot', () => {
    renderAt(<CompareScreen />);
    const [fileA] = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileA, {
      target: { files: [new File(['a'], 'a.pdf', { type: 'application/pdf' })] },
    });
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[1], { target: { value: 'Pasted counterpart' } });
    fireEvent.click(screen.getByRole('button', { name: /Compare Drafts/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Pick two files, or paste two texts — not a mix of both.'
    );
  });

  it('rejects pairing a single file in the other slot with pasted text', () => {
    renderAt(<CompareScreen />);
    const [, fileB] = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileB, {
      target: { files: [new File(['b'], 'b.pdf', { type: 'application/pdf' })] },
    });
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: 'Pasted original' } });
    fireEvent.click(screen.getByRole('button', { name: /Compare Drafts/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Pick two files, or paste two texts — not a mix of both.'
    );
  });

  it('compares two files through a multipart payload', async () => {
    const diffs = [
      { clauseId: 'c1', status: 'added', explanation: 'Brand new clause' },
      { clauseId: 'c2', status: 'modified', explanation: 'Changed severities' },
      { clauseId: 'c3', status: 'unchanged', explanation: 'Identical text' },
    ];
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ diffs }) });
    renderAt(<CompareScreen />);
    const [fileA, fileB] = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileA, {
      target: { files: [new File(['a'], 'base.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.change(fileB, {
      target: { files: [new File(['b'], 'counter.pdf', { type: 'application/pdf' })] },
    });
    expect(screen.getByText('base.pdf')).toBeInTheDocument();
    expect(screen.getByText('counter.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Compare Drafts/ }));
    await waitFor(() => expect(screen.getByText('Brand new clause')).toBeInTheDocument());
    expect(screen.getByText('1 modified')).toBeInTheDocument();
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/compare');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('compares two pasted texts through a JSON payload and filters results', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        diffs: [
          { clauseId: 'c1', status: 'added', explanation: 'Added clause' },
          { clauseId: 'c2', status: 'removed', explanation: 'Removed obligation' },
          { clauseId: 'c3', status: 'modified', explanation: 'Modified clause' },
          { clauseId: 'c4', status: 'unchanged', explanation: 'Unchanged clause' },
        ],
      }),
    });
    renderAt(<CompareScreen />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: 'Original text' } });
    fireEvent.change(textareas[1], { target: { value: 'Counter text' } });
    fireEvent.click(screen.getByRole('button', { name: /Compare Drafts/ }));

    await waitFor(() => expect(screen.getAllByText('Added clause').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Removed obligation').length).toBeGreaterThan(0);
    expect(screen.getByText('1 modified').parentElement).toHaveTextContent('1 added');
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/compare');
    expect(JSON.parse(init.body)).toEqual({
      documentA: 'Original text',
      documentB: 'Counter text',
    });
    expect(screen.getAllByLabelText(/Paste Document/)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /Changes \(.\/.\/.\)/ }));
    expect(screen.getAllByLabelText(/Paste Document/)).toHaveLength(2);
    expect(screen.queryByText('Unchanged clause')).not.toBeInTheDocument();
    expect(screen.getAllByText('Added clause').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /^Unchanged$/ }));
    expect(screen.getByText('Unchanged clause')).toBeInTheDocument();
    expect(screen.queryByText('Added clause')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /All Provisions/ }));
    expect(screen.getAllByText('Added clause').length).toBeGreaterThan(0);
  });

  it('shows a no-results message when the diff list is empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    renderAt(<CompareScreen />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: 'A' } });
    fireEvent.change(textareas[1], { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: /Compare Drafts/ }));
    await waitFor(() =>
      expect(screen.getByText(/No provisions match this filter/)).toBeInTheDocument()
    );
    expect(screen.getByText('0 modified')).toBeInTheDocument();
  });

  it('renders unknown statuses as unchanged and skips them in counts', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        diffs: [{ clauseId: 'c9', status: 'mystery', explanation: 'Weird diff' }],
      }),
    });
    renderAt(<CompareScreen />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: 'A' } });
    fireEvent.change(textareas[1], { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: /Compare Drafts/ }));
    await waitFor(() => expect(screen.getByText('Weird diff')).toBeInTheDocument());
    expect(screen.getAllByText('Unchanged').length).toBeGreaterThan(1);
  });

  it('surfaces a comparison error message', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Compare service down'), { status: 500 }));
    renderAt(<CompareScreen />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: 'A' } });
    fireEvent.change(textareas[1], { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: /Compare Drafts/ }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Compare service down')
    );
  });

  it('falls back to a generic comparison error message and recovers', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue({});
    renderAt(<CompareScreen />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: 'A' } });
    fireEvent.change(textareas[1], { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: /Compare Drafts/ }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Comparison failed. Please try again.')
    );
    globalThis.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ diffs: [] }),
    });
    fireEvent.click(screen.getByRole('button', { name: /Compare Drafts/ }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('renders busy state while a comparison is pending', async () => {
    let resolveCompare;
    globalThis.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveCompare = () =>
            resolve({ ok: true, status: 200, json: async () => ({ diffs: [] }) });
        })
    );
    renderAt(<CompareScreen />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: 'A' } });
    fireEvent.change(textareas[1], { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: /Compare Drafts/ }));
    expect(screen.getByRole('button', { name: /Comparing/ })).toBeDisabled();
    await screen.findByText('Comparing…');
    await waitFor(() => resolveCompare());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Compare Drafts/ })).toBeEnabled()
    );
  });
});

describe('IssuesScreen', () => {
  it('renders the default case when no code is given', () => {
    renderAt(<IssuesScreen />, { initialEntries: ['/issues'] });
    expect(
      screen.getByRole('heading', { name: 'Make your document ready for analysis' })
    ).toBeInTheDocument();
    expect(screen.getByText('Intake Protocol')).toBeInTheDocument();
  });

  it('renders guidance for each known intake code', () => {
    const cases = [
      ['UPLOAD_TOO_LARGE', 'Document exceeds the 5 MB limit', 'Upload smaller file'],
      ['UNSUPPORTED_FILE_TYPE', 'File format not supported', 'Try another format'],
      ['SCANNED_PDF', 'Text could not be extracted from this scan', 'Select readable document'],
      [
        'EXTRACTED_TEXT_TOO_LARGE',
        'The extracted text is too large to process safely',
        'Upload shorter document',
      ],
    ];
    for (const [code, heading, buttonLabel] of cases) {
      const { unmount } = renderAt(<IssuesScreen />, { initialEntries: [`/issues?code=${code}`] });
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: buttonLabel })).toHaveAttribute('href', '/');
      unmount();
    }
  });

  it('scrolls back to the top', () => {
    window.scrollTo = vi.fn();
    renderAt(<IssuesScreen />, { initialEntries: ['/issues?code=SCANNED_PDF'] });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Top' }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('renders the intake protocol checklist with a highlighted limit line', () => {
    renderAt(<IssuesScreen />, { initialEntries: ['/issues'] });
    expect(screen.getByText('Max uncompressed size: 5 MB')).toBeInTheDocument();
    expect(
      screen.getByText('Encrypted or DRM-locked files require passwords before upload.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Multi-column layouts are parsed automatically when an OCR layer exists.')
    ).toBeInTheDocument();
    expect(screen.getByText('— the limit for this session')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Request Manual Document Ingestion/ })
    ).toBeInTheDocument();
  });
});
