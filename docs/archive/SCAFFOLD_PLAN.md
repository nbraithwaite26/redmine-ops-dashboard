# Scaffold plan (approved)

Plan for implementing change requests #1–#11 from
[`CHANGE_REQUESTS.md`](./CHANGE_REQUESTS.md). All decisions below were
confirmed in chat before any code was written.

## Dependency graph

```
#11 (pure format.ts) ────── independent, lands first
#2  (single-active + /resources split) ────── independent, small
#5  (DashboardMetric[]) ────── prerequisite for #6, #7
   └── #6 (conic-gradient donut) ────── uses metric.progress
        └── #7 (Home Codex-style landing) ────── uses cards + grid sections
#8  (% Done progress bar) ────── independent
#9  (icon-in-pill priority) ────── independent
#10 (sticky sync banner) ────── independent
#1  (collapsible sidebar) ────── lands before #3+#4
   └── #3 + #4 (merged sidebar restructure) ────── 8-item primary rail
```

## Commit order (11 commits)

| # | Phase | Change | Size |
| --- | --- | --- | --- |
| 1 | Foundations | #11 — Pure `lib/format.ts` | S |
| 2 | Foundations | #2 — Single-active workspace + `/resources` split | S |
| 3 | Foundations | #5 — `DashboardMetric[]` data shape | M |
| 4 | Visuals | #6 — Conic-gradient donut in `DashboardCard` | S |
| 5 | Visuals | #8 — Inline % Done progress bar | S |
| 6 | Visuals | #9 — Icon-in-pill priority (High/Urgent/Immediate) | S |
| 7 | App shell | #10 — Sticky sync banner (smart state) | M |
| 8 | App shell | #1 — Collapsible sidebar | M |
| 9 | Nav restructure | #3+#4 — Primary rail rewrite + new pages | L |
| 10 | Nav restructure | Helpers: `ReorderableSection`, `GroupedTaskTable`, `useSectionOrder` | M |
| 11 | Home redesign | #7 — Home Codex-style landing | M |

## Confirmed decisions

### #1 — Collapsible sidebar
- Yellow icon rail shows **labels next to icons** when expanded.
- Toggle lives in the TopBar **and** as a chevron at the top of the sidebar
  **and** as a keyboard shortcut (`[`).
- Collapsed state shows a **thin icon-only strip** of the workspaces panel
  (does not hide it entirely).
- Collapsed state **persists in localStorage**.

### #2 — Single-active workspace
- `/resources` splits into two routes:
  - `/resources/personal` (Resource Planning view)
  - `/resources/team` (Team Workload view)
