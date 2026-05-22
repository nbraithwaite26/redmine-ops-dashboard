import { useCallback, useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface UseTableStateOptions<T, K extends string> {
  rows: T[];
  /** Initial sort key. */
  initialSortKey: K;
  /** Initial sort direction. Defaults to `asc`. */
  initialSortDir?: SortDirection;
  /** Returns a sortable primitive (string | number) for a row + key. */
  sortValue: (row: T, key: K) => string | number;
  /** Returns true when the row matches the (lowercased) query. */
  matches: (row: T, query: string) => boolean;
  /** Stable identifier per row, used for selection. */
  rowId: (row: T) => number | string;
}

export interface UseTableStateResult<T, K extends string> {
  query: string;
  setQuery: (q: string) => void;
  sortKey: K;
  sortDir: SortDirection;
  /** Toggle sort dir if `key` matches the current sort key; otherwise
   *  switch to that key with `asc`. Single call site for header clicks. */
  toggleSort: (key: K) => void;
  /** Filtered + sorted rows. */
  rows: T[];
  selected: Set<number | string>;
  toggleSelected: (id: number | string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  isAllSelected: boolean;
}

/**
 * Generic table state hook: owns search query, sort key + direction, and
 * row selection. Extracted from IssueTable so the same pattern can be
 * reused by other tables (Time Tracking, AllProjects, future tables) and
 * IssueTable's render code can focus on presentation.
 */
export function useTableState<T, K extends string>({
  rows,
  initialSortKey,
  initialSortDir = 'asc',
  sortValue,
  matches,
  rowId,
}: UseTableStateOptions<T, K>): UseTableStateResult<T, K> {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<K>(initialSortKey);
  const [sortDir, setSortDir] = useState<SortDirection>(initialSortDir);
  const [selected, setSelected] = useState<Set<number | string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = rows;
    if (q) result = result.filter((row) => matches(row, q));
    const sorted = [...result].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [rows, query, sortKey, sortDir, matches, sortValue]);

  const toggleSort = useCallback((key: K) => {
    setSortKey((current) => {
      if (current === key) {
        setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return current;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const toggleSelected = useCallback((id: number | string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(filtered.map((r) => rowId(r))));
  }, [filtered, rowId]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isAllSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(rowId(r)));

  return {
    query,
    setQuery,
    sortKey,
    sortDir,
    toggleSort,
    rows: filtered,
    selected,
    toggleSelected,
    selectAll,
    clearSelection,
    isAllSelected,
  };
}
