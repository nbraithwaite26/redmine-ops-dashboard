# API reference

The dashboard exposes its data through the Hono backend in `server/`. The
frontend never talks to Redmine directly — all traffic flows through the
backend, which injects `X-Redmine-API-Key` server-side.

This file covers the backend HTTP surface plus the thin frontend service
facade that wraps it.

---

## Cross-cutting

### Base path

The backend mounts under `/api` and is reached via the Vite dev proxy
(`vite.config.ts` proxies `/api → http://localhost:8787`) or whatever
reverse proxy you put in front of it in production.

### Error shape

Every non-2xx response has a uniform body:

```json
{ "error": { "code": "READ_ONLY", "message": "Writes are disabled.", "requestId": "0188fea1-..." } }
```

Codes used today:

| Code | When |
| --- | --- |
| `READ_ONLY` | Non-GET hit `/api/redmine/*` while `REDMINE_READ_ONLY=true` |
| `RATE_LIMITED` | Too many requests from this IP |
| `AUTH_FAILED` | Login mismatch (generic — covers both unknown user and wrong password) |
| `UNAUTHENTICATED` | Admin route hit without a valid session cookie |
| `NOT_FOUND` | Route not mounted |
| `BAD_REQUEST` | zod validation failed |
| `UPSTREAM_ERROR` | Redmine itself returned non-2xx |

Every request also carries an `X-Request-Id` header on the way in (or a
new UUID is minted if missing), and that ID appears in every error body
and every history-store entry. Use it to correlate logs.

### Read-only mode

`REDMINE_READ_ONLY=true` (default) makes `middleware/readOnly.ts` reject
any PATCH/POST/DELETE to `/api/redmine/*` with `403 READ_ONLY`. The
frontend reads this state from `/api/redmine/me` and disables Save buttons
accordingly. `/api/auth/*`, `/api/admin/*`, and `/api/sync-events` are
**not** affected — they sit alongside `/api/redmine`.

### Pagination

List endpoints accept `limit` (1–500, default varies) + `offset`
(default 0) and return:

```ts
{ items: T[]; total: number; limit: number; offset: number; ...extras }
```

---

## `/api/redmine/*` — Redmine proxy (currently GET-only)

All routes require the backend to have a valid `REDMINE_BASE_URL` and
`REDMINE_API_KEY` configured. Response bodies are normalized to camelCase
domain objects via the adapters in `server/src/adapters/`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/redmine/me` | Current user + `connectionStatus.readOnly` flag |
| GET | `/api/redmine/users` | List Redmine users (paginated) |
| GET | `/api/redmine/users/:id` | Single user |
| GET | `/api/redmine/projects` | List projects (paginated) |
| GET | `/api/redmine/projects/:id` | Project detail + enabled modules + trackers |
| GET | `/api/redmine/projects/:id/members` | Memberships → users/groups with roles |
| GET | `/api/redmine/issues` | List issues (paginated, supports `assigned_to_id`, `status_id`, `due_date`, `from`, `to`, ...) |
| GET | `/api/redmine/issues/:id` | Issue detail with children, relations, journals |
| GET | `/api/redmine/time-entries` | List time entries (supports `user_id`, `from`, `to`, `project_id`) |
| GET | `/api/redmine/metadata` | Bundled `{ statuses, trackers, priorities, timeActivities, customFields }` |
| GET | `/api/redmine/gantt` | Composite Gantt rows (issues + estimates + relations + overload flags) |

All GETs above route through the **server-side TTL cache** (CR #29) with
60s for lists, 10s for issue detail, and 5min for `/metadata`. The gantt
route also runs pagination in parallel (cap 4) after learning `total_count`
from page 0, and is the only route with SWR (5min stale window). Writes
(`PATCH/POST/DELETE` on `/issues` and `/time-entries`) invalidate the
matching prefixes: issue writes drop `issues:*` and `gantt:*`; time-entry
writes drop `time-entries:*`.

Cache admin (admin-session-gated, mounted under `/api/admin/_cache`):

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/admin/_cache/invalidate` | Clear everything. Returns `{ removed }`. |
| POST | `/api/admin/_cache/invalidate?prefix=…` | Clear keys starting with `prefix` (trailing `*` tolerated). |
| GET | `/api/admin/_cache/stats` | `{ hits, misses, staleHits, coalesced, evictions, rejectedTooLarge, size }` for debugging. |

---

## `/api/auth/*` — Admin session