- `/reports` does **not** split into routes — it gets internal tabs
  instead (Q2b answered → Option B; see #3+#4 below).

### #3 + #4 — Sidebar restructure
**Primary yellow rail (9 items):**

1. Home (kept implicitly; redesigned in #7)
2. Dashboard
3. Tasks (renamed from My Tasks; gains a Team section)
4. Calendar (new)
5. Hours (new landing → `/hours/me` + `/hours/team`)
6. Directory
7. All Projects (new, `/projects/all`)
8. Projects (assigned to me — current `/projects` filtered to mine)
9. Settings

**Demoted to secondary workspaces nav** (still in the app, just not in
primary rail): Past Due, Project Builder, Resource Mgmt, Time Tracking,
Reports.

**New pages:**
- `Calendar.tsx` — month-grid view of issues by due date
- `Hours.tsx` — landing with cards linking to My/Team Hours
- `MyHours.tsx` (`/hours/me`)
- `TeamHours.tsx` (`/hours/team`)
- `AllProjects.tsx` (`/projects/all`)
- `Tasks.tsx` — replaces MyTasks.tsx; My-tasks + Team-tasks sections

**Reports page becomes tabbed:** `[KPI Tracker] [Issue Reports]` swapping
the body, single `/reports` route (Q2b → Option B).

**Resource Management page:** single page with **reorderable sections**.
Initial sections: Personal Gantt + Team Gantt. Section header has up/down
arrows. Architecture supports adding more section types later via
`useSectionOrder` hook (state persisted in localStorage).

**Tasks page "Team tasks" section:** modeled on user's "AE Spent Time"
screenshot — grouped rows by user with weekly hours + percentage, expandable
to show individual issue rows.

### #5 — `DashboardMetric[]`
```ts
interface DashboardMetric {
  id: string;
  title: string;
  value: string | number;
  total?: string | number;
  progress: number;          // 0–100, independent of value/total
  statusLabel?: string;
  statusColor?: 'green'|'orange'|'red'|'blue'|'gray'|'yellow';
  color: string;             // hex for donut fill
  route?: string;            // optional drill-to route
}
```
Three arrays in `mockData.ts`: `dashboardMetrics`, `reportMetrics`,
`timeMetrics`. Pages map the array instead of repeating JSX.

### #6 — Conic-gradient donut
`DashboardCard` renders a CSS `conic-gradient` ring driven by
`metric.progress`. Existing `DonutChart` component stays available as an
opt-in for cases needing precise SVG stroke control.

### #7 — Home redesign (Option C)
Final Home page sections, in order:
1. Slate gradient hero with **personalized greeting** (`Welcome back,
   Alex Morgan`) and decorative workspace selector.
2. 4-card metric row (subset of `dashboardMetrics`).
3. "Recently opened workspaces" grid — 8 cards.
4. Tools section (kept).

"Recently opened files" section is **dropped** (Q5b → option c).

`/dashboard` stays as the deeper ServiceNow-style operations console (full
metric grid + tabs + My Tasks table).

### #8 — Inline % Done progress bar
Replaces text `40%` in IssueTable's `% Done` column with a horizontal bar
(green fill) + the percentage number to its right.

### #9 — Icon-in-pill priority
New `PriorityPill` component renders an `AlertTriangle` icon inside the
pill for `High`, `Urgent`, and `Immediate` priorities. Consumed by
IssueTable.

### #10 — Sync banner (smart-state)
Single `StatusBanner` component under TopBar with three states:
- **Mock mode (default):** orange `⚠ Mock mode is active — using sample
  data`. Dismissible (× hides for the session).
- **After successful sync:** green `✓ Sync completed · just now`. Auto-
  reverts to mock-mode message after 5 seconds.
- **After failed sync:** red `✗ Sync failed: {reason}`. Dismissible.

### #11 — Pure `lib/format.ts`
- Remove module-level `TODAY = new Date('2026-05-21')`.
- `isOverdue(due, today = new Date())` and `daysOverdue(due, today =
  new Date())` take `today` as a parameter.
- Callers (`IssueTable`, `redmineApi.getPastDueIssues`) pass an explicit
  `today` so the mock pinned date (2026-05-21) still produces stable demos.

## Files

**New (~13):**
- `src/components/StatusBanner.tsx`
- `src/components/PriorityPill.tsx`
- `src/components/RecentlyOpenedGrid.tsx`
- `src/components/ProgressBar.tsx`
- `src/components/ReorderableSection.tsx`
- `src/components/GroupedTaskTable.tsx`
- `src/components/CalendarGrid.tsx`
- `src/hooks/useSidebarCollapse.ts`
- `src/hooks/useSectionOrder.ts`
- `src/pages/Calendar.tsx`
- `src/pages/Hours.tsx`
- `src/pages/MyHours.tsx`
- `src/pages/TeamHours.tsx`
- `src/pages/AllProjects.tsx`
- `src/pages/Tasks.tsx`

**Edited (~16):**
- `src/App.tsx`
- `src/lib/format.ts`
- `src/types/redmine.ts`
- `src/data/mockData.ts`
- `src/services/redmineApi.ts`
- `src/components/AppShell.tsx`
- `src/components/TopBar.tsx`
- `src/components/Sidebar.tsx`
- `src/components/SecondaryNav.tsx`
- `src/components/DashboardCard.tsx`
- `src/components/DonutChart.tsx`
- `src/components/IssueTable.tsx`
- `src/pages/Home.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Reports.tsx`
- `src/pages/TimeTracking.tsx`
- `src/pages/ResourceManagement.tsx`

**Deleted:**
- `src/pages/MyTasks.tsx` → renamed to `Tasks.tsx`

**New tests (~5):**
- `src/tests/format.test.ts`
- `src/tests/Home.test.tsx`
- `src/tests/AppShell.test.tsx`
- `src/tests/PriorityPill.test.tsx`
- `src/tests/StatusBanner.test.tsx`

**Updated tests:**
- `src/tests/IssueTable.test.tsx` (progress bar, priority icon)
- `src/tests/SecondaryNav.test.tsx` (single-active)
- `src/tests/Dashboard.test.tsx` (data-driven cards)
- `src/tests/api.test.ts` (format pure)

## Out of scope for this batch

The following items were explicitly considered and rejected (full
rationale in `CHANGE_REQUESTS.md` → "Codex-comparison explicit skips"):
- Routing replaced by `useState` page switcher
- Aggressive responsive hiding of chrome
- Stripped-down IssueTable
- Non-persistent mock API
- Tightening Issue types to remove `null` from `assignee`/`dueDate`
