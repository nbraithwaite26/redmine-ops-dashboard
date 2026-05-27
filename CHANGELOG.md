# Changelog

All notable changes to the Redmine Operations Dashboard are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — CR #25: engineers-out time-off calendar (UI) (2026-05-27)

- **Engineers-out card** — the Engineers metric becomes `EngineersOutCard`
  ("N out this week", week-scoped), which morphs (shared `layoutId`) into a
  full-screen `TimeOffDetail` calendar.
- **Time-off calendar** — week ⇄ month toggle (default week), prev/next
  navigation, entries color-coded by leave type with a legend
  (`lib/timeOff.ts`).
- **Data seam** — new `getTimeOff(range)`. Leave is not a Redmine time activity
  on this instance, so mock mode is seeded and **real mode returns empty until
  the AE-calendar source is wired** (`realRedmineApi.getTimeOff` TODO).

### Changed — CR #24: Dashboard card rings + week-driven team hours (2026-05-27)

- **Rings only on hours cards.** `DashboardCard` gained a `ring` opt-out; the
  team + Home count cards now render a plain number, and the donut ring is
  reserved for the hours cards (my hours / team hours).
- **Week toggle drives team hours.** The This week / Last week selection is
  lifted to the Dashboard, so switching weeks updates both the engineer cards
  *and* the "Team hours" metric card (now week-scoped, summed from time
  entries, with a "this week" / "last week" title).

### Changed — CR #23: engineer detail collapse, logged-hours, week switcher (2026-05-27)

Refinements to the Team page engineer cards/detail.

- **Collapsible projects in the detail view.** The full-screen engineer sheet
  (`TeamMemberDetail`) now lists projects collapsed; each expands to reveal its
  subtasks (with per-task logged hours).
- **Logged hours, not expected.** The card and detail drop the "expected"
  (estimated) figure and show only hours *logged*.
- **Week switcher.** A This week / Last week control on the Team members panel
  re-scopes the logged hours. The panel now derives hours via `aggregateHours`
  (time-entry based, week-filtered) instead of cumulative issue spent-hours,
  and re-fetches time entries when the week changes.
- **Team metric swap.** Replaced the "Avg load" team metric card with "Due this
  week" (count of open issues due within the next 7 days, from `buildTeamMetrics`).

### Changed — CR #22: team-first Dashboard, personal-first Tasks & Hours (2026-05-27)

Rebalanced where team vs. individual work lives.

- **Dashboard is now team-first.** Dropped the personal "Your Work" tab; the
  landing leads with team metrics (`buildTeamMetrics`) + the engineer cards
  (`TeamWorkPanel`). Tabs are now Team (default) / Project Health / Resource
  Planning. Personal metrics + the My Tasks table were removed from the
  Dashboard (they live on Tasks/Hours now).
- **Tasks is personal-first.** Defaults to "My tasks" only; the team
  (`GroupedTaskTable`) view is behind a persisted "Show team tasks" toggle and
  its data is fetched lazily on first reveal.
- **Hours is personal-first.** Defaults to the this-week / last-week personal
  sections; the team schedule is behind a persisted "Show team schedule"
  toggle and the ~700-row gantt is fetched lazily on first reveal (no longer
  on every Hours visit).

### Added — CR #19: Team's Work redesign + card-expand interaction (2026-05-27)

The Dashboard "Your Team's Work" tab becomes a team-centric view. Added
`framer-motion` for the shared-layout card morph.

- **Team metrics** — `buildTeamMetrics` (team tasks, in-progress, team
  past-due, unassigned, team hours, engineer count, avg load, awaiting). The
  Dashboard metric grid swaps to these on the Team's Work tab; other tabs keep
  the personal grid.
- **Per-engineer cards** — `TeamWorkPanel` renders a card per engineer with
  their per-project / per-task workload, derived from assignees via
  `getTeamSchedule` (scoped to AIRCRAFT ENGINEERING) so it works without the
  admin-only `/users` endpoint.
