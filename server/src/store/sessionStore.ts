import { randomBytes } from 'node:crypto';

export interface Session {
  id: string;
  user: string;
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const sessions = new Map<string, Session>();

export function createSession(user: string): Session {
  const id = randomBytes(24).toString('hex');
  const now = Date.now();
  const session: Session = {
    id,
    user,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): Session | null {
  const s = sessions.get(id);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    sessions.delete(id);
    return null;
  }
  return s;
}

export function refreshSession(id: string): Session | null {
  const s = getSession(id);
  if (!s) return null;
  s.expiresAt = Date.now() + SESSION_TTL_MS;
  return s;
}

export function destroySession(id: string) {
  sessions.delete(id);
}

export function maxAgeSeconds(): number {
  return Math.floor(SESSION_TTL_MS / 1000);
}
