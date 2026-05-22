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
