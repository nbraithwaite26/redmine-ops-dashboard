/**
 * Frontend HTTP client. Talks to the backend proxy at VITE_API_BASE
 * (default `/api/redmine`), never to Redmine directly. The browser must
 * never see the X-Redmine-API-Key header — the backend injects it.
 */

const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api/redmine').toString();

export class HttpError extends Error {
  status: number;
  code: string | undefined;
  requestId: string | undefined;

  constructor(status: number, code: string | undefined, message: string, requestId?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export interface BackendErrorBody {
  error?: { code?: string; message?: string; requestId?: string };
}

async function parseError(res: Response): Promise<HttpError> {
  let body: BackendErrorBody | null = null;
  try {
    body = (await res.json()) as BackendErrorBody;
  } catch {
    /* ignore parse errors */
  }
  return new HttpError(
    res.status,
    body?.error?.code,
    body?.error?.message ?? `Request failed with status ${res.status}`,
    body?.error?.requestId,
  );
}

function buildUrl(path: string, query?: Record<string, string | number | undefined | null>): string {
  const trimmed = path.startsWith('/') ? path : `/${path}`;
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const url = `${base}${trimmed}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function httpGet<T>(
  path: string,
  query?: Record<string, string | number | undefined | null>,
): Promise<T> {
  const res = await fetch(buildUrl(path, query), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

/**
 * JSON-body request helper. Use for PATCH/POST/PUT/DELETE against the
 * backend proxy. Body is serialized as JSON; the response is parsed as
 * JSON unless empty (which returns `undefined as T`).
 */
export async function httpJson<T>(
  method: 'PATCH' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (!res.ok) throw await parseError(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
