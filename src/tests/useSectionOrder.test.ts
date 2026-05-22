import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSectionOrder } from '../hooks/useSectionOrder';

function makeStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
}

const KEY = 'rod.test.order';

describe('useSectionOrder — initial state', () => {
  it('uses defaultOrder when storage is empty', () => {
    const { result } = renderHook(() =>
      useSectionOrder({
        storageKey: KEY,
        defaultOrder: ['a', 'b', 'c'],
        storage: makeStorage(),
      }),
    );
    expect(result.current.order).toEqual(['a', 'b', 'c']);
  });

  it('restores a stored order', () => {
    const storage = makeStorage({ [KEY]: JSON.stringify(['c', 'a', 'b']) });
    const { result } = renderHook(() =>
      useSectionOrder({
        storageKey: KEY,
        defaultOrder: ['a', 'b', 'c'],
        storage,
      }),
    );
    expect(result.current.order).toEqual(['c', 'a', 'b']);
  });

  it('drops unknown stored ids and appends missing defaults', () => {
    const storage = makeStorage({ [KEY]: JSON.stringify(['unknown', 'b']) });
    const { result } = renderHook(() =>
      useSectionOrder({
        storageKey: KEY,
        defaultOrder: ['a', 'b', 'c'],
        storage,
      }),
    );
    expect(result.current.order).toEqual(['b', 'a', 'c']);
  });

  it('ignores corrupt storage payloads', () => {
    const storage = makeStorage({ [KEY]: 'not-json' });
    const { result } = renderHook(() =>
      useSectionOrder({
        storageKey: KEY,
        defaultOrder: ['a', 'b'],
        storage,
      }),
    );
    expect(result.current.order).toEqual(['a', 'b']);
  });
});

describe('useSectionOrder — transitions', () => {
  it('moveUp swaps the item with its predecessor', () => {
    const storage = makeStorage();
    const { result } = renderHook(() =>
      useSectionOrder({
        storageKey: KEY,
        defaultOrder: ['a', 'b', 'c'],
        storage,
      }),
    );
    act(() => result.current.moveUp('c'));
    expect(result.current.order).toEqual(['a', 'c', 'b']);
    expect(storage.getItem(KEY)).toBe(JSON.stringify(['a', 'c', 'b']));
  });

  it('moveUp is a no-op at the top of the list', () => {
    const { result } = renderHook(() =>
      useSectionOrder({
        storageKey: KEY,
        defaultOrder: ['a', 'b'],
        storage: makeStorage(),
      }),
    );
    act(() => result.current.moveUp('a'));
    expect(result.current.order).toEqual(['a', 'b']);
  });

  it('moveDown swaps the item with its successor', () => {
    const { result } = renderHook(() =>
      useSectionOrder({
        storageKey: KEY,
        defaultOrder: ['a', 'b', 'c'],
        storage: makeStorage(),
      }),
    );
    act(() => result.current.moveDown('a'));
    expect(result.current.order).toEqual(['b', 'a', 'c']);
  });

  it('moveDown is a no-op at the bottom of the list', () => {
    const { result } = renderHook(() =>
      useSectionOrder({
        storageKey: KEY,
        defaultOrder: ['a', 'b'],
        storage: makeStorage(),
      }),
    );
    act(() => result.current.moveDown('b'));
    expect(result.current.order).toEqual(['a', 'b']);
  });

  it('moveUp/moveDown are no-ops for unknown ids', () => {
    const { result } = renderHook(() =>
      useSectionOrder({
        storageKey: KEY,
        defaultOrder: ['a', 'b'],
        storage: makeStorage(),
      }),
    );
    act(() => result.current.moveUp('zzz'));
    act(() => result.current.moveDown('zzz'));
    expect(result.current.order).toEqual(['a', 'b']);
  });

  it('setOrder replaces and persists the full order', () => {
    const storage = makeStorage();
    const { result } = renderHook(() =>
      useSectionOrder({
        storageKey: KEY,
        defaultOrder: ['a', 'b'],
        storage,
      }),
    );
    act(() => result.current.setOrder(['b', 'a']));
    expect(result.current.order).toEqual(['b', 'a']);
    expect(storage.getItem(KEY)).toBe(JSON.stringify(['b', 'a']));
  });
});
