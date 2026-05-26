# Implementation status

Snapshot of the work executed against [`docs/INTEGRATION_PLAN.md`](./INTEGRATION_PLAN.md). Section numbers below match the plan's §9 implementation order.

Last updated: 2026-05-26 (Hours redesign + writes Wave 1+2).

## Section ledger

| Section | Plan ref | Status | Highlight |
| --- | --- | --- | --- |
| 4 — Phase 0 preflight | §4.1, §4.2 | ✅ done | Removed local `vite.config.d.ts`/`.js` shadows; bootstrapped `server/` workspace |
| 5 — Backend file layout | §5 | ✅ done | Hono app + zod env loader + read-only / request-id / rate-limit middleware + error handler |
| 6 — Read-only GET routes | §6 | ✅ done | `/me`, `/users`, `/projects` (+ detail + members), `/issues` (+ detail), `/time-entries`, `/metadata`, `/gantt`. snake → camel adapters; no write routes implemented |
| 7 — Frontend wiring | §7.1, §7.2, §7.5 | ✅ done | Vite proxy `/api` → `:8787`; `realRedmineApi.ts` replaced with HTTP; `useCurrentUser` hook; Home reflects real Redmine user + tasks + hours |
| 8 — Real-mode UI readiness | §7.8.1, §7.8.2, §7.8.3, §7.8.8 | ✅ done | Removed API-key input from Settings (security); pages hydrated via `useCurrentUser`; read-only TopBar badge + disabled Save buttons; metadata coordinator |
| 9 — Cache + last-sync | §7.4 / Step 9 | ✅ done | 60s/10s TTL cache; `syncWithRedmine` invalidates; "Last sync HH:MM" chip in TopBar; localStorage-persisted |
| 14a — Admin backend | §14.2, §14.3, §14.5 | ✅ done | bcryptjs login; HMAC-signed session cookie (HttpOnly+SameSite=Lax); JSONL history store; sync-event + login-event recording; `/api/auth/*` + `/api/admin/*` + `/api/sync-events`; 5/min/IP login rate-limit; generic AUTH_FAILED to prevent enumeration |
| 14b — Frontend login + guard | §14.4 | ✅ done | `useSession` hook; standalone `/login` page; `RequireAdmin` route guard; conditional Sidebar admin link; mock-mode session shortcut |
| 14c — Admin page tabs | §14.1 | ✅ done | Users / Permissions / History tabs in `Admin.tsx`; mock-mode fabricators in `adminApi.ts`; degraded-users banner; history kind/status/since/until filters; 9 new tests in `Admin.test.tsx` |
| 12 — UI polish | §7.8.11–13 | ✅ done | Last-sync chip (prior); custom-fields empty state in `TicketDrawer`; `today()` helper in `lib/format.ts` replaces real-mode `MOCK_TODAY` reads; Gantt shape left as-is per plan §7.8.11 |
| Sync-events wiring | §14.3 note | ✅ done | `AppShell.handleSync` POSTs `{ trigger, status, durationMs, errorMessage? }` to `/api/sync-events`; best-effort (catch + swallow). Mock mode short-circuits in `adminApi.postSyncEvent` |
| 10 — Write routes (backend) | §9 Step 10 | ✅ done | PATCH/POST/DELETE `/issues`; POST/PATCH/DELETE `/time-entries`. Zod allowlists; name→id resolution for status/priority/tracker/activity via per-route enum cache; Redmine 404/422 → NOT_FOUND/UPSTREAM_ERROR. 21 server tests cover the surface. |
| 11 — Frontend write paths | §7.7 | 🛠 in progress | `useIssueActions` (save/create/remove/comment/reparent/addSubtaskFor) + `useTimeEntryActions` (save/create/remove). Toasts + error-mapping. Read-only respected. **Wired:** QuickEdit + TicketDrawer Save; TicketDrawer Delete; AddTimeModal create; TimeTracking delete. **Pending:** Add subtask, comment post, reparent, time-entry edit, "+ New issue" CTA, list-optimistic refactor. |
| Hours redesign | plan §1 | ✅ done | Hours page replaced with user-card landing showing this-week + last-week sections. Drilldown: user → projects → tasks. Per-task "Log time" pre-seeds AddTimeModal. AddTimeModal rewritten: no user dropdown, dependent project→task dropdown, past-entries panel, status-bump from `New` → `In Progress` on first time log. `hoursAggregate.ts` + 19 unit tests; `Hours.test.tsx` + 4 tests; `AddTimeModal.test.tsx` + 4 tests. |
| 13 — Rate-limit production story | §6 Notes | ⏳ not started | Redis-backed `RateLimitStore` + `SessionStore` |
| 14 — Doc updates | §9 Step 14 | ✅ done | README / ARCHITECTURE / API rewritten to reflect the two-process app. Each new feature commit updates this status doc. |
| Phase G — Responsive sweep | refactor log | ⏳ not started | Sidebar overlay vs. push on narrow viewports, drawer full-width on mobile, card grid breakpoints, table horizontal-scroll, AddTimeModal mobile layout |
| 15 — Final validation | §9 Step 15 | ⏳ not started | After remaining §11 wiring + Phase G land. Flip `REDMINE_READ_ONLY=false`, smoke every mutation path against live Redmine. |

