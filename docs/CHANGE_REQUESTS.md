# Change Requests

Running log of UI changes the user has requested. These are **not yet
implemented** — they are collected here in the order received. When the user
gives the green light to start coding, a project scaffold plan (touched
files, dependencies between changes, new components/types, test impact,
commit sequence) will be drafted *before* any code is written.

Status legend:
- 📥 Collected, not yet planned
- 📝 Scaffold plan drafted, awaiting approval
- 🛠 In progress
- ✅ Shipped

---

## #29 — Speed up Redmine API pulls (server-side cache, parallel pagination, prefetch)

**Status:** 📝 Scaffold plan drafted (2026-05-28), awaiting approval

**Request:** The site is slow against live Redmine. The team **gantt** for
project 127 takes ~9s / 295 KB (Dashboard "Team" tab and Hours "Show team"
trigger it); other calls land at 1–3s. Each fresh tab / hard reload pays the
full cost because today's TTL cache lives in the **browser**
(`src/services/realRedmineApi.ts`) — the server (`redmineClient.ts`,
`routes/gantt.ts`) has no cache and walks pagination sequentially. Make the
common reads feel instant without waiting on the Phase D/E platform work.

**Why now:** no existing CR addresses this; HANDOFF flags it as a live-mode
pain point; the deferred Redis/SSE plan in ROADMAP "Later" phases solves the
same problem but is gated behind Entra SSO (Phase A) and isn't shipping soon.
This CR is the in-place version that runs on today's architecture.

**Proposed scope:**

