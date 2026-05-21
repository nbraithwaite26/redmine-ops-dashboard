# Features

This document enumerates every feature in the v0.1.0 base UI. Use it as a QA
checklist or a product-manager handoff when wiring up real Redmine endpoints.

Status legend:
- ✅ Implemented (mock data)
- 🟡 Placeholder (UI present, behavior is mock-only or stubbed)
- ⬜ Not yet built

---

## 1. App shell

| Feature | Status | Notes |
| --- | --- | --- |
| Yellow `#FEDF00` top header | ✅ | `TopBar.tsx` |
| Yellow `#FEDF00` left icon sidebar | ✅ | `Sidebar.tsx` |
| Secondary searchable workspace nav | ✅ | `SecondaryNav.tsx` |
| Right-side utility panel | ✅ | `RightPanel.tsx` |
| App title "Redmine Operations Dashboard" | ✅ |  |
| Global search input | 🟡 | UI present, no backend |
| Sync with Redmine button | 🟡 | Calls mock `syncWithRedmine()` |
| API connection status pill | ✅ | Green / Orange / Red |
| User avatar / profile slot | 🟡 | Icon placeholder, no menu yet |
| Help / Notifications / Settings icon buttons | 🟡 | Click handlers TBD |
| Top tabs (All / Favorites / History / Workspaces) | 🟡 | Static for now |

## 2. Sidebar pages (primary nav)

| Page | Route | Status |
| --- | --- | --- |
| Home | `/home` | ✅ |
| Dashboard | `/dashboard` | ✅ |
| My Tasks | `/my-tasks` | ✅ |
| Past Due | `/past-due` | ✅ |
| Projects | `/projects` | ✅ |
| Project Builder | `/project-builder` | ✅ |
| Resource Management | `/resources` | ✅ |
| Time Tracking | `/time` | ✅ |
| Reports | `/reports` | ✅ |
| Directory | `/directory` | ✅ |
| Settings | `/settings` | ✅ |

## 3. Home page

| Feature | Status |
| --- | --- |
| Welcome banner with current user | ✅ |
| Inline search input | 🟡 |
| Recently opened **files** card grid | ✅ |
| Recently opened **workspaces** card grid | ✅ |
| Tools card grid | ✅ |
| Bookmark icons on cards | 🟡 (decorative) |

## 4. Dashboard

| Feature | Status |
| --- | --- |
| Page title + workspace dropdown | ✅ |
| Refresh / Edit / More toolbar buttons | 🟡 |
| Tabs: Your Work / Your Team's Work / Project Health / Resource Planning | ✅ (switchable) |
| Metric card: Tasks assigned to you (donut) | ✅ |
| Metric card: Past due tasks (donut, red) | ✅ |
| Metric card: Hours this week (donut, green) | ✅ |
| Metric card: Team hours this week (donut, orange) | ✅ |
| Metric card: Unassigned tasks | ✅ |
| Metric card: Projects at risk | ✅ |
| Metric card: Tasks waiting for update | ✅ |
| Metric card: Open KPIs | ✅ |
| Each card has three-dot menu, click-to-drill | ✅ |
| "My Tasks" issue table below cards | ✅ |
| Edit / Export buttons next to table | 🟡 |

## 5. Issue table (shared)

Used on Dashboard, My Tasks, and Past Due.

| Feature | Status |
| --- | --- |
| Header search input | ✅ |
| Filter button | 🟡 |
| Refresh button | ✅ |
| Export button | 🟡 |
| Select-all + per-row checkboxes | ✅ |
| Bulk update button (with selection count) | 🟡 |
| Click ID → open ticket drawer | ✅ |
| Click subject → open ticket drawer | ✅ |
| Sort by ID, subject, project, status, priority, assignee, dates, hours, % done, days overdue | ✅ |
| Pencil icon → open Quick Edit | ✅ |
| External-link icon → open drawer | ✅ |
| Delete row icon | 🟡 (placeholder, no confirm) |
| More menu | 🟡 |
| Status pills | ✅ |
| Priority pills | ✅ |
| Overdue date highlighting | ✅ |
| High-priority row tinting | ✅ |
| Optional `daysOverdue` column | ✅ (Past Due only) |

