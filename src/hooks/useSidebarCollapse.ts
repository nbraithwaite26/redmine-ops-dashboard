import { useCallback, useEffect, useState } from 'react';

interface Args {
  /** localStorage key used to persist the collapsed flag. */
  storageKey?: string;
  /** Keyboard shortcut that toggles the sidebar. `null` disables it. */
  shortcutKey?: string | null;
  /**
   * Storage adapter. Defaults to globalThis.localStorage. Inject for
   * deterministic testing.
   */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /**
   * Media query that, when matched on first render with no stored value,
   * makes the sidebar default to collapsed. Used so first-time mobile
   * visitors see the page content instead of an overlay covering it.
   * Pass `null` to disable. Defaults to `(max-width: 767px)`.
   */
  defaultCollapsedQuery?: string | null;
}

export interface UseSidebarCollapseResult {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggle: () => void;
}

/**
 * Owns the sidebar collapsed flag with localStorage persistence and an
 * optional keyboard shortcut. Initial value is `false` (expanded) unless
 * the storage layer has a stored `1`.
 */
export function useSidebarCollapse({
  storageKey = 'rod.sidebar.collapsed',
  shortcutKey = '[',
  storage,
  defaultCollapsedQuery = '(max-width: 767px)',
}: Args = {}): UseSidebarCollapseResult {
  const effectiveStorage = storage === undefined ? safeLocalStorage() : storage;

  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    const stored = effectiveStorage?.getItem(storageKey);
    if (stored === '1') return true;
    if (stored === '0') return false;
    // No stored preference yet — fall back to viewport-width default.
    if (defaultCollapsedQuery && typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia(defaultCollapsedQuery).matches;
    }
    return false;
  });

  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedState(next);
      effectiveStorage?.setItem(storageKey, next ? '1' : '0');
    },
    [effectiveStorage, storageKey],
  );

  const toggle = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  // Keyboard shortcut to toggle. Skip when user is typing in a text field.
  useEffect(() => {
    if (!shortcutKey) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== shortcutKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      toggle();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcutKey, toggle]);

  return { collapsed, setCollapsed, toggle };
}

function safeLocalStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}
