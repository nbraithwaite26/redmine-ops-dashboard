import { useEffect, useState } from 'react';

export interface MsAuthState {
  loading: boolean;
  /** True when the backend has Microsoft sign-in turned on (MS_AUTH_ENABLED). */
  enabled: boolean;
  authenticated: boolean;
  user: { name: string; username: string } | null;
}

/**
 * Reads the Microsoft sign-in state from the backend (/api/auth/ms/me).
 * When `enabled` is false, the app runs ungated (current behavior).
 */
export function useMsAuth(): MsAuthState {
  const [state, setState] = useState<MsAuthState>({
    loading: true,
    enabled: false,
    authenticated: false,
    user: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/ms/me', { credentials: 'include' });
        const data = await res.json();
        if (cancelled) return;
        setState({
          loading: false,
          enabled: Boolean(data.enabled),
          authenticated: Boolean(data.authenticated),
          user: data.user ?? null,
        });
      } catch {
        if (!cancelled) {
          setState({ loading: false, enabled: false, authenticated: false, user: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Full-page navigation to begin the Microsoft sign-in flow. */
export function startMsSignIn(): void {
  const redirect = window.location.hash || '#/';
  window.location.href = `/api/auth/ms/signin?redirect=${encodeURIComponent(redirect)}`;
}

/** Full-page navigation to sign out (clears session + Entra logout). */
export function msSignOut(): void {
  window.location.href = '/api/auth/ms/signout';
}
