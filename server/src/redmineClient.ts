import { config } from './config.js';

/**
 * Thin typed wrapper around fetch() for Redmine REST. Injects the API key
 * server-side and never logs request bodies or the key itself.
 *
 * The browser does not import this. It only talks to /api/redmine/* on our
 * own proxy.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

export interface RedmineRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
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
  const url = new URL(`${config.redmineBaseUrl}${normalized}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function redmineFetch<T>(
  path: string,
  options: RedmineRequestOptions = {},
): Promise<T> {
  const { method = 'GET', query, body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const url = buildUrl(path, query);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'X-Redmine-API-Key': config.redmineApiKey,
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
