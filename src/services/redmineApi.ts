/**
 * Mock Redmine API service.
 *
 * Every function here returns mock data, but the signatures are intentionally
 * close to what a real Redmine REST integration would expose. When wiring up
 * a real Redmine backend later:
 *
 *  - DO NOT call the Redmine REST API with your API key directly from the
 *    browser. Proxy through a backend so the key is never exposed and CORS
 *    is not an issue.
 *  - The functions below should be the *only* place mock-vs-real switching
 *    happens — keep call sites unchanged.
 */

import { MOCK_TODAY } from '../lib/format';
import {
  currentMockUser,
  mockAllocations,
  mockDirectoryLinks,
  mockIssues,
  mockIssueStatuses,
  mockPriorities,
  mockProjects,
  mockTimeActivities,
  mockTimeEntries,
  mockTrackers,
  mockUsers,
} from '../data/mockData';
import type {
  ConnectionSettings,
  ConnectionStatus,
  Issue,
  Project,
  ResourceAllocation,
  TimeEntry,
  User,
} from '../types/redmine';

// In-memory mutable copies so the UI can simulate edits.
let issues: Issue[] = [...mockIssues];
let timeEntries: TimeEntry[] = [...mockTimeEntries];
let projects: Project[] = [...mockProjects];

let connectionSettings: ConnectionSettings = {
  baseUrl: '',
  apiKey: '',
  mockMode: true,
};

let lastSync: string | null = null;

const wait = <T,>(value: T, ms = 120): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

// ─── Connection ──────────────────────────────────────────────────────────

export async function testConnection(): Promise<ConnectionStatus> {
  if (connectionSettings.mockMode) {
    return wait({
      connected: true,
      mockMode: true,
      lastSync,
      currentUser: currentMockUser,
      message: 'Mock data mode active. No Redmine call was made.',
    });
  }
  // Real implementation would hit /users/current.json with X-Redmine-API-Key.
  return wait({
    connected: false,
    mockMode: false,
    lastSync,
    currentUser: null,
    message: 'Connection not configured. Set base URL and API key.',
  });
}

export async function saveConnectionSettings(
  settings: ConnectionSettings,
): Promise<ConnectionSettings> {
  connectionSettings = { ...settings };
  return wait(connectionSettings);
}

export async function getConnectionSettings(): Promise<ConnectionSettings> {
  return wait(connectionSettings);
}

export async function getCurrentUser(): Promise<User> {
  return wait(currentMockUser);
}

export async function syncWithRedmine(): Promise<{ syncedAt: string }> {
  lastSync = new Date().toISOString();
  return wait({ syncedAt: lastSync });
}

// ─── Projects ────────────────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  return wait(projects);
}

export async function createProject(input: Partial<Project>): Promise<Project> {
  const next: Project = {
    id: Math.max(...projects.map((p) => p.id)) + 1,
    name: input.name ?? 'New Project',
    identifier: input.identifier ?? 'new-project',
    description: input.description ?? '',
    status: input.status ?? 'Active',
    parentProjectId: input.parentProjectId ?? null,
    createdOn: new Date().toISOString().slice(0, 10),
    updatedOn: new Date().toISOString().slice(0, 10),
  };
  projects = [...projects, next];
  return wait(next);
}

export async function updateProject(id: number, patch: Partial<Project>): Promise<Project> {
  projects = projects.map((p) => (p.id === id ? { ...p, ...patch, updatedOn: new Date().toISOString().slice(0, 10) } : p));
  return wait(projects.find((p) => p.id === id)!);
}

// ─── Issues ──────────────────────────────────────────────────────────────

export async function getIssues(): Promise<Issue[]> {
  return wait(issues);
}

export async function getMyIssues(userId: number = currentMockUser.id): Promise<Issue[]> {
  return wait(issues.filter((i) => i.assignee?.id === userId));
}

export async function getPastDueIssues(today: Date = MOCK_TODAY): Promise<Issue[]> {
  const cutoff = today.toISOString().slice(0, 10);
  return wait(
    issues.filter(
      (i) => i.dueDate !== null && i.dueDate < cutoff && i.status !== 'Closed' && i.status !== 'Resolved',
    ),
  );
}

export async function getIssueById(id: number): Promise<Issue | null> {
  return wait(issues.find((i) => i.id === id) ?? null);
}

