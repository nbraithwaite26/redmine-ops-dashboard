import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement window.matchMedia. Phase G's responsive sweep
// uses it (useMediaQuery + sidebar overlay defaults), so install a minimal
// always-non-matching stub here. Tests that care about the match result
// override `window.matchMedia` themselves.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
