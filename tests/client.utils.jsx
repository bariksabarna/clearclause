import { useMemo, useReducer } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { SessionContext, sessionReducer } from '../client/src/store/session.jsx';

export function SessionHarness({ initial, children }) {
  const [state, dispatch] = useReducer(sessionReducer, initial);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function renderAt(ui, { initial = {}, initialEntries = ['/'] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SessionHarness initial={initial}>{ui}</SessionHarness>
    </MemoryRouter>
  );
}

export function renderRoutes(initial, routes, initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SessionHarness initial={initial}>{routes}</SessionHarness>
    </MemoryRouter>
  );
}

export function sampleClause(overrides = {}) {
  return {
    id: 'c1',
    tag: 'Non-Compete',
    severity: 'High',
    explanation: 'Restricts where you can work.',
    severityReason: 'Broad in duration and scope.',
    sourceText: 'You will not work for a competitor for eighteen months.',
    ...overrides,
  };
}

export function sseEvent(event, data) {
  return `event: ${event}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`;
}

export function installSseFetcher(events) {
  const text = events.map(([event, data]) => sseEvent(event, data)).join('');
  globalThis.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({}),
    body: {
      getReader: () => {
        const encoder = new TextEncoder();
        const buffer = encoder.encode(text);
        let offset = 0;
        return {
          read: async () => {
            if (offset >= buffer.length) return { done: true, value: undefined };
            const start = offset;
            offset = Math.min(buffer.length, offset + 11);
            return { done: false, value: buffer.subarray(start, offset) };
          },
          releaseLock: () => {},
        };
      },
    },
  });
}
