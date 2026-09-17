import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

globalThis.fetch = vi.fn();

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = vi.fn();
}

if (typeof window !== 'undefined') {
  if (typeof window.print === 'undefined') window.print = vi.fn();
  if (typeof window.scrollTo === 'undefined') window.scrollTo = vi.fn();
  if (typeof URL.createObjectURL === 'undefined') URL.createObjectURL = vi.fn(() => 'blob:mock');
  if (typeof URL.revokeObjectURL === 'undefined') URL.revokeObjectURL = vi.fn();
}
