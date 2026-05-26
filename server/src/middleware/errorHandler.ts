import type { Context, MiddlewareHandler } from 'hono';
import { RedmineHttpError } from '../redmineClient.js';

/**
 * Single source of truth for error → JSON response shape. Always returns
 *   { error: { code, message, requestId } }
 * Never leaks Redmine response bodies, request bodies, or the API key.
 */
export const errorHandler = (): MiddlewareHandler => async (c, next) => {
  try {
    await next();
  } catch (err) {
    return respondWithError(c, err);
  }
};

export function respondWithError(c: Context, err: unknown) {
  const requestId = c.get('requestId') as string | undefined;

  if (err instanceof RedmineHttpError) {
    const code = `REDMINE_${err.status}`;
    return c.json(
      {
        error: {
          code,
          message: err.message,
          requestId,
        },
      },
      mapStatus(err.status),
    );
  }

  if (err instanceof Error && err.name === 'AbortError') {
    return c.json(
      {
        error: { code: 'REDMINE_TIMEOUT', message: 'Upstream timed out', requestId },
      },
      504,
    );
  }

  // Unknown shape — surface a generic 500 without echoing details.
  console.error('[server] unhandled error', { requestId, error: errorSafeString(err) });
  return c.json(
    {
      error: { code: 'INTERNAL', message: 'Internal server error', requestId },
    },
    500,
  );
}

function mapStatus(status: number): 400 | 401 | 403 | 404 | 502 | 504 {
  if (status === 401) return 401;
  if (status === 403) return 403;
  if (status === 404) return 404;
  if (status === 400 || status === 422) return 400;
  return 502;
}

function errorSafeString(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
