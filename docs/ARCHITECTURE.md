# Architecture

This document describes how the Redmine Operations Dashboard is structured
and how data flows. The dashboard is a **two-process app**: a Vite/React
frontend and a Hono backend in the `server/` workspace. The backend
brokers every call to Redmine so the API key never reaches the browser.

## Stack

**Frontend**
- **React 18** with functional components and hooks.
- **TypeScript** (strict mode) for the whole codebase.
- **Vite** for dev server and production build.
- **Tailwind CSS** for styling, with a small set of `@layer components`
  utilities (`.card`, `.btn`, `.btn-brand`, `.pill-*`).
- **react-router-dom** with `HashRouter` so the same `dist/` works on
  GitHub Pages, Netlify, S3, and any other static host without server-side
  rewrites.
- **lucide-react** for icons.
- **Vitest** + **@testing-library/react** + **jest-dom** for tests.

**Backend (`server/`)**
- **Hono** on Node 20+.
- **zod** for env loading + request payload validation.
- **bcryptjs** for admin password hashing.
- **HMAC-SHA256** for signing session cookies.
- **Vitest** for route + adapter + middleware tests.

## Directory layout

```
src/                          Frontend
  main.tsx                    React entry; wraps App in HashRouter
  App.tsx                     Route declarations (incl. /login, /admin)
  index.css                   Tailwind base + component utilities + theme vars

  components/                 Reusable building blocks
    AppShell.tsx                TopBar + Sidebar + RightPanel + sticky layout
    TopBar.tsx                  Yellow #FEDF00 header; sync button; last-sync chip
    Sidebar.tsx                 Vertical icon nav (collapsible)
    RightPanel.tsx              Announcements / Upcoming / Quick links / Activity
    StatusBanner.tsx            Mock-mode / read-only / sync banner under TopBar
    DashboardCard.tsx           Metric card driven by DashboardMetric[]
    DonutChart.tsx              SVG donut (opt-in; default visual is conic-gradient)
    IssueTable.tsx + IssueRow   Issue table with search/sort/select/quick actions
    QuickEditPopup.tsx          Small popup for fast ticket updates + time log
    TicketDrawer.tsx            Slide-out ticket editor (a11y dialog)
    ResourceTimeline.tsx        Gantt-style allocation grid
    RequireAdmin.tsx            Route guard for /admin

  pages/                      Routes (Home, Dashboard, Tasks, Calendar, Hours,
                              Directory, AllProjects, Projects, Settings,
                              Admin, Login, ResourceManagement, ProjectBuilder, ...)

  hooks/
    useSession.ts               /api/auth/me + signIn/signOut (mock-mode shortcut)
    useCurrentUser.ts           /api/redmine/me hydration
    useReadOnly.ts              ConnectionStatus.readOnly hydration
    useTheme.ts                 light/dark toggle (system-aware)
    useSidebarCollapse.ts       persisted sidebar state
    useSyncBanner.ts            sync-status state machine
    useAsyncResource.ts         load-on-mount + reload helper
    useDialogA11y.ts            focus trap + ESC for dialogs

  services/
    redmineApi.ts               Facade — picks real vs. mock from VITE_MOCK_MODE
    realRedmineApi.ts           HTTP client + TTL cache + metadata coordinator
    mockRedmineApi.ts           In-memory fabricator (offline demos + tests)
    adminApi.ts                 /api/auth + /api/admin + /api/sync-events client
    http.ts                     Shared fetch helper for the Redmine proxy

  data/mockData.ts            Generic mock users, projects, issues, time entries
  types/redmine.ts            Domain TypeScript interfaces
  lib/format.ts               Date / priority / status helpers; MOCK_TODAY + today()

  tests/                      Frontend Vitest suites (35 files, 264 tests)

server/                       Backend (Hono on :8787)
  src/
    index.ts                    App bootstrap; mounts middleware + all routes
    config.ts                   zod env loader (Redmine + admin + session)
    redmineClient.ts            X-Redmine-API-Key injection + RedmineHttpError

    middleware/
      requestId.ts                stamps a UUID on every request for log correlation
      readOnly.ts                 403 READ_ONLY on non-GET to /api/redmine/* when
                                  REDMINE_READ_ONLY=true
      errorHandler.ts             uniform { error: { code, message, requestId } } shape
      rateLimit.ts                IP rate limit; Redis-backed when REDIS_URL is set, else process-local token bucket (default 20 req/s/IP, burst 40)
      session.ts                  session() + requireSession()

    auth/
      password.ts                 bcrypt verify / hash helpers
      cookies.ts                  HMAC-SHA256 signed session cookies (HttpOnly+SameSite=Lax)

    store/
      redisClient.ts              lazy ioredis singleton; null when REDIS_URL is unset
      sessionStore.ts             session store (12h rolling); Redis-backed when REDIS_URL is set, else in-memory Map
      historyStore.ts             JSONL append-only sync + login event store

    routes/
      me.ts                       /api/redmine/me
      users.ts                    /api/redmine/users + /:id
      projects.ts                 /api/redmine/projects (+ detail + members)
      issues.ts                   /api/redmine/issues (+ detail)
      timeEntries.ts              /api/redmine/time-entries
      metadata.ts                 /api/redmine/metadata (sampled custom fields)
      gantt.ts                    /api/redmine/gantt
      auth.ts                     /api/auth/{me,login,logout}
      syncEvents.ts               /api/sync-events (POST)
      admin/
        users.ts                    /api/admin/users (degrades gracefully on 403)
        permissions.ts              /api/admin/permissions (project × user × role)
        history.ts                  /api/admin/history (filtered, paginated)

    adapters/                   snake_case Redmine DTO → camelCase domain
    types/                      redmineDto.ts (snake), normalized.ts (camel),
                                appVars.ts (shared Hono Variables)

  test/                       Backend Vitest suites (10 files, 39 tests)
    fixtures/                   Anonymized JSON (Project A, Test One, ...)
  scripts/hash-password.mjs   Generates ADMIN_PASSWORD_HASH for .env.local

.github/workflows/
  ci.yml                      Push/PR: typecheck + lint + tests + build
  deploy.yml                  Push to main: build + deploy to GitHub Pages
```

