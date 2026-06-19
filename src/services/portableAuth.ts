/**
 * Client-side wrapper around the portable-mode endpoints on the backend.
 *
 * Used only by the boot-time gate ([usePortableGate](../hooks/usePortableGate.ts))
 * and the first-run login page ([PortableLogin](../pages/PortableLogin.tsx)).
 * The rest of the app never talks to these routes — once a login has
 * persisted to disk, the regular `/api/redmine/*` proxy reads the api_key
 * server-side and the UI keeps using its normal facade.
 */

export interface HealthResponse {
  ok: boolean;
  mode?: 'read-only' | 'read-write';
  readOnly?: boolean;
  portable: boolean;
  /** Server build version (semver). Used by the topbar version chip. */
  version?: string;
}

export interface PortableStatusResponse {
  configured: boolean;
  redmineUrl?: string;
  login?: string;
  loggedInAt?: string;
}

export type PortableLoginInput =
  | { redmineUrl: string; username: string; password: string }
  | { redmineUrl: string; apiKey: string };

export interface PortableLoginSuccess {
  configured: true;
  redmineUrl: string;
  login: string;
  user: { id: number; login: string; name: string };
}

export interface PortableErrorPayload {
  error: {
    code:
      | 'BAD_REQUEST'
      | 'INVALID_CREDENTIALS'
      | 'UPSTREAM_UNREACHABLE'
      | 'UPSTREAM_NOT_FOUND'
      | 'UPSTREAM_ERROR'
      | 'NO_API_KEY'
      | 'RATE_LIMITED';
    message: string;
    requestId?: string;
  };
}

export class PortableAuthError extends Error {
  code: PortableErrorPayload['error']['code'];
  status: number;
  constructor(status: number, payload: PortableErrorPayload) {
    super(payload.error.message);
    this.name = 'PortableAuthError';
    this.status = status;
    this.code = payload.error.code;
  }
}

// `/api/redmine/health` is proxied by Vite in dev (`/api` prefix) and
// served directly by the same Hono app in the portable .exe. The
// alternative `/health` at the root works in production but Vite's
// proxy doesn't catch bare `/health` in dev. Using the /api/redmine one
// keeps both topologies covered with no proxy quirks.
const HEALTH_URL = '/api/redmine/health';
const STATUS_URL = '/api/portable/status';
const LOGIN_URL = '/api/portable/login';
const LOGOUT_URL = '/api/portable/logout';
const SHUTDOWN_URL = '/api/portable/shutdown';

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(HEALTH_URL, { credentials: 'same-origin' });
  if (!res.ok) {
    throw new Error(`/health returned ${res.status}`);
  }
  return (await res.json()) as HealthResponse;
}

export async function getPortableStatus(): Promise<PortableStatusResponse> {
  const res = await fetch(STATUS_URL, { credentials: 'same-origin' });
  if (!res.ok) {
    throw new Error(`/api/portable/status returned ${res.status}`);
  }
  return (await res.json()) as PortableStatusResponse;
}

export async function portableLogin(input: PortableLoginInput): Promise<PortableLoginSuccess> {
  const res = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    let payload: PortableErrorPayload | null = null;
    try {
      payload = (await res.json()) as PortableErrorPayload;
    } catch {
      // upstream error without JSON body
    }
    throw new PortableAuthError(
      res.status,
      payload ?? {
        error: { code: 'UPSTREAM_ERROR', message: `Login failed (${res.status}).` },
      },
    );
  }
  return (await res.json()) as PortableLoginSuccess;
}

export async function portableLogout(): Promise<void> {
  await fetch(LOGOUT_URL, { method: 'POST', credentials: 'same-origin' });
}

/**
 * Ask the portable .exe to terminate itself. The server returns 200
 * before exiting; this function resolves once that ack comes back. The
 * browser tab will then be talking to a dead server — caller decides
 * whether to leave it open or close it.
 */
export async function portableShutdown(): Promise<void> {
  await fetch(SHUTDOWN_URL, { method: 'POST', credentials: 'same-origin' });
}

const AUTOSTART_URL = '/api/portable/autostart';

export interface AutostartStatus {
  supported: boolean;
  enabled: boolean;
  registeredPath?: string;
  exePath: string;
}

export async function getAutostartStatus(): Promise<AutostartStatus> {
  const res = await fetch(AUTOSTART_URL, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`/api/portable/autostart returned ${res.status}`);
  return (await res.json()) as AutostartStatus;
}

export async function setAutostartEnabled(enabled: boolean): Promise<AutostartStatus> {
  const res = await fetch(AUTOSTART_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as PortableErrorPayload | null;
    throw new PortableAuthError(
      res.status,
      payload ?? {
        error: { code: 'UPSTREAM_ERROR', message: `Update failed (${res.status}).` },
      },
    );
  }
  return (await res.json()) as AutostartStatus;
}