The dashboard's own admin login (not a Redmine login).

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/api/auth/me` | — | `{ user: string \| null }`. Returns `null` if the cookie is missing/expired. Returns `501` if `ADMIN_USER`/`ADMIN_PASSWORD_HASH`/`SESSION_SECRET` are not configured. |
| POST | `/api/auth/login` | `{ user, password }` | Sets HttpOnly + SameSite=Lax + HMAC-signed session cookie. Returns `{ user, loginAt }`. Rate-limited 5/min/IP. Failures return generic `AUTH_FAILED`. |
| POST | `/api/auth/logout` | — | Clears the session cookie. `{ ok: true }`. |

Sessions are **in-memory and single-process**. Restarting the backend
invalidates every session. A Redis-backed `SessionStore` is planned for
production (Plan Section 13).

---

## `/api/admin/*` — Admin views (requires session)

All routes require a valid session cookie. 401 otherwise.

### `GET /api/admin/users`

Mirrors `/users.json`. Returns `{ items: AdminUser[], total, limit, offset, degraded, degradedReason? }`.

`degraded: true` means the configured API key isn't a Redmine admin —
`/users.json` returned 401/403. The handler swallows that and returns an
empty list with `degradedReason` so the UI can render a banner instead of
an error page. The Permissions tab works around this by deriving from
per-project memberships.

### `GET /api/admin/permissions`

Aggregates every `/projects/:id/memberships.json` the API key can see and
returns the project × user × role matrix:

```ts
{
  projects: Array<{ id: number; name: string }>;
  rows: Array<{ userId: number; userName: string; byProjectRoles: Record<number, string[]> }>;
  total: number; limit: number; offset: number;
}
```

Pagination is on **projects** (since that's where the upstream pagination
lives). Per-project 401/403 failures are swallowed individually so one
locked-down project doesn't kill the whole matrix.

### `GET /api/admin/history`

Reads the JSONL history store with filters:

| Query | Type | Notes |
| --- | --- | --- |
| `kind` | `'sync' \| 'login' \| 'all'` | Default `'all'` |
| `status` | string | Exact match (e.g. `'success'`, `'error'`, `'failure'`) |
| `since` | ISO-8601 | Inclusive lower bound on `at` |
| `until` | ISO-8601 | Inclusive upper bound on `at` |
| `limit` | int | 1–500, default 100 |
| `offset` | int | default 0 |

Returns `{ items: HistoryEvent[], total, limit, offset }` where each event is:

```ts
type HistoryEvent =
  | { kind: 'sync';  id; at; status; requestId; actor?; trigger?; durationMs?; errorMessage? }
  | { kind: 'login'; id; at; status; requestId; user?; sourceIp? }
```

---

## `/api/sync-events` — open POST

Sits **outside** `/api/redmine/*` so the read-only middleware doesn't
block it. No session required — the actor falls back to `'anonymous'`
when no session is present.

`POST /api/sync-events` with body:

```ts
{
  trigger: string;              // freeform; the frontend sends 'manual' or 'scheduled'
  status: 'success' | 'error';
  durationMs?: number;          // int, ≥0
  errorMessage?: string;        // ≤256 chars
}
```

Returns `{ ok: true }`. The event is appended to the JSONL history store
and shows up in `/api/admin/history?kind=sync`.

---

## Frontend service facade

UI code never calls `fetch` directly. Two facades sit between pages and
the backend:

### `src/services/redmineApi.ts`

Re-exports either `realRedmineApi` (HTTP against `/api/redmine/*`) or
`mockRedmineApi` (in-memory fixtures) based on `VITE_MOCK_MODE`. Surface:

| Function | Backend hit |
| --- | --- |
| `getCurrentUser()` | `GET /me` |
| `getConnectionSettings()` | derived from `/me` |
| `getProjects()` / `getProjectById(id)` / `getProjectMembers(id)` | `GET /projects` (+ detail + members) |
| `getIssues()` / `getMyIssues(userId?)` / `getIssueById(id)` | `GET /issues` (+ detail) |
| `getPastDueIssues(today?)` | `GET /issues?status_id=open&due_date=<=today` |
| `getTimeEntries()` / `getWeeklyHours(userId?)` / `getTeamHours()` | `GET /time-entries` |
| `getIssueStatuses()` / `getTrackers()` / `getPriorities()` / `getTimeActivities()` / `getCustomFields()` | `GET /metadata` (coordinated single fetch) |
| `getResourceAllocations()` | `GET /gantt` (mapped) |
| `getUsers()` | `GET /users` |
| `syncWithRedmine()` | invalidates the metadata coordinator + TTL cache |
| `createIssue` / `updateIssue` / `deleteIssue` / `addIssueComment` / `addSubtask` / `updateIssueHierarchy` / `createTimeEntry` / `updateTimeEntry` / `deleteTimeEntry` | **throws `READ_ONLY_CLIENT`** until Plan Section 10/11 lands |

### `src/services/adminApi.ts`

Wraps `/api/auth`, `/api/admin`, and `/api/sync-events`. Mock-mode
short-circuits (fabricated `AdminUsersResponse` / `PermissionsResponse` /
`HistoryResponse` / `{ ok: true }`) so the Admin page renders without a
backend during demos and tests.

| Function | Backend hit |
| --- | --- |
| `getSessionUser()` | `GET /auth/me` |
| `signIn(user, password)` | `POST /auth/login` |
| `signOut()` | `POST /auth/logout` |
| `getAdminUsers({ limit, offset })` | `GET /admin/users` |
| `getAdminPermissions({ limit, offset })` | `GET /admin/permissions` |
| `getAdminHistory({ kind, status, since, until, limit, offset })` | `GET /admin/history` |
| `postSyncEvent({ trigger, status, durationMs?, errorMessage? })` | `POST /sync-events` |

Errors surface as `AdminApiError` with `{ status, code, message, requestId }`.
