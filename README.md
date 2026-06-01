# Redmine Operations Dashboard

A modern enterprise dashboard UI for Redmine, inspired by ServiceNow-style operations workspaces and the Studio-style app launcher. Brand color is `#FEDF00` (bright yellow) on the header and sidebar, with a clean light-canvas main area.

The repository ships a **frontend** (Vite + React + TypeScript) and a **Hono backend** in a `server/` workspace. The backend proxies a real Redmine instance with the API key injected server-side, so the key never reaches the browser. The frontend can also run in `VITE_MOCK_MODE=true` for offline demos.

**Live demo:** https://nbraithwaite26.github.io/redmine-ops-dashboard/

**More docs:**
- [CHANGELOG.md](./CHANGELOG.md) — every change in this and future releases
- [docs/FEATURES.md](./docs/FEATURES.md) — feature checklist for every page and component
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — code layout, data flow, backend design
- [docs/API.md](./docs/API.md) — backend API surface (`/api/redmine`, `/api/auth`, `/api/admin`, `/api/sync-events`)
- [docs/ROADMAP.md](./docs/ROADMAP.md) — forward-looking plan (now / on-hold / later)
- [docs/CHANGE_REQUESTS.md](./docs/CHANGE_REQUESTS.md) — active CR backlog (shipped CRs and historical plans live under `docs/archive/`)

## Features

- App shell with yellow `#FEDF00` top bar and slim left sidebar
- Secondary searchable workspace navigation
- Operations-style dashboard with metric cards, donuts, tabs, and right-side utility panel
- Reusable issue table with search, sort, bulk select, quick edit, and row drawer
- Quick Edit popup for fast status/priority/assignee/time updates
- Slide-out Ticket Editor drawer with full field set
- Past Due tasks view with overdue highlighting
- Time Tracking page with summary cards and add/edit/delete entries
- Resource Management page with a Gantt-style allocation timeline
- Project Builder for assembling project + task hierarchy before pushing to Redmine
- Directory page mirroring the Studio-style grouped app list
- Settings page for backend connection + mock-mode toggle (no API-key input — the key lives only on the backend)
- Admin page with Users / Permissions / History tabs, cookie-backed sign-in, route guard, and sync-event audit trail
- Read-only middleware (`REDMINE_READ_ONLY=true`) blocks non-GET requests at the proxy layer; UI Save buttons are disabled accordingly
- Mock Redmine service (`VITE_MOCK_MODE=true`) for offline demos and tests
- Vitest + React Testing Library tests (frontend) + Vitest tests for the backend Hono routes
- GitHub Actions CI for typecheck + lint + tests + build, and a GH Pages deploy workflow

## Getting started

```bash
npm install          # installs both root + server workspace
npm run dev:all      # backend on :8787 + Vite frontend on :5173 (Vite proxies /api → :8787)
```

For offline demos with no backend, set `VITE_MOCK_MODE=true` in `.env.local` and run `npm run dev` alone — the frontend serves fabricated data.

### Configuring the backend

Copy `.env.example` to `.env.local` at the repo root and fill in:

