import { useEffect, useState } from 'react';
import { getCurrentUser } from '../services/redmineApi';
import type { User } from '../types/redmine';

/**
 * Hydrates the current user once on mount. In mock mode this is the
 * pinned mock user; in real mode it is the API key holder pulled from
 * /api/redmine/me.
 *
 * `loading` distinguishes "not yet fetched" from "fetched and null" (which
 * would indicate a backend issue).
 */
export function useCurrentUser(): { user: User | null; loading: boolean; error: Error | null } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await getCurrentUser();
        if (!cancelled) setUser(u);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading, error };
}
