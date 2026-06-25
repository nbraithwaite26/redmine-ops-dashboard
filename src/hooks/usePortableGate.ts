import { useCallback, useEffect, useState } from 'react';
import {
  getHealth,
  getPortableStatus,
  type PortableStatusResponse,
} from '../services/portableAuth';

/**
 * Boot-time gate for CR #30 portable mode.
 *
 * Resolves to one of three states:
 *   - 'checking'       — initial probe of /health is in flight.
 *   - 'ready'          — centralized mode, OR portable + already configured.
 *                        The normal app shell can render.
 *   - 'login-required' — portable mode + no persisted config on disk.
 *                        Caller should render the PortableLogin page.
 *
 * In centralized mode this hook adds a single fetch on boot (`/health`)
 * and then settles to 'ready' permanently. No further network traffic.
 *
 * `markReady()` is called by the login page after a successful login so
 * the gate can transition without a full page reload.
 */
export type PortableGateState = 'checking' | 'login-required' | 'ready';

export interface PortableGate {
  state: PortableGateState;
  /** True when the backend reports it's running in portable mode. */
  portable: boolean;
  /** Build version reported by /api/redmine/health. */
  version: string | null;
  /** Status payload — populated once we know whether config is on disk. */
  status: PortableStatusResponse | null;
  /** Force-transition to 'ready'. Called after a successful login. */
  markReady: (status: PortableStatusResponse) => void;
}

export function usePortableGate(): PortableGate {
  const [state, setState] = useState<PortableGateState>('checking');
  const [portable, setPortable] = useState<boolean>(false);
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<PortableStatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await getHealth();
        if (cancelled) return;
        setPortable(health.portable);
        if (typeof health.version === 'string') setVersion(health.version);
        if (!health.portable) {
          setState('ready');
          return;
        }
        // Portable mode — does a per-user config exist yet?
        const s = await getPortableStatus();
        if (cancelled) return;
        setStatus(s);
        setState(s.configured ? 'ready' : 'login-required');
      } catch {
        if (cancelled) return;
        // If we can't reach /health at all, fall through to 'ready' so the
        // existing app shell renders and its own error surfaces explain the
        // problem. Treating this as login-required would be misleading.
        setState('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markReady = useCallback((s: PortableStatusResponse) => {
    setStatus(s);
    setState('ready');
  }, []);

  return { state, portable, version, status, markReady };
}