## 6. Quick Edit popup

| Field / action | Status |
| --- | --- |
| Status select | ✅ |
| Priority select | ✅ |
| Assignee select (incl. Unassigned) | ✅ |
| Due Date | ✅ |
| Estimated Hours | ✅ |
| % Done | ✅ |
| Next Action | ✅ |
| Short Comment textarea | 🟡 (collected, not yet posted) |
| Log Time block: date, hours, activity, comment | ✅ |
| Save Quick Edit | ✅ |
| Save and Log Time | ✅ |
| Open Full Ticket Editor link | ✅ |
| Cancel | ✅ |

## 7. Ticket Editor drawer

| Field / action | Status |
| --- | --- |
| Subject | ✅ |
| Project select | ✅ |
| Tracker select | ✅ |
| Status select | ✅ |
| Priority select | ✅ |
| Assignee select | ✅ |
| Description textarea | ✅ |
| Start date / Due date / % Done | ✅ |
| Estimated / Spent hours | ✅ (spent is readonly) |
| Next action | ✅ |
| Parent task | ✅ |
| Related tasks | 🟡 (display-only) |
| Custom fields | 🟡 (placeholder) |
| Attachments | 🟡 (placeholder dropzone) |
| Comments / journal | 🟡 (textarea + post button stub) |
| Quick Edit handoff | ✅ |
| Add Subtask | 🟡 |
| Log Time | 🟡 (links to Time Tracking) |
| Duplicate | 🟡 |
| Mark Complete | ✅ (sets status=Closed, %=100 in draft) |
| Save Changes | ✅ |
| Cancel | ✅ |

## 8. Past Due page

| Feature | Status |
| --- | --- |
| Overdue queue title with warning icon | ✅ |
| Assignee filter | ✅ |
| Project filter | ✅ |
| `daysOverdue` column | ✅ |
| Red date highlight | ✅ |
| Quick Edit + drawer | ✅ |

## 9. Time Tracking

| Feature | Status |
| --- | --- |
| Range selector (Daily / Weekly / Monthly / Quarterly / Yearly) | 🟡 (UI ready, no real filter) |
| Group-by None / User / Project | ✅ |
| My hours this week donut | ✅ |
| Team hours this week donut | ✅ |
| Entries this period | ✅ |
| Average per entry | ✅ |
| Add Time modal (date / hours / user / activity / project / issue / comment) | ✅ |
| Delete time entry | ✅ |
| Export button | 🟡 |
| Edit time entry inline | 🟡 (delete only for now) |

## 10. Resource Management

| Feature | Status |
| --- | --- |
| Left hierarchy with engineers + expandable issues | ✅ |
| Subject / Name, Priority, Estimated, Spent columns | ✅ |
| Right-side timeline grid | ✅ |
| Today marker | ✅ |
| Weekend tinting | ✅ |
| Auto allocation bars (blue) | ✅ |
| Manual allocation bars (purple) | ✅ |
| Overloaded bars (red) | ✅ |
| Day / Week / Month / Quarter / Year zoom toggle | 🟡 (UI ready, redraw TBD) |
| Drag-and-drop reschedule | ⬜ |
| Resize allocation bar | ⬜ |
| Save layout button | 🟡 |
| Tools button | 🟡 |
| Print button | 🟡 |

## 11. Project Builder

| Feature | Status |
| --- | --- |
| Project name / identifier / description | ✅ |
| Team assignment (multi-select team) | 🟡 (checkboxes only) |
| Add task | ✅ |
| Add subtask under a task | ✅ |
| Drag handle on rows | 🟡 (visual only) |
| Inline subject, assignee, due date, estimate, priority, KPI flag, delete | ✅ |
| Save structure (calls mock `createProject`) | ✅ |
| Push to Redmine | 🟡 (button only) |

