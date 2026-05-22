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
}: Args = {}): UseSidebarCollapseResult {
  const effectiveStorage = storage === undefined ? safeLocalStorage() : storage;

  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (!effectiveStorage) return false;
    return effectiveStorage.getItem(storageKey) === '1';
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
