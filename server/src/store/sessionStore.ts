import { randomBytes } from 'node:crypto';
import { getRedis } from './redisClient.js';

export interface Session {
  id: string;
  user: string;
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_TTL_SEC = Math.floor(SESSION_TTL_MS / 1000);
const KEY_PREFIX = 'session:';

const memSessions = new Map<string, Session>();

interface StoredSession {
  user: string;
  createdAt: number;
}

function key(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

export async function createSession(user: string): Promise<Session> {
  const id = randomBytes(24).toString('hex');
  const now = Date.now();
  const session: Session = {
    id,
    user,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  const redis = await getRedis();
  if (redis) {
    const payload: StoredSession = { user, createdAt: now };
    await redis.set(key(id), JSON.stringify(payload), 'EX', SESSION_TTL_SEC);
  } else {
    memSessions.set(id, session);
  }
  return session;
}

export async function getSession(id: string): Promise<Session | null> {
  const redis = await getRedis();
  if (redis) {
    const raw = await redis.get(key(id));
    if (!raw) return null;
    try {
      const stored = JSON.parse(raw) as StoredSession;
      const ttl = await redis.ttl(key(id));
      const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : Date.now() + SESSION_TTL_MS;
      return { id, user: stored.user, createdAt: stored.createdAt, expiresAt };
    } catch {
      return null;
    }
  }
  const s = memSessions.get(id);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    memSessions.delete(id);
    return null;
  }
  return s;
}

export async function refreshSession(id: string): Promise<Session | null> {
  const redis = await getRedis();
  if (redis) {
    const exists = await redis.expire(key(id), SESSION_TTL_SEC);
    if (!exists) return null;
    return getSession(id);
  }
  const s = await getSession(id);
  if (!s) return null;
  s.expiresAt = Date.now() + SESSION_TTL_MS;
  return s;
}

export async function destroySession(id: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await redis.del(key(id));
    return;
  }
  memSessions.delete(id);
}

export function maxAgeSeconds(): number {
  return SESSION_TTL_SEC;
}

/** Test-only. */
export function __clearMemSessions() {
  memSessions.clear();
}
