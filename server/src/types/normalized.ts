/**
 * Wire-format shapes the proxy sends to the browser. camelCase, mirrors
 * src/types/redmine.ts on the frontend side. Adapters in server/src/adapters
 * are the only place that translates snake_case Redmine DTOs into these.
 *
 * If you change a shape here, update src/types/redmine.ts to match.
 */

export type IssueStatusName = string;
export type IssuePriorityName = string;
export type TrackerName = string;

export interface NormalizedUser {
  id: number;
  name: string;
  email: string;
  login: string;
  status: 'Active' | 'Inactive';
  groups: string[];
  roles: string[];
}

export interface NormalizedProjectSummary {
  id: number;
  name: string;
  identifier: string;
  description: string;
  status: 'Active' | 'Closed' | 'Archived' | 'At Risk';
  parentProjectId: number | null;
  createdOn: string;
  updatedOn: string;
}

export interface NormalizedProjectDetail extends NormalizedProjectSummary {
  enabledModules: string[];
  trackers: string[];
  issueCategories: string[];
}

export interface NormalizedMembership {
  userId: number;
  userName: string;
  roles: string[];
}

export interface NormalizedIssueRelation {
  id: number;
  relationType: 'relates' | 'duplicates' | 'blocks' | 'precedes' | 'follows';
  issueId: number;
}

export interface NormalizedCustomField {
  id: number;
  name: string;
  value: string | number | boolean | null;
}

export interface NormalizedIssue {
  id: number;
  projectId: number;
  projectName: string;
  tracker: TrackerName;
  status: IssueStatusName;
  priority: IssuePriorityName;
  subject: string;
  description: string;
  assignee: NormalizedUser | null;
  author: NormalizedUser;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  spentHours: number;
  doneRatio: number;
  parentIssueId: number | null;
  children: number[];
  relations: NormalizedIssueRelation[];
  customFields: NormalizedCustomField[];
  nextAction: string | null;
  createdOn: string;
  updatedOn: string;
  closedOn: string | null;
}

export interface NormalizedTimeEntry {
  id: number;
  projectId: number;
  projectName: string;
  issueId: number | null;
  user: NormalizedUser;
  activity: string;
  spentOn: string;
  hours: number;
  comments: string;
  createdOn: string;
  updatedOn: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Redmine user group. The base list endpoint (/groups.json) is
 * admin-gated and 403s for our non-admin key, so the server exposes a
 * curated catalog of known team groups and looks up members per-group
 * via /groups/:id.json?include=users (which IS readable). Mirrors the
 * frontend's Group shape.
 */
export interface NormalizedGroup {
  id: number;
  name: string;
  members: NormalizedUser[];
}

/**
 * Out-of-office entry. Sourced from Easy Redmine's
 * /easy_attendances.json — only rows whose activity has at_work=false are
 * surfaced here (Vacation, Holiday, Sick, etc.). Mirrors the frontend's
 * TimeOffEntry shape in src/types/redmine.ts.
 */
export interface NormalizedTimeOffEntry {
  id: number;
  user: NormalizedUser;
  /** ISO YYYY-MM-DD; derived from the attendance row's `arrival` timestamp. */
  date: string;
  /** Activity name from Easy Redmine (e.g. "Vacation", "Holiday Mexico"). */
  type: string;
  /** Hours out that day (full day ≈ 8). */
  hours: number;
}

export interface MetadataBundle {
  statuses: string[];
  trackers: string[];
  priorities: string[];
  timeActivities: string[];
  /** Derived from issue/project samples — empty if no harvest succeeded. */
  customFields: string[];
}

export interface GanttRow {
  id: number;
  issueId: number;
  projectId: number;
  projectName: string;
  subject: string;
  tracker: string;
  status: string;
  assigneeId: number | null;
  assigneeName: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  spentHours: number;
  doneRatio: number;
  parentIssueId: number | null;
  children: number[];
  relations: NormalizedIssueRelation[];
  isOverloaded: boolean;
  isAtRisk: boolean;
}
