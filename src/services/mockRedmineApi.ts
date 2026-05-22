/**
 * Mock implementation of {@link RedmineApi}.
 *
 * Holds in-memory state seeded from `src/data/mockData.ts`. Mutations
 * (create/update/delete) write to the in-memory state so the UI reflects
 * edits without a real backend.
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
  TimeEntry,
  User,
} from '../types/redmine';
import type { RedmineApi } from './redmineApiTypes';

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

export const mockRedmineApi: RedmineApi = {
  // ─── Connection ──────────────────────────────────────────────────────
  async testConnection(): Promise<ConnectionStatus> {
    if (connectionSettings.mockMode) {
      return wait({
        connected: true,
        mockMode: true,
        lastSync,
        currentUser: currentMockUser,
        message: 'Mock data mode active. No Redmine call was made.',
      });
    }
    return wait({
      connected: false,
      mockMode: false,
      lastSync,
      currentUser: null,
      message: 'Connection not configured. Set base URL and API key.',
    });
  },

  async saveConnectionSettings(settings) {
    connectionSettings = { ...settings };
    return wait(connectionSettings);
  },

  async getConnectionSettings() {
    return wait(connectionSettings);
  },

  async getCurrentUser() {
    return wait(currentMockUser);
  },

  async syncWithRedmine() {
    lastSync = new Date().toISOString();
    return wait({ syncedAt: lastSync });
  },

  // ─── Projects ────────────────────────────────────────────────────────
  async getProjects() {
    return wait(projects);
  },

  async createProject(input) {
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
  },

  async updateProject(id, patch) {
    projects = projects.map((p) =>
      p.id === id
        ? { ...p, ...patch, updatedOn: new Date().toISOString().slice(0, 10) }
        : p,
    );
    return wait(projects.find((p) => p.id === id)!);
  },

  // ─── Issues ──────────────────────────────────────────────────────────
  async getIssues() {
    return wait(issues);
  },

  async getMyIssues(userId: number = currentMockUser.id) {
    return wait(issues.filter((i) => i.assignee?.id === userId));
  },

  async getPastDueIssues(today: Date = MOCK_TODAY) {
    const cutoff = today.toISOString().slice(0, 10);
    return wait(
      issues.filter(
        (i) =>
          i.dueDate !== null &&
          i.dueDate < cutoff &&
          i.status !== 'Closed' &&
          i.status !== 'Resolved',
      ),
    );
  },

  async getIssueById(id) {
    return wait(issues.find((i) => i.id === id) ?? null);
  },

  async createIssue(input) {
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
  },

  async updateIssue(id, patch) {
    issues = issues.map((i) =>
      i.id === id ? { ...i, ...patch, updatedOn: new Date().toISOString().slice(0, 10) } : i,
    );
    return wait(issues.find((i) => i.id === id)!);
  },

  async deleteIssue(id) {
    issues = issues.filter((i) => i.id !== id);
    return wait({ id });
  },

  async addIssueComment(id, _comment) {
    return wait({ id });
  },

  async addSubtask(parentId, input) {
    const subtask = await this.createIssue({ ...input, parentIssueId: parentId });
    issues = issues.map((i) =>
      i.id === parentId ? { ...i, children: [...i.children, subtask.id] } : i,
    );
    return subtask;
  },

  async updateIssueHierarchy(id, parentId) {
    return this.updateIssue(id, { parentIssueId: parentId });
  },

  // ─── Time ────────────────────────────────────────────────────────────
  async getTimeEntries() {
    return wait(timeEntries);
  },

  async createTimeEntry(input) {
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
    if (next.issueId) {
      issues = issues.map((i) =>
        i.id === next.issueId ? { ...i, spentHours: i.spentHours + next.hours } : i,
      );
    }
    return wait(next);
  },

  async updateTimeEntry(id, patch) {
    timeEntries = timeEntries.map((t) =>
      t.id === id ? { ...t, ...patch, updatedOn: new Date().toISOString().slice(0, 10) } : t,
    );
    return wait(timeEntries.find((t) => t.id === id)!);
  },

  async deleteTimeEntry(id) {
    timeEntries = timeEntries.filter((t) => t.id !== id);
    return wait({ id });
  },

  // ─── Users ───────────────────────────────────────────────────────────
  async getUsers() {
    return wait(mockUsers);
  },

  async getProjectMembers(_projectId): Promise<User[]> {
    return wait(mockUsers);
  },

  // ─── Metadata ────────────────────────────────────────────────────────
  async getIssueStatuses() {
    return wait(mockIssueStatuses);
  },

  async getTrackers() {
    return wait(mockTrackers);
  },

  async getPriorities() {
    return wait(mockPriorities);
  },

  async getTimeActivities() {
    return wait(mockTimeActivities);
  },

  async getCustomFields() {
    return wait([]);
  },

  // ─── Reports ─────────────────────────────────────────────────────────
  async getWeeklyHours(userId: number = currentMockUser.id) {
    const logged = timeEntries
      .filter((t) => t.user.id === userId)
      .reduce((sum, t) => sum + t.hours, 0);
    return wait({ logged, target: 40 });
  },

  async getTeamHours() {
    const logged = timeEntries.reduce((sum, t) => sum + t.hours, 0);
    return wait({ logged, target: 360 });
  },

  async getResourceAllocations() {
    return wait(mockAllocations);
  },

  // ─── Directory ───────────────────────────────────────────────────────
  async getDirectoryLinks() {
    return wait(mockDirectoryLinks);
  },
};
