import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, LogIn } from 'lucide-react';
import { useSession } from '../hooks/useSession';

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();

  const next = params.get('next') ?? '/admin';
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // If already authenticated (e.g. revisiting /login), bounce to the
  // intended destination.
  useEffect(() => {
    if (!session.loading && session.user) navigate(next, { replace: true });
  }, [session.loading, session.user, next, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await session.signIn(user, password);
      navigate(next, { replace: true });
    } catch (err) {
      // useSession already set its own error; mirror it locally so we can
      // surface it next to the form.
      setSubmitError(session.error ?? (err instanceof Error ? err.message : 'Login failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (session.adminDisabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-canvas">
        <div className="card p-6 max-w-md space-y-2" data-testid="admin-disabled">
          <h1 className="text-xl font-semibold">Admin not configured</h1>
          <p className="text-sm text-ink-muted">
            The backend is missing <code>ADMIN_USER</code>,
            <code> ADMIN_PASSWORD_HASH</code>, or <code>SESSION_SECRET</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-canvas">
      <form
        onSubmit={onSubmit}
        className="card p-6 max-w-md w-full space-y-4"
        data-testid="login-form"
      >
        <div>
          <h1 className="text-xl font-semibold">Admin sign-in</h1>
          <p className="text-sm text-ink-muted">
            This is the dashboard's own admin login. It does not log you into
            Redmine.
          </p>
        </div>

        <label className="block text-sm">
          <span className="text-xs text-ink-muted">Username</span>
          <input
            className="input mt-1"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>

        <label className="block text-sm">
          <span className="text-xs text-ink-muted">Password</span>
          <input
            type="password"
            className="input mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {(submitError || session.error) && (
          <div
            className="text-xs text-red-700 bg-red-50 border border-red-100 rounded p-2 flex items-start gap-2"
            data-testid="login-error"
          >
            <AlertCircle size={14} className="mt-0.5" />
            <span>{submitError ?? session.error}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn-brand w-full justify-center"
          disabled={submitting || !user || !password}
        >
          <LogIn size={14} />
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