## Data flow

```
Browser ─fetch /api/redmine/...─► Vite dev proxy ──► Hono backend :8787
                                                       │
                                                       ├─ requestId
                                                       ├─ readOnly (blocks non-GET when REDMINE_READ_ONLY=true)
                                                       ├─ rateLimit (token bucket / IP)
                                                       ├─ route handler
                                                       └─ redmineClient ─HTTP+X-Redmine-API-Key─► Redmine
                                                              │
                                                              └─ snake_case DTO ─adapter─► camelCase domain ─► JSON
```

Frontend pages never import `data/mockData.ts` directly for fetching. Every
call goes through the `services/redmineApi.ts` facade, which picks the
real HTTP client or the mock in-memory store based on `VITE_MOCK_MODE`.
This keeps the page code identical across modes.

### Metadata coordinator

`realRedmineApi.ts` consolidates all `/metadata` lookups (statuses, trackers,
priorities, time activities, custom fields) into a **single in-flight promise**
with a 5-minute TTL. First caller triggers `GET /api/redmine/metadata`;
subsequent callers await the same promise. `syncWithRedmine()` resets the
promise so the next read re-fetches. This avoids the four-parallel-requests
fan-out the prior design had.

### Auth + sync events

- `/api/auth/login` accepts `{ user, password }`, verifies against
  `bcrypt`(`ADMIN_PASSWORD_HASH`), and sets an HMAC-signed session cookie.
  Failures return a single generic `AUTH_FAILED` code so attackers can't
  enumerate valid usernames. Login is rate-limited to **5/min/IP** at the
  middleware layer; rate-limit hits are recorded in the history store.
- `/api/admin/*` requires a valid session cookie (`requireSession`
  middleware). 401 responses redirect the frontend to `/login`.
- `/api/sync-events` is **open** (no session required) — the actor falls
  back to `'anonymous'` when no session is present. The frontend's
  `AppShell.handleSync` POSTs success/error events here best-effort. The
  endpoint sits **outside** `/api/redmine/*` so the read-only middleware
  doesn't block it.

### Caching

`realRedmineApi.ts` wraps GETs in a TTL cache (60s default, 10s for
`/issues`). `syncWithRedmine()` blows the cache so the next fetches go to
the network. The frontend writes the timestamp to `localStorage` under
`redmine-ops:last-sync-at` so the "Last sync HH:MM" chip in the TopBar
persists across reloads.

### Session + rate-limit storage

Both stores have a Redis-backed branch and an in-memory fallback. The
backend reads `REDIS_URL` at startup:

- **Unset (default):** sessions live in a process-local `Map`; the rate
  limiter uses a process-local token bucket. Fine for a single-instance
  deploy; sessions reset on restart.
