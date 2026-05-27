import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import {
  ConfidentialClientApplication,
  CryptoProvider,
  type AuthorizationCodeRequest,
  type AuthorizationUrlRequest,
  type Configuration,
} from '@azure/msal-node';
import { config } from '../config.js';
import {
  createMsSession,
  destroyMsSession,
  getMsSession,
  saveMsSession,
} from '../auth/msSessionStore.js';
import type { AppEnv } from '../types/appVars.js';

/**
 * Microsoft Entra sign-in (MSAL Node, OAuth2 auth-code + PKCE). Adapted from
 * the ms-identity-node sample to Hono. Uses query response mode (not the
 * sample's FORM_POST) so the `SameSite=Lax` session cookie survives the
 * top-level redirect back without requiring HTTPS in local dev.
 *
 * Routes (mounted at /api/auth/ms):
 *   GET /signin   → redirect to the Entra authorize endpoint
 *   GET /redirect → auth-code callback; exchanges code, establishes session
 *   GET /me       → { enabled, authenticated, user }
 *   GET /signout  → clear session + redirect to the Entra logout endpoint
 */
const COOKIE = 'rod_msid';
const crypto = new CryptoProvider();

function msalConfig(): Configuration {
  return {
    auth: {
      clientId: config.msAuth.clientId,
      authority: config.msAuth.cloudInstance + config.msAuth.tenantId,
      clientSecret: config.msAuth.clientSecret,
    },
  };
}

const msAuth = new Hono<AppEnv>();

// Feature gate: when disabled, /me reports it (so the frontend skips the gate)
// and the auth endpoints 404.
msAuth.use('*', async (c, next) => {
  if (!config.msAuth.enabled) {
    if (c.req.path.endsWith('/me')) {
      return c.json({ enabled: false, authenticated: false, user: null });
    }
    return c.json({ error: { code: 'MS_AUTH_DISABLED', message: 'Microsoft sign-in is not enabled.' } }, 404);
  }
  await next();
});

msAuth.get('/signin', async (c) => {
  const session = createMsSession();
  const { verifier, challenge } = await crypto.generatePkceCodes();
  session.pkceVerifier = verifier;

  const successRedirect = c.req.query('redirect') || '/';
  const state = crypto.base64Encode(JSON.stringify({ successRedirect }));

  const authCodeUrlRequest: AuthorizationUrlRequest = {
    redirectUri: config.msAuth.redirectUri,
    scopes: [],
    state,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
  };
  // Stash the matching code request so /redirect can complete the exchange.
  session.authCodeRequest = {
    redirectUri: config.msAuth.redirectUri,
    scopes: [],
    state,
    code: '',
    codeVerifier: verifier,
  } as AuthorizationCodeRequest;
  saveMsSession(session);
  setCookie(c, COOKIE, session.id, {
    httpOnly: true,
    secure: config.msAuth.cookieSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 12 * 60 * 60,
  });

  const cca = new ConfidentialClientApplication(msalConfig());
  const url = await cca.getAuthCodeUrl(authCodeUrlRequest);
  return c.redirect(url);
});

msAuth.get('/redirect', async (c) => {
  const session = getMsSession(getCookie(c, COOKIE));
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!session || !session.authCodeRequest || !code) {
    return c.redirect('/?auth_error=session');
  }

  const cca = new ConfidentialClientApplication(msalConfig());
  if (session.tokenCache) cca.getTokenCache().deserialize(session.tokenCache);

  try {
    const tokenResponse = await cca.acquireTokenByCode({
      ...session.authCodeRequest,
      code,
    });
    session.tokenCache = cca.getTokenCache().serialize();
    session.account = tokenResponse.account ?? undefined;
    session.idTokenClaims = tokenResponse.idTokenClaims as Record<string, unknown>;
    session.isAuthenticated = true;
    saveMsSession(session);

    let successRedirect = '/';
    try {
      successRedirect = JSON.parse(crypto.base64Decode(state ?? '')).successRedirect ?? '/';
    } catch {
      // keep default
    }
    return c.redirect(successRedirect);
  } catch {
    return c.redirect('/?auth_error=token');
  }
});

msAuth.get('/me', (c) => {
  const session = getMsSession(getCookie(c, COOKIE));
  if (!session || !session.isAuthenticated) {
    return c.json({ enabled: true, authenticated: false, user: null });
  }
  const claims = session.idTokenClaims ?? {};
  return c.json({
    enabled: true,
    authenticated: true,
    user: {
      name: (claims.name as string | undefined) ?? session.account?.name ?? '',
      username:
        session.account?.username ?? (claims.preferred_username as string | undefined) ?? '',
    },
  });
});

msAuth.get('/signout', (c) => {
  destroyMsSession(getCookie(c, COOKIE));
  deleteCookie(c, COOKIE, { path: '/' });
  const base = `${config.msAuth.cloudInstance}${config.msAuth.tenantId}/oauth2/v2.0/logout`;
  const uri = config.msAuth.postLogoutRedirectUri
    ? `${base}?post_logout_redirect_uri=${encodeURIComponent(config.msAuth.postLogoutRedirectUri)}`
    : base;
  return c.redirect(uri);
});

export default msAuth;
