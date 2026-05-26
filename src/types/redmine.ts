/**
 * Redmine domain types. These are intentionally pragmatic — close enough to
 * Redmine's REST API shape that adapters can map cleanly later, while
 * remaining ergonomic for the UI.
 */

export type IssueStatus =
  | 'New'
  | 'In Progress'
  | 'Resolved'
  | 'Feedback'
  | 'Closed'
  | 'Rejected'
  | 'On Hold';

export type IssuePriority = 'Low' | 'Normal' | 'High' | 'Urgent' | 'Immediate';

export type Tracker = 'Bug' | 'Feature' | 'Support' | 'Task' | 'KPI' | 'Milestone';

export type ProjectStatus = 'Active' | 'Closed' | 'Archived' | 'At Risk';

export interface Project {
  id: number;
  name: string;
  identifier: string;
  description: string;
  status: ProjectStatus;
  parentProjectId: number | null;
  createdOn: string;
  updatedOn: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  login: string;
  status: 'Active' | 'Inactive';
  groups: string[];
  roles: string[];
}

export interface CustomField {
  id: number;
  name: string;
  value: string | number | boolean | null;
}

export interface IssueRelation {
  id: number;
  relationType: 'relates' | 'duplicates' | 'blocks' | 'precedes' | 'follows';
  issueId: number;
}

export interface Issue {
  id: number;
  projectId: number;
  projectName: string;
  tracker: Tracker;
  status: IssueStatus;
  priority: IssuePriority;
  subject: string;
  description: string;
  assignee: User | null;
  author: User;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  spentHours: number;
  doneRatio: number;
  parentIssueId: number | null;
  children: number[];
  relations: IssueRelation[];
  customFields: CustomField[];
  nextAction: string | null;
  createdOn: string;
  updatedOn: string;
  closedOn: string | null;
}

export interface TimeEntry {
  id: number;
  projectId: number;
  projectName?: string;
  issueId: number | null;
  user: User;
  activity: string;
  spentOn: string;
  hours: number;
  comments: string;
  createdOn: string;
  updatedOn: string;
}

export type AllocationType = 'Auto' | 'Manual' | 'Vacation' | 'Reserved';

export interface ResourceAllocation {
  id: number;
  userId: number;
  issueId: number | null;
  projectId: number;
  startDate: string;
  endDate: string;
  allocatedHours: number;
  spentHours: number;
  allocationType: AllocationType;
  isOverloaded: boolean;
}

export interface DirectoryLink {
  id: number;
  group: string;
  label: string;
  url: string;
  type: 'internal' | 'external';
}

export interface ConnectionSettings {
  baseUrl: string;
  apiKey: string;
  mockMode: boolean;
}

export interface ConnectionStatus {
  connected: boolean;
  mockMode: boolean;
  /**
   * Whether the backend is in REDMINE_READ_ONLY mode. In mock mode this is
   * always false. In real mode it reflects the backend's REDMINE_READ_ONLY
   * env flag.
   */
  readOnly: boolean;
  lastSync: string | null;
  currentUser: User | null;
  message: string;
}

/**
 * Single source of truth for a dashboard metric card. `progress` is the
 * donut fill (0–100) and is intentionally independent of `value`/`total`
 * because the two often have different units (e.g. "12 tasks" can't drive
 * a percentage by itself, but "12 of 20" can).
 */
export interface DashboardMetric {
  id: string;
  title: string;
  /** Big number shown in the center of the card. */
  value: string | number;
  /** Optional "/ N" denominator shown alongside the value. */
  total?: string | number;
  /** 0–100, drives donut fill. */
  progress: number;
  /** Status pill text. */
  statusLabel?: string;
  /** Status pill color. */
  statusColor?: 'green' | 'orange' | 'red' | 'blue' | 'gray' | 'yellow';
  /** Hex color for the donut fill. */
  color: string;
  /** Optional sub-caption underneath the donut. */
  caption?: string;
  /** If set, the card becomes clickable and navigates here. */
  route?: string;
}