- **Set:** `server/src/store/redisClient.ts` lazily constructs an `ioredis`
  client. `sessionStore` uses `SET session:<id> <json> EX <ttl>` /
  `GET` / `EXPIRE` / `DEL`. The rate limiter uses a per-second fixed
  window via `INCR rl:<ip>:<sec>` with `EXPIRE`. Sessions survive restart
  and shard across backend instances behind a load balancer.

Connection errors are logged but never throw — a Redis outage degrades
silently to a single-instance behavior rather than taking down the
backend.

## Yellow brand color

`#FEDF00` is the brand. Tailwind exposes it as `bg-brand`, `text-brand`,
`border-brand`. A scale `brand-50 … brand-700` is defined for hover and
active states. Because pure yellow has poor contrast with white, all text
and icons on yellow surfaces use `text-ink` (`#111827`) or stronger.

Tokens (`tailwind.config.js`):
- `brand` / `brand-400` — base yellow `#FEDF00`
- `ink` — primary text `#111827`
- `ink-soft` — `#1F2937`
- `ink-muted` — `#4B5563`
- `canvas` — main workspace bg `#F5F7FA`

## Routing

`HashRouter` is used so URLs look like `…/redmine-ops-dashboard/#/dashboard`.
This sidesteps the need for a fallback rewrite on static hosts. If you move
to a host with rewrite support, replace `HashRouter` with `BrowserRouter` in
`src/main.tsx`.

The Vite `base` is `/redmine-ops-dashboard/` for GitHub Pages; override with
`VITE_BASE` at build time.

## Why the structure looks the way it does

- **`AppShell` wraps every route.** Top bar, sidebar, secondary nav, and
  right panel are always present, so we don't repeat them in each page.
- **`IssueTable`, `QuickEditPopup`, and `TicketDrawer` are shared.** The
  Dashboard, My Tasks, and Past Due pages all use the same components — the
  only difference is which `getIssues*` they call. This keeps the table's
  look and behavior consistent.
- **`DashboardCard` + `DonutChart` are decoupled.** Any page that wants a
  metric tile drops a `DashboardCard` and provides its own visual (donut,
  number, gauge, sparkline). The Time Tracking and Reports pages reuse
  them.
- **No global state library.** Each page owns its own `useState`/`useEffect`
  calls. If you find yourself sharing a lot of state across pages later
  (e.g. caching loaded issues), introduce React Query or Zustand at that
  point — not preemptively.

## Read-only vs. read-write

`REDMINE_READ_ONLY=true` (the default) is enforced at two layers:

1. **Backend middleware.** `middleware/readOnly.ts` returns
   `403 { error: { code: 'READ_ONLY' } }` for any non-GET hitting
   `/api/redmine/*`. PATCH/POST/DELETE never reach the route handlers.
2. **Frontend.** `useReadOnly()` reads the flag from `/api/redmine/me`'s
   `connectionStatus.readOnly`. Save buttons in `QuickEditPopup`,
   `TicketDrawer`, and Settings are `disabled` with a tooltip.

When the write endpoints land (Plan Section 10–11) they will exist behind
the middleware. Flipping `REDMINE_READ_ONLY=false` is the only deploy-time
change required to enable them.

## Testing strategy

- **Frontend** — Vitest + RTL. Component tests target high-leverage
  interactions (table sort/filter/select, opening drawers, save flows,
  tab switching) rather than snapshots. Tests run with
  `VITE_MOCK_MODE=true` (via `.env.test`) so they exercise the real
  facade against the mock client — no network required.
- **Backend** — Vitest. Route tests hit each Hono handler with a fake
  Redmine upstream (a small `app.use('*', mockHandler)` for each fixture).
  Adapter tests confirm the snake→camel mapping.
- **Anonymized fixtures only.** Both suites use `Project A`, `Test One`,
  `astone@example.com`, … — no real subjects or emails ever land in the
  repo.

When the frontend needs to mock a network module in a test, prefer
`vi.mock('./services/redmineApi', …)` over MSW unless contract
complexity grows enough to justify it.

## CI

Two workflows:
- **CI** (`ci.yml`) runs on every push and PR. Steps: install →
  `npm run typecheck` → `npm run lint` → `npm test` → `npm run build` →
  upload the build artifact.
- **Deploy** (`deploy.yml`) runs on push to `main`. It re-runs typecheck +
  tests + build with `VITE_BASE=/redmine-ops-dashboard/`, configures Pages,
  and deploys via `actions/deploy-pages@v4`.

Both workflows pin Node 20 and use `npm ci` for reproducibility.
