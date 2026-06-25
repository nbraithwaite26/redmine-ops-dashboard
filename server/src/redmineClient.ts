import { config, getRedmineCredentials } from './config.js';
import { getOrFetch } from './cache.js';

/**
 * Thin typed wrapper around fetch() for Redmine REST. Injects the API key
 * server-side and never logs request bodies or the key itself.
 *
 * The browser does not import this. It only talks to /api/redmine/* on our
 * own proxy.
 */

// Per-request upstream timeout. Reads `REDMINE_CLIENT_TIMEOUT_MS` via
// `config.redmine.timeoutMs`; default 15 s. Raise it for slow Redmine
// instances where writes contend with paginated reads.
const DEFAULT_TIMEOUT_MS = config.redmine.timeoutMs;

export interface RedmineRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
  /**
   * Opt this call into the shared server-side TTL cache (CR #29). Only GET
   * requests are cached; the option is ignored for non-GET methods.
   *
   * `key` should be a stable identifier for the (path, filters) tuple — by
   * convention `<route>:<sorted-filters>` (e.g. `gantt:project_id=127`).
   */
  cache?: {
    key: string;
    ttlMs: number;
    staleMs?: number;
  };
}

export class RedmineHttpError extends Error {
  status: number;
  redmineMessage: string | undefined;

  constructor(status: number, message: string, redmineMessage?: string) {
    super(message);
    this.name = 'RedmineHttpError';
    this.status = status;
    this.redmineMessage = redmineMessage;
  }
}

function buildUrl(path: string, query?: RedmineRequestOptions['query']): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const { baseUrl } = getRedmineCredentials();
  const url = new URL(`${baseUrl}${normalized}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function doRedmineFetch<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  query: RedmineRequestOptions['query'],
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  const url = buildUrl(path, query);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { apiKey } = getRedmineCredentials();
    const response = await fetch(url, {
      method,
      headers: {
        'X-Redmine-API-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      let redmineMessage: string | undefined;
      try {
        const errBody = (await response.json()) as { errors?: string[] };
        if (errBody?.errors?.length) redmineMessage = errBody.errors.join('; ');
      } catch {
        // ignore parse failures
      }
      throw new RedmineHttpError(
        response.status,
        `Redmine returned ${response.status} for ${method} ${path}`,
        redmineMessage,
      );
    }

    // Some Redmine endpoints (DELETE) may return empty body.
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function redmineFetch<T>(
  path: string,
  options: RedmineRequestOptions = {},
): Promise<T> {
  const {
    method = 'GET',
    query,
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cache,
  } = options;

  if (cache && method === 'GET') {
    return getOrFetch(
      cache.key,
      cache.ttlMs,
      () => doRedmineFetch<T>(path, method, query, body, timeoutMs),
      cache.staleMs !== undefined ? { staleMs: cache.staleMs } : {},
    );
  }

  return doRedmineFetch<T>(path, method, query, body, timeoutMs);
}
