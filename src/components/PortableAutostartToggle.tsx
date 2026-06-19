import { useEffect, useState } from 'react';
import { Power } from 'lucide-react';
import {
  getAutostartStatus,
  setAutostartEnabled,
  type AutostartStatus,
} from '../services/portableAuth';

/**
 * "Start with Windows" toggle for the portable .exe (CR #30).
 *
 * Writes / removes
 *   HKCU\Software\Microsoft\Windows\CurrentVersion\Run\RedmineOpsDashboard
 * via the server's /api/portable/autostart endpoint. Hidden on non-
 * Windows hosts where the server reports `supported: false`.
 *
 * The component renders nothing while it's still fetching the initial
 * status so the toggle doesn't flash the wrong state.
 */
export default function PortableAutostartToggle() {
  const [status, setStatus] = useState<AutostartStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAutostartStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) {
    return error ? (
      <div className="text-xs text-red-600" data-testid="autostart-error">
        Couldn't load autostart status: {error}
      </div>
    ) : null;
  }

  if (!status.supported) {
    return (
      <div className="text-xs text-ink-muted" data-testid="autostart-unsupported">
        Autostart is a Windows-only feature.
      </div>
    );
  }

  async function toggle() {
    if (!status || pending) return;
    setPending(true);
    setError(null);
    try {
      const next = await setAutostartEnabled(!status.enabled);
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4" data-testid="autostart-toggle">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <Power size={14} />
          Start with Windows
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Launches the dashboard automatically when you sign in to Windows.
          Stored under HKCU&nbsp;Run — no admin required.
        </p>
        {status.enabled && status.registeredPath && (
          <p className="mt-1 break-all text-[11px] text-ink-muted">
            Registered: <code className="text-ink-soft">{status.registeredPath}</code>
          </p>
        )}
        {error && (
          <p className="mt-1 text-xs text-red-600" data-testid="autostart-error">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={status.enabled}
        aria-label="Start with Windows"
        onClick={toggle}
        disabled={pending}
        data-testid="autostart-switch"
        className={
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ' +
          (status.enabled ? 'bg-brand-500' : 'bg-border-default') +
          (pending ? ' opacity-60 cursor-wait' : ' cursor-pointer')
        }
      >
        <span
          className={
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition ' +
            (status.enabled ? 'translate-x-5' : 'translate-x-0.5')
          }
        />
      </button>
    </div>
  );
}
