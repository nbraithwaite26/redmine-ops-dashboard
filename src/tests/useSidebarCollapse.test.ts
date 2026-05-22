import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSidebarCollapse } from '../hooks/useSidebarCollapse';

function makeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
}

beforeEach(() => {
  // Avoid the real listener leaking across renderHook calls.
});

afterEach(() => {});

describe('useSidebarCollapse — initial state', () => {
  it('defaults to expanded (collapsed=false)', () => {
    const { result } = renderHook(() =>
      useSidebarCollapse({ storage: makeStorage(), shortcutKey: null }),
    );
    expect(result.current.collapsed).toBe(false);
  });

  it('reads "1" from storage as collapsed=true', () => {
    const storage = makeStorage();
    storage.setItem('rod.sidebar.collapsed', '1');
    const { result } = renderHook(() =>
      useSidebarCollapse({ storage, shortcutKey: null }),
    );
    expect(result.current.collapsed).toBe(true);
  });

  it('defaults to collapsed when the viewport matches the mobile media query and no stored value exists', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      const { result } = renderHook(() =>
        useSidebarCollapse({ storage: makeStorage(), shortcutKey: null }),
      );
      expect(result.current.collapsed).toBe(true);
    } finally {
      window.matchMedia = original;
    }
  });

  it('stored "0" wins over the mobile default', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      const storage = makeStorage();
      storage.setItem('rod.sidebar.collapsed', '0');
      const { result } = renderHook(() =>
        useSidebarCollapse({ storage, shortcutKey: null }),
      );
      expect(result.current.collapsed).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('useSidebarCollapse — transitions', () => {
  it('toggle flips the flag', () => {
    const { result } = renderHook(() =>
      useSidebarCollapse({ storage: makeStorage(), shortcutKey: null }),
    );
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
  });

  it('setCollapsed persists to storage', () => {
    const storage = makeStorage();
    const { result } = renderHook(() =>
      useSidebarCollapse({ storage, shortcutKey: null }),
    );
    act(() => result.current.setCollapsed(true));
    expect(storage.getItem('rod.sidebar.collapsed')).toBe('1');
    act(() => result.current.setCollapsed(false));
    expect(storage.getItem('rod.sidebar.collapsed')).toBe('0');
  });
});

describe('useSidebarCollapse — keyboard shortcut', () => {
  it('toggles when the shortcut key is pressed', () => {
    const { result } = renderHook(() =>
      useSidebarCollapse({ storage: makeStorage(), shortcutKey: '[' }),
    );
    expect(result.current.collapsed).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '[' }));
    });
    expect(result.current.collapsed).toBe(true);
  });

  it('ignores the shortcut while the user is typing in an input', () => {
    const { result } = renderHook(() =>
      useSidebarCollapse({ storage: makeStorage(), shortcutKey: '[' }),
    );
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: '[', bubbles: true }),
      );
    });
    document.body.removeChild(input);
    expect(result.current.collapsed).toBe(false);
  });

  it('does not register a listener when shortcutKey is null', () => {
    const { result } = renderHook(() =>
      useSidebarCollapse({ storage: makeStorage(), shortcutKey: null }),
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '[' }));
    });
    expect(result.current.collapsed).toBe(false);
  });
});
