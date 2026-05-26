import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession';

/**
 * Route guard for /admin. Redirects to /login when there's no session;
 * surfaces a small "admin disabled" notice when the backend has not been
 * configured with ADMIN_USER + ADMIN_PASSWORD_HASH + SESSION_SECRET.
 */
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading, adminDisabled } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <div className="p-6 text-sm text-ink-muted" data-testid="require-admin-loading">
        Checking session…
      </div>
    );
  }

  if (adminDisabled) {
    return (
      <div className="card p-5 max-w-xl space-y-2" data-testid="admin-disabled">
        <h2 className="font-semibold">Admin not configured</h2>
        <p className="text-sm text-ink-muted">
          The backend has not been started with <code>ADMIN_USER</code>,
          <code> ADMIN_PASSWORD_HASH</code>, and <code>SESSION_SECRET</code>.
          Add them to <code>.env.local</code> and restart the backend to
          enable the admin page.
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
}
