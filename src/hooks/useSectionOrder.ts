import { useCallback, useEffect, useState } from 'react';

interface Args {
  /** Stable string id used to namespace the order in storage. */
  storageKey: string;
  /** Initial ordered list of section ids (used on first load / fallback). */
  defaultOrder: string[];
  /**
   * Storage adapter. Defaults to globalThis.localStorage. Inject for
   * deterministic testing.
   */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

export interface UseSectionOrderResult {
  /** Current ordered list of section ids. */
  order: string[];
  /** Move the section with this id up one slot (no-op at the top). */
  moveUp: (id: string) => void;
  /** Move the section with this id down one slot (no-op at the bottom). */
  moveDown: (id: string) => void;
  /** Replace the whole order. */
  setOrder: (next: string[]) => void;
}

/**
 * Owns the ordered list of section ids for a reorderable page. Persists to
 * localStorage under `storageKey`. Drops unknown stored ids and appends any
 * defaultOrder ids missing from storage so the page always has a complete
 * ordering even after a section is added.
 */
export function useSectionOrder({
  storageKey,
  defaultOrder,
  storage,
}: Args): UseSectionOrderResult {
  const effectiveStorage = storage === undefined ? safeLocalStorage() : storage;

  const [order, setOrderState] = useState<string[]>(() =>
    loadOrder(effectiveStorage, storageKey, defaultOrder),
  );

  // Re-sync the order if the defaultOrder gains/loses ids (e.g. new section).
  useEffect(() => {
    setOrderState((current) => reconcile(current, defaultOrder));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOrder.join('|')]);

  const persist = useCallback(
    (next: string[]) => {
      effectiveStorage?.setItem(storageKey, JSON.stringify(next));
    },
    [effectiveStorage, storageKey],
  );

  const setOrder = useCallback(
    (next: string[]) => {
      setOrderState(next);
      persist(next);
    },
    [persist],
  );

  const moveUp = useCallback(
    (id: string) => {
      setOrderState((current) => {
        const idx = current.indexOf(id);
        if (idx <= 0) return current;
        const next = [...current];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const moveDown = useCallback(
    (id: string) => {
      setOrderState((current) => {
        const idx = current.indexOf(id);
        if (idx < 0 || idx >= current.length - 1) return current;
        const next = [...current];
        [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  return { order, moveUp, moveDown, setOrder };
}

function loadOrder(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  storageKey: string,
  defaultOrder: string[],
): string[] {
  if (!storage) return defaultOrder;
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return defaultOrder;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
      return defaultOrder;
    }
    return reconcile(parsed as string[], defaultOrder);
  } catch {
    return defaultOrder;
  }
}

function reconcile(stored: string[], defaultOrder: string[]): string[] {
  const allowed = new Set(defaultOrder);
  const known = stored.filter((id) => allowed.has(id));
  const missing = defaultOrder.filter((id) => !known.includes(id));
  return [...known, ...missing];
}

function safeLocalStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}
