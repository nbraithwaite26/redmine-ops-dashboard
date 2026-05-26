import type { MiddlewareHandler } from 'hono';
import { readCookieFromHeader, verifyCookieValue } from '../auth/cookies.js';
import { getSession, refreshSession } from '../store/sessionStore.js';
import type { AppEnv } from '../types/appVars.js';

/**
 * Reads the session cookie if present and attaches { user } to the
 * context. Does NOT reject unauthenticated requests — pair with
 * requireSession() for routes that need auth.
 */
export const session = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const cookieValue = readCookieFromHeader(c.req.header('cookie'));
  if (cookieValue) {
    const sessionId = verifyCookieValue(cookieValue);
    if (sessionId) {
      const s = (await refreshSession(sessionId)) ?? (await getSession(sessionId));
      if (s) c.set('sessionUser', s.user);
    }
  }
  await next();
};

/**
 * Hard gate: 401 if no session attached by the session() middleware.
 */
export const requireSession = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const user = c.get('sessionUser');
  if (!user) {
    return c.json(
      {
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Sign in required.',
          requestId: c.get('requestId'),
        },
      },
      401,
    );
  }
  await next();
};
