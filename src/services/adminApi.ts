/**
 * Thin client for /api/auth/* and /api/admin/*. Lives outside the
 * redmineApi facade because admin is a real-only feature — there is no
 * useful mock equivalent for auth. `useSession()` short-circuits in mock
 * mode and never calls these.
 *
 * Every request sends cookies (same-origin via the Vite proxy) and never
 * carries any Redmine credentials in the browser.
 */

const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api/redmine').toString();

function authBase(): string {
  // VITE_API_BASE is normally `/api/redmine`. /api/auth lives alongside,
  // so trim the trailing `/redmine` segment.
  return API_BASE.replace(/\/redmine\/?$/, '');
}

const ROOT = authBase();

const MOCK_MODE =
  (import.meta.env.VITE_MOCK_MODE ?? 'true').toString().toLowerCase() !== 'false';

export interface BackendError {
  status: number;
  code: string | undefined;
  message: string;
  requestId: string | undefined;
}

export class AdminApiError extends Error implements BackendError {
  status: number;
  code: string | undefined;
  requestId: string | undefined;

  constructor(status: number, code: string | undefined, message: string, requestId?: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; requestId?: string };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${ROOT}${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let body: ErrorBody | null = null;
    try {
      body = (await res.json()) as ErrorBody;
    } catch {
      /* ignore */
    }
    throw new AdminApiError(
      res.status,
      body?.error?.code,
      body?.error?.message ?? `Request failed with status ${res.status}`,
      body?.error?.requestId,
    );
  }
  // Allow empty body responses.
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

// ─── Auth ────────────────────────────────────────────────────────────────

export interface SessionResponse {
  user: string | null;
}

export async function getSessionUser(): Promise<string | null> {
  try {
    const r = await request<SessionResponse>('/auth/me');
    return r.user;
  } catch (err) {
    if (err instanceof AdminApiError && err.status === 501) return null;
    throw err;
  }
}

export async function signIn(user: string, password: string): Promise<string> {
  const r = await request<{ user: string; loginAt: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ user, password }),
  });
  return r.user;
}

export async function signOut(): Promise<void> {
  await request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
}

// ─── Admin ───────────────────────────────────────────────────────────────

export interface AdminUserWire {
  id: number;
  name: string;
  email: string;
  login: string;
  status: 'Active' | 'Inactive';
  groups: string[];
  roles: string[];
}

export interface AdminUsersResponse {
  items: AdminUserWire[];
  total: number;
  limit: number;
  offset: number;
  degraded: boolean;
  degradedReason?: string;
}

export function getAdminUsers(params: { limit?: number; offset?: number } = {}) {
  if (MOCK_MODE) return Promise.resolve(mockAdminUsers(params));
  const q = new URLSearchParams();
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  const qs = q.toString();
  return request<AdminUsersResponse>(`/admin/users${qs ? `?${qs}` : ''}`);
}

export interface PermissionsRow {
  userId: number;
  userName: string;
  byProjectRoles: Record<number, string[]>;
}
export interface PermissionsResponse {
  projects: Array<{ id: number; name: string }>;
  rows: PermissionsRow[];
  total: number;
  limit: number;
  offset: number;
}

export function getAdminPermissions(params: { limit?: number; offset?: number } = {}) {
  if (MOCK_MODE) return Promise.resolve(mockAdminPermissions(params));
  const q = new URLSearchParams();
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  const qs = q.toString();
  return request<PermissionsResponse>(`/admin/permissions${qs ? `?${qs}` : ''}`);
}

export type HistoryKind = 'sync' | 'login' | 'all';

export interface HistoryEvent {
  kind: 'sync' | 'login';
  id: number;
  at: string;
  status: string;
  requestId: string;
  // sync-only:
  actor?: string;
  trigger?: string;
  durationMs?: number;
  errorMessage?: string;
  // login-only:
  user?: string;
  sourceIp?: string;
}

export interface HistoryResponse {
  items: HistoryEvent[];
  total: number;
  limit: number;
  offset: number;
}

export function getAdminHistory(params: {
  kind?: HistoryKind;
  status?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
} = {}) {
  if (MOCK_MODE) return Promise.resolve(mockAdminHistory(params));
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const qs = q.toString();
  return request<HistoryResponse>(`/admin/history${qs ? `?${qs}` : ''}`);
}

// ─── Sync event reporter ────────────────────────────────────────────────

