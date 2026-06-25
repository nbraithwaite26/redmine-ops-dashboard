import { useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';
import { portableLogin, PortableAuthError } from '../services/portableAuth';
import type { PortableStatusResponse } from '../services/portableAuth';

interface Props {
  /** Called after a successful login so the gate can flip to 'ready'. */
  onLoggedIn: (status: PortableStatusResponse) => void;
}

/**
 * First-run login screen for CR #30 portable distribution.
 *
 * Collects the Redmine URL + user's own Redmine username + password,
 * sends them to /api/portable/login, then transitions the gate when
 * the backend has persisted the returned api_key. The password never
 * leaves this component — the server uses it once for Basic Auth and
 * does NOT write it to disk.
 */
type Mode = 'password' | 'apiKey';

export default function PortableLogin({ onLoggedIn }: Props) {
  const [mode, setMode] = useState<Mode>('password');
  const [redmineUrl, setRedmineUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === 'apiKey'
          ? await portableLogin({
              redmineUrl: redmineUrl.trim(),
              apiKey: apiKey.trim(),
            })
          : await portableLogin({
              redmineUrl: redmineUrl.trim(),
              username: username.trim(),
              password,
            });
      onLoggedIn({
        configured: true,
        redmineUrl: result.redmineUrl,
        login: result.login,
      });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="min-h-screen w-full bg-canvas px-4 py-10 text-ink"
      data-testid="portable-login"
    >
      <div className="mx-auto max-w-md">
        <div className="card overflow-hidden">
          <header className="border-b border-border-default bg-canvas/60 px-5 py-4">
            <h1 className="text-lg font-semibold">Connect to Redmine</h1>
            <p className="mt-1 text-xs text-ink-muted">
              First-time setup. Your Redmine URL and credentials are used once to
              fetch your API key, then your username and password are forgotten.
            </p>
          </header>

          <div className="flex border-b border-border-default px-5 pt-3 text-xs">
            <button
              type="button"
              onClick={() => setMode('password')}
              aria-pressed={mode === 'password'}
              data-testid="portable-login-mode-password"
              className={
                'px-3 py-2 -mb-px border-b-2 transition ' +
                (mode === 'password'
                  ? 'border-brand-500 text-ink font-medium'
                  : 'border-transparent text-ink-muted hover:text-ink')
              }
            >
              Sign in with password
            </button>
            <button
              type="button"
              onClick={() => setMode('apiKey')}
              aria-pressed={mode === 'apiKey'}
              data-testid="portable-login-mode-apikey"
              className={
                'px-3 py-2 -mb-px border-b-2 transition ' +
                (mode === 'apiKey'
                  ? 'border-brand-500 text-ink font-medium'
                  : 'border-transparent text-ink-muted hover:text-ink')
              }
            >
              I have an API key
            </button>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4 p-5">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">Redmine URL</span>
              <input
                type="url"
                placeholder="https://redmine.example.com"
                required
                autoFocus
                value={redmineUrl}
                onChange={(e) => setRedmineUrl(e.currentTarget.value)}
                className="rounded-md border border-border-default bg-surface px-3 py-2 text-sm text-ink outline-none focus:ring-1 focus:ring-brand-400"
                data-testid="portable-login-url"
              />
            </label>

            {mode === 'password' ? (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-ink-soft">Username</span>
                  <input
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.currentTarget.value)}
                    className="rounded-md border border-border-default bg-surface px-3 py-2 text-sm text-ink outline-none focus:ring-1 focus:ring-brand-400"
                    data-testid="portable-login-username"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-ink-soft">Password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    className="rounded-md border border-border-default bg-surface px-3 py-2 text-sm text-ink outline-none focus:ring-1 focus:ring-brand-400"
                    data-testid="portable-login-password"
                  />
                </label>
              </>
            ) : (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-soft">API key</span>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  value={apiKey}
                  onChange={(e) => setApiKey(e.currentTarget.value)}
                  className="rounded-md border border-border-default bg-surface px-3 py-2 font-mono text-xs text-ink outline-none focus:ring-1 focus:ring-brand-400"
                  data-testid="portable-login-apikey"
                  placeholder="40-character API key from your Redmine account page"
                />
                <span className="text-[11px] text-ink-muted">
                  Find it in Redmine under <em>My account → API access key → Show</em>.
                </span>
              </label>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-md border border-red-400 bg-red-500/10 px-3 py-2 text-xs text-red-600"
                data-testid="portable-login-error"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-brand mt-2 inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="portable-login-submit"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="border-t border-border-default bg-canvas/40 px-5 py-3 text-[11px] text-ink-muted">
            Your API key is stored locally in your Windows user profile only.
            Logging out clears it.
          </p>
        </div>
      </div>
    </main>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof PortableAuthError) {
    switch (err.code) {
      case 'INVALID_CREDENTIALS':
        return 'Username or password rejected by Redmine.';
      case 'UPSTREAM_UNREACHABLE':
        return 'Could not reach that Redmine URL. Check the URL and your network.';
      case 'UPSTREAM_NOT_FOUND':
        // The server-side message already names the URL we tried and
        // suggests the subpath fix — surface it verbatim.
        return err.message;
      case 'NO_API_KEY':
        return "Redmine didn't return an API key. Enable 'Enable REST web service' in your account preferences and try again.";
      case 'RATE_LIMITED':
        return 'Too many login attempts. Wait a minute and try again.';
      case 'BAD_REQUEST':
        return err.message || 'Check the form fields and try again.';
      case 'UPSTREAM_ERROR':
      default:
        return err.message || 'Redmine returned an error.';
    }
  }
  return err instanceof Error ? err.message : 'Login failed.';
}
