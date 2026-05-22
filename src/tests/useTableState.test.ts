import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTableState } from '../hooks/useTableState';

interface Row {
  id: number;
  name: string;
  hours: number;
}

const rows: Row[] = [
  { id: 1, name: 'alpha', hours: 5 },
  { id: 2, name: 'beta', hours: 1 },
  { id: 3, name: 'gamma', hours: 9 },
];

type Key = 'name' | 'hours';

function renderTable() {
  return renderHook(() =>
    useTableState<Row, Key>({
      rows,
      initialSortKey: 'name',
      sortValue: (r, key) => (key === 'name' ? r.name : r.hours),
      matches: (r, q) => r.name.toLowerCase().includes(q),
      rowId: (r) => r.id,
    }),
  );
}

describe('useTableState — sort', () => {
  it('returns rows sorted ascending by initial key', () => {
    const { result } = renderTable();
    expect(result.current.rows.map((r) => r.name)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
  });

  it('toggleSort flips direction on the same key', () => {
    const { result } = renderTable();
    act(() => result.current.toggleSort('name'));
    expect(result.current.sortDir).toBe('desc');
    expect(result.current.rows.map((r) => r.name)).toEqual([
      'gamma',
      'beta',
      'alpha',
    ]);
  });

  it('toggleSort switches key and resets to asc', () => {
    const { result } = renderTable();
    act(() => result.current.toggleSort('hours'));
    expect(result.current.sortKey).toBe('hours');
    expect(result.current.sortDir).toBe('asc');
    expect(result.current.rows.map((r) => r.hours)).toEqual([1, 5, 9]);
  });
});

describe('useTableState — filter', () => {
  it('filters rows by query', () => {
    const { result } = renderTable();
    act(() => result.current.setQuery('alp'));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]?.name).toBe('alpha');
  });

  it('empty query returns all rows', () => {
    const { result } = renderTable();
    act(() => result.current.setQuery(''));
    expect(result.current.rows).toHaveLength(3);
  });
});

describe('useTableState — selection', () => {
  it('toggleSelected adds and removes ids', () => {
    const { result } = renderTable();
    act(() => result.current.toggleSelected(1));
    expect(result.current.selected.has(1)).toBe(true);
    act(() => result.current.toggleSelected(1));
    expect(result.current.selected.has(1)).toBe(false);
  });

  it('selectAll selects every filtered row', () => {
    const { result } = renderTable();
    act(() => result.current.selectAll());
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.selected.size).toBe(3);
  });

  it('clearSelection empties the set', () => {
    const { result } = renderTable();
    act(() => result.current.selectAll());
    act(() => result.current.clearSelection());
    expect(result.current.selected.size).toBe(0);
  });

  it('selectAll respects the active filter', () => {
    const { result } = renderTable();
    act(() => result.current.setQuery('alp'));
    act(() => result.current.selectAll());
    // Only alpha matches "alp".
    expect(result.current.selected.size).toBe(1);
    expect(result.current.selected.has(1)).toBe(true);
  });
});
