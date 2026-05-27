import { randomBytes } from 'node:crypto';
import type { AccountInfo, AuthorizationCodeRequest } from '@azure/msal-node';

/**
 * Server-side session state for the MSAL auth-code flow. Holds the PKCE
 * verifier + pending code request between the /signin and /redirect legs, then
 * the account + serialized token cache once authenticated. Keyed by the
 * `rod_msid` cookie.
 *
 * In-memory (like the ms-identity-node sample). Single-process only — a
 * multi-instance deploy would back this with Redis (see store/redisClient).
 */
export interface MsSession {
  id: string;
  pkceVerifier?: string;
  authCodeRequest?: AuthorizationCodeRequest;
  tokenCache?: string;
  account?: AccountInfo;
  idTokenClaims?: Record<string, unknown>;
  isAuthenticated: boolean;
  createdAt: number;
  expiresAt: number;
}

const TTL_MS = 12 * 60 * 60 * 1000;
const store = new Map<string, MsSession>();

export function createMsSession(): MsSession {
  const now = Date.now();
  const session: MsSession = {
    id: randomBytes(24).toString('hex'),
    isAuthenticated: false,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  store.set(session.id, session);
  return session;
}

export function getMsSession(id: string | undefined): MsSession | null {
  if (!id) return null;
  const session = store.get(id);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    store.delete(id);
    return null;
  }
  return session;
}

export function saveMsSession(session: MsSession): void {
  store.set(session.id, session);
}

export function destroyMsSession(id: string | undefined): void {
  if (id) store.delete(id);
}