1. **Server-side TTL cache layered over `redmineFetch`.** New
   `server/src/cache.ts` (in-memory `Map<key, { data, fetchedAt }>`, single
   process — Redis later per Phase D). Key = method + path + sorted query.
   Default TTLs: 60s lists, 10s issue detail; per-route overrides via the
   call site. Honors `Cache-Control: no-cache` from the proxy for force-refresh.
   **Mock mode uses the same cache** (per CR #29 Q5) so tests exercise the
   full cache path; `resetCache()` runs in `server/test/setup.ts` between tests.
2. **In-flight coalescing.** If a second request for the same key arrives
   while the first is pending, both await the same promise — no duplicate
   upstream calls when 3 browsers hit `/api/redmine/gantt?project_id=127`
   together.
3. **Parallel pagination in `routes/gantt.ts`.** Today the page loop is
   sequential (`for page = 0..MAX_PAGES`). After the first page returns
   `total_count`, fan out the remaining pages with bounded concurrency
   (e.g. 4 in flight). For a 295 KB / ~7-page payload this is the biggest
   single win on the cold path.
4. **Cache the derived Gantt rows**, not just the upstream `/issues.json`
   pages. `buildGanttRows()` is pure of the issues array — store the final
   `{ items, total }` under a per-filter-set key with a 60s TTL.
5. **Prefetch / warm on boot for the hot keys.** Three warm tasks (decided
   2026-05-28): (a) **team gantt for project 127**; (b) **full projects
   list, paginated to `total_count`** — no `limit=100` cap (one page from
   Redmine is fine when the count fits; otherwise the warmer walks pages
   the same way the gantt route does); (c) **the top-level `/issues` lists
   the Dashboard renders** (personal "Your Work" + team "Team's Work"
   queries). Metadata is **not** warmed — it's cached on first hit but
   doesn't justify a background refresh. On server start and on a
   configurable interval, fire those requests in the background so the
   first user hit is a cache hit. Failures log and back off; they never
   block startup.
6. **`stale-while-revalidate` semantics for warmed keys.** If a request lands
   on an entry past its TTL but within a `staleMs` window, return stale
   immediately and kick off a background refresh. Keeps perceived latency
   flat even when the warmer hasn't run recently.
7. **Frontend follow-through.** Drop the frontend TTL cache to a much
   shorter window (or remove the list-level cache entirely) once the
   server-side cache is authoritative — single source of truth for staleness.
   `syncWithRedmine()` calls a new `POST /api/redmine/_cache/invalidate`
   instead of just clearing the browser map.

**Out of scope (deferred to Phase D/E):**
- Redis-backed cache (single-process Map is fine on the single Azure App
  Service instance we're deploying to).
- SSE push of refresh events to connected browsers (clients can poll the
  cheap, now-warm endpoint).
- Per-user cache partitioning (single shared Redmine key today, so all
  cached payloads are tenant-wide — fine until Phase B).

**Acceptance:**
- Cold load of Dashboard "Team" tab on a fresh server: ≤ ~5s (parallel
  pagination should roughly halve the 9s).
- Warm load (within TTL, after prefetch has run): ≤ 500ms server side,
  observed end-to-end ≤ 1s.
- `npm test` green; new server tests cover cache hit/miss, in-flight
  coalescing, parallel pagination ordering, and the invalidate route.
- No regression in `REDMINE_READ_ONLY=true` behavior or in mock mode.
- Logs still redact keys/bodies (cache layer must not log request bodies).

### Scaffold plan

**New files**
| Path | Purpose |
| --- | --- |
| `server/src/cache.ts` | Generic in-memory TTL cache with in-flight coalescing + SWR. Exports `getOrFetch<T>(key, ttlMs, fetcher, opts?)`, `invalidate(prefix?)`, `stats()`. Bounded LRU (cap ~500 entries). No body/key logging. |
| `server/src/warmer.ts` | Boot-time + interval prefetch driver. Reads a static list of warm tasks (functions, not strings — keeps it type-safe), runs them on start with `Promise.allSettled`, then re-runs every `CACHE_WARM_INTERVAL_MS`. Backs off on `429`/`5xx`. |
| `server/src/routes/_cache.ts` | Tiny route group mounted at `/api/redmine/_cache`. `POST /invalidate` (admin or session-gated) clears the server cache; `GET /stats` returns hit/miss counts for debugging. |
| `server/test/cache.test.ts` | Unit tests: hit, miss, expiry, in-flight coalescing (one upstream call for N parallel callers), SWR (stale return + background refresh), LRU eviction. |
| `server/test/warmer.test.ts` | Warmer runs all tasks on boot; failure of one doesn't kill the others; interval re-runs them; backoff after upstream `5xx`. |
| `server/test/routes.cache.test.ts` | `POST /_cache/invalidate` clears the map; `GET /_cache/stats` shape. |

**Modified files**
| Path | Change |
| --- | --- |
| `server/src/redmineClient.ts` | Add an optional `cache?: { key: string; ttlMs: number; staleMs?: number }` field to `RedmineRequestOptions`. When present, route the call through `cache.getOrFetch`. Default behavior unchanged when omitted. |
| `server/src/routes/gantt.ts` | (a) Fetch page 0 to learn `total_count`. (b) Spawn the remaining pages with `Promise.all` and a bounded-concurrency helper (cap 4 in flight; sequential fallback if `total_count` is missing). (c) Cache the **derived** `{ items, total }` payload under key `gantt:<sorted-filters>` with `ttlMs=60_000`, `staleMs=5*60_000`. |
| `server/src/routes/issues.ts`, `routes/metadata.ts`, `routes/timeEntries.ts`, `routes/users.ts`, `routes/me.ts` | Opt each GET into the cache by passing `cache: { key, ttlMs }` to `redmineFetch`. TTLs: 60s lists, 10s detail, 5min metadata. Writes call `cache.invalidate('issues:*')` + `cache.invalidate('gantt:*')` / `'time-entries:*'` after success — replaces the frontend's `invalidateIssueCaches` pattern. |
| `server/src/routes/projects.ts` | Same cache opt-in, **plus paginate-to-`total_count`** (mirroring `gantt.ts`'s loop) for the warmed full-projects list — needed because the warmer is configured to walk all pages, not cap at `limit=100`. |
| `server/src/index.ts` | Mount `_cache` route group under `/api/redmine/_cache` (inside the readOnly group is fine — invalidate is POST but is internal). Start the warmer after `serve()` reports listening. |
| `server/src/config.ts` | Add `CACHE_ENABLED` (default `true`), `CACHE_WARM_INTERVAL_MS` (default `300_000`), `CACHE_LIST_TTL_MS` (default `60_000`), `CACHE_DETAIL_TTL_MS` (default `10_000`), `CACHE_SWR_MS` (default `300_000`). Expose as `config.cache.*`. |
| `src/services/realRedmineApi.ts` | Drop the list-endpoint TTL cache (lines ~164–230). Keep the metadata coordinator (still useful for browser-side dedup within a single page render). Update `syncWithRedmine()` to `POST /api/redmine/_cache/invalidate` then re-fetch active page. Update `invalidateIssueCaches` / `invalidateTimeEntryCaches` to either remove or no-op (writes now invalidate server-side). |
| `src/services/http.ts` | Add a `force?: boolean` option that sends `Cache-Control: no-cache`; server treats it as "bypass cache for this call." Used by `syncWithRedmine` and any explicit refresh button. |
| `.env.example` | Document the new `CACHE_*` vars. |
| `CHANGELOG.md` | One-line entry under "Unreleased". |
| `docs/ARCHITECTURE.md` | Update §7.4 "TTL cache" — move authoritative cache from frontend to server. Add a paragraph on the warmer + SWR. |
| `docs/API.md` | Document `POST /api/redmine/_cache/invalidate` and `GET /api/redmine/_cache/stats`. Note which GET routes are cached + per-route TTL. |
| `docs/IMPLEMENTATION_STATUS.md` | Add a row for CR #29. Update the row referencing CR #9 (was "cache in `realRedmineApi.ts`") to point at the server. |

**New utilities / types**
- `withConcurrency<T>(items, limit, mapper)` in `server/src/cache.ts` (or a small `concurrency.ts` if it grows) — bounded `Promise.all` for the gantt page fan-out.
- `CacheEntry<T>`, `CacheStats` types in `server/src/cache.ts`.

**Dependencies between changes (order matters)**
1. `cache.ts` lands first (pure, fully unit-tested) — nothing imports it yet.
2. `redmineClient.ts` learns the optional `cache` field. Existing call sites unchanged; tests stay green.
3. Gantt route gets parallel pagination + derived-row cache. This alone unlocks the headline perf win and is independently testable / revertible.
4. Other GET routes opt in. One commit per route group keeps blast radius small.
5. Write routes wire up cache invalidation.
6. `_cache` route + warmer + boot wiring.
7. Frontend cleanup (drop browser-side list cache, route sync through new endpoint).

**Test impact**
- **New:** `cache.test.ts`, `warmer.test.ts`, `routes.cache.test.ts`, plus a new case in `routes.gantt.test.ts` asserting (a) parallel fan-out — second page requested before first page response is consumed (use a deferred-promise fixture), and (b) cache hit returns no `fetch` calls.
- **Updated:** existing `routes.issues.test.ts`, `routes.timeEntries.test.ts`, etc. need `cache.invalidate('*')` between tests so cross-test bleed doesn't show up. Add a shared `resetCache()` to `server/test/setup.ts`.
- **Frontend:** any test that asserted browser-side cache state in `realRedmineApi` needs to be deleted or rewritten against the new shape. Audit during step 7.

**Commit sequence**
1. `feat(server): in-memory cache with TTL, SWR, in-flight coalescing` — `cache.ts` + `cache.test.ts` only. No call sites yet.
2. `feat(server): plumb optional cache into redmineFetch` — `redmineClient.ts` accepts the new option; no callers use it yet. Tests stay green.
3. `perf(gantt): parallel pagination + cache derived rows` — the headline change. Gantt route + new test fixture. **Stop and measure** before continuing.
4. `perf(server): cache hot GET routes (issues, projects, metadata, time-entries, users, me)` — one route group at a time if reviewers prefer; otherwise one bundled commit.
5. `feat(server): invalidate cache on writes` — write routes call `cache.invalidate(prefix)`.
6. `feat(server): /_cache invalidate + stats routes` + boot-time + interval warmer.
7. `refactor(client): drop browser list cache; sync via /_cache/invalidate` — frontend cleanup.
8. `docs(cr-29): update ARCHITECTURE, API, IMPLEMENTATION_STATUS, CHANGELOG` — flip CR status to ✅ with measured numbers.

**Decisions locked (2026-05-28)**
- **Warm-task list.** Team gantt `project_id=127`; **full projects list,
  paginated to `total_count`** (no `limit=100` cap); top-level Dashboard
  `/issues` queries (personal + team). Metadata excluded.
- **Invalidate auth.** `POST /_cache/invalidate` is **session-gated, admin
  only**. The sync button force-refreshes by sending `Cache-Control:
  no-cache` on its read instead of calling the invalidate route.
- **Write invalidation scope.** Writes invalidate **all `issues:*` + `gantt:*`
  keys** (the simple, slightly over-eager version) — no filter-set parsing.
- **Frontend cache.** **Rip out** the list/detail TTL maps in
  `realRedmineApi.ts`. Keep the metadata coordinator (in-render dedup).
- **Mock mode.** Same TTL behavior as real mode — tests exercise the full
  cache path. Requires `resetCache()` in `server/test/setup.ts`.

**Risks + mitigations**
- Stale data after a write → server-side `cache.invalidate(prefix)` in every write route. Covered by tests.
- Memory growth → bounded LRU (~500 keys) + per-entry serialized-size guard; reject entries > 1 MB (logged, not cached).
- Warmer hammering Redmine if misconfigured → default interval 5 min; exponential backoff to 15 min after a `429`/`5xx`; never blocks startup.
- Process restart wipes the cache (single-process Map). Acceptable for now; Phase D moves to Redis.

---

## #28 — Microsoft Entra sign-in (MSAL Node)

**Status:** ✅ Built, flag-gated (2026-05-27) — activation pending redirect-URI registration

**Request:** Make the dashboard work with Microsoft auth, using the
ms-identity-node auth-code sample + the provided app identity.

**Shipped:**
- Backend `/api/auth/ms/{signin,redirect,me,signout}` (Hono) using MSAL Node
  `ConfidentialClientApplication` + PKCE, query response mode, server-side
  session store for MSAL state.
- Frontend `useMsAuth` + `MsSignIn` gate in `App.tsx`.
- `MS_AUTH_ENABLED` flag (default false); `MSAL_*` identity env; added
  `@azure/msal-node`.

**Decisions:** query response mode (vs the sample's FORM_POST) so the Lax
session cookie survives the redirect without HTTPS in dev; full-app gate,
flag-controlled.

**To activate:** register the redirect URI `<origin>/api/auth/ms/redirect`
(dev: `http://localhost:5173/api/auth/ms/redirect`) in the app registration,
then set `MS_AUTH_ENABLED=true`. See `docs/AZURE_APP_SETUP.md`.

---

## #27 — Clickable project cards → spring-up task list

**Status:** ✅ Shipped (2026-05-27)

**Request:** In the Projects tabs, clicking a project should show its related
tasks in a spring animation (same as the team cards).

**Shipped:**
- `ProjectCard` (clickable, Framer Motion `layoutId`) replaces the static
  project-card markup on **AllProjects** and **ProjectCategory**.
- `ProjectDetail` full-screen morph lists the project's related tasks
  (#id, subject, status, assignee, due), with close / Escape / backdrop /
  swipe dismiss + reduced-motion.
- New `getIssuesByProject(projectId)` service (`/issues?project_id=…`) so the
  detail loads the project's full task set.

---

## #25 — Engineers-out time-off calendar

**Status:** ✅ UI shipped (2026-05-27) — real-mode data source still pending

**Build notes:** Fetching the live activity list confirmed leave is **not** a
Redmine time activity here (the `/metadata` list is all work codes). So the UI
was built behind a `getTimeOff(range)` seam: **mock mode** is seeded
(Vacation / Personal Time / Holiday / Customer Visit across this + next week);
**real mode returns `[]`** until the AE-calendar source is wired (see
`realRedmineApi.getTimeOff` TODO). Shipped: `EngineersOutCard` (replaces the
Engineers metric, shows "N out this week", `layoutId` morph) → `TimeOffDetail`
full-screen calendar with a week ⇄ month toggle (default week), prev/next
navigation, color-coded entries + legend (`lib/timeOff.ts`), and
dismiss/reduced-motion. The out-count is week-scoped (follows the dashboard
week toggle).

**Still needed for real data:** the AE-calendar plugin/endpoint + field shape
(paused here per the request — will ask again with specifics before wiring).

**Request:** Make the Dashboard "Engineers" card show how many engineers will
be out that week. Clicking it springs up (same morph as the team cards) into a
time-off calendar for the week, with a selector to move to the next week, and
colors coded by the type of time off (per the Redmine screenshot: Vacation,
Personal Time, Holiday, Customer Visit (FOF/FOT)).

**Decisions captured:**
- **Data source:** time entries whose *activity* is a leave type. Derive
  `{ user, date, type, hours }` by filtering `getTimeEntries({from,to})` to a
  leave-activity set. (Mock mode seeds a few leave entries for testing.)
- **"Out" count includes customer visits** (not only true leave). The card
  headline becomes "N out this week" (distinct engineers with any leave /
  customer-visit entry that week); "12 on the team" stays as a sub-caption.
- **Calendar has a week ⇄ month toggle, default week.** Week = engineers ×
  Mon–Sun color-coded blocks; month = full grid like the screenshot. Prev/next
  navigation + a color legend per type.

**Implementation sketch:**
- `getTimeOff(range)` service (filters time entries to leave activities).
- Engineers metric card becomes an interactive Framer Motion element
  (`layoutId`) → `TimeOffDetail` full-screen sheet (reuses the
  `TeamMemberDetail` morph + dismiss + reduced-motion scaffolding).
- Week/month calendar component, color map per leave type, lazy fetch per
  period, tests + browser verification.

**Open input needed before coding:** the exact Redmine activity strings that
represent leave (as returned by `getTimeActivities()` — e.g. is it literally
`"Personal Time"`, `"Holiday Mexico"`, `"Customer Visit (FOF/FOT)"`).

---

## #24 — Dashboard card rings + week-driven team hours

**Status:** ✅ Shipped (2026-05-27)

**Request:** Remove the donut rings from the metric cards except the team-hours
and my-hours cards. Also make the Dashboard's Last week button update the
team-hours card (not just the engineer cards).

**Shipped:**
- `DashboardCard` `ring` opt-out; `buildTeamMetrics` + `buildDashboardMetrics`
  set `ring: false` on count cards (rings kept on `hours-week` /
  `team-hours-week`).
- Week selection lifted to `Dashboard`; team hours are summed from time
  entries for the selected week and the card title reflects it. `TeamWorkPanel`
  accepts the week as a controlled prop.

---

## #23 — Engineer detail: collapse projects, logged hours, week switcher

**Status:** ✅ Shipped (2026-05-27)

**Request:** On the Team page, clicking an engineer should show their projects
collapsed with a toggle to reveal subtasks. Remove "hours expected" from the
team card — show only hours logged — and let the page switch between the
current and previous week.

**Shipped:**
- `TeamMemberDetail` projects are collapsed by default (`ProjectBlock` toggle)
  and expand to show subtasks with per-task logged hours.
- `TeamMemberCard` / `TeamMemberDetail` show only logged hours (dropped the
  estimated/"expected" figure).
- `TeamWorkPanel` gained a This week / Last week switcher and now computes
  week-scoped *logged* hours via `aggregateHours` (time-entry based),
  re-fetching time entries when the week changes.
- Replaced the "Avg load" team metric card with "Due this week" (open issues
  due within the next 7 days).

**Decisions:** "hours logged" = time entries in the selected week (not
cumulative issue spent-hours); the week switcher lives on the Team members
panel header and is ephemeral (defaults to the current week).

---

## #22 — Team-first Dashboard; personal-first Tasks & Hours

**Status:** ✅ Shipped (2026-05-27)

**Request:** Make the Dashboard more team-focused, while Tasks and Hours
center on the individual — with the ability to see the team's work when
needed.

**Shipped:**
- Dashboard rebuilt team-first: dropped the "Your Work" tab; tabs are Team
  (default, = team metrics + `TeamWorkPanel`) / Project Health / Resource
  Planning. Removed personal metrics + My Tasks table from the page.
- Tasks personal-first: My tasks by default; team `GroupedTaskTable` behind a
  persisted "Show team tasks" toggle, lazy-loaded on first reveal.
- Hours personal-first: this/last-week sections by default; team schedule
  behind a persisted "Show team schedule" toggle, gantt lazy-loaded on first
  reveal.

**Decisions:** team-first Dashboard *replaces* the personal landing (personal
work now owned by Tasks/Hours); "see team" is an inline per-page toggle (not a
link-out). Toggles persist per device (`rod.tasks.showTeam` /
`rod.hours.showTeam`).

---

## #1 — Collapsible left sidebar

**Status:** ✅ Shipped

**Request:** Make the left sidebar collapsible. When expanded, the workspace
names are visible (current behavior). When collapsed, only the symbols/icons
are shown.

**Scope notes:**
- Affects both the slim yellow icon rail (`Sidebar.tsx`) and the white
  workspaces panel (`SecondaryNav.tsx`) — the screenshot outlined them as a
  single unit.
- Expanded state = current default layout.
- Collapsed state = icon rail only; the workspaces panel is hidden.
- A toggle control is needed; placement TBD.

**Open questions for the scaffold plan:**
- Should the primary icon rail (Home / Dashboard / etc.) also gain text
  labels when expanded, or stay icon-only with the white panel doing all the
  labeling?
- Where should the collapse toggle live — top-left of the sidebar, in the
  TopBar, or both (keyboard shortcut + button)?
- Should collapsed state persist across page reloads (localStorage)?

---

## #2 — Single-active-item in the workspaces list

**Status:** ✅ Shipped

**Request:** Multiple items in the workspaces panel light up at once when
visiting routes that have duplicate entries pointing to them. Only one item
should be highlighted at a time.

**Root cause:** Two routes have duplicate workspace entries; React Router's
`NavLink` marks every matching entry as active.

| Route | Duplicate workspace entries |
| --- | --- |
| `/resources` | Resource Planning, Team Workload |
| `/reports` | KPI Tracker, Issue Reports |

**Decision needed when work begins:**
- For each pair, decide whether to (a) keep one and remove the other, or
  (b) split into two dedicated routes so both can stay.

The user will choose at coding time.

---

## #3 — Sidebar placeholders for screenshot views

**Status:** ✅ Shipped

**Request:** Using the supplied screenshots (Directory grid, Past Due Tasks
table, My Tasks table, Personal Resource Management Gantt, and My/Team
Hours This Week gauges) as a reference, add sidebar links / placeholders so
each of those views has a home in the app.

**Items and current state:**

| Screenshot view | Existing target | Status |
| --- | --- | --- |
| Directory (grouped multi-column) | `/directory` | Exists; may need restructure to mirror the grouped column layout |
| Past Due Tasks | `/past-due` | Exists |
| My Tasks | `/my-tasks` | Exists |
| Personal Resource Management (Gantt for one user) | — | New placeholder needed (distinct from team-wide `/resources`) |
| My Hours This Week (gauge) | Card on Dashboard / Reports | May need its own page or anchor |
| Team Hours This Week (gauge) | Card on Dashboard / Reports | Same |

**Open questions for the scaffold plan:**
- Where should the new links live — the primary icon rail, the secondary
  workspaces list, or both?
- Should "My Hours This Week" and "Team Hours This Week" be standalone
  pages, or just deep-linkable anchors / filtered views on the existing
  Reports page?
- The source screenshots include real internal project names
  (`Avionica Equipment Installation Power Bus Selection White Paper`,
  `Corendon Airlines [EASA] De-Mod B737 MAX`, etc.) and `@avionica` emails.
  The original project spec mandated generic data only (`example.com`,
  invented project names). Placeholders will use the existing generic mock
  data, **not** the names visible in the screenshots. Will reconfirm at
  scaffold-plan time.

---

## #4 — Sidebar placeholders for Dashboard, Directory, Tasks, Calendar, Hours, All Projects

**Status:** ✅ Shipped

**Request:** Add sidebar entries for Dashboard, Directory, Tasks, Calendar,
Hours, and All Projects.

**Current state per item:**

| Item | Current state |
| --- | --- |
| Dashboard | Exists at `/dashboard` |
| Directory | Exists at `/directory` |
| Tasks | Exists at `/my-tasks` (currently "My Tasks") |
| Calendar | **New placeholder** |
| Hours | New — likely combines My/Team Hours; relates to existing `/time` |
| All Projects | New — distinct from current `/projects`? Or rename? |

**Open questions for the scaffold plan:**
- Replace vs. extend — does this fully replace the existing sidebar items,
  or add alongside them?
- Which sidebar — primary yellow icon rail, secondary workspaces list, or
  both?
- "Hours" — new page or rename of existing Time Tracking?
- "All Projects" — replaces the current Projects link, or a broader "every
  project in Redmine" view distinct from the active-portfolio view?
- "Tasks" — rename "My Tasks" to "Tasks", or broader scope (all tasks across
  the org)?

**Relationship to #3:** Overlaps heavily — both add sidebar entries for
similar items. At scaffold-plan time, #3 and #4 will be merged into a
single sidebar restructure decision.

---

# Codex-comparison cherry-picks (#5–#11)

The next seven items come from a side-by-side review of an alternative UI
that Codex generated for the same brief. Codex's version was a higher-
fidelity static mockup with no routing, no functional editing, and a single
test file — its architecture is **not** being adopted. These are the
specific visual / data-shape upgrades that are worth pulling in.

The full comparison rationale (what's better in each version, what to skip
and why) is in chat history; not re-quoting here to keep this log scannable.

---

## #5 — Data-driven metric cards via `DashboardMetric[]`

**Status:** ✅ Shipped

**Request:** Replace the per-page JSX repetition of `<DashboardCard …>` on
the Dashboard / Reports / Time Tracking pages with a typed
`DashboardMetric[]` array in `data/mockData.ts`. Card config (title, value,
total, progress %, status pill text, color tone, drill-to route) becomes
data, not JSX.

**Why:** Eliminates the current value/total/donut-ratio mismatch where the
donut math gets confused by unit differences (e.g. `1/40` hours). Each card
gets a real `progress` percentage independent of the displayed value.

**Files:**
- `src/types/redmine.ts` — add `DashboardMetric` type
- `src/data/mockData.ts` — add `dashboardMetrics`, `reportMetrics`,
  `timeMetrics` arrays
- `src/pages/Dashboard.tsx` — render from array
- `src/pages/Reports.tsx` — same
- `src/pages/TimeTracking.tsx` — same

**Size:** Small.

---

## #6 — Conic-gradient donut visual

**Status:** ✅ Shipped

**Request:** Replace the SVG `DonutChart` inside `DashboardCard` with a CSS
`conic-gradient` ring driven by `DashboardMetric.progress`. Smaller DOM,
animates for free, less code per card.

**Note:** The existing `DonutChart` component stays available as an opt-in
for cases that need precise stroke control (custom thickness, caps, etc.).
Default visual switches to the conic ring.

**Files:**
- `src/components/DashboardCard.tsx`
- `src/components/DonutChart.tsx` (kept, no longer default)

**Size:** Small.

---

## #7 — Restructure Home as Codex-style landing (Option C)

**Status:** ✅ Shipped

**Request:** Redesign `/home` to be a friendly landing page modeled on
Codex's Dashboard layout. Keep `/dashboard` as a separate operations console
(no merge).

**Final shape of `/home`:**
1. Slate gradient hero with greeting (`Welcome back, <Name>`) and a
   workspace selector dropdown.
2. A small (3–4 card) row of headline metric cards — subset of Dashboard's
   full grid, sourced from `dashboardMetrics`.
3. "Recently opened workspaces" grid — 8 cards with letter avatar, type
   label, short description, bookmark icon.
4. Existing **Tools** card section retained (`/home` already has this).
5. Existing **Recently opened files** section retained (or merged into #3 —
   decide at scaffold-plan time).

**Why:** The original brief called out a Studio-style welcome page; this
restructure gets closer to that reference without losing the existing Tools
grid.

**Files:**
- `src/pages/Home.tsx`
- Possibly a new `RecentlyOpenedGrid` component

**Size:** Medium.

---

## #8 — Inline % Done progress bar in IssueTable

**Status:** ✅ Shipped

**Request:** Replace the plain `40%` text in the IssueTable's `% Done`
column with a small horizontal bar (green fill) plus the number. Visually
richer at a glance.

**Files:**
- `src/components/IssueTable.tsx`

**Size:** Small.

---

## #9 — Icon-in-pill for High / Urgent / Immediate priority

**Status:** ✅ Shipped

**Request:** Render an `AlertTriangle` icon inside the priority pill when
the priority is `High`, `Urgent`, or `Immediate`. Increases scannability
for the rows that matter most.

**Files:**
- `src/lib/format.ts` (`priorityPill` helper signature change, or a new
  `PriorityPill` component)
- `src/components/IssueTable.tsx` (consume the new render)

**Size:** Small.

---

## #10 — Sticky sync-status / mock-mode banner under TopBar

**Status:** ✅ Shipped

**Request:** Thin notice bar shown app-wide just below the TopBar when in
mock mode or after a sync (`Mock mode is active` / `Mock sync completed
just now`). Currently this status only lives as a small pill in the TopBar
itself, which is easy to miss.

**Files:**
- `src/components/AppShell.tsx`
- Possibly a new `StatusBanner` component

**Size:** Small.

---

## #11 — Make `lib/format.ts` pure (no module-level `TODAY`)

**Status:** ✅ Shipped

**Request:** Remove the module-level `TODAY = new Date('2026-05-21')`
global. `isOverdue` and `daysOverdue` should take `today` as a parameter
(with a default if needed for ergonomics). Improves test determinism and
removes a hidden dependency.

**Files:**
- `src/lib/format.ts`
- All call sites that rely on the default

**Size:** Small.

---

## #14 — Document-scroll layout + sticky sidebars (no bottom dead-space)

**Status:** ✅ Shipped

**Request:** Fix scrolling so the page doesn't leave a big empty space at
the bottom — pages with short main content were showing an obvious
canvas-colored gap below the content while the right panel still extended
further down.

**Root cause:** AppShell forced the inner flex row to viewport height with
`flex-1 min-h-0`, each panel had `overflow-y-auto` (its own scroll), and
`<main>` had `flex-1` so it grew to row height — leaving canvas color
below short content. Visually obvious in dark mode where the canvas is
near-black.

**Fix:**
- AppShell switches from `h-full flex flex-col` + internal per-panel
  scroll to `min-h-screen flex flex-col` with **document-level scroll**.
- TopBar + StatusBanner sit in a `sticky top-0 z-30` wrapper so they
  remain pinned to the viewport top while the page scrolls.
- Sidebar gets `sticky top-14 self-start` with `min/max-height: calc(100vh
  - 3.5rem)` (inline style; Tailwind's arbitrary-value parser misreads
  the dash inside calc()) so the rail visually fills the full screen
  alongside whatever main content is displayed.
- RightPanel gets the same sticky positioning + max-height so it shows a
  scrollbar internally if its content exceeds the visible area, but
  doesn't artificially stretch.
- Main column drops `overflow-y-auto` and now flows naturally with the
  document scroll.
- `index.css` switches `html/body/#root` from `height: 100%` to
  `min-height: 100%` and lets the body scroll.

**Visual result:**
- Short pages (Home, Tasks) fit one screen; sidebar fills full height; no
  visible gap.
- Long pages (Resource Management) scroll naturally; TopBar/banner/
  sidebar/right-panel all stay sticky.

---

## #13 — Remove workspaces sidebar, full-height yellow rail, popout, branded chrome

**Status:** ✅ Shipped

**Request (combined):**
- Yellow sidebar must extend all the way down to the viewport bottom.
- Remove the white workspaces sidebar (SecondaryNav) entirely.
- Add a visible popout/expand button on the yellow sidebar that works in
  both expanded and collapsed states.
- In dark mode the yellow sidebar (and TopBar, for consistency) becomes a
  dark grey; the *active* nav tab is the part that's now yellow.
- Add a slot in the TopBar's top-left corner for a PNG logo; change the
  title text from "Redmine Operations Dashboard" to
  "Aircraft Engineering Redmine".

**Result:**
- `SecondaryNav.tsx` + `SecondaryNav.test.tsx` deleted.
- New CSS variables `--brand-surface`, `--brand-surface-text`,
  `--brand-surface-hover`, `--brand-active-bg`, `--brand-active-text` in
  both `:root` and `:root.dark`; sidebar and TopBar consume them via inline
  styles. In dark mode the surface flips to dark grey and the active
  highlight flips to yellow.
- New `.sidebar-link` / `.sidebar-link-active` component classes.
- Sidebar gets `h-full self-stretch`; the AppShell flex row uses
  `items-stretch` so the rail fills the available height even when main
  content is short.
- Popout button is now always visible (data-testid `sidebar-popout`) and
  swaps chevron direction based on collapsed state.
- TopBar renders an `<img>` from `${BASE_URL}logo.png` with an `onError`
  fallback to the ClipboardList "R" badge so the app still looks correct
  when no logo is present. **To brand the deploy, drop your PNG at
  `public/logo.png`.**
- Title in HTML head + TopBar label both say "Aircraft Engineering Redmine".

---

## #12 — Dark mode / light mode toggle

**Status:** ✅ Shipped

**Request:** App-wide theme switch between dark and light. Dark mode uses
near-black canvas with grey contrasts; brand yellow stays bright in both.

**Decisions confirmed:**
- Toggle in both TopBar and Settings, plus `]` keyboard shortcut.
- First visit follows OS `prefers-color-scheme`; manual choice overrides.
- localStorage key `rod.theme` (`light` | `dark` | `system`).
- Status pills shift to muted variants in dark.
- Yellow `#FEDF00` brand stays bright in both modes.
- Conic donut track auto-swaps via `--donut-track`.
- Home hero transitions to pure black on dark via `--hero-from/--hero-to`.
- CSS variables in `:root` / `:root.dark` (not Tailwind `dark:` per-class).
- Toggle UX: single button cycling light ↔ dark (Q12i option B); system is
  configurable via Settings.

**Result:**
- New: `useTheme` hook, `ThemeToggle` component, theme variable scope in
  `index.css`, three new test files.
- Edited: `tailwind.config.js`, `AppShell`, `TopBar`, `Settings`,
  `DonutChart`, `DashboardCard`, `Home`.
- 217 tests passing (+18 from before this CR).

---

## #16 — Hours becomes a sidebar group (Time Tracking + Resource Management) + team Gantt

**Status:** ✅ Shipped

**Shipped notes (2026-05-26):**
- Sidebar: "Hours" is now an expandable group → Time Tracking (`/time`) +
  Resource Management (`/resources`), reusing the CR #15 nested machinery.
- Backend: `gantt.ts` paginates all matching issues and accepts `project_id`
  (Redmine includes subprojects). Scoped to AIRCRAFT ENGINEERING the endpoint
  returns ~703 rows (vs. 100 instance-wide before), 366 with start+due dates.
- Frontend: new `getTeamSchedule(projectId?)` adapter derives **users +
  issues + allocations from the Gantt rows themselves** — necessary because
  live `/users.json` 403s for the non-admin key (returns 0 users), which
  would otherwise leave `ResourceTimeline` (it renders one row per user) with
  no rows. Hours embeds a read-only team `ResourceTimeline` scoped to the
  AIRCRAFT ENGINEERING root. Verified live: 28 user rows, bars populated.
- Bug fixed (surfaced by live data): `ResourceTimeline` produced
  `left: NaN` styles for allocations missing start/end dates (many real
  issues). Added a `Number.isNaN` guard before computing bar geometry.

Validation: typecheck (front+server) pass, lint 2 pre-existing warnings,
frontend 47 files / 344 tests, server 14 files / 73 tests, build OK.
Browser-verified at `localhost:5174`.

**Decisions locked (user, 2026-05-26):** Q1 = (b) scope the Gantt to the
AIRCRAFT ENGINEERING project tree + paginate (small backend change). Q2 =
(a) yes, embed a compact read-only team Gantt on `/hours` in addition to the
`/resources` sub-link. Q3 = record CR #17 to make the dead Dashboard tabs
real (separate from this CR).

**Decisions locked (user, 2026-05-26):** Q1 = (b) scope the Gantt to the
AIRCRAFT ENGINEERING project tree + paginate (small backend change). Q2 =
(a) yes, embed a compact read-only team Gantt on `/hours` in addition to the
`/resources` sub-link. Q3 = record CR #17 to make the dead Dashboard tabs
real (separate from this CR).

**Request (verbatim):**
> Time tracking page should be a drop down under Hours. Resource Management
> should be a dropdown under Hours tab. Will you be able to pull data from
> resource tracking in Redmine to help recreate the Gantt chart? If so add
> it to the page that shows the team hours. Is your team's work going to
> show anything when live testing? Is project health going to show
> something? Is resource planning going to show something?

### Investigation findings (answers to the questions)

- **"Your Team's Work", "Project Health", "Resource Planning" are dead
  tabs.** In `src/pages/Dashboard.tsx` the `TABS` array renders a row of
  tab buttons and `setTab` updates the highlight, but **nothing reads
  `tab`** — all four tabs render the identical content (the metrics grid +
  the "My Tasks" `IssueTable`, which is *your* issues). So in live testing
  none of the three show anything tab-specific. They are cosmetic
  placeholders. Fixing them is **not part of this CR** — flagged as a
  candidate for a separate CR #17.
- **Gantt from Redmine "resource tracking": feasible, with caveats.**
  Redmine core has **no resource-allocation API** — its own Gantt is
  derived from issue `start_date` / `due_date`. The backend already does
  this: `/api/redmine/gantt` (`server/src/routes/gantt.ts`) builds Gantt
  rows from `/issues.json` (+ estimated/spent/relations), and
  `realRedmineApi.getResourceAllocations()` maps them. The existing
  `ResourceTimeline` component (rendered at `/resources`) already draws
  this Gantt. **Caveats from probing the live endpoint:** of the first 100
  issues, only ~20 have both start+due dates (sparse bars) and ~21 have an
  assignee; the route caps at 100 issues with no project scoping.

### Shape of the change

A. **Sidebar: "Hours" becomes an expandable group.** Reuses the nested
sub-link machinery built in CR #15 (no new mechanism). Children:
- Time Tracking → `/time`
- Resource Management → `/resources`
The Hours parent link still navigates to `/hours`. Group state persists to
localStorage; sub-links hide when the rail is collapsed (matches CR #15
Q6). These two pages are currently only reachable via Home tools / the
right panel — this gives them a home in the rail.

B. **Team Gantt on the Hours (team-hours) page.** `/hours` is the
per-engineer team-hours landing (this week / last week). Add a Gantt
section that reuses the existing `ResourceTimeline` + `getResourceAllocations`
(team view = all users). Read-only, no new component needed.

### Files

**Edit**
- `src/components/Sidebar.tsx` — add `children` to the Hours nav item
  (`/time`, `/resources`). Mechanism already exists.
- `src/tests/Sidebar.test.tsx` — assert the Hours group renders its two
  sub-links and toggles.
- `src/pages/Hours.tsx` — add a "Team schedule (Gantt)" section that loads
  users + issues + allocations and renders `ResourceTimeline` for the whole
  team. Compact, read-only.
- `src/tests/Hours.test.tsx` — assert the Gantt section renders.
- (Possibly) `server/src/routes/gantt.ts` + `realRedmineApi` — only if we
  decide to scope/paginate the Gantt (see Q1). Out of scope unless chosen.

**No changes**
- `ResourceManagement.tsx`, `TimeTracking.tsx` — unchanged; just gain a
  sidebar home. The Gantt logic is reused, not duplicated.

### Data / API assumptions

- Consumes existing `getResourceAllocations()` (→ `/api/redmine/gantt`),
  `getUsers()`, `getIssues()`. No new endpoints unless Q1 says to scope.
- Read-only; safe to ship before Section 15.

### Open questions

- **Q1 — Gantt scope/quality.** The live `/gantt` returns 100 issues
  instance-wide and only ~20% carry start+due dates, so a raw team Gantt
  will look sparse. Options: (a) ship as-is (sparse but honest), (b) scope
  the Gantt to the AIRCRAFT ENGINEERING project tree + paginate so it's
  denser and relevant (needs a small backend/adapter change — a `project_id`
  filter + paging on the gantt route). Recommend (b) if you want it useful,
  (a) if you just want it visible for now.
- **Q2 — Redundancy / placement.** Resource Management (the full Gantt) is
  becoming a sub-link directly under Hours. Do you still want a second
  Gantt embedded on the Hours landing? Options: (a) yes — compact read-only
  team Gantt on `/hours` + full interactive one at `/resources`; (b) no —
  the sub-link is enough, skip the embed. Recommend (a) per your request,
  but flagging the overlap.
- **Q3 — Dead Dashboard tabs.** Want me to spin up CR #17 to make "Your
  Team's Work" / "Project Health" / "Resource Planning" actually render
  distinct content, or leave them for now?

### Size

Small. (A) is a few lines reusing existing machinery. (B) reuses an
existing component. Backend scoping (Q1b) would add a small route change.

---

## #18 — Pre-live QA: overflow, Hours/Time consolidation, Gantt rework, Team Hours views

**Status:** ✅ Shipped

**Shipped notes (2026-05-26):** Landed across 12 commits in the planned
order. Highlights + things found along the way:
- **Foundational:** `deriveUsers` builds the Hours/team roster from issue
  assignees + entry authors (live `/users.json` 403s → 0 users), which also
  fixed the previously-empty live Hours page.
- **Overflow:** responsive TopBar (nav/pills/icons collapse by breakpoint,
  search unfixed) + `body { overflow-x: hidden }` backstop; PastDue filter
  header wraps; ProjectBuilder task grid scrolls in-card. 0 doc overflow on
  all 14 routes at 390/1280/1920.
- **STCs:** already canonical; added `/projects/category/stc → stcs` alias.
- **AllProjects:** `stripHtml` on description + search.
- **TimeTracking:** dropped mock project/issue lookups (uses `entry.projectName`
  + `issueId`); `/time` kept as the raw entries log.
- **Hours refresh:** `refreshToken` prop re-fetches both week sections + team
  after logging time.
- **Lint:** `useCallback` load in MyTasks/Tasks — lint now 0 warnings.
- **Sidebar:** Tasks→Past Due, Projects→(All Projects + Project Builder),
  added Reports rail link.
- **Gantt rework:** new `UserGantt` / `UserGanttBars` — select-first, empty by
  default, Project→Task bars (start→due), only the focused user; filters the
  already-loaded scoped rows (no 700-row render).
- **Team Hours:** new `TeamHours` with Card | List toggle. Card = per-engineer
  (projects/tasks/spent/expected) → expand to per-user Gantt. List =
  engineer→project→task table with log-time. Pure `aggregateTeamFromIssues`.
- **Polish:** Projects tucks empty categories behind a disclosure (20→6 cards),
  card spacing + trimmed names, drilldown skeleton loading state.

Validation: typecheck (front+server) pass, lint 0 warnings, frontend 49
files / 357 tests, server 14 files / 73 tests, build OK. Browser-verified at
390/1280/1920 — no doc overflow, no console errors on fresh mount, STCs
populated (35), AllProjects HTML stripped, Team Hours card/list working.

**Origin:** Pre-live QA pass. Eight must-fix/implement items + visual polish
+ two decision items. Frontend-scoped; reuse existing server/adapters, no
new backend contracts.

**Decisions locked (user, 2026-05-26):**
- Q1 = keep `/time` (fixed: drop mock lookups), sidebar Time Tracking sub-link
  still points to it.
- Q2 = "expected" hours = Σ `estimatedHours` of the user's tasks.
- Q3 = on Gantt user-select, filter the already-loaded (AIRCRAFT ENGINEERING-
  scoped) gantt rows client-side; no new fetch.
- Q4 = execute all 11 steps in order, commit per step.
- **Sidebar restructure (replaces the old "decision items"):**
  - **Tasks** becomes an expandable group → child **Past Due** (`/past-due`).
  - **Projects** group gains **Project Builder** (`/project-builder`)
    alongside **All Projects**.
  - **Reports** (`/reports`) added as a top-level rail link.
  - Admin stays conditional (signed-in only), as today.
- Secrets: `.env.local` is gitignored + untracked (verified); rotation is
  Nigel's call only if creds leaked outside the repo.

### ⚠️ Foundational finding that shapes items 5/7/8

`loadHoursData` (`src/lib/hoursAggregate.ts`) and the team Gantt build their
user list from `getUsers()`, which **returns 0 users live** (the non-admin
API key 403s `/users.json`). So today the live Hours page shows "No hours
logged" for everyone and the Gantt had no rows until CR #16's `getTeamSchedule`
worked around it. **Fix once, centrally:** derive the engineer list from
**issue assignees** (the data we do have) instead of `getUsers()`. This single
change is a prerequisite for items 5, 7, and 8 to work against live data.

### Item-by-item plan

**1. Global horizontal overflow / responsive TopBar** — `src/components/TopBar.tsx`
- The header is a non-wrapping flex row of fixed-width blocks (`min-w-[260px]`
  logo group, 4-button nav, `w-[440px]` search, a long action cluster with
  Sync label + 2–3 pills + 4 icon buttons). Below ~1024px it overflows →
  document-level horizontal scroll.
- Plan: hide the `All/Favorites/History/Workspaces` nav below `lg`; constrain
  search to `flex-1 min-w-0 max-w-[440px]` (no fixed width) and drop the
  workspace chip + chevron on small screens; collapse the action cluster —
  Sync becomes icon-only below `sm` (`hidden sm:inline` on its label),
  Connected/Read-only/last-sync pills `hidden md:inline-flex`, Help/Notif/
  Settings icons `hidden lg:inline-flex` (Settings already reachable via
  sidebar). Add `overflow-x-clip` (or `overflow-x: hidden`) on the AppShell
  root / `html` as a backstop so no stray child can force a horizontal
  scrollbar.
- Tests: extend/keep `TopBarLogo.test.tsx`; add a small assertion that the
  nav is not rendered (or `hidden`) — keep light since these are CSS classes.

**2. Projects STCs drilldown consistency** — mostly verification + small adds
- Canonical label/slug is already `STCs`/`stcs` (mock id 220, real name
  "STCs", `PINNED_CATEGORY_SLUGS` has `stcs`). No `stc` primary route exists.
- Add: an alias so a stale `/projects/category/stc` resolves to `stcs` — in
  `ProjectCategory.tsx`, if the slug doesn't match any category, try a
  startsWith/normalized fallback, OR add an explicit `<Route>` redirect
  `/projects/category/stc` → `/projects/category/stcs` in `App.tsx`.
- Cleanup for consistency: update the synthetic `STC`/`stc` strings in
  `ProjectCategoryCard.test.tsx`, `projectTree.test.ts`, and the mock child
  project names ("STC — …") are fine (they're child projects, not the
  category) — leave those. Confirm clicking STCs opens the populated list
  (verified live in CR #16: 35 projects).

**3. Strip HTML in All Projects cards** — `src/pages/AllProjects.tsx`
- Import `stripHtml` (already in `lib/format.ts`); wrap the description
  render. Also run the search filter against `stripHtml(p.description)` so
  users don't match on tag text. Mirror `ProjectCategory.tsx`.

**4. Hours vs Time Tracking duplication** — `src/pages/TimeTracking.tsx`, `App.tsx`
- `TimeTracking` looks up project/issue **names from `mockProjects`/`mockIssues`**
  even in real mode → wrong/"—" names live. Remove that dependency: use
  `entry.projectName` (already on `TimeEntry`) and the issue id link; drop the
  `mockIssues`/`mockProjects` imports.
- Placement is a **decision** (see Q1): either redirect `/time → /hours` (and
  repoint/remove the "Time Tracking" sidebar sub-link), or keep `/time` as the
  entries log reachable from the sub-link. Recommended: keep `/time` but fixed,
  since the sidebar sub-link now points there and the Hours landing is the
  card/list summary — they serve different needs (summary vs. raw entry log).

**5. Hours refresh after logging time** — `Hours.tsx`, `UserHoursSection.tsx`
- `Hours` bumps `setReloadKey` but `UserHoursSection` only re-fetches on
  `range.from/to`. Add a `refreshToken: number` prop to `UserHoursSection`,
  include it in the effect deps, and pass the page's reload counter. On
  `AddTimeModal.onCreated`, bump the token so both sections re-fetch.

**6. Lint warnings** — `src/pages/MyTasks.tsx`, `src/pages/Tasks.tsx`
- Wrap each page's `load` in `useCallback` (deps: `currentUser?.id` etc.) and
  list it in the `useEffect` deps, clearing the `react-hooks/exhaustive-deps`
  warning without changing behavior.

**7. Gantt rework (select-user-first, hierarchical)** — `ResourceTimeline.tsx` (or a new `UserGantt`)
- Default: **no bars**; show an empty state "Select an engineer to see their
  schedule." Add an engineer `<select>` (options derived from assignees).
- After selection, render **only that user's** work, grouped hierarchically:
  a **project summary row** (bar spanning min(start)…max(due) across the
  user's tasks in that project) with **task rows beneath** (each task's own
  start→due bar). Collapsible per project.
- This also fixes the ~700–1000-row render: we only ever render one user's
  rows. Keep the existing zoom control.
- Tests: new `UserGantt.test.tsx` (empty state, select → rows, project+task
  grouping, bars only for selected user).

**8. Team Hours card / list view modes** — `Hours.tsx` + components
- Add a view selector (Card | List), styled like TimeTracking's group-by
  `<select>`.
- **Card view** = today's `UserHoursCard` extended: per user show name,
  assigned project count, task count, hours spent, **hours expected
  (Σ estimatedHours)**. Expand → embed the item-7 per-user hierarchical Gantt
  (project → tasks, bars start→due, selected user only).
- **List view** = table: user sections → project rows (name, spent, expected,
  task count, due) → expandable to task rows (subject, status, start, due,
  spent, expected, log-time action). Reuses `aggregateHours` output
  (`UserHoursSummary` already has projects→tasks, spent, estimated, due).
- All of this consumes the assignee-derived user list (foundational fix), so
  it populates live.

**Visual polish**
- Projects: de-emphasize 0-project categories — render the pinned three +
  any non-zero categories first, then collapse the 0-count ones under a
  "More categories (N)" disclosure. (`Projects.tsx` + `projectSource` ordering.)
- Category card: add spacing between name and count, ensure visible/accessible
  text (`ProjectCategoryCard.tsx`).
- Normalize category labels to exactly `Custom Engineering Services`, `STCs`,
  `Aircraft Engineering Continuous Improvement` (already the real names; just
  confirm display uses them verbatim, trailing space trimmed for display).
- Drilldown loading state: `ProjectCategory.tsx` currently shows `…` as the
  heading while loading — add a proper skeleton/`Loading…` state so the
  ellipsis heading doesn't flash.
- Mobile header: covered by item 1.

**Sidebar restructure (decided)** — `src/components/Sidebar.tsx`
- **Tasks** → expandable group with child **Past Due** (`/past-due`).
- **Projects** group → add **Project Builder** (`/project-builder`) next to
  **All Projects**.
- Add top-level **Reports** (`/reports`) rail link.
- Reuses the existing nested-group machinery; update `Sidebar.test.tsx`.

### Files (summary)

Edit: `TopBar.tsx`, `AppShell.tsx` (overflow backstop), `AllProjects.tsx`,
`TimeTracking.tsx`, `App.tsx` (alias route + maybe `/time` redirect),
`Hours.tsx`, `UserHoursSection.tsx`, `UserHoursCard.tsx`, `MyTasks.tsx`,
`Tasks.tsx`, `ResourceTimeline.tsx`, `Projects.tsx`, `ProjectCategory.tsx`,
`ProjectCategoryCard.tsx`, `lib/hoursAggregate.ts` (assignee-derived users),
plus the affected tests.
Create: `UserGantt.tsx` (+ test), Team Hours list components as needed.

### Suggested commit sequence

1. Foundational: derive Hours/team users from assignees (`hoursAggregate` +
   team schedule) — makes Hours populate live.
2. Item 6 lint fixes (tiny, isolated).
3. Item 1 responsive TopBar + overflow backstop.
4. Item 3 AllProjects stripHtml.
5. Item 2 STCs alias + test consistency.
6. Item 4 TimeTracking de-mock + placement decision.
7. Item 5 Hours refresh token.
8. Sidebar restructure (Tasks→Past Due, Projects→Project Builder, +Reports).
9. Item 7 UserGantt (select-first hierarchical).
10. Item 8 Team Hours card/list views (consumes 1 + 7).
11. Visual polish (Projects 0-count grouping, card spacing, drilldown loading).
12. Docs: flip CR #18 ✅, refresh IMPLEMENTATION_STATUS, CHANGELOG.

### Open questions

- **Q1 — `/time` placement.** Redirect `/time → /hours` (remove the Time
  Tracking sub-link), or keep `/time` as the fixed raw-entries log reachable
  from the sub-link? (Recommend: keep, fixed.)
- **Q2 — "expected" hours definition.** Use Σ `estimatedHours` of the user's
  tasks as "expected/estimated"? (No other field exists.) (Recommend: yes.)
- **Q3 — Gantt scope when a user is selected.** Pull that user's issues via a
  scoped fetch (`assigned_to_id`) or filter the already-loaded
  AIRCRAFT ENGINEERING gantt rows client-side? (Recommend: filter the loaded
  rows — no new fetch, and it's already scoped.)
- **Q4 — Decision items** above (sidebar links; credential rotation).

### Size

Large. Items 7 + 8 are the bulk (new Gantt + two view modes); items 1–6 and
polish are small-to-medium. Suggest landing in the commit order above so each
piece is reviewable and the foundational data fix lands first.

---

## #17 — Make the Dashboard tabs render real, distinct content

**Status:** ✅ Shipped (2026-05-27)

**Shipped:** The four tabs read `tab` and render distinct content below a
persistent metric grid. *Your Work* unchanged; *Your Team's Work* → CR #19;
*Project Health* → `DashboardProjectHealth` (AIRCRAFT ENGINEERING tree metrics
+ category cards; shared `lib/projectHealth.ts`); *Resource Planning* →
`DashboardResourcePlanning` (embedded team Gantt via `getTeamSchedule` + link
to `/resources`). Decisions: persistent metric row, Project Health scoped to
the default tree, Gantt embedded.

---

## #19 — Team's Work: team metrics, per-engineer cards, selector + card-expand

**Status:** ✅ Shipped (2026-05-27)

**Request:** On the Dashboard "Your Team's Work" tab, (1) make the metric
cards reflect the team rather than the current user; (2) add per-engineer
cards showing each engineer's projects; (3) add a selector to choose which
engineers appear; (4) implement an iOS-style "card expands into full-screen
detail" interaction (Dribbble shot 25725700) with spatial continuity,
border-radius morph, staggered reveal, spring motion, swipe-to-dismiss, and a
reduced-motion fallback.

**Shipped:**
- `buildTeamMetrics` (team-scoped cards); Dashboard swaps the grid on the
  team tab.
- `TeamWorkPanel` + `TeamMemberCard` / `TeamMemberDetail` (Framer Motion
  shared `layoutId` morph) + `TeamMemberSelector` (persisted multi-select).
- Engineers + workload derived from assignees via `getTeamSchedule`
  (AIRCRAFT ENGINEERING tree). Default selection in `lib/teamSelection.ts`
  (afreixas, nbraithwaite, jgarcia, kgonzalez, rdelgado, vcoy), matched by
  first name or email local-part, all-fallback.
- Added `framer-motion` dependency.

**Decisions:** Framer Motion (vs hand-rolled FLIP / View Transitions);
initials-on-gradient hero (Redmine users have no photos); the plain
all-issues table added on this tab in CR #17 was replaced by the engineer
cards.

---

### (historical context for #17)

Original collected request below.

**Status (original):** 📥 Collected (planned after CR #16)

**Origin:** Surfaced during CR #16 investigation. `src/pages/Dashboard.tsx`
declares four tabs — `Your Work`, `Your Team's Work`, `Project Health`,
`Resource Planning` — but the tab state is never read, so all four show the
same metrics grid + "My Tasks" table.

**Goal:** Each tab should render distinct content:
- **Your Work** — current behavior (your metrics + your issues). Keep.
- **Your Team's Work** — team-wide issues (all assignees), not just yours;
  team metrics.
- **Project Health** — per-project status/health view (open vs. closed,
  at-risk, % done) across the active portfolio. Likely reuses the CR #15
  project-tree + issue stats.
- **Resource Planning** — the team Gantt (reuse `ResourceTimeline`), or a
  link/embed of `/resources`.

**Open questions for the scaffold plan:**
- Should each tab swap the whole body, or keep the metrics row and only
  swap the lower section?
- "Project Health" — derive from the AIRCRAFT ENGINEERING tree (CR #15) or
  all projects?
- Avoid duplicating the Gantt if CR #16 already embeds one on `/hours`.

**Size:** Medium. Will be planned in full once CR #16 ships.

---

## #15 — Projects page as category dashboard + All Projects as Projects sub-link

**Status:** ✅ Shipped

**Shipped notes (2026-05-26):** Implemented across the planned 7 steps.
Live-data verification at `localhost:5174` surfaced three things the plan
didn't anticipate, resolved with the user:
- The `**` in `**AV Engineering` is **literally part of the Redmine project
  name** (not markdown emphasis). `DEFAULT_PROJECT_SOURCE.path` and the mock
  root were corrected to include it.
- `AIRCRAFT ENGINEERING` has **20 direct children**, not 3. Decision: show
  all, but pin the three named categories first (`PINNED_CATEGORY_SLUGS` in
  `projectSource.ts`). Real names are `Custom Engineering Services`, `STCs`
  (not "STC"), `Aircraft Engineering Continuous Improvement ` (trailing
  space) — pinning matches on slug so casing/spacing don't matter.
- `getProjects()` only fetched the first 100 projects, undercounting
  categories (STCs was invisible). Decision: paginate the
  `realRedmineApi.getProjects` adapter through all pages. Total descendants
  went 75 → 105; STCs now correctly shows 35.
- Also fixed: Redmine project descriptions contain HTML; added
  `stripHtml()` in `lib/format.ts` used by the category card + drill-down.

Final validation: typecheck pass, lint (2 pre-existing warnings), `npm test`
47 files / 341 tests pass, build OK. Browser-verified in dark mode, no
console errors.

**Decisions locked (user, 2026-05-26):** Q1 = (a) resolve by identifier ·
Q2 = all descendants · Q3 = (a) parent-swapper · Q4 = **yes**, include a
headline metrics row · Q5 = mock category names OK · Q6 = (c) sub-links
hidden until the rail is expanded.

**Scope guardrails (user):** Keep changes frontend/UI-only. Do **not**
invent permanent API contracts — backend work may be happening
separately. The default project path must be isolated behind a clearly
named frontend adapter/mock function (no env-var contract baked in).
Preserve existing design language, dark/light behavior, spacing, and
component patterns. No unrelated refactors. Verify at `localhost:5174`.

**Request (verbatim):**
> "All Projects" should be a sub-link of "Projects" — like a dropdown menu.
> The Projects page should draw inspiration from the overview page. There
> should be a menu on the Projects page that lets you select what subprojects
> are pulled. For now let the project path pulled from be
> `**AV Engineering\AIRCRAFT ENGINEERING**` and have the cards display the
> total number of projects under **Custom Engineering Services**, **STC**,
> and **Aircraft Engineering Continuous Improvement** — as separate cards
> showing the total projects amongst them. Then when a category card is
> selected it takes you to another page that shows you an overview of that
> selected project (so clicking the STC card → see all STC projects).

### Shape of the change

A. **Sidebar restructure** — "All Projects" demoted to a sub-link of
"Projects". Expanded sidebar: clicking the chevron next to "Projects"
reveals "All Projects" beneath it. Collapsed sidebar: keep the existing
"Projects" icon button; sub-link only visible when hovering or after
expanding the rail.

B. **Projects page redesign** — replace the current "card per project"
grid with a Home-style landing:
1. Page header with a **root-project picker** (default
   `AV Engineering > AIRCRAFT ENGINEERING`).
2. Row of three **category cards** (Custom Engineering Services, STC,
   Aircraft Engineering Continuous Improvement) showing the count of
   projects beneath each. Each card is clickable and navigates to the
   drill-down route below.
3. (Optional) Headline metrics row below the cards — open/closed counts,
   total descendants, last-updated. TBD pending user feedback (see Q4).

C. **New drill-down route** —
`/projects/category/:slug` (e.g. `/projects/category/stc`) renders a
filtered AllProjects-style listing: header with category name +
breadcrumb back to Projects, search + status filter (reused from
AllProjects), grid of project cards.

D. **Mock data + types** — extend the mock `projects` fixture so the
three category project nodes exist with children beneath them; the
real-mode path resolves the same shape from `parent_id` traversal.

### Files

**Create**
- `src/lib/projectTree.ts` — pure tree helpers (no I/O):
  `findProjectByPath(projects, ['AV Engineering', 'AIRCRAFT ENGINEERING'])`,
  `getDirectChildren(projects, parentId)`,
  `getAllDescendants(projects, rootId)` (Q2: inclusive of all levels),
  `slugify(name)` for the category route param.
- `src/services/projectSource.ts` — **the named frontend adapter** that
  isolates the default project path (Q1 + scope guardrail). Exports a
  `DEFAULT_PROJECT_SOURCE = { path: ['AV Engineering', 'AIRCRAFT ENGINEERING'], label: 'AV Engineering / AIRCRAFT ENGINEERING' }`
  constant and `resolveProjectSource(projects, path?)` which finds the
  root by path (matching on `name`, then resolves to `identifier`),
  returns its direct children as "categories" each with an
  all-descendants count. This is the single swap-point when backend
  wiring lands — no API contract is presumed; it operates on whatever
  `getProjects()` already returns.
- `src/pages/ProjectCategory.tsx` — drill-down page for a single
  category (e.g. STC). Reuses AllProjects' filter UI (search + status).
- `src/components/ProjectCategoryCard.tsx` — the clickable card used in
  the Projects landing (Home-card visual + count badge + drill arrow).
- `src/tests/projectTree.test.ts` — unit tests for the helpers
  (build a tree fixture, assert path resolution, child counts, deep
  descendant counts, slugify).
- `src/tests/projectSource.test.ts` — adapter resolves the default path,
  returns the right categories + counts, handles missing root.
- `src/tests/ProjectCategoryCard.test.tsx` — render, count, click-nav.
- `src/tests/ProjectCategory.test.tsx` — drill-down filtering, empty
  state, breadcrumb back link.

**Edit**
- `src/components/Sidebar.tsx` — convert the flat `links` array into a
  shape that allows nested sub-links (`children?: NavLink[]`), so future
  project section links can be added without further refactor. Add
  expand/collapse state for the Projects group (persist in localStorage).
  Q6: when the rail is collapsed to icon-only, sub-links are hidden;
  expanding the rail reveals them. Remove the `/projects/all` entry from
  the top-level list — it becomes a child of Projects.
- `src/pages/Projects.tsx` — full rewrite to the category-dashboard
  shape. Loads `getProjects()` once, runs it through
  `resolveProjectSource`, renders: (1) root-project picker (Q3:
  parent-swapper — switches which parent's children become the
  categories), (2) headline metrics row (Q4: e.g. total projects, open
  vs. closed across descendants, last-updated — built from the resolved
  tree, reusing `DashboardCard`), (3) the three category cards.
- `src/App.tsx` — add `<Route path="/projects/category/:slug" …>`.
  Keep `/projects/all` route intact (the sub-link still points there).
- `src/data/mockData.ts` — add the three category project nodes
  (`Custom Engineering Services`, `STC`,
  `Aircraft Engineering Continuous Improvement`) as children of a new
  `AIRCRAFT ENGINEERING` project (itself a child of `AV Engineering`),
  each with 3–5 mock descendants so the counts have something to show.
- `src/tests/Sidebar.test.tsx` — assert nested sub-link rendering +
  expand/collapse behavior.
- `src/tests/Projects.test.tsx` — replace with new assertions: three
  category cards render, counts match, click navigates to
  `/projects/category/:slug`, root-picker switches the visible categories.
- `docs/CHANGE_REQUESTS.md` — flip status to 🛠 then ✅ on ship.
- `docs/IMPLEMENTATION_STATUS.md` — add a CR #15 row.

**No changes**
- `src/pages/AllProjects.tsx` — unchanged; still reachable via the
  sub-link. Acts as the "browse everything, ignoring the category lens"
  escape hatch.
- `server/src/routes/projects.ts` — `parentProjectId` is already in the
  normalized payload; no backend changes needed.

### Dependencies between changes

1. `projectTree.ts` helpers + tests first (foundation; no UI deps).
2. Mock data fixture update (so the new Projects page has data to show).
3. `ProjectCategoryCard` component + test.
4. `ProjectCategory` page + route + test.
5. `Projects.tsx` rewrite + test (consumes everything above).
6. `Sidebar.tsx` nested sub-link rewrite + test (independent of the
   page rewrites; can land in parallel but cleaner after the page works).

Suggested commit sequence: one commit per step above (6 commits) so each
is independently revertable.

### Test impact

- New tests: 3 files, est. 15–20 new tests.
- Existing tests touched: `Projects.test.tsx` (rewrite),
  `Sidebar.test.tsx` (extend), `AppShell.test.tsx` (likely unaffected —
  sidebar shape changes but the assertion surface is around the
  primary-sidebar wrapper).
- No backend tests change.

### Route structure

| Route | Page | Notes |
| --- | --- | --- |
| `/projects` | `Projects.tsx` (rewritten) | Category dashboard — picker + metrics + 3 cards |
| `/projects/all` | `AllProjects.tsx` (unchanged) | Now a **sub-link** of Projects in the sidebar |
| `/projects/category/:slug` | `ProjectCategory.tsx` (new) | Drill-down; `:slug` from `slugify(category name)` |

Category slug is derived (not stored): `slugify('STC') → 'stc'`,
`slugify('Custom Engineering Services') → 'custom-engineering-services'`.
The drill-down page re-resolves the tree and finds the category whose
slug matches the param, so no state needs to survive navigation.

### Data / API assumptions

- The page consumes the **existing** `getProjects(): Promise<Project[]>`
  facade only. `Project.parentProjectId` is already in the type and is
  populated by both the mock and the real adapter — the project tree is
  derived **client-side** from that flat list. No new endpoints, no new
  query params, no backend changes.
- Issue counts per category (if shown on the drill-down) come from the
  existing `getIssues()` filtered by `projectId`, same as the current
  Projects/AllProjects pages.
- No write paths involved — entirely read-only, safe to ship before
  Section 15 live validation.

### Default project-path representation

- Held as a named constant in the new `src/services/projectSource.ts`
  adapter: `DEFAULT_PROJECT_SOURCE.path = ['AV Engineering', 'AIRCRAFT ENGINEERING']`.
- Resolved at runtime by walking `parentProjectId` and matching on
  `name` (case-insensitive), then pinning to the matched project's
  `identifier`/`id`. **No `.env` / `VITE_*` contract** is introduced —
  per the scope guardrail, the path lives in frontend code as a clearly
  named, single-swap-point adapter.
- When the user swaps the root via the picker (Q3), the chosen parent's
  `id` overrides the default for that session (component state only; not
  persisted unless we later decide to).

### Backend blockers / mock adapter points

- **No blockers.** Everything derives from data already returned today.
- Single mock/seed point: `src/data/mockData.ts` gains the
  `AV Engineering → AIRCRAFT ENGINEERING → {Custom Engineering Services,
  STC, Aircraft Engineering Continuous Improvement} → {3–5 leaf
  projects each}` subtree (new ids, e.g. 200+; existing flat projects
  101–108 left untouched so current AllProjects tests don't shift).
- Single real-mode swap point: `projectSource.ts`. If backend later
  exposes a dedicated "subprojects under X" endpoint, only this adapter
  changes; pages and components stay as-is.

### Size

Medium. Bulk of the work is the `Projects.tsx` rewrite, the new
drill-down page, and the sidebar nested-sub-link refactor. The mock-data
extension and tree helpers are small.

---

# Codex-comparison explicit skips

The following Codex patterns were considered and **rejected** because
adopting them would regress the current shipping app. Documented here so
the rationale isn't lost.

| Skipped | Why |
| --- | --- |
| Codex's `useState` page switcher in App.tsx | Regression — kills URLs, back button, deep links |
| Codex's `xl:block` / `2xl:block` responsive chrome hiding | Regression — secondary nav and right panel vanish on a 1366px laptop |
| Codex's `Issue.assignee: User` (no null) | Regression — makes unassigned issues impossible |
| Codex's `IssueStatus: string` / `Tracker: string` | Regression — loses type safety |
| Codex's non-persistent mock API | Regression — UI wouldn't reflect edits |
| Codex's stripped-down IssueTable (no sort, no select, no bulk update) | Regression — major feature loss |
| Codex's duplicate-key bug in `Sidebar` (Home + Dashboard share key) | Bug, not a feature |
| Codex's single test file (`format.test.ts`) | Regression — current repo has 7 |

---

## Workflow

1. User sends a UI change request (often with screenshots).
2. The request is appended to this document under a new numbered section
   with status 📥 Collected — no code is touched.
3. When the user says "start coding" (or similar), a **scaffold plan** is
   drafted that covers, for each change:
   - Files that need to be created, edited, or deleted
   - New components, hooks, types, or utilities
   - Dependencies between changes (which must land first)
   - Test impact (which existing tests change, which new tests are needed)
   - Suggested commit sequence
   - Open questions that need user decisions before implementation
4. The scaffold plan is reviewed with the user. Changes move to status 📝.
5. After approval, work begins. Changes move to status 🛠 then ✅, with the
   relevant commit hashes recorded here.
