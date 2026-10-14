import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// recharts ResponsiveContainer için
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock;

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
window.scrollTo = (() => {}) as typeof window.scrollTo;
Element.prototype.scrollIntoView = () => {};

afterEach(() => cleanup());

// Gürültülü, zararsız jsdom uyarılarını bastır (recharts boyut uyarısı)
const origError = console.error;
const origWarn = console.warn;
const noisy = (a: unknown[]) => String(a[0]).includes('width(0) and height(0)');
console.error = (...a: unknown[]) => (noisy(a) ? undefined : origError(...a));
console.warn = (...a: unknown[]) => (noisy(a) ? undefined : origWarn(...a));
