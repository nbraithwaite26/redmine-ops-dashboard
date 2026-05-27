import { LogIn } from 'lucide-react';
import { startMsSignIn } from '../hooks/useMsAuth';

/**
 * Full-screen Microsoft sign-in gate, shown when MS auth is enabled and the
 * user is not yet authenticated.
 */
export default function MsSignIn() {
  const authError = new URLSearchParams(window.location.search).get('auth_error');

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-500/10 text-brand-600">
          <LogIn size={22} />
        </div>
        <h1 className="text-xl font-semibold text-ink">Aircraft Engineering Redmine</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Sign in with your Microsoft account to continue.
        </p>
        {authError && (
          <p className="mt-3 text-sm text-red-600">
            Sign-in didn&apos;t complete. Please try again.
          </p>
        )}
        <button
          type="button"
          onClick={startMsSignIn}
          className="btn-brand mt-6 w-full justify-center"
          data-testid="ms-signin-button"
        >
          <LogIn size={16} /> Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}