## File map (new since the plan started)

```
server/
  package.json
  tsconfig.json
  vitest.config.ts
  scripts/
    hash-password.mjs                 # generates ADMIN_PASSWORD_HASH for .env.local
  src/
    index.ts                          # Hono bootstrap, mounts everything
    config.ts                         # zod env loader (Redmine + admin)
    redmineClient.ts                  # X-Redmine-API-Key injection
    middleware/
      requestId.ts
      readOnly.ts                     # 403 READ_ONLY on non-GET when REDMINE_READ_ONLY=true
      errorHandler.ts                 # uniform { error: { code, message, requestId } }
      rateLimit.ts                    # process-local token bucket (20 req/s/IP)
      session.ts                      # session() + requireSession()
    auth/
      password.ts                     # bcrypt verify / hash
      cookies.ts                      # HMAC-signed session cookies
    store/
      sessionStore.ts                 # in-memory session map, 12h rolling
      historyStore.ts                 # JSONL append-only history (sync + login events)
    routes/
      me.ts, users.ts, projects.ts, issues.ts,
      timeEntries.ts, metadata.ts, gantt.ts
      auth.ts                         # /api/auth/me, /login, /logout
      syncEvents.ts                   # /api/sync-events (POST)
      admin/
        users.ts                      # /api/admin/users (degrades gracefully on 403)
        permissions.ts                # project × user × role matrix
        history.ts                    # filtered, paginated history
    adapters/
      user.ts, project.ts, issue.ts, timeEntry.ts, gantt.ts
    types/
      redmineDto.ts                   # snake_case
      normalized.ts                   # camelCase
      appVars.ts                      # shared Hono Variables shape
  test/
    setup.ts
    fixtures/                         # anonymized JSON: Project A, Test One, ...
    health.test.ts
    adapters.{user,project,issue,gantt}.test.ts
    routes.{me,issues}.test.ts
    routes.auth.test.ts
    routes.history.test.ts
    middleware.session.test.ts

src/
  services/
    http.ts                           # browser → /api/redmine/* (cookies, no Redmine key)
    adminApi.ts                       # browser → /api/auth + /api/admin + /api/sync-events
    realRedmineApi.ts                 # rewritten to use http.ts; TTL cache; metadata coordinator
  hooks/
    useCurrentUser.ts                 # /api/redmine/me hydration
    useReadOnly.ts                    # ConnectionStatus.readOnly hydration
    useSession.ts                     # /api/auth/me hydration + signIn/signOut
  components/
    RequireAdmin.tsx                  # route guard for /admin
  pages/
    Login.tsx                         # admin sign-in (standalone, no AppShell)
    Admin.tsx                         # placeholder until 14c
docs/
  IMPLEMENTATION_STATUS.md            # this file
.env.test                             # forces VITE_MOCK_MODE=true for Vitest
```

Files touched but not new (representative):

- `src/types/redmine.ts` — `ConnectionStatus.readOnly`; `TimeEntry.projectName?`
- `src/services/mockRedmineApi.ts` — returns `readOnly: false`
- `src/services/redmineApi.ts` — facade unchanged in surface; toggled via `VITE_MOCK_MODE`
- `src/components/{AppShell,TopBar,QuickEditPopup,TicketDrawer,Sidebar}.tsx` — read-only badge, last-sync chip, disabled Save when readOnly, conditional Admin link
- `src/pages/{Home,Dashboard,MyTasks,MyHours,Tasks,ResourceManagement,Settings}.tsx` — current-user hydration; Settings rewritten to drop API-key input
- `src/App.tsx` — `/login` + `/admin` routes
- `package.json` — `workspaces: ["server"]`; `dev:server`, `dev:all`, `test:server` scripts
- `vite.config.ts` — `server.proxy: /api → http://localhost:8787`; Vitest `include` scoped to `src/**`
- `.env.example` — server-side `REDMINE_*` + optional `ADMIN_*`; frontend `VITE_API_BASE` + `VITE_MOCK_MODE` (no `VITE_REDMINE_API_KEY`)
- `.gitignore` — `server/data/`, `server/test/.tmp-*`

## Security guardrails honored

