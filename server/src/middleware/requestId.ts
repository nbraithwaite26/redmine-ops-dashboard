import type { MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';

/**
 * Attaches a request id to every request. Logged with each request line,
 * surfaced in error response bodies, and returned as the X-Request-Id
 * response header so clients can correlate.
 */
export const requestId = (): MiddlewareHandler => async (c, next) => {
  const id = c.req.header('x-request-id') ?? randomUUID();
  c.set('requestId', id);
  c.header('X-Request-Id', id);
  await next();
};
