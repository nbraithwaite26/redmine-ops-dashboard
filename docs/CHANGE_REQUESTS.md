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
