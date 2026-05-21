import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Save, Wifi } from 'lucide-react';
import {
  getConnectionSettings,
  saveConnectionSettings,
  testConnection,
} from '../services/redmineApi';
import type { ConnectionSettings, ConnectionStatus } from '../types/redmine';

export default function Settings() {
  const [settings, setSettings] = useState<ConnectionSettings>({
    baseUrl: '',
    apiKey: '',
    mockMode: true,
  });
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setSettings(await getConnectionSettings());
      setStatus(await testConnection());
    })();
  }, []);

  const onTest = async () => {
    await saveConnectionSettings(settings);
    setStatus(await testConnection());
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await saveConnectionSettings(settings);
      setStatus(await testConnection());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">API Settings</h1>
        <p className="text-sm text-ink-muted">
          Connect this dashboard to your Redmine instance.
        </p>
      </div>

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">Redmine connection</h2>

        <label className="block text-sm">
          <span className="text-xs text-ink-muted">Redmine Base URL</span>
          <input
            className="settings-input"
            placeholder="https://redmine.example.com"
            value={settings.baseUrl}
            onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
          />
        </label>

        <label className="block text-sm">
          <span className="text-xs text-ink-muted">API Key</span>
          <input
            type="password"
            className="settings-input"
            placeholder="Your Redmine API access key"
            value={settings.apiKey}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
          />
          <div className="mt-1 text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded p-2 flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5" />
            <div>
              <strong>Security note:</strong> Do not ship a real API key in client-side
              code. In production, route Redmine calls through a backend or serverless proxy
              so the key isn't exposed and so CORS isn't a problem.
            </div>
          </div>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.mockMode}
            onChange={(e) => setSettings({ ...settings, mockMode: e.target.checked })}
          />
          <span>Mock data mode (no real Redmine calls)</span>
        </label>

        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={onTest}>
            <Wifi size={14} /> Test connection
          </button>
          <button className="btn-brand" onClick={onSave} disabled={saving}>
            <Save size={14} /> Save connection
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Sync status</h2>
        {status ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {status.connected || status.mockMode ? (
                <CheckCircle2 size={16} className="text-green-600" />
              ) : (
                <AlertCircle size={16} className="text-red-600" />
              )}
              <span>{status.message}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-ink-muted">Last sync</div>
                <div>{status.lastSync ?? 'Never'}</div>
              </div>
              <div>
                <div className="text-xs text-ink-muted">Current user</div>
                <div>{status.currentUser?.name ?? '—'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-ink-muted">Loading…</div>
        )}
      </section>

      <section className="card p-5 text-sm">
        <h2 className="font-semibold mb-2">Notes for live integration</h2>
        <ul className="list-disc pl-5 space-y-1 text-ink-soft">
          <li>Real Redmine REST API requires an <code>X-Redmine-API-Key</code> header. Don't
            send this from the browser.</li>
          <li>Add a thin backend service that injects the API key and exposes the same
            shape this UI already calls.</li>
          <li>Consider caching project / user / status metadata to keep dashboard loads
            snappy.</li>
        </ul>
      </section>

      <style>{`
        .settings-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #E5E7EB;
          border-radius: 0.375rem;
          font-size: 0.9rem;
        }
        .settings-input:focus {
          outline: none;
          border-color: #FEDF00;
          box-shadow: 0 0 0 3px rgba(254, 223, 0, 0.3);
        }
      `}</style>
    </div>
  );
}