- **Engineer selector** — `TeamMemberSelector` popover multi-select (persisted
  to `localStorage`). Default set matched by first name or email local-part
  (`lib/teamSelection.ts`): afreixas, nbraithwaite, jgarcia, kgonzalez,
  rdelgado, vcoy; falls back to all when nothing matches.
- **Card → full-screen detail** — `TeamMemberCard` morphs into
  `TeamMemberDetail` via Framer Motion `layoutId` (border-radius, gradient/
  initials hero, name all interpolate). Staggered body reveal, spring easing,
  tap-scale, fade-in close, backdrop dim + scroll-lock, dismiss via close /
  Escape / backdrop / swipe-down handle, safe-area padding, and a
  `useReducedMotion` fade fallback.

### Added — CR #17: real Dashboard tabs (2026-05-27)

The four Dashboard tabs now render distinct content (previously the tab state
was set but never read). Metric grid stays persistent; the section below swaps:

- **Your Work** — unchanged (my metrics + My Tasks).
- **Your Team's Work** — see CR #19.
- **Project Health** — `DashboardProjectHealth`: portfolio health on the
  AIRCRAFT ENGINEERING tree (metrics + drill-down category cards). Shared
  `lib/projectHealth.ts` (`buildSourceMetrics`) extracted from the Projects
  page.
- **Resource Planning** — `DashboardResourcePlanning`: embedded team Gantt via
  `getTeamSchedule`, plus a link to `/resources`.

### Fixed / Changed — CR #18: pre-live QA batch (2026-05-26)

A 12-commit pass against pre-live QA findings. See
[`docs/CHANGE_REQUESTS.md`](docs/CHANGE_REQUESTS.md) #18 for the full log.

- **Hours roster derived from assignees** — `loadHoursData` no longer relies
  on `/users.json` (403s for the non-admin key), so the live Hours page
  populates. New `deriveUsers` + `aggregateTeamFromIssues` helpers.
- **No more horizontal overflow** — responsive TopBar (nav/pills/icons
  collapse by breakpoint, search unfixed) + `body { overflow-x: hidden }`;
  PastDue filter header wraps; ProjectBuilder grid scrolls in-card. Verified
  0 document overflow at 390 / 1280 / 1920 on all routes.
- **Gantt rework** — `UserGantt` / `UserGanttBars`: empty until an engineer
  is selected, then Project→Task bars (start→due) for that user only.
- **Team Hours views** — `TeamHours` Card | List toggle. Card = per-engineer
  summary → expand to per-user Gantt; List = engineer→project→task table with
  log-time.
- **Sidebar** — Tasks→Past Due, Projects→(All Projects + Project Builder),
  new Reports rail link.
- Misc: All Projects descriptions/search use `stripHtml`; TimeTracking uses
  live `entry.projectName`/`issueId` (no mock lookups); `/time` kept as the
  entries log; Hours refreshes after logging time; `/projects/category/stc`
  aliases to `stcs`; empty project categories tucked behind a disclosure;
  drilldown skeleton loading; lint warnings cleared (0).

### Added — Backend integration + recent CRs (2026-05-26)

