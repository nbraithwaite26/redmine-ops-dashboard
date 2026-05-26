# Implementation status

Snapshot of the work executed against [`docs/INTEGRATION_PLAN.md`](./INTEGRATION_PLAN.md). Section numbers below match the plan's §9 implementation order.

Last updated: 2026-05-26 (Phase 2 + 3 complete — writes fan-out, list-optimistic, custom fields, path cleanup).

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
| 11 — Frontend write paths | §7.7 | ✅ done | `useIssueActions` (save/create/remove/comment/reparent/addSubtaskFor) + `useTimeEntryActions` (save/create/remove). Toasts + error-mapping. Read-only respected throughout. All affordances wired: QuickEdit + TicketDrawer Save, TicketDrawer Delete + Add subtask + Post comment, AddTimeModal create + edit, TimeTracking delete + edit, CreateIssueModal launched from the Tasks page header. Parent pages (Tasks/MyTasks/Dashboard) use list-optimistic updates — no `load()` re-fetch on every mutation. |
| Hours redesign | plan §1 | ✅ done | Hours page replaced with user-card landing showing this-week + last-week sections. Drilldown: user → projects → tasks. Per-task "Log time" pre-seeds AddTimeModal. AddTimeModal rewritten: no user dropdown, dependent project→task dropdown, past-entries panel, status-bump from `New` → `In Progress` on first time log. `hoursAggregate.ts` + 19 unit tests; `Hours.test.tsx` + 4 tests; `AddTimeModal.test.tsx` + 5 tests. |
| 12 polish — custom fields write | plan §7.8 | ✅ done | TicketDrawer CustomFields section becomes editable when `!readOnly`. Type-aware inputs (text / number / checkbox). Backend PATCH allowlist gains `customFields[]` mapped to Redmine snake_case `custom_fields` with string-coerced values. |
| Cleanup batch | scope #18, #19, #20, #21 | ✅ done | HISTORY_DB resolves against repo root (no more `server/server/data/`). `#/my-tasks?id=...` links → `#/tasks?id=...`. `?id=` on `/tasks` auto-opens the drawer once per visit. Orphaned `MyHours.tsx` + `TeamHours.tsx` deleted (redirects in `App.tsx` cover legacy bookmarks). |
| 13 — Rate-limit production story | §6 Notes | ⏳ not started | Redis-backed `RateLimitStore` + `SessionStore`. Currently in-memory single-process. Toggle behind `REDIS_URL` env var when added. |
| 14 — Doc updates | §9 Step 14 | ✅ done | README / ARCHITECTURE / API rewritten to reflect the two-process app. Each new feature commit updates this status doc. |
| 15 (sub) — users/:id/projects endpoint | scope #15 | ❌ skipped | Reconsidered after Hours shipped. The Hours card requirement is "projects under their tasks" — derive-from-tasks already gives that semantic. A memberships endpoint would surface projects with 0 tasks (noise). Not implementing. |
| Phase G — Responsive sweep | refactor log | ⏳ not started | Sidebar overlay vs. push on narrow viewports, drawer full-width on mobile, card grid breakpoints, table horizontal-scroll, modal mobile layout |
| 15 — Final validation | §9 Step 15 | ⏳ not started | After Phase G lands. Flip `REDMINE_READ_ONLY=false`, smoke every mutation path against live Redmine. |

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
    routes.{me,issues,timeEntries,auth,history}.test.ts
    middleware.session.test.ts

src/
  services/
    http.ts                           # browser → /api/redmine/* (cookies, no Redmine key)
                                      #   gains httpJson() for PATCH/POST/PUT/DELETE
    adminApi.ts                       # browser → /api/auth + /api/admin + /api/sync-events
    realRedmineApi.ts                 # rewritten to use http.ts; TTL cache; metadata coordinator
                                      #   full write surface (issues + time entries)
  hooks/
    useCurrentUser.ts                 # /api/redmine/me hydration
    useReadOnly.ts                    # ConnectionStatus.readOnly hydration
    useSession.ts                     # /api/auth/me hydration + signIn/signOut
    useToasts.ts                      # useSyncExternalStore subscription to toast store
    useIssueActions.ts                # save / create / remove / comment / reparent / addSubtaskFor
    useTimeEntryActions.ts            # save / create / remove for /time-entries
  lib/
    toast.ts                          # module-level toast store (push / dismiss / clear)
    hoursAggregate.ts                 # weekRange + per-user/per-project aggregation helpers
  components/
    RequireAdmin.tsx                  # route guard for /admin
    ToastHost.tsx                     # bottom-right toast renderer (mounted in AppShell)
    CreateIssueModal.tsx              # "New issue" dialog launched from Tasks header
    UserHoursCard.tsx                 # Hours: user-level card with project drilldown
    ProjectHoursRow.tsx               # Hours: project row inside a user card
    TaskHoursRow.tsx                  # Hours: task row with inline Log time
    UserHoursSection.tsx              # Hours: "this week" / "last week" wrapper
  pages/
    Login.tsx                         # admin sign-in (standalone, no AppShell)
    Admin.tsx                         # Users / Permissions / History tabs
    Hours.tsx                         # rewritten as user-cards landing
