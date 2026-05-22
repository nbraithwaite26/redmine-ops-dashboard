import { useCallback, useEffect, useState } from 'react';

export interface AsyncResource<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  /** Re-invoke the loader with the same dependencies. */
  reload: () => Promise<void>;
  /** Imperatively replace the current data. Used by pages that need to
   *  reflect an in-place mutation without re-fetching. */
  setData: (next: T) => void;
}

/**
 * Reusable "load on mount + expose reload" hook. The dashboard pages all
 * share the same pattern of: hold `useState`, call an async loader inside
 * `useEffect`, expose a `load` function the page can call again after
 * editing. This hook collapses that boilerplate.
 *
 * @example
 * const issues = useAsyncResource(getMyIssues, []);
 * issues.data.map(...);
 * await issues.reload();
 */
export function useAsyncResource<T>(
  load: () => Promise<T>,
  initial: T,
  /**
   * If `load` closes over state that changes, the caller can pass a
   * dependency array to re-run the loader. Defaults to `[]` (load once).
   */
  deps: ReadonlyArray<unknown> = [],
): AsyncResource<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await load();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