- `REDMINE_BASE_URL` and `REDMINE_API_KEY` — your Redmine instance + a personal API key
- `REDMINE_READ_ONLY=true` to keep the proxy blocking writes (default)
- `ADMIN_USER`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` — enables the Admin page. Generate a hash with `node server/scripts/hash-password.mjs '<password>'` and paste the output. Default dev creds in `.env.example` are `admin`/`admin`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 |
| `npm run dev:server` | Backend only on :8787 |
| `npm run dev:all` | Both, concurrently |
| `npm --workspace server run start` | Backend only (no watch) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Frontend Vitest suite |
| `npm run test:server` | Backend Vitest suite |
| `npm run test:watch` | Frontend Vitest in watch mode |
| `npm run typecheck` | TypeScript type check (no emit) for the frontend |
| `npm --workspace server run typecheck` | Same for the backend |
| `npm run lint` | ESLint |

## Project structure

```
src/                         Frontend (Vite + React)
  App.tsx                    Router and top-level layout
  main.tsx                   Entry point
  index.css                  Tailwind base + component classes
  components/                Reusable building blocks
    AppShell.tsx               TopBar + Sidebar + RightPanel + sticky layout
    TopBar.tsx                 Yellow #FEDF00 top bar with search, sync, profile
    Sidebar.tsx                Vertical icon nav (collapsible)
    RightPanel.tsx             Announcements, Upcoming, Quick links, Recent activity
    StatusBanner.tsx           Mock-mode / read-only / sync banner under TopBar
    DashboardCard.tsx          Metric card; conic-gradient donut
    IssueTable.tsx + IssueRow  Issue table with search/sort/bulk select
    QuickEditPopup.tsx         Fast ticket edit popup
    TicketDrawer.tsx           Slide-out ticket editor (a11y dialog)
    ResourceTimeline.tsx       Gantt-style allocation timeline
    RequireAdmin.tsx           Route guard for /admin
  pages/                     Routes (Home, Dashboard, Tasks, Calendar, Hours, Directory,
                             AllProjects, Projects, Settings, Admin, Login, ...)
  hooks/                     useSession, useCurrentUser, useReadOnly, useTheme,
                             useSidebarCollapse, useSyncBanner, useAsyncResource, ...
  services/
    redmineApi.ts              Facade: switches to real or mock based on VITE_MOCK_MODE
    realRedmineApi.ts          HTTP client against /api/redmine/* (cache + metadata coordinator)
    mockRedmineApi.ts          In-memory mock for offline demos and tests
    adminApi.ts                /api/auth + /api/admin + /api/sync-events client
    http.ts                    Shared fetch helper
  data/mockData.ts           Anonymized fixtures
  types/redmine.ts           Domain types
  lib/format.ts              Formatting helpers + today() / MOCK_TODAY
  tests/                     Frontend Vitest + RTL suites

server/                      Backend (Hono on :8787)
  src/
    index.ts                   App bootstrap; mounts middleware + routes
    config.ts                  zod env loader (Redmine + admin + sessions)
    redmineClient.ts           X-Redmine-API-Key injection + RedmineHttpError
    middleware/                requestId, readOnly, errorHandler, rateLimit, session
    auth/                      bcrypt password verify, HMAC session-cookie signing
    store/                     in-memory session store + JSONL history store
    routes/
      me.ts, users.ts, projects.ts, issues.ts,
      timeEntries.ts, metadata.ts, gantt.ts   /api/redmine/* (GET-only)
      auth.ts                                  /api/auth/{me,login,logout}
      syncEvents.ts                            /api/sync-events (POST)
      admin/{users,permissions,history}.ts     /api/admin/* (requires session)
    adapters/                  snake_case Redmine DTO → camelCase domain
    types/                     redmineDto.ts (snake), normalized.ts (camel)
  test/                      Backend Vitest suites + anonymized fixtures
  scripts/hash-password.mjs  Generates ADMIN_PASSWORD_HASH for .env.local

.github/workflows/
  ci.yml                     Typecheck + lint + test + build on every push/PR
  deploy.yml                 GitHub Pages deploy on push to main
```

## Mock data

All names and emails in mock data are intentionally generic (`alex.morgan@example.com`, etc.). The UI references project names like "Aircraft Retrofit Planning" and "Customer Support Requests" as illustrative placeholders — no real internal data is included. Backend test fixtures use the same convention (`Project A`, `Test One`, …).

## How a request flows

```
Browser ──fetch /api/redmine/issues──► Vite dev proxy ──► Hono backend :8787
                                                            │
                                                            ├─ requestId middleware
                                                            ├─ readOnly middleware (blocks non-GET when REDMINE_READ_ONLY=true)
                                                            ├─ rateLimit (token bucket / IP)
                                                            ├─ /api/redmine route
                                                            └─ redmineClient ──HTTP+X-Redmine-API-Key──► Redmine
                                                                  │
                                                                  └─ snake_case DTO ─adapter─► camelCase domain ─► JSON
```

The Redmine API key never reaches the browser. The Settings page no longer collects one.

## Admin sign-in

`/admin` is gated by `RequireAdmin`. In real mode it requires a valid cookie-backed session minted at `/login`. In mock mode (`VITE_MOCK_MODE=true`) the session is fabricated so the page renders for demos.

Backend session cookies are HttpOnly + SameSite=Lax + HMAC-signed (`SESSION_SECRET`). `Secure` is set when `COOKIE_SECURE=true` (production). Login is rate-limited to 5/min/IP; failures are logged to the JSONL history store and surfaced in the Admin → History tab.

## Deployment (GitHub Pages)

This repo includes a `Deploy to GitHub Pages` workflow at `.github/workflows/deploy.yml`. After enabling Pages in repo settings (Source: GitHub Actions), every push to `main` builds and deploys.

The Vite config sets `base` to `/redmine-ops-dashboard/`. If you fork or rename the repo, override with `VITE_BASE=/new-name/`.

> **GitHub Pages on private repos** requires GitHub Pro, Team, or Enterprise. If Pages refuses to publish, either make the repo public or use Vercel/Netlify instead — they accept the same `dist/` output.

## Tech stack

**Frontend**
- React 18 + TypeScript (strict)
- Vite
- Tailwind CSS
- react-router-dom (hash router for static hosting)
- lucide-react for icons
- Vitest + React Testing Library

**Backend (`server/`)**
- Hono on Node 20+
- zod for env + payload validation
- bcryptjs + HMAC-SHA256 for session cookies
- JSONL append-only history store
- Vitest for route + adapter tests

GitHub Actions runs CI on every push/PR and deploys the frontend to GitHub Pages on push to `main`.