export function postSyncEvent(payload: {
  trigger: string;
  status: 'success' | 'error';
  durationMs?: number;
  errorMessage?: string;
}): Promise<{ ok: boolean }> {
  if (MOCK_MODE) return Promise.resolve({ ok: true });
  return request<{ ok: boolean }>('/sync-events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Mock fabricators ────────────────────────────────────────────────────
// Used when VITE_MOCK_MODE=true (default in dev + Vitest). Lets the Admin
// page render without a running backend. Real builds set VITE_MOCK_MODE=false
// and these branches are skipped.

const MOCK_USERS: AdminUserWire[] = [
  { id: 1, name: 'Avery Stone',  login: 'astone',  email: 'astone@example.com',  status: 'Active',   groups: ['Engineering'],          roles: ['Manager']   },
  { id: 2, name: 'Blair Quinn',  login: 'bquinn',  email: 'bquinn@example.com',  status: 'Active',   groups: ['Engineering'],          roles: ['Developer'] },
  { id: 3, name: 'Casey Reed',   login: 'creed',   email: 'creed@example.com',   status: 'Active',   groups: ['Design'],               roles: ['Developer'] },
  { id: 4, name: 'Drew Patel',   login: 'dpatel',  email: 'dpatel@example.com',  status: 'Inactive', groups: [],                       roles: ['Reporter']  },
  { id: 5, name: 'Emerson Lee',  login: 'elee',    email: 'elee@example.com',    status: 'Active',   groups: ['QA'],                   roles: ['Developer'] },
];

const MOCK_PROJECTS = [
  { id: 101, name: 'Project A' },
  { id: 102, name: 'Project B' },
  { id: 103, name: 'Project C' },
];

function mockAdminUsers(params: { limit?: number; offset?: number }): AdminUsersResponse {
  const degraded = typeof localStorage !== 'undefined' && localStorage.getItem('rod.admin.mockDegraded') === '1';
  if (degraded) {
    return {
      items: [],
      total: 0,
      limit: params.limit ?? 25,
      offset: params.offset ?? 0,
      degraded: true,
      degradedReason:
        'Redmine /users endpoint is admin-only and the configured API key is not an admin. Members are available per-project instead.',
    };
  }
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return {
    items: MOCK_USERS.slice(offset, offset + limit),
    total: MOCK_USERS.length,
    limit,
    offset,
    degraded: false,
  };
}

function mockAdminPermissions(params: { limit?: number; offset?: number }): PermissionsResponse {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return {
    projects: MOCK_PROJECTS,
    rows: [
      { userId: 1, userName: 'Avery Stone', byProjectRoles: { 101: ['Manager'], 102: ['Manager'] } },
      { userId: 2, userName: 'Blair Quinn', byProjectRoles: { 101: ['Developer'], 103: ['Developer'] } },
      { userId: 3, userName: 'Casey Reed',  byProjectRoles: { 102: ['Developer'] } },
      { userId: 5, userName: 'Emerson Lee', byProjectRoles: { 101: ['Reporter'], 102: ['Developer'], 103: ['Developer'] } },
    ],
    total: MOCK_PROJECTS.length,
    limit,
    offset,
  };
}

const MOCK_HISTORY: HistoryEvent[] = [
  { kind: 'sync',  id: 1, at: '2026-05-26T08:15:03Z', status: 'success', requestId: 'req-001', actor: 'admin (mock)', trigger: 'manual', durationMs: 842 },
  { kind: 'login', id: 2, at: '2026-05-26T08:14:55Z', status: 'success', requestId: 'req-002', user: 'admin', sourceIp: '127.0.0.1' },
  { kind: 'sync',  id: 3, at: '2026-05-26T07:30:00Z', status: 'error',   requestId: 'req-003', actor: 'admin (mock)', trigger: 'scheduled', durationMs: 1204, errorMessage: 'Upstream 503 from Redmine' },
  { kind: 'login', id: 4, at: '2026-05-25T22:01:11Z', status: 'failure', requestId: 'req-004', user: 'admin', sourceIp: '127.0.0.1' },
  { kind: 'sync',  id: 5, at: '2026-05-25T16:45:20Z', status: 'success', requestId: 'req-005', actor: 'admin (mock)', trigger: 'manual', durationMs: 612 },
];

function mockAdminHistory(params: {
  kind?: HistoryKind;
  status?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}): HistoryResponse {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  let items = MOCK_HISTORY;
  if (params.kind && params.kind !== 'all') items = items.filter((e) => e.kind === params.kind);
  if (params.status) items = items.filter((e) => e.status === params.status);
  if (params.since) items = items.filter((e) => e.at >= params.since!);
  if (params.until) items = items.filter((e) => e.at <= params.until!);
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  };
}
