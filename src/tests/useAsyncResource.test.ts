import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAsyncResource } from '../hooks/useAsyncResource';

describe('useAsyncResource', () => {
  it('starts in loading state with the initial value', () => {
    const loader = vi.fn(async () => 'done');
    const { result } = renderHook(() => useAsyncResource(loader, 'initial'));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe('initial');
    expect(result.current.error).toBeNull();
  });

  it('resolves to the loader value and clears loading', async () => {
    const loader = vi.fn(async () => 'fetched');
    const { result } = renderHook(() => useAsyncResource(loader, ''));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('fetched');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('captures loader errors into `error` and stops loading', async () => {
    const loader = vi.fn(async () => {
      throw new Error('boom');
    });
    const { result } = renderHook(() => useAsyncResource(loader, ''));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('boom');
  });

  it('reload re-invokes the loader', async () => {
    let counter = 0;
    const loader = vi.fn(async () => ++counter);
    const { result } = renderHook(() => useAsyncResource(loader, 0));
    await waitFor(() => expect(result.current.data).toBe(1));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data).toBe(2);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('setData replaces the current value without triggering loader', async () => {
    const loader = vi.fn(async () => 'a');
    const { result } = renderHook(() => useAsyncResource(loader, ''));
    await waitFor(() => expect(result.current.data).toBe('a'));
    act(() => {
      result.current.setData('manual');
    });
    expect(result.current.data).toBe('manual');
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
