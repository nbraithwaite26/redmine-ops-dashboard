import type { MiddlewareHandler } from 'hono';
import { config } from '../config.js';

/**
 * When REDMINE_READ_ONLY=true (default), every non-GET request to
 * /api/redmine/* returns 403. This is the hard kill switch — even if a
 * write route exists, it cannot fire while this is set.
 */
export const readOnly = (): MiddlewareHandler => async (c, next) => {
  if (config.readOnly && c.req.method !== 'GET') {
    return c.json(
      {
        error: {
          code: 'READ_ONLY',
          message: 'Backend is in read-only mode. Writes are disabled.',
          requestId: c.get('requestId'),
        },
      },
      403,
    );
  }
  await next();
};
