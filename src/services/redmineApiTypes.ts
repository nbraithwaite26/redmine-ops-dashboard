import type {
  ConnectionSettings,
  ConnectionStatus,
  DirectoryLink,
  Issue,
  Project,
  ResourceAllocation,
  TimeEntry,
  User,
} from '../types/redmine';

/**
 * The Redmine API surface the UI depends on. Both the mock implementation
 * (mockRedmineApi.ts) and the future real backend client (realRedmineApi.ts)
 * implement this interface. The facade in redmineApi.ts selects one and
 * re-exports each method as a named export so call sites do not change.
 *
 * IMPORTANT: when wiring up a real Redmine REST instance, do NOT call the
 * Redmine API directly from the browser. The X-Redmine-API-Key header
 * carries full user permissions and exposing it client-side leaks creds
 * and creates a CORS surface. Stand up a thin backend proxy and have the
 * real implementation call THAT.
 */
export interface RedmineApi {
  // ─── Connection ───────────────────────────────────────────────────────
  testConnection(): Promise<ConnectionStatus>;
  saveConnectionSettings(settings: ConnectionSettings): Promise<ConnectionSettings>;
  getConnectionSettings(): Promise<ConnectionSettings>;
  getCurrentUser(): Promise<User>;
  syncWithRedmine(): Promise<{ syncedAt: string }>;

  // ─── Projects ─────────────────────────────────────────────────────────
  getProjects(): Promise<Project[]>;
  createProject(input: Partial<Project>): Promise<Project>;
  updateProject(id: number, patch: Partial<Project>): Promise<Project>;

  // ─── Issues ───────────────────────────────────────────────────────────
  getIssues(): Promise<Issue[]>;
  getMyIssues(userId?: number): Promise<Issue[]>;
  getPastDueIssues(today?: Date): Promise<Issue[]>;
  getIssueById(id: number): Promise<Issue | null>;
  createIssue(input: Partial<Issue>): Promise<Issue>;
  updateIssue(id: number, patch: Partial<Issue>): Promise<Issue>;
  deleteIssue(id: number): Promise<{ id: number }>;
  addIssueComment(id: number, comment: string): Promise<{ id: number }>;
  addSubtask(parentId: number, input: Partial<Issue>): Promise<Issue>;
  updateIssueHierarchy(id: number, parentId: number | null): Promise<Issue>;

  // ─── Time ─────────────────────────────────────────────────────────────
  getTimeEntries(opts?: {
    from?: string;
    to?: string;
    userId?: number;
    issueId?: number;
  }): Promise<TimeEntry[]>;
  createTimeEntry(input: Partial<TimeEntry>): Promise<TimeEntry>;
  updateTimeEntry(id: number, patch: Partial<TimeEntry>): Promise<TimeEntry>;
  deleteTimeEntry(id: number): Promise<{ id: number }>;

  // ─── Users ────────────────────────────────────────────────────────────
  getUsers(): Promise<User[]>;
  getProjectMembers(projectId: number): Promise<User[]>;

  // ─── Metadata ─────────────────────────────────────────────────────────
  getIssueStatuses(): Promise<string[]>;
  getTrackers(): Promise<string[]>;
  getPriorities(): Promise<string[]>;
  getTimeActivities(): Promise<string[]>;
  getCustomFields(): Promise<string[]>;

  // ─── Reports ──────────────────────────────────────────────────────────
  getWeeklyHours(userId?: number): Promise<{ logged: number; target: number }>;
  getTeamHours(): Promise<{ logged: number; target: number }>;
  getResourceAllocations(projectId?: number): Promise<ResourceAllocation[]>;
  /**
   * Team Gantt inputs derived from a single scoped /gantt fetch. Unlike
   * getUsers() (which 403s for non-admin keys), the user list here is
   * derived from issue assignees in the Gantt rows, so the schedule
   * populates even when the users endpoint is degraded. CR #16.
   */
  getTeamSchedule(projectId?: number): Promise<{
    users: User[];
    issues: Issue[];
    allocations: ResourceAllocation[];
  }>;

  // ─── Directory ────────────────────────────────────────────────────────
  getDirectoryLinks(): Promise<DirectoryLink[]>;
}
