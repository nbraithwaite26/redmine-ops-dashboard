import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BannerSeverity } from '../components/StatusBanner';

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'success'; at: number }
  | { kind: 'error'; message: string };

interface Args {
  mockMode: boolean;
  /** ms before a success notice reverts to the mock-mode message. */
  successDurationMs?: number;
  /** sessionStorage key used to remember the mock-mode dismissal. */
  storageKey?: string;
  /**
   * Storage adapter. Defaults to globalThis.sessionStorage; injectable for
   * deterministic testing.
   */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

export interface BannerView {
  severity: BannerSeverity;
  message: string;
  /** When provided, the banner renders an X button that calls this. */
  onDismiss?: () => void;
}

export interface UseSyncBannerResult {
  /** What the banner should render right now (or null when hidden). */
  banner: BannerView | null;
  /** Current sync state machine value. */
  status: SyncStatus;
  /** Transitions: caller signals beginning of sync. */
  beginSync: () => void;
  /** Transitions: caller reports success. */
  reportSuccess: () => void;
  /** Transitions: caller reports failure. */
  reportError: (message: string) => void;
}

/**
 * Drives the sticky sync banner. Single source of truth for which message
 * (if any) should render at the top of the app.
 *
 * Behavior:
 * - When sync is `syncing`, show a transient info "Syncing…" notice.
 * - When sync just succeeded, show green "Sync completed". After
 *   `successDurationMs` (default 5000ms) the state auto-resets so the
 *   underlying mock-mode notice (if any) becomes visible again.
 * - When sync errored, show red error notice, dismissible.
 * - Otherwise, if mock mode is on AND the mock notice has not been
 *   dismissed this session, show the orange mock notice.
 * - Otherwise, hide the banner.
 */
export function useSyncBanner({
  mockMode,
  successDurationMs = 5000,
  storageKey = 'rod.banner.mockDismissed',
  storage,
}: Args): UseSyncBannerResult {
  const effectiveStorage =
    storage === undefined ? safeSessionStorage() : storage;

  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' });
  const [mockDismissed, setMockDismissed] = useState<boolean>(() => {
    if (!effectiveStorage) return false;
    return effectiveStorage.getItem(storageKey) === '1';
  });

  // Auto-revert success notice after the configured duration.
  useEffect(() => {
    if (status.kind !== 'success') return;
    const timer = setTimeout(() => {
      setStatus({ kind: 'idle' });
    }, successDurationMs);
    return () => clearTimeout(timer);
  }, [status, successDurationMs]);

  const beginSync = useCallback(() => setStatus({ kind: 'syncing' }), []);
  const reportSuccess = useCallback(
    () => setStatus({ kind: 'success', at: Date.now() }),
    [],
  );
  const reportError = useCallback(
    (message: string) => setStatus({ kind: 'error', message }),
    [],
  );
  const clearError = useCallback(() => setStatus({ kind: 'idle' }), []);
  const dismissMockNotice = useCallback(() => {
    setMockDismissed(true);
    effectiveStorage?.setItem(storageKey, '1');
  }, [effectiveStorage, storageKey]);

  const banner = useMemo<BannerView | null>(() => {
    if (status.kind === 'syncing') {
      return { severity: 'info', message: 'Syncing with Redmine…' };
    }
    if (status.kind === 'success') {
      return { severity: 'success', message: 'Sync completed · just now' };
    }
    if (status.kind === 'error') {
      return {
        severity: 'error',
        message: `Sync failed: ${status.message}`,
        onDismiss: clearError,
      };
    }
    if (mockMode && !mockDismissed) {
      return {
        severity: 'warning',
        message: 'Mock mode is active — using sample data. Connect Redmine in Settings.',
        onDismiss: dismissMockNotice,
      };
    }
    return null;
  }, [status, mockMode, mockDismissed, clearError, dismissMockNotice]);

  return { banner, status, beginSync, reportSuccess, reportError };
}

function safeSessionStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}
