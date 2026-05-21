# Architecture

This document describes how the Redmine Operations Dashboard is structured
and how data flows. It is the document to read first when planning the live
Redmine integration.

## Stack

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

## Directory layout

```
src/
  main.tsx                  React entry; wraps App in HashRouter
  App.tsx                   Route declarations
  index.css                 Tailwind base + component utilities

  components/               Reusable building blocks
    AppShell.tsx              Lays out TopBar / Sidebar / SecondaryNav / RightPanel
    TopBar.tsx                Yellow header
    Sidebar.tsx               Vertical icon nav
    SecondaryNav.tsx          Filterable workspace list
    RightPanel.tsx            Announcements / Upcoming / Quick links / Activity
    DashboardCard.tsx         Metric card wrapper
    DonutChart.tsx            SVG donut
    IssueTable.tsx            Reusable issue table (search/sort/select/quick actions)
    QuickEditPopup.tsx        Small popup for fast ticket updates + time log
    TicketDrawer.tsx          Full slide-out ticket editor
    ResourceTimeline.tsx      Gantt-style allocation grid

  pages/                    Routes
    Home.tsx
    Dashboard.tsx
    MyTasks.tsx
    PastDue.tsx
    Projects.tsx
    ProjectBuilder.tsx
    ResourceManagement.tsx
    TimeTracking.tsx
    Reports.tsx
    Directory.tsx
    Settings.tsx

  data/mockData.ts          Generic mock users, projects, issues, time entries,
                            allocations, directory links, metadata
  services/redmineApi.ts    Async functions: every UI call goes through here
  types/redmine.ts          Domain TypeScript interfaces
  lib/format.ts             Date / priority / status helpers + isOverdue

  tests/                    Vitest suites
    setup.ts                  jest-dom import
    api.test.ts
    IssueTable.test.tsx
    QuickEditPopup.test.tsx
    TicketDrawer.test.tsx
    Dashboard.test.tsx
    SecondaryNav.test.tsx

.github/workflows/
  ci.yml                    Push/PR: typecheck + lint + tests + build
  deploy.yml                Push to main: build + deploy to GitHub Pages
```

## Data flow

```
UI component  ──►  src/services/redmineApi.ts  ──►  in-memory mock state
                                                     (src/data/mockData.ts seeds)
```

The whole app talks to **`redmineApi.ts`** — no component imports from
`mockData.ts` for its own data fetching. This is intentional: when you swap
the mock bodies for real `fetch` calls (or a backend proxy), the UI doesn't
change.

State that the UI mutates (issue updates, new time entries, new projects)
lives in module-scoped `let` variables inside `redmineApi.ts`. This makes
edits visible across pages within a session but reset on reload — fine for
demo / scaffold work.

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

## Going live with Redmine

When you're ready to talk to a real Redmine instance:

1. Stand up a **thin backend** (Express, Hono, or a serverless function) that
   accepts the same shape of requests this UI already makes, and forwards
   them to Redmine with the `X-Redmine-API-Key` header injected. This solves
   two problems at once:
   - The API key never reaches the browser.
   - You avoid the CORS errors Redmine emits on cross-origin requests.
2. Replace each function body inside `src/services/redmineApi.ts` with a
   `fetch('/api/…')` against your backend. Keep return shapes intact so the
   pages don't need to change.
3. Drop the in-memory `let issues = […]` lines — your backend (and Redmine)
   are now the source of truth.
4. Plug `getCurrentUser()` into your auth flow.
5. The Settings page already collects base URL + API key + mock mode toggle
   — wire those into your backend bootstrap.

If you want a faster path with no backend, you can also use a Redmine plugin
that allows CORS for your dashboard origin, *but you must accept that the
API key will live in client storage* — fine for an internal tool on a
trusted network, **not** appropriate for public hosting.

## Testing strategy

- **API tests** validate the mock service contract (what the UI relies on).
- **Component tests** target the high-leverage interactions — table sort/
  filter/select, opening drawers, save flows — not snapshots.
- **Page tests** confirm key wiring (tabs render, cards mount).

When you wire up live API calls, mock the network with `vi.mock(
'./services/redmineApi', …)` rather than introducing MSW, unless the
contract complexity grows enough to justify it.

## CI

Two workflows:
- **CI** (`ci.yml`) runs on every push and PR. Steps: install →
  `npm run typecheck` → `npm run lint` → `npm test` → `npm run build` →
  upload the build artifact.
- **Deploy** (`deploy.yml`) runs on push to `main`. It re-runs typecheck +
  tests + build with `VITE_BASE=/redmine-ops-dashboard/`, configures Pages,
  and deploys via `actions/deploy-pages@v4`.

Both workflows pin Node 20 and use `npm ci` for reproducibility.
