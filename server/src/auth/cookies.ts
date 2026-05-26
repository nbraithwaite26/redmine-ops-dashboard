import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

const COOKIE_NAME = 'rod_session';

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function sign(sessionId: string): string {
  const hmac = createHmac('sha256', config.admin.sessionSecret).update(sessionId).digest();
  return b64url(hmac);
}

export function buildCookieValue(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

export function verifyCookieValue(value: string): string | null {
  const dot = value.lastIndexOf('.');
  if (dot < 1) return null;
  const sessionId = value.slice(0, dot);
  const provided = value.slice(dot + 1);
  const expected = sign(sessionId);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? sessionId : null;
}

export function buildSetCookieHeader(
  sessionId: string,
  maxAgeSeconds: number,
): string {
  const value = buildCookieValue(sessionId);
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (config.admin.cookieSecure) attrs.push('Secure');
  return attrs.join('; ');
}

export function buildClearCookieHeader(): string {
  const attrs = [
    `${COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`,
  ];
  if (config.admin.cookieSecure) attrs.push('Secure');
  return attrs.join('; ');
}

export function readCookieFromHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === COOKIE_NAME) return rest.join('=');
  }
  return null;
}

export { COOKIE_NAME };
