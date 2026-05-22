import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

interface Args {
  /** localStorage key. */
  storageKey?: string;
  /** Storage adapter — injectable for deterministic testing. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /**
   * Function returning whether the OS currently prefers dark mode. Defaults
   * to `window.matchMedia('(prefers-color-scheme: dark)').matches`.
   * Injectable for testing.
   */
  systemDark?: () => boolean;
  /**
   * Subscribe to system-preference changes. Returns an unsubscribe.
   * Defaults to the matchMedia listener. Injectable for testing.
   */
  subscribeSystem?: (listener: (isDark: boolean) => void) => () => void;
  /**
   * The element that gets the `.dark` class applied to it.
   * Defaults to `document.documentElement` in real environments.
   */
  rootElement?: HTMLElement | null;
}

export interface UseThemeResult {
  /** What the user picked: light, dark, or system. */
  theme: ThemeChoice;
  /** The currently-displayed mode. When `theme` is `system`, this reflects the OS preference. */
  effectiveTheme: EffectiveTheme;
  /** Set the user's choice. Persists immediately. */
  setTheme: (next: ThemeChoice) => void;
  /** Convenience: flip between light and dark (matches the UX from CR #12 Q12i option B). */
  toggle: () => void;
}

/**
 * Owns the active theme. Three concerns in one place:
 *  - Persistence via localStorage under `storageKey` (default `rod.theme`).
 *  - Resolution to an effective `light | dark` value (when `theme === 'system'`,
 *    we listen to `prefers-color-scheme`).
 *  - DOM side-effect: toggles the `.dark` class on the root element so the
 *    CSS variables in :root.dark take effect.
 */
export function useTheme({
  storageKey = 'rod.theme',
  storage,
  systemDark,
  subscribeSystem,
  rootElement,
}: Args = {}): UseThemeResult {
  const effectiveStorage = storage === undefined ? safeLocalStorage() : storage;

  const [theme, setThemeState] = useState<ThemeChoice>(() => {
    if (!effectiveStorage) return 'system';
    const stored = effectiveStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
  });

  const isSystemDark = useCallback(() => {
    if (systemDark) return systemDark();
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }, [systemDark]);

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    isSystemDark(),
  );

  // Subscribe to OS preference changes — only matters when theme === 'system'
  // but we listen unconditionally and let the derived value handle it.
  useEffect(() => {
    if (subscribeSystem) {
      return subscribeSystem(setSystemPrefersDark);
    }
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    // Some older Safari versions only expose addListener.
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [subscribeSystem]);

  const effectiveTheme: EffectiveTheme =
    theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;

  // DOM side-effect: apply the .dark class.
  useEffect(() => {
    const el =
      rootElement === undefined
        ? typeof document !== 'undefined'
          ? document.documentElement
          : null
        : rootElement;
    if (!el) return;
    if (effectiveTheme === 'dark') {
      el.classList.add('dark');
    } else {
      el.classList.remove('dark');
    }
  }, [effectiveTheme, rootElement]);

  const setTheme = useCallback(
    (next: ThemeChoice) => {
      setThemeState(next);
      effectiveStorage?.setItem(storageKey, next);
    },
    [effectiveStorage, storageKey],
  );

  // Per Q12i option B: toggle is strictly light ↔ dark. Picking from `system`
  // resolves to the opposite of the current effective mode (so it feels natural).
  const toggle = useCallback(() => {
    const next: ThemeChoice = effectiveTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [effectiveTheme, setTheme]);

  return { theme, effectiveTheme, setTheme, toggle };
}

function safeLocalStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}
