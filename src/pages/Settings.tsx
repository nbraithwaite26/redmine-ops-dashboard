import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Lock, Monitor, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { testConnection } from '../services/redmineApi';
import type { ConnectionStatus } from '../types/redmine';
import { useTheme } from '../hooks/useTheme';
import type { ThemeChoice } from '../hooks/useTheme';

const THEME_OPTIONS: Array<{ id: ThemeChoice; label: string; Icon: typeof Sun }> = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
];

const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api/redmine').toString();
const MOCK_MODE =
  (import.meta.env.VITE_MOCK_MODE ?? 'true').toString().toLowerCase() !== 'false';

export default function Settings() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [probing, setProbing] = useState(false);

  const probe = async () => {
    setProbing(true);
    try {
      setStatus(await testConnection());
    } finally {
      setProbing(false);
    }
  };

  useEffect(() => {
    void probe();
  }, []);

  const { theme, setTheme, effectiveTheme } = useTheme();

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-ink-muted">
          Connection status and appearance preferences. API keys are managed
          server-side and never exposed in the browser.
        </p>
      </div>

      <section className="card p-5 space-y-3" data-testid="appearance-section">
        <h2 className="font-semibold">Appearance</h2>
        <p className="text-sm text-ink-muted">
          Choose how the dashboard looks. <code>System</code> follows your OS
          and updates live; <code>Light</code> and <code>Dark</code> override that.
          You can also press <kbd className="px-1 py-0.5 text-xs border rounded">]</kbd>
          {' '}to flip between light and dark from anywhere in the app.
        </p>
        <div className="flex items-center gap-2">
          {THEME_OPTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              data-testid={`theme-option-${id}`}
              aria-pressed={theme === id}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm border transition',
                theme === id
                  ? 'bg-brand text-ink border-brand-500 font-medium'
                  : 'border-[color:var(--border-default)] hover:bg-subtle',
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        <div className="text-xs text-ink-muted" data-testid="effective-theme">
          Currently displaying: <span className="font-medium text-ink">{effectiveTheme}</span>
          {theme === 'system' && (
            <span className="ml-1">(from your OS)</span>
          )}
        </div>
      </section>

      <section className="card p-5 space-y-4" data-testid="connection-section">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Connection</h2>
          <button
            className="btn-secondary text-xs"
            onClick={probe}
            disabled={probing}
            data-testid="recheck-connection"
          >
            {probing ? 'Checking…' : 'Re-check'}
          </button>
        </div>

        <p className="text-sm text-ink-muted">
          The dashboard talks to a secure backend proxy that injects the
          Redmine API key on the server. The browser never sees the key.
        </p>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <Row label="Mode" testid="row-mode">
            {MOCK_MODE ? (
              <span className="pill-yellow">Mock data</span>
            ) : (
              <span className="pill-green">Live Redmine</span>
            )}
          </Row>
          <Row label="Backend endpoint" testid="row-api-base">
            <code className="text-xs">{API_BASE}</code>
          </Row>
          <Row label="Backend reachable" testid="row-backend">
            <Health ok={status?.connected === true || status?.mockMode === true} loading={!status} />
          </Row>
          <Row label="Redmine reachable" testid="row-redmine">
            <Health ok={status?.connected === true || status?.mockMode === true} loading={!status} />
          </Row>
          <Row label="Read-only mode" testid="row-read-only">
            {status?.readOnly ? (
              <span className="inline-flex items-center gap-1 pill-blue">
                <Lock size={12} /> Read-only
              </span>
            ) : (
              <span className="text-ink-muted">Writes allowed</span>
            )}
          </Row>
          <Row label="Current user" testid="row-current-user">
            <span className="font-medium text-ink">
              {status?.currentUser?.name ?? '—'}
            </span>
          </Row>
          <Row label="Last sync" testid="row-last-sync">
            <span className="text-ink-soft">{status?.lastSync ?? 'Never'}</span>
          </Row>
          <Row label="Message" testid="row-message" wide>
            <span className="text-ink-soft">{status?.message ?? 'Loading…'}</span>
          </Row>
        </dl>
      </section>

      <section className="card p-5 text-sm space-y-2">
        <h2 className="font-semibold">How this works</h2>
        <ul className="list-disc pl-5 space-y-1 text-ink-soft">
          <li>
            The API key lives only in <code>.env.local</code> on the backend
            host (gitignored). The browser never receives it.
          </li>
          <li>
            Every request goes through <code>{API_BASE}/*</code> → backend
            proxy → Redmine. CORS and credentials stay server-side.
          </li>
          <li>
            <code>REDMINE_READ_ONLY=true</code> in backend env blocks every
            non-GET request with <code>403 READ_ONLY</code>.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Row({
  label,
  children,
  testid,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  testid?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined} data-testid={testid}>
      <dt className="text-xs text-ink-muted mb-1">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Health({ ok, loading }: { ok: boolean; loading: boolean }) {
  if (loading) return <span className="text-ink-muted">Checking…</span>;
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 text-green-700">
        <CheckCircle2 size={14} /> OK
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-red-700">
      <AlertCircle size={14} /> Unreachable
    </span>
  );
}