## 12. Directory

| Feature | Status |
| --- | --- |
| Filter input | ✅ |
| Grouped: Projects, Support, Meetings, Other, External Links | ✅ |
| Internal links route within the app | ✅ |
| External links open in new tab | ✅ |

## 13. Reports

| Feature | Status |
| --- | --- |
| My hours / Team hours donuts | ✅ |
| Resolved issues donut | ✅ |
| Open KPIs donut | ✅ |
| Overloaded engineers donut | ✅ |
| Time entries count | ✅ |
| Drill-down charts | ⬜ |
| Export weekly report | 🟡 |

## 14. Settings

| Feature | Status |
| --- | --- |
| Redmine Base URL input | ✅ |
| API Key input (`password` type) | ✅ |
| Mock-mode toggle | ✅ |
| Test Connection button | ✅ |
| Save Connection button | ✅ |
| Sync Status panel (message, last sync, current user) | ✅ |
| Security note re: not exposing API key client-side | ✅ |
| Notes panel for live integration | ✅ |

## 15. Right-side utility panel

| Section | Status |
| --- | --- |
| Announcements with severity badges (Info / Warning / Major incident) | ✅ |
| Upcoming with Today / Tomorrow / This Week tabs | ✅ |
| Quick Links: Create Task, New Project, Log Time, Resource Planner, API Settings, Export Weekly Report | ✅ |
| Recent Activity feed | ✅ |
| Hidden on Resource Management, Project Builder, Settings | ✅ |

## 16. Mock Redmine API service

Every UI path calls one of these. Replace the body of each function with real
`fetch` calls when wiring up a Redmine instance; signatures are stable.

**Connection**: `testConnection`, `saveConnectionSettings`,
`getConnectionSettings`, `getCurrentUser`, `syncWithRedmine`.

**Projects**: `getProjects`, `createProject`, `updateProject`.

**Issues**: `getIssues`, `getMyIssues`, `getPastDueIssues`, `getIssueById`,
`createIssue`, `updateIssue`, `deleteIssue`, `addIssueComment`, `addSubtask`,
`updateIssueHierarchy`.

**Time**: `getTimeEntries`, `createTimeEntry`, `updateTimeEntry`,
`deleteTimeEntry`.

**Users**: `getUsers`, `getProjectMembers`.

**Metadata**: `getIssueStatuses`, `getTrackers`, `getPriorities`,
`getTimeActivities`, `getCustomFields`.

**Reports**: `getWeeklyHours`, `getTeamHours`, `getResourceAllocations`.

**Directory**: `getDirectoryLinks`.

## 17. Testing & CI

| Feature | Status |
| --- | --- |
| Vitest + RTL setup | ✅ |
| API service tests | ✅ (7) |
| IssueTable tests | ✅ (5) |
| QuickEditPopup tests | ✅ (3) |
| TicketDrawer tests | ✅ (2) |
| Dashboard tests | ✅ (2) |
| SecondaryNav tests | ✅ (1) |
| CI workflow (typecheck + lint + test + build) | ✅ |
| GitHub Pages deploy workflow | ✅ |

## 18. What's intentionally not built yet

The pieces below are out-of-scope for the v0.1.0 base UI but are easy follow-ons.

- Live Redmine REST integration (replace mock api bodies).
- Server-side proxy for API key safety (recommended architecture in README).
- Drag-and-drop in the resource timeline and project builder.
- Saved filters / saved views.
- Multi-tab favorites / history.
- Notifications inbox.
- Tracking comment posts (Add Comment, Add Subtask) end-to-end.
- Pagination — current mock dataset fits on one screen.
- Authentication (Redmine API key is the only auth assumed).
- i18n.