export async function createIssue(input: Partial<Issue>): Promise<Issue> {
  const id = Math.max(...issues.map((i) => i.id)) + 1;
  const next: Issue = {
    id,
    projectId: input.projectId ?? projects[0].id,
    projectName: input.projectName ?? projects[0].name,
    tracker: input.tracker ?? 'Task',
    status: input.status ?? 'New',
    priority: input.priority ?? 'Normal',
    subject: input.subject ?? 'New issue',
    description: input.description ?? '',
    assignee: input.assignee ?? null,
    author: input.author ?? currentMockUser,
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    estimatedHours: input.estimatedHours ?? null,
    spentHours: input.spentHours ?? 0,
    doneRatio: input.doneRatio ?? 0,
    parentIssueId: input.parentIssueId ?? null,
    children: input.children ?? [],
    relations: input.relations ?? [],
    customFields: input.customFields ?? [],
    nextAction: input.nextAction ?? null,
    createdOn: new Date().toISOString().slice(0, 10),
    updatedOn: new Date().toISOString().slice(0, 10),
    closedOn: null,
  };
  issues = [...issues, next];
  return wait(next);
}

export async function updateIssue(id: number, patch: Partial<Issue>): Promise<Issue> {
  issues = issues.map((i) =>
    i.id === id ? { ...i, ...patch, updatedOn: new Date().toISOString().slice(0, 10) } : i,
  );
  return wait(issues.find((i) => i.id === id)!);
}

export async function deleteIssue(id: number): Promise<{ id: number }> {
  issues = issues.filter((i) => i.id !== id);
  return wait({ id });
}

export async function addIssueComment(id: number, _comment: string): Promise<{ id: number }> {
  // Real implementation would POST a note to /issues/{id}.json
  return wait({ id });
}

export async function addSubtask(parentId: number, input: Partial<Issue>): Promise<Issue> {
  const subtask = await createIssue({ ...input, parentIssueId: parentId });
  issues = issues.map((i) =>
    i.id === parentId ? { ...i, children: [...i.children, subtask.id] } : i,
  );
  return subtask;
}

export async function updateIssueHierarchy(id: number, parentId: number | null): Promise<Issue> {
  return updateIssue(id, { parentIssueId: parentId });
}

// ─── Time ────────────────────────────────────────────────────────────────

export async function getTimeEntries(): Promise<TimeEntry[]> {
  return wait(timeEntries);
}

export async function createTimeEntry(input: Partial<TimeEntry>): Promise<TimeEntry> {
  const id = Math.max(0, ...timeEntries.map((t) => t.id)) + 1;
  const next: TimeEntry = {
    id,
    projectId: input.projectId ?? projects[0].id,
    issueId: input.issueId ?? null,
    user: input.user ?? currentMockUser,
    activity: input.activity ?? 'Development',
    spentOn: input.spentOn ?? new Date().toISOString().slice(0, 10),
    hours: input.hours ?? 0,
    comments: input.comments ?? '',
    createdOn: new Date().toISOString().slice(0, 10),
    updatedOn: new Date().toISOString().slice(0, 10),
  };
  timeEntries = [...timeEntries, next];
  // Reflect spent time on the linked issue
  if (next.issueId) {
    issues = issues.map((i) =>
      i.id === next.issueId ? { ...i, spentHours: i.spentHours + next.hours } : i,
    );
  }
  return wait(next);
}

export async function updateTimeEntry(id: number, patch: Partial<TimeEntry>): Promise<TimeEntry> {
  timeEntries = timeEntries.map((t) =>
    t.id === id ? { ...t, ...patch, updatedOn: new Date().toISOString().slice(0, 10) } : t,
  );
  return wait(timeEntries.find((t) => t.id === id)!);
}

export async function deleteTimeEntry(id: number): Promise<{ id: number }> {
  timeEntries = timeEntries.filter((t) => t.id !== id);
  return wait({ id });
}

// ─── Users ───────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  return wait(mockUsers);
}

export async function getProjectMembers(_projectId: number): Promise<User[]> {
  return wait(mockUsers);
}

// ─── Metadata ────────────────────────────────────────────────────────────

export async function getIssueStatuses(): Promise<string[]> {
  return wait(mockIssueStatuses);
}

export async function getTrackers(): Promise<string[]> {
  return wait(mockTrackers);
}

export async function getPriorities(): Promise<string[]> {
  return wait(mockPriorities);
}

export async function getTimeActivities(): Promise<string[]> {
  return wait(mockTimeActivities);
}

export async function getCustomFields(): Promise<string[]> {
  return wait([]);
}

// ─── Reports ─────────────────────────────────────────────────────────────

export async function getWeeklyHours(userId: number = currentMockUser.id): Promise<{ logged: number; target: number }> {
  const logged = timeEntries
    .filter((t) => t.user.id === userId)
    .reduce((sum, t) => sum + t.hours, 0);
  return wait({ logged, target: 40 });
}

export async function getTeamHours(): Promise<{ logged: number; target: number }> {
  const logged = timeEntries.reduce((sum, t) => sum + t.hours, 0);
  return wait({ logged, target: 360 });
}

export async function getResourceAllocations(): Promise<ResourceAllocation[]> {
  return wait(mockAllocations);
}

// ─── Directory ───────────────────────────────────────────────────────────

export async function getDirectoryLinks() {
  return wait(mockDirectoryLinks);
}
