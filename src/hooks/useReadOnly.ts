import { useEffect, useState } from 'react';
import { testConnection } from '../services/redmineApi';

/**
 * Returns the current read-only flag. In mock mode this is always false.
 * In real mode it reflects the backend's REDMINE_READ_ONLY env var.
 *
 * The flag is fetched once on mount via testConnection(). Treat it as
 * eventually-consistent — operators flipping the env requires an app
 * reload to refresh the cached value.
 */
export function useReadOnly(): { readOnly: boolean; loading: boolean } {
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await testConnection();
        if (!cancelled) setReadOnly(status.readOnly);
      } catch {
        // Network/backend errors: leave readOnly=false so writes can still
        // attempt and surface their own errors. Better than blocking the UI.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { readOnly, loading };
}
