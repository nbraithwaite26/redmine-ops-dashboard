# Mock Redmine API reference

Every async function in `src/services/redmineApi.ts`. Signatures are
designed so that the implementation can switch from mock to real Redmine
without changing call sites.

## Connection

| Function | Purpose | Mock behavior |
| --- | --- | --- |
| `testConnection(): Promise<ConnectionStatus>` | Reports whether the dashboard can talk to Redmine. | Returns `{ connected: true, mockMode: true, ... }` when mock mode is on; otherwise reports "not configured". |
| `saveConnectionSettings(settings: ConnectionSettings): Promise<ConnectionSettings>` | Persists base URL, API key, mock-mode flag. | Stores in module-scope state. |
| `getConnectionSettings(): Promise<ConnectionSettings>` | Reads the current settings. | Returns what was last saved (or defaults). |
| `getCurrentUser(): Promise<User>` | Authenticated user. | Returns `currentMockUser` (Alex Morgan). |
| `syncWithRedmine(): Promise<{ syncedAt: string }>` | Triggers a sync. | Stamps `lastSync` with `new Date().toISOString()`. |

## Projects

| Function | Purpose |
| --- | --- |
| `getProjects(): Promise<Project[]>` | All projects. |
| `createProject(input: Partial<Project>): Promise<Project>` | Adds a new project with auto-assigned id. |
| `updateProject(id, patch): Promise<Project>` | Patches an existing project. |

## Issues

| Function | Purpose |
| --- | --- |
| `getIssues(): Promise<Issue[]>` | All issues. |
| `getMyIssues(userId?: number): Promise<Issue[]>` | Filters to the given user (defaults to current user). |
| `getPastDueIssues(today?: Date): Promise<Issue[]>` | Returns open issues whose `dueDate < today`. Defaults to pinned `2026-05-21`. |
| `getIssueById(id): Promise<Issue \| null>` | One issue. |
| `createIssue(input: Partial<Issue>): Promise<Issue>` | Creates and returns with new id. |
| `updateIssue(id, patch): Promise<Issue>` | Patches in place. |
| `deleteIssue(id): Promise<{ id: number }>` | Removes from store. |
| `addIssueComment(id, comment): Promise<{ id: number }>` | Stub — real impl POSTs to `/issues/{id}.json` `notes`. |
| `addSubtask(parentId, input): Promise<Issue>` | Creates a subtask and links it to the parent's `children`. |
| `updateIssueHierarchy(id, parentId): Promise<Issue>` | Reparent helper. |

## Time entries

| Function | Purpose |
| --- | --- |
| `getTimeEntries(): Promise<TimeEntry[]>` | All entries. |
| `createTimeEntry(input): Promise<TimeEntry>` | Creates an entry. If `issueId` is set, also adds to that issue's `spentHours`. |
| `updateTimeEntry(id, patch): Promise<TimeEntry>` | Patches an entry. |
| `deleteTimeEntry(id): Promise<{ id: number }>` | Removes an entry. |

## Users

| Function | Purpose |
| --- | --- |
| `getUsers(): Promise<User[]>` | All users. |
| `getProjectMembers(projectId): Promise<User[]>` | Mock returns all users; real impl filters by project membership. |

## Metadata

| Function | Purpose |
| --- | --- |
| `getIssueStatuses(): Promise<string[]>` | List of status names. |
| `getTrackers(): Promise<string[]>` | List of tracker names. |
| `getPriorities(): Promise<string[]>` | List of priority names. |
| `getTimeActivities(): Promise<string[]>` | Activity types for time entries. |
| `getCustomFields(): Promise<string[]>` | Empty in mock; populate when real fields are loaded. |

## Reports

| Function | Purpose |
| --- | --- |
| `getWeeklyHours(userId?): Promise<{ logged, target }>` | Sum of hours for that user (target = 40). |
| `getTeamHours(): Promise<{ logged, target }>` | Sum of all hours (target = 360). |
| `getResourceAllocations(): Promise<ResourceAllocation[]>` | Allocation rows for the timeline. |

## Directory

| Function | Purpose |
| --- | --- |
| `getDirectoryLinks(): Promise<DirectoryLink[]>` | Grouped internal + external link entries. |

---

## Mapping mock → Redmine REST

When you wire up live Redmine, here's the suggested mapping. All assume an
`X-Redmine-API-Key` header (set server-side, **not** in the browser).

| Mock function | Suggested Redmine endpoint |
| --- | --- |
| `getCurrentUser` | `GET /users/current.json` |
| `getProjects` | `GET /projects.json?limit=100` |
| `createProject` | `POST /projects.json` |
| `updateProject` | `PUT /projects/:id.json` |
| `getIssues` | `GET /issues.json?limit=100` |
| `getMyIssues` | `GET /issues.json?assigned_to_id=me` |
| `getPastDueIssues` | `GET /issues.json?due_date=<%3D<today>&status_id=open` |
| `getIssueById` | `GET /issues/:id.json?include=children,relations,journals,attachments` |
| `createIssue` | `POST /issues.json` |
| `updateIssue` | `PUT /issues/:id.json` |
| `deleteIssue` | `DELETE /issues/:id.json` |
| `addIssueComment` | `PUT /issues/:id.json` with `notes` field |
| `addSubtask` | `POST /issues.json` with `parent_issue_id` |
| `updateIssueHierarchy` | `PUT /issues/:id.json` with `parent_issue_id` |
| `getTimeEntries` | `GET /time_entries.json` |
| `createTimeEntry` | `POST /time_entries.json` |
| `updateTimeEntry` | `PUT /time_entries/:id.json` |
| `deleteTimeEntry` | `DELETE /time_entries/:id.json` |
| `getUsers` | `GET /users.json` |
| `getProjectMembers` | `GET /projects/:id/memberships.json` |
| `getIssueStatuses` | `GET /issue_statuses.json` |
| `getTrackers` | `GET /trackers.json` |
| `getPriorities` | `GET /enumerations/issue_priorities.json` |
| `getTimeActivities` | `GET /enumerations/time_entry_activities.json` |
| `getCustomFields` | `GET /custom_fields.json` (admin-only) |
| `getResourceAllocations` | No native endpoint — compute from issues + estimates, or persist your own table |

`getWeeklyHours` / `getTeamHours` / `getDirectoryLinks` have no native
Redmine endpoint; the first two should aggregate from `/time_entries.json`
on the backend, and the directory is your own configuration.

## Pinned "today" for mock mode

`getPastDueIssues` defaults `today = new Date('2026-05-21')` so the demo
data always shows a sensible set of overdue rows. Change the default once
you connect a live API.
