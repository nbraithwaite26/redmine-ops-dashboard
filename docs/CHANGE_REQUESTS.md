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

**Status:** 📥 Collected

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

**Status:** 📥 Collected

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

**Status:** 📥 Collected

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