- `.env.local` never committed; gitignored.
- Redmine API key never reaches the browser bundle (`VITE_REDMINE_API_KEY` line removed from `.env.example`).
- Every Redmine call goes through `/api/redmine/*` proxy; the backend injects `X-Redmine-API-Key`.
- Read-only middleware blocks every non-GET to `/api/redmine/*` when `REDMINE_READ_ONLY=true`. Verified live: PATCH/POST/DELETE → 403 `READ_ONLY`.
- Settings page no longer collects an API key.
- Admin login uses a generic error message regardless of "user wrong" vs. "password wrong" — no enumeration.
- Login route rate-limited 5/min/IP; rate-limit failures recorded in the history store.
- Session cookies are HttpOnly + SameSite=Lax; signed with HMAC-SHA256 keyed by `SESSION_SECRET`. `Secure` only when `COOKIE_SECURE=true` (production).
- History store path (`server/data/`) gitignored — no audit data leaks into the repo.
- All test fixtures use anonymized data (`Project A`, `Test One`, …); no real subjects/descriptions/emails.

## Validation matrix (last clean run)

| Command | Result |
| --- | --- |
| `npm run typecheck` (root) | pass |
| `npm --workspace server run typecheck` | pass |
| `npm run lint` | pass (3 pre-existing `react-hooks/exhaustive-deps` warnings, no errors) |
| `npm test` (frontend) | 34 files, 255 tests pass |
| `npm run test:server` | 10 files, 39 tests pass |
| `npm run build` | dist built (≈324 KB JS, 31 KB CSS gzipped) |

## How to run

```bash
# install once
npm install

# start backend on :8787 (loads .env.local)
npm --workspace server run start

# start frontend on :5173/:5174 (Vite proxies /api → :8787)
npm run dev

# both at once
npm run dev:all
```

Default dev admin credentials live in `.env.local` (not committed): `admin` / `admin`. Change with:

```bash
node server/scripts/hash-password.mjs '<your new password>'
# paste hash into ADMIN_PASSWORD_HASH in .env.local, restart backend
```

Flip mock mode by setting `VITE_MOCK_MODE=true` in `.env.local` and restarting Vite.

## Currently known limits

- **No write routes.** `realRedmineApi` throws `READ_ONLY_CLIENT` for `createIssue`/`updateIssue`/`addIssueComment`/`addSubtask`/`updateIssueHierarchy`/`deleteIssue`/`createTimeEntry`. The backend has no write endpoints yet. Section 10 + 11 add them.
- **`/api/admin/users` degrades.** The configured API key isn't a Redmine admin → `/users.json` returns 403; the backend returns `{ items: [], degraded: true, degradedReason }`. The Admin page (when built) must handle the degraded shape. Permissions tab works around this by deriving from per-project memberships.
- **Custom fields catalog is sampled.** `/custom_fields.json` is admin-only and 403s; `/api/redmine/metadata` derives the catalog from a small issue sample. Treat as a hint, not a schema.
- **`ResourceTimeline` still consumes three props** (`users`, `issues`, `allocations`). `getResourceAllocations` maps from `/api/redmine/gantt`. Per plan §7.8.11 this is acceptable as-is.
- **`MOCK_TODAY = 2026-05-21`** still referenced in `lib/format.ts`. Real-mode usages should be replaced with `new Date()` or gated on `VITE_MOCK_MODE`. Plan §7.8.13.
- **In-memory rate limit + session store** are single-process. Plan §13 documents the Redis upgrade path.
- **Sync events are best-effort.** The frontend's `syncWithRedmine` does not yet `POST /api/sync-events`. Wiring is one small change; left for the polish pass.

## Pointers for the next session

If picking up "Section 14c":
1. Add tabs to `src/pages/Admin.tsx` — Users / Permissions / History.
2. Reuse the API client already in `src/services/adminApi.ts` (`getAdminUsers`, `getAdminPermissions`, `getAdminHistory`).
3. Users tab must render the `degraded: true` empty-state with `degradedReason`.
4. History tab needs a kind filter (sync / login / all), date range, status filter, and pagination.
5. Tests: `src/tests/Admin.test.tsx` covering tab switching, degraded-users banner, filter wiring.

If picking up writes (Section 10):
1. Server: add PATCH/POST/DELETE handlers under `/api/redmine/issues`, `/issues/:id/comments`, `/issues/:id/subtasks`, `/issues/:id/parent`, `/time-entries`, with zod allowlists. They will still be blocked by `readOnly` middleware until `REDMINE_READ_ONLY=false`.
2. Frontend: extend `useIssueEditor` with optimistic-update + revert + toast (plan §7.7 / §7.8.7).
3. Disable affordances when `useReadOnly()` is true (already wired for QuickEdit + Drawer Save buttons; extend to new affordances).

All sections continue to honor the existing guardrails: no company data in the repo, anonymized fixtures, key only on the backend, mock mode preserved, brand and routes intact.