docs/
  IMPLEMENTATION_STATUS.md            # this file
.env.test                             # forces VITE_MOCK_MODE=true for Vitest
```

Files touched but not new (representative):

- `src/types/redmine.ts` — `ConnectionStatus.readOnly`; `TimeEntry.projectName?`
- `src/services/mockRedmineApi.ts` — read-only=false; full write surface; getTimeEntries filters
- `src/services/redmineApi.ts` — facade unchanged in surface; toggled via `VITE_MOCK_MODE`
- `src/components/AppShell.tsx` — read-only badge, last-sync chip, sync-events POST, ToastHost mount
- `src/components/{TopBar,QuickEditPopup,TicketDrawer,Sidebar}.tsx` — read-only badge / disabled Save / wired writes / editable custom fields
- `src/components/AddTimeModal.tsx` — dropped user dropdown; dependent task dropdown; past-entries panel; pre-seeding; status-bump; edit mode
- `src/pages/{Home,Dashboard,MyTasks,Tasks,ResourceManagement,Settings}.tsx` — current-user hydration; list-optimistic updates; Settings rewritten to drop API-key input
- `src/pages/{Hours,TimeTracking}.tsx` — Hours page rewritten; TimeTracking gains inline edit
- `src/App.tsx` — `/login` + `/admin` routes; `/hours/me`/`/hours/team` redirects to `/hours`
- `src/lib/format.ts` — `today()` helper alongside `MOCK_TODAY` for real-mode date math
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
| `npm run lint` | pass (2 pre-existing `react-hooks/exhaustive-deps` warnings, no errors) |
| `npm test` (frontend) | 42 files, 308 tests pass |
| `npm run test:server` | 11 files, 62 tests pass |
| `npm run build` | dist built (≈358 KB JS, 33 KB CSS; gzip 101 / 7 KB) |

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

- **`/api/admin/users` degrades.** The configured API key isn't a Redmine admin → `/users.json` returns 403; the backend returns `{ items: [], degraded: true, degradedReason }`. The Admin page's Users tab renders the degraded banner instead of an empty list. Permissions tab derives from per-project memberships and works around it.
- **Custom fields catalog is sampled.** `/custom_fields.json` is admin-only and 403s; `/api/redmine/metadata` derives the catalog from a small issue sample. Treat as a hint, not a schema. Editing custom fields per-issue (write-through) works regardless because the PATCH route accepts `{ id, value }` pairs without consulting the catalog.
- **`ResourceTimeline` still consumes three props** (`users`, `issues`, `allocations`). `getResourceAllocations` maps from `/api/redmine/gantt`. Per plan §7.8.11 this is acceptable as-is.
- **In-memory rate limit + session store** are single-process. Plan §13 documents the Redis upgrade path.
- **Project due date is derived.** Redmine's `/projects.json` doesn't return a due date. The Hours card uses the **latest task dueDate** in the project as a stand-in. Tooltipped on the column header so users know.
- **Per-user weekly target is hardcoded to 40h.** No backend field exists yet. Once one does, swap the constant in `hoursAggregate`.
- **`ResourceTimeline` still reads `MOCK_TODAY`** indirectly via `today()`. In real mode `today()` returns `new Date()`, so this is functionally correct — just noting the wiring.

## Pointers for the next session

If picking up Phase G (responsive sweep):
1. Sidebar already overlays below `md` (Tailwind 768px). Confirm behavior at 360 / 414 / 768 / 1024 / 1280.
2. Drawer (`TicketDrawer`) is currently `w-[640px]` — needs `w-full sm:w-[640px]` for mobile.
3. AddTimeModal and CreateIssueModal are `w-[640px] max-w-[95vw]` — already responsive. Verify the past-entries panel on small screens.
4. `IssueTable` is wrapped in `overflow-x-auto` but the columns are 12-wide; consider hiding ID + project columns below `sm`.
5. Hours user cards are vertical stacks — already mobile-friendly.

If picking up Redis (Section 13):
1. Add `ioredis` to `server/package.json`.
2. Toggle by `REDIS_URL` env var. Fallback to in-memory when unset (zero behavior change for dev).
3. `server/src/store/sessionStore.ts` and `server/src/middleware/rateLimit.ts` are the two consumers.

If picking up Section 15 (final validation):
1. Flip `REDMINE_READ_ONLY=false` in `.env.local`. Restart backend.
2. Smoke each mutation path end-to-end: update issue, create issue, delete issue, comment, subtask, reparent, log time, edit time, delete time.
3. Watch the History tab in Admin — sync events should land.

All sections continue to honor the existing guardrails: no company data in the repo, anonymized fixtures, key only on the backend, mock mode preserved, brand and routes intact.