The app is now a **two-process app**: the Vite/React frontend plus a Hono
backend in `server/` that brokers every Redmine call (the API key never
reaches the browser). Full detail in
[`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) and
[`docs/CHANGE_REQUESTS.md`](docs/CHANGE_REQUESTS.md).

- **Backend proxy + writes** — Hono app with read-only/request-id/rate-limit
  middleware, snake→camel adapters, admin auth (bcrypt + HMAC-signed session
  cookie), JSONL audit history, and the full write surface (PATCH/POST/DELETE
  for issues + time entries). Frontend wired to real mode via `/api/redmine/*`.
- **§13 — Redis-backed session + rate-limit stores** behind `REDIS_URL`.
  `server/src/store/redisClient.ts` lazily constructs an `ioredis` client;
  `sessionStore` and the `rateLimit` middleware fall back to in-memory maps
  when `REDIS_URL` is unset (zero behavior change for single-process dev).
- **CR #15 — Projects category dashboard.** `/projects` rewritten as a
  Home-style landing: hero + project-source picker + headline metrics +
  category cards, drilling into `/projects/category/:slug`. "All Projects"
  demoted to a sidebar sub-link of "Projects". New `lib/projectTree.ts`
  (pure tree helpers) + `services/projectSource.ts` (named adapter isolating
  the `**AV Engineering / AIRCRAFT ENGINEERING` default path — no API
  contract). `getProjects()` now paginates all pages; three named categories
  (Custom Engineering Services, STCs, Aircraft Engineering Continuous
  Improvement) pinned first. `stripHtml()` added for Redmine HTML
  descriptions. 40 new tests.
- **CR #16 — Hours sidebar group + team Gantt.** "Hours" becomes an
  expandable group → Time Tracking (`/time`) + Resource Management
  (`/resources`). The Gantt route paginates and accepts a `project_id` filter
  (subproject-inclusive). New `getTeamSchedule(projectId?)` adapter derives
  users/issues/allocations from Gantt rows (works around the degraded
  `/users.json`). A read-only team `ResourceTimeline` scoped to AIRCRAFT
  ENGINEERING is embedded on `/hours`. Fixed a `NaN` CSS bug in
  `ResourceTimeline` for allocations missing start/end dates.

Validation at session end: frontend 47 files / 344 tests, server 14 files /
73 tests, typecheck (front + server) + lint (2 pre-existing warnings) + build
all clean.

### Refactor session (Phases 0 → H)

A focused review-and-optimize pass after CR #14. Behavior-preserving;
no new product features. See [`docs/REFACTOR_LOG.md`](docs/REFACTOR_LOG.md)
for the per-phase notes.

- **Phase 0** — Theme-aware logo swap: light loads `logo.png`, dark
  loads `logo-white.png`, with per-variant `onError` fallback.
- **Phase A** — Centralized the pinned demo date `MOCK_TODAY` and
  cleared the 2 outstanding lint warnings (PriorityPill duplicate
  helper, ResourceTimeline memo dep).
- **Phase B** — Three reusable hooks: `useAsyncResource`,
  `useIssueEditor`, `useTableState`. Replaced ~10 pages' worth of
  copy-pasted load + edit + table state.
- **Phase C** — Split large components: `IssueTable` (309 → ~210
  lines, extracted `IssueRow`); `TimeTracking` (310 → ~180 lines,
  extracted `AddTimeModal`).
- **Phase D** — Five duplicated inline `<style>` blocks consolidated
  into a single `@layer components` rule in `index.css` covering
  `.form-input`, `.modal-input`, `.builder-input`, `.settings-input`,
  `.input`. Side benefit: inputs now respect dark mode automatically.
- **Phase E** — `services/redmineApi.ts` split into a mock/real
  facade: `redmineApiTypes.ts` (interface), `mockRedmineApi.ts`,
  `realRedmineApi.ts` (stub), and a thin facade that picks impl by
  `VITE_MOCK_MODE`. Call sites unchanged.
- **Phase F** — Accessibility pass. New `useDialogA11y` hook (ESC
  dismisses, autofocus first focusable, focus restoration). Applied
  to TicketDrawer, QuickEditPopup, AddTimeModal. Reports tablist
  gained WAI-ARIA roving-tabindex + ArrowLeft/Right nav.
- **Phase G** — Responsive sweep. Sidebar overlays content below
  `md`, becomes sticky/push at `>=md`. New `useMediaQuery` hook.
  Mobile backdrop closes the rail when tapped. RightPanel is
  `hidden xl:flex`. TicketDrawer is full-width on phones. All 4-up
  metric grids → 1/2/4, 3-up project grids → 1/2/3, two-pane
  layouts and modal grids collapse to single column.
- **Phase H** — Docs + final validation pass. This entry,
  `docs/REFACTOR_LOG.md`, and a clean run of typecheck / lint /
  test / build.

Test arc: 215 → 255 passing. Lint warnings: 2 → 0.

### Added — CR #12: Dark mode
- New `useTheme` hook + `ThemeToggle` component. Three states: `light`,
  `dark`, `system`; first visit follows `prefers-color-scheme`; manual
  choice persists in localStorage (`rod.theme`).
- Toggle lives in the TopBar (Sun/Moon icon next to the help button) and on
  the Settings page (light/dark/system pills + "currently displaying"
  indicator). Keyboard shortcut `]` flips theme app-wide (mirrors `[` for
  sidebar collapse).
- Theming driven by CSS variables in `:root` / `:root.dark` (not Tailwind
  per-class `dark:` variants). Tailwind tokens (`ink`, `ink-soft`, `canvas`,
  `surface`, `subtle`, `border-default`, `border-muted`, etc.) point at the
  variables. Pill colors shift to muted dark variants.
- Brand `#FEDF00` yellow remains constant in both modes.
- Conic donut track auto-follows theme via `--donut-track`. Home hero
  gradient transitions from slate-900/slate-700 (light) to pure black on
  dark.
- 18 new tests across `useTheme.test.ts`, `ThemeToggle.test.tsx`, and
  `theme.integration.test.tsx`. Suite at 217 passing.

### Added — Phase 1: foundations
- **CR #11** — `lib/format.ts` is now pure. `isOverdue`/`daysOverdue` take an
  optional `today` parameter (defaults to `new Date()`); the pinned
  `MOCK_TODAY = 2026-05-21` is exported separately for demo reproducibility.
- **CR #2** — Single-active workspace nav and `/resources` route split:
  - `/resources` → multi-section reorderable view (default)
  - `/resources/personal` and `/resources/team` → legacy single-section
    routes kept for deep links
  - `/reports` stays as one route with internal tabs (KPI Tracker / Issue
    Reports); the workspaces panel disambiguates via `?tab=` query.
- **CR #5** — Metric cards data-driven via a new `DashboardMetric` type +
  three builder functions (`buildDashboardMetrics`, `buildReportMetrics`,
  `buildTimeMetrics`). Card config is no longer repeated JSX across pages.

### Added — Phase 2: visual upgrades
- **CR #6** — `DashboardCard` metric variant renders a CSS conic-gradient
  ring (from a new `donutGradient` helper in `lib/visual.ts`). SVG
  `DonutChart` stays available for the legacy `visual` slot.
- **CR #8** — Inline `% Done` progress bar replaces the plain percentage
  text in `IssueTable` via a new `ProgressBar` component with
  `role="progressbar"` + `aria-valuemin/max/now`.
- **CR #9** — New `PriorityPill` component shows an `AlertTriangle` icon
  inside the pill for `High`, `Urgent`, and `Immediate` priorities.

### Added — Phase 3: app-shell behaviors
- **CR #10** — `StatusBanner` below TopBar driven by a new `useSyncBanner`
  state machine. Mock-mode warning (dismissible via sessionStorage) →
  syncing → success (auto-reverts after 5s) → error (dismissible).
- **CR #1** — Collapsible sidebar via `useSidebarCollapse`. Yellow icon
  rail widens to show labels when expanded; the workspaces panel collapses
  to a thin icon-only strip. Toggle lives in the TopBar (with `[`
  keyboard shortcut) and as an in-sidebar chevron. State persists in
  localStorage.

### Added — Phase 4: navigation restructure
- **CR #3+#4 helpers** — `useSectionOrder` hook (persistent ordered list of
  section ids), `ReorderableSection` wrapper with up/down arrows, and
  `GroupedTaskTable` (expandable per-user rows with weekly hours +
  percentage).
- **CR #3+#4 (a)** — New pages: `Tasks` (my + team in one view),
  `Calendar` (month grid), `Hours` landing + `MyHours` + `TeamHours`,
  `AllProjects` (browse every project including archived). `Tasks.tsx`
  replaces `MyTasks.tsx` as the canonical route at `/tasks`.
- **CR #3+#4 (b)** — Reports gains internal tabs (KPI Tracker, Issue
  Reports). Resource Management at `/resources` becomes a multi-section
  reorderable page composed of Personal + Team sections.
- **CR #3+#4 (c)** — Primary yellow rail rewritten to 9 items: Home,
  Dashboard, Tasks, Calendar, Hours, Directory, All Projects, Projects
  (assigned to me), Settings. Demoted items (Past Due, Project Builder,
  Resource Mgmt, Time Tracking, Reports) remain reachable via the
  workspaces panel.

### Added — Phase 5: Home redesign
- **CR #7** — Home is now a Codex-style landing: slate gradient hero with
  personalized greeting + workspace selector → 4-card headline metric row
  → "Recently opened workspaces" grid → Tools section. The previous
  "Recently opened files" section is removed. `/dashboard` remains as the
  operations console.

### Tests
- 199 passing across 26 files (started at 20 across 6 files).
- Per-CR coverage standard: unit tests for new pure functions, functional
  tests for new component behavior, and at least one integration test
  per CR that touches navigation, state, or data flow.
- New test files: `format.test.ts`, `dashboardMetrics.test.ts`,
  `visual.test.ts`, `ProgressBar.test.tsx`, `PriorityPill.test.tsx`,
  `StatusBanner.test.tsx`, `useSyncBanner.test.ts`, `AppShell.test.tsx`,
  `Sidebar.test.tsx`, `useSidebarCollapse.test.ts`,
  `useSectionOrder.test.ts`, `ReorderableSection.test.tsx`,
  `GroupedTaskTable.test.tsx`, `sectionReorder.integration.test.tsx`,
  `newPages.test.tsx`, `Reports.test.tsx`, `ResourceManagement.test.tsx`,
  `RecentlyOpenedGrid.test.tsx`, `Home.test.tsx`,
  `DashboardCard.test.tsx`.

## [0.1.0] — 2026-05-21

Initial base UI scaffold. Everything below is rendered against mock data; no
real Redmine API is wired up yet.

### Added — Project foundation
- Vite + React 18 + TypeScript (strict) toolchain.
- Tailwind CSS configured with brand color `#FEDF00` (yellow), enterprise
  canvas color `#F5F7FA`, and ink palette `#111827` / `#1F2937` / `#4B5563`.
- ESLint 9 flat config (`eslint.config.js`) using `typescript-eslint`.
- Vitest + React Testing Library + `jest-dom`, with jsdom environment.
- `.env.example` placeholders for `VITE_REDMINE_BASE_URL`,
  `VITE_REDMINE_API_KEY`, and `VITE_MOCK_MODE`.

### Added — Domain types, mock data, mock API
- `src/types/redmine.ts`: `Project`, `Issue`, `IssueStatus`, `IssuePriority`,
  `Tracker`, `User`, `CustomField`, `IssueRelation`, `TimeEntry`,
  `ResourceAllocation`, `AllocationType`, `DirectoryLink`, `ConnectionSettings`,
  `ConnectionStatus`.
- `src/data/mockData.ts`: generic users (`alex.morgan@example.com`,
  `jordan.lee@example.com`, `taylor.rivera@example.com`,
  `casey.brooks@example.com`, `riley.parker@example.com`); 8 example projects;
  13 issues across statuses, trackers, priorities, and overdue states; 5 time
  entries; 4 resource allocations; full grouped directory of internal +
  external links.
- `src/services/redmineApi.ts`: 30+ async placeholder functions covering
  connection, projects, issues, time entries, users, metadata, reports, and
  directory. Mutations operate on in-memory state so the UI reflects edits.

### Added — App shell with `#FEDF00` branding
- `TopBar`: yellow `#FEDF00` background with dark navy text/icons for AA
  contrast. Includes app title, top tabs (All / Favorites / History /
  Workspaces), centered search with workspace badge, **Sync with Redmine**
  button (spinner during sync), API connection status pill, help /
  notifications / settings icons, and a user avatar slot.
- `Sidebar`: slim vertical yellow rail with 11 icon links — Home, Dashboard,
  My Tasks, Past Due, Projects, Project Builder, Resource Management, Time
  Tracking, Reports, Directory, Settings. Active route inverts to dark navy +
  yellow icon.
- `SecondaryNav`: white panel with a filter input and 11 workspace shortcuts
  (My Assigned Work, Past Due Tasks, Project Portfolio, Resource Planning,
  Time Entries, Team Workload, Project Builder, KPI Tracker, Issue Reports,
  Redmine Directory, API Settings). Live-filters as you type.
- `RightPanel`: Announcements (Info / Warning / Major incident severities),
  Upcoming (Today / Tomorrow / This Week tabs), Quick Links (Create Task, New
  Project, Log Time, Resource Planner, API Settings, Export Weekly Report),
  Recent Activity feed. Hidden on Resource Management, Project Builder, and
  Settings to give those pages more horizontal room.
- `AppShell`: composes TopBar, Sidebar, SecondaryNav, page content, and
  RightPanel; pulls connection status and current user on mount.

### Added — Shared UI primitives
- `DonutChart`: lightweight SVG donut for metric cards, supports value/total,
  color override, center label, and caption.
- `DashboardCard`: reusable metric card with title, three-dot menu, visual
  slot, status pill (`green | orange | red | blue | gray | yellow`), and
  click-to-drill behavior.
- `IssueTable`: reusable, virtualizable-ready issue list with
  - Header search (filters all visible columns)
  - Click-to-sort on every column (asc/desc indicator)
  - Per-row checkbox + select-all
  - Bulk update button (appears with selection count)
  - Refresh / Export / Filter actions
  - Issue ID + subject as blue links → open the ticket drawer
  - Row pencil → opens Quick Edit popup
  - Row external-link → opens drawer
  - Overdue dates rendered red bold
  - Urgent/Immediate rows lightly tinted red
  - Optional `daysOverdue` column for Past Due page
- `QuickEditPopup`: compact ticket popup with Status, Priority, Assignee, Due
  Date, Estimated Hours, % Done, Next Action, Short Comment, plus an
  integrated **Log Time** block (date, hours, activity, comment) so users can
  save quick-edit and log time in one action. Buttons: Cancel, Save and Log
  Time, Save Quick Edit, plus a link to Open Full Ticket Editor.
- `TicketDrawer`: slide-out drawer with Overview (subject, project, tracker,
  status, priority, assignee, description), Schedule (start, due, % done,
  estimated, spent, next action), Relations (parent, related tasks), Custom
  Fields placeholder, Attachments placeholder, and Comments / Journal
  textarea. Footer actions: Quick Edit, Add Subtask, Log Time, Duplicate,
  Mark Complete, Cancel, Save Changes.
- `ResourceTimeline`: Gantt-style view with left hierarchy table (expand
  engineer → see their issues) and right timeline of day-by-day allocation
  bars. Auto allocations = blue, Manual = purple, Overloaded = red. Today
  marker tints the current column yellow. Zoom toggle (Day / Week / Month /
  Quarter / Year). Tools / Print / Save layout buttons.

### Added — Pages
- **Home** (`/home`) — Studio-inspired welcome banner with `currentMockUser`
  name, search input, recently opened files card grid, recently opened
  workspaces card grid, and tools card grid. Each card has icon, bookmark,
  title, type label, and short description.
- **Dashboard** (`/dashboard`) — ServiceNow-inspired Overview page with
  title + workspace dropdown placeholder, refresh/edit/more buttons, work
  tabs (`Your Work`, `Your Team's Work`, `Project Health`, `Resource
  Planning`), 8 metric cards with donut visuals (Tasks assigned to you, Past
  due tasks, Hours this week, Team hours this week, Unassigned tasks,
  Projects at risk, Tasks waiting for update, Open KPIs), then a **My Tasks**
  issue table.
- **My Tasks** (`/my-tasks`) — Personal issue queue using the shared
  IssueTable, with quick edit and drawer.
- **Past Due** (`/past-due`) — Overdue queue with `daysOverdue` column, red
  date highlighting, assignee + project filters, and warning icon header.
- **Projects** (`/projects`) — Card grid of all projects with status pill,
  identifier, description, open/total issue stats, and updated date.
- **Project Builder** (`/project-builder`) — Form for project details and
  team assignment, plus a hierarchical task builder with drag handle, inline
  subject/assignee/date/estimate/priority/KPI controls, delete row, and
  "Add subtask under …" links. Save button calls the mock createProject.
- **Resource Management** (`/resources`) — Full-width ResourceTimeline.
- **Time Tracking** (`/time`) — Summary metric cards (My hours this week,
  Team hours this week, Entries this period, Average per entry), range
  selector (Daily / Weekly / Monthly / Quarterly / Yearly), group-by toggle
  (None / User / Project), Add Time modal (date / hours / user / activity /
  project / issue / comment), and editable time entry table.
- **Reports** (`/reports`) — Six donut/number cards (My hours, Team hours,
  Resolved issues, Open KPIs, Overloaded engineers, Time entries) plus a
  "coming soon" panel describing planned drill-downs.
- **Directory** (`/directory`) — Filterable, grouped link lists for
  Projects, Support, Meetings, Other, and External Links (external links use
  example.com placeholders).
- **Settings** (`/settings`) — Redmine connection form (base URL, API key
  with `password` field, mock-mode toggle), Test Connection / Save buttons,
  Sync Status panel (connected? last sync, current user), and prominent
  security note: do not ship the API key client-side — proxy through a
  backend.

### Added — Tests (20 passing)
- `api.test.ts` — 7 tests covering mock connection status, getMyIssues filter,
  getPastDueIssues exclusion of Resolved/Closed, updateIssue mutation,
  createTimeEntry roll-up to issue spent hours, getWeeklyHours/getTeamHours
  targets, and createIssue id assignment.
- `IssueTable.test.tsx` — 5 tests covering row rendering, search filtering,
  Quick Edit button callback, issue id link callback, and select-all toggle.
- `QuickEditPopup.test.tsx` — 3 tests covering field seeding, save callback,
  and full-editor handoff.
- `TicketDrawer.test.tsx` — 2 tests covering header rendering + save, and
  quick-edit handoff.
- `Dashboard.test.tsx` — 2 tests covering overview tab presence and tab
  switching.
- `SecondaryNav.test.tsx` — 1 test covering live workspace-list filter.

### Added — CI/CD
- `.github/workflows/ci.yml`: typecheck + lint + tests + production build on
  every push and pull request to `main`.
- `.github/workflows/deploy.yml`: builds with `VITE_BASE=/redmine-ops-dashboard/`
  and deploys to GitHub Pages on every push to `main` (using
  `actions/deploy-pages@v4`).

### Added — Docs
- README with setup, scripts, layout, mock data convention, Redmine wiring
  guidance, and the suggested commit plan.
- `CHANGELOG.md` (this file).
- `docs/FEATURES.md` — feature map for QA and product checklists.
- `docs/ARCHITECTURE.md` — code layout, data flow, and integration plan.
- `docs/API.md` — reference for the mock Redmine API surface.

### Notes / known limitations
- All mutations are in-memory only. Refreshing the page resets state.
- ESLint warns (not errors) on `ResourceTimeline`'s memo deps — kept as-is to
  avoid churn; will resolve as the timeline gains real interactions.
- The "Sync with Redmine" button currently writes a `lastSync` timestamp into
  mock state; no real API is contacted.
- GitHub Pages publishes the production build; the repo is public so Pages is
  available on the free GitHub plan.

### Commit log (initial scaffold)
1. Initial project scaffold (Vite + React + TS + Tailwind)
2. Add domain types, mock data, and Redmine API service
3. Add app shell with #FEDF00 brand color (TopBar, Sidebar, SecondaryNav,
   RightPanel)
4. Add reusable dashboard primitives (DashboardCard, DonutChart, IssueTable)
5. Add Quick Edit popup and Ticket Editor drawer
6. Add Gantt-style resource allocation timeline
7. Add Home, Dashboard, MyTasks, PastDue, Projects pages
8. Add TimeTracking, ResourceManagement, ProjectBuilder, Directory, Reports,
   Settings pages
9. Add Vitest + RTL tests for key interactions
10. Add GitHub Actions CI and GitHub Pages deploy workflows
11. Add README with setup, deployment, and commit-plan notes
12. Migrate ESLint to flat config (`eslint.config.js`)
