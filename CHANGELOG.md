# Changelog

All notable changes to the Redmine Operations Dashboard are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
