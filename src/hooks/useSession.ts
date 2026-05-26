import { useCallback, useEffect, useState } from 'react';
import { AdminApiError, getSessionUser, signIn, signOut } from '../services/adminApi';

const MOCK_MODE =
  (import.meta.env.VITE_MOCK_MODE ?? 'true').toString().toLowerCase() !== 'false';

export interface SessionState {
  user: string | null;
  loading: boolean;
  /** True when running in mock mode — the session is fabricated. */
  mock: boolean;
  /** Backend returned 501 = admin feature not enabled in env. */
  adminDisabled: boolean;
  error: string | null;
  signIn: (user: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
  /** Re-probe the session — useful after login. */
  refresh: () => Promise<void>;
}

/**
 * Tracks the admin session. In mock mode the session is fabricated so the
 * admin page can render without a real backend (plan §14.4 mock behavior).
 * In real mode it calls /api/auth/me to read the cookie-backed session.
 */
export function useSession(): SessionState {
  const [user, setUser] = useState<string | null>(MOCK_MODE ? 'admin (mock)' : null);
  const [loading, setLoading] = useState<boolean>(!MOCK_MODE);
  const [adminDisabled, setAdminDisabled] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (MOCK_MODE) {
      setUser('admin (mock)');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const u = await getSessionUser();
      setUser(u);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 501) {
        setAdminDisabled(true);
        setUser(null);
      } else {
        setError(err instanceof Error ? err.message : 'Auth probe failed');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const doSignIn = useCallback(async (u: string, password: string) => {
    if (MOCK_MODE) {
      setUser('admin (mock)');
      return 'admin (mock)';
    }
    setError(null);
    try {
      const next = await signIn(u, password);
      setUser(next);
      return next;
    } catch (err) {
      const msg =
        err instanceof AdminApiError && err.code === 'AUTH_FAILED'
          ? 'Invalid username or password.'
          : err instanceof AdminApiError && err.code === 'RATE_LIMITED'
            ? 'Too many attempts. Try again in a minute.'
            : err instanceof Error
              ? err.message
              : 'Login failed.';
      setError(msg);
      throw err;
    }
  }, []);

  const doSignOut = useCallback(async () => {
    if (MOCK_MODE) {
      setUser(null);
      return;
    }
    try {
      await signOut();
    } finally {
      setUser(null);
    }
  }, []);

  return {
    user,
    loading,
    mock: MOCK_MODE,
    adminDisabled,
    error,
    signIn: doSignIn,
    signOut: doSignOut,
    refresh,
  };
}
