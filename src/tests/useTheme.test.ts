import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useTheme } from '../hooks/useTheme';

function makeStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
}

function makeRoot() {
  const el = document.createElement('div');
  return el;
}

const KEY = 'rod.theme';

beforeEach(() => {
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('useTheme — initial state', () => {
  it('defaults to system when storage is empty', () => {
    const { result } = renderHook(() =>
      useTheme({
        storage: makeStorage(),
        rootElement: makeRoot(),
        systemDark: () => false,
        subscribeSystem: () => () => {},
      }),
    );
    expect(result.current.theme).toBe('system');
    expect(result.current.effectiveTheme).toBe('light');
  });

  it('reads "dark" from storage and applies it', () => {
    const root = makeRoot();
    const { result } = renderHook(() =>
      useTheme({
        storage: makeStorage({ [KEY]: 'dark' }),
        rootElement: root,
        systemDark: () => false,
        subscribeSystem: () => () => {},
      }),
    );
    expect(result.current.theme).toBe('dark');
    expect(result.current.effectiveTheme).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('ignores corrupt stored values and falls back to system', () => {
    const { result } = renderHook(() =>
      useTheme({
        storage: makeStorage({ [KEY]: 'midnight-electric' }),
        rootElement: makeRoot(),
        systemDark: () => true,
        subscribeSystem: () => () => {},
      }),
    );
    expect(result.current.theme).toBe('system');
    expect(result.current.effectiveTheme).toBe('dark');
  });

  it('resolves system → dark when the OS prefers dark', () => {
    const root = makeRoot();
    const { result } = renderHook(() =>
      useTheme({
        storage: makeStorage(),
        rootElement: root,
        systemDark: () => true,
        subscribeSystem: () => () => {},
      }),
    );
    expect(result.current.effectiveTheme).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
  });
});

describe('useTheme — setting and toggling', () => {
  it('setTheme(dark) applies the dark class and persists', () => {
    const root = makeRoot();
    const storage = makeStorage();
    const { result } = renderHook(() =>
      useTheme({
        storage,
        rootElement: root,
        systemDark: () => false,
        subscribeSystem: () => () => {},
      }),
    );
    act(() => result.current.setTheme('dark'));
    expect(result.current.effectiveTheme).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
    expect(storage.getItem(KEY)).toBe('dark');
  });

  it('toggle flips light ↔ dark', () => {
    const { result } = renderHook(() =>
      useTheme({
        storage: makeStorage(),
        rootElement: makeRoot(),
        systemDark: () => false,
        subscribeSystem: () => () => {},
      }),
    );
    expect(result.current.effectiveTheme).toBe('light');
    act(() => result.current.toggle());
    expect(result.current.effectiveTheme).toBe('dark');
    act(() => result.current.toggle());
    expect(result.current.effectiveTheme).toBe('light');
  });

  it('toggling away from system picks the opposite of current effective', () => {
    const { result } = renderHook(() =>
      useTheme({
        storage: makeStorage(),
        rootElement: makeRoot(),
        systemDark: () => true, // OS is dark, system → dark
        subscribeSystem: () => () => {},
      }),
    );
    expect(result.current.theme).toBe('system');
    expect(result.current.effectiveTheme).toBe('dark');
    act(() => result.current.toggle());
    // From dark → user explicitly chose light.
    expect(result.current.theme).toBe('light');
    expect(result.current.effectiveTheme).toBe('light');
  });
});

describe('useTheme — system preference changes', () => {
  it('responds to subscribeSystem when theme is system', () => {
    let listener: ((isDark: boolean) => void) | null = null;
    const root = makeRoot();
    const { result } = renderHook(() =>
      useTheme({
        storage: makeStorage(),
        rootElement: root,
        systemDark: () => false,
        subscribeSystem: (cb) => {
          listener = cb;
          return () => {};
        },
      }),
    );
    expect(result.current.effectiveTheme).toBe('light');
    act(() => {
      listener?.(true);
    });
    expect(result.current.effectiveTheme).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('does NOT respond to system changes once user picks an explicit theme', () => {
    let listener: ((isDark: boolean) => void) | null = null;
    const { result } = renderHook(() =>
      useTheme({
        storage: makeStorage(),
        rootElement: makeRoot(),
        systemDark: () => false,
        subscribeSystem: (cb) => {
          listener = cb;
          return () => {};
        },
      }),
    );
    act(() => result.current.setTheme('light'));
    act(() => {
      listener?.(true);
    });
    expect(result.current.effectiveTheme).toBe('light');
  });
});
