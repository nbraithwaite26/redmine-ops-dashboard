import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSyncBanner } from '../hooks/useSyncBanner';

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
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSyncBanner — initial state', () => {
  it('shows the mock warning when mockMode is true and not dismissed', () => {
    const storage = makeStorage();
    const { result } = renderHook(() => useSyncBanner({ mockMode: true, storage }));
    expect(result.current.banner?.severity).toBe('warning');
    expect(result.current.banner?.message).toMatch(/mock mode/i);
    expect(result.current.banner?.onDismiss).toBeTypeOf('function');
  });

  it('hides the banner when mockMode is false and status is idle', () => {
    const { result } = renderHook(() =>
      useSyncBanner({ mockMode: false, storage: makeStorage() }),
    );
    expect(result.current.banner).toBeNull();
  });

  it('hides the mock warning when sessionStorage already has it dismissed', () => {
    const storage = makeStorage();
    storage.setItem('rod.banner.mockDismissed', '1');
    const { result } = renderHook(() => useSyncBanner({ mockMode: true, storage }));
    expect(result.current.banner).toBeNull();
  });
});

describe('useSyncBanner — sync state transitions', () => {
  it('beginSync renders the syncing banner', () => {
    const { result } = renderHook(() =>
      useSyncBanner({ mockMode: true, storage: makeStorage() }),
    );
    act(() => result.current.beginSync());
    expect(result.current.status.kind).toBe('syncing');
    expect(result.current.banner?.severity).toBe('info');
    expect(result.current.banner?.message).toMatch(/syncing/i);
  });

  it('reportSuccess renders the success banner', () => {
    const { result } = renderHook(() =>
      useSyncBanner({ mockMode: true, storage: makeStorage() }),
    );
    act(() => result.current.reportSuccess());
    expect(result.current.banner?.severity).toBe('success');
    expect(result.current.banner?.onDismiss).toBeUndefined();
  });

  it('reportError renders the error banner with the message', () => {
    const { result } = renderHook(() =>
      useSyncBanner({ mockMode: true, storage: makeStorage() }),
    );
    act(() => result.current.reportError('boom'));
    expect(result.current.banner?.severity).toBe('error');
    expect(result.current.banner?.message).toBe('Sync failed: boom');
    expect(result.current.banner?.onDismiss).toBeTypeOf('function');
  });

  it('auto-reverts the success banner after the configured duration', () => {
    const { result } = renderHook(() =>
      useSyncBanner({ mockMode: true, storage: makeStorage(), successDurationMs: 1000 }),
    );
    act(() => result.current.reportSuccess());
    expect(result.current.banner?.severity).toBe('success');
    act(() => {
      vi.advanceTimersByTime(1001);
    });
    // Falls back to the mock warning because mockMode is still true.
    expect(result.current.banner?.severity).toBe('warning');
  });

  it('does not auto-revert the error banner', () => {
    const { result } = renderHook(() =>
      useSyncBanner({ mockMode: true, storage: makeStorage() }),
    );
    act(() => result.current.reportError('nope'));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.banner?.severity).toBe('error');
  });

  it('dismissing the error banner returns to mock-mode warning', () => {
    const { result } = renderHook(() =>
      useSyncBanner({ mockMode: true, storage: makeStorage() }),
    );
    act(() => result.current.reportError('nope'));
    act(() => result.current.banner?.onDismiss?.());
    expect(result.current.banner?.severity).toBe('warning');
  });

  it('dismissing the mock warning persists to storage', () => {
    const storage = makeStorage();
    const { result } = renderHook(() => useSyncBanner({ mockMode: true, storage }));
    act(() => result.current.banner?.onDismiss?.());
    expect(result.current.banner).toBeNull();
    expect(storage.getItem('rod.banner.mockDismissed')).toBe('1');
  });
});
