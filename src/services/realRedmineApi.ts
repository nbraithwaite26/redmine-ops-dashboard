import type { RedmineApi } from './redmineApiTypes';

/**
 * Stub implementation of {@link RedmineApi} for a real Redmine backend.
 *
 * This file is the seam where the dashboard will eventually call a
 * backend proxy that forwards to the Redmine REST API. Each method
 * currently throws so that build-time selection (VITE_MOCK_MODE=false)
 * fails loudly rather than silently returning empty data.
 *
 * Wiring guidance for the team picking this up:
 *
 * 1. Stand up a thin backend (Express / Hono / serverless function) that
 *    accepts the same shape of requests this file exposes and forwards
 *    them to Redmine with `X-Redmine-API-Key` injected server-side. The
 *    key must NEVER reach the browser.
 *
 * 2. Replace each `throw` below with a `fetch('/api/...')` call against
 *    the backend, returning the parsed JSON shaped to match the type
 *    annotation pulled from RedmineApi. Suggested mappings are listed
 *    in docs/API.md (each mock function has a Redmine REST endpoint
 *    counterpart documented there).
 *
 * 3. Keep the return shapes identical — call sites import from
 *    services/redmineApi.ts and depend on the typed exports there.
 *    Changing return shapes is a breaking change for the UI.
 */
const notImplemented = (method: string): never => {
  throw new Error(
    `realRedmineApi.${method} is not implemented. Build with VITE_MOCK_MODE=true or wire up a backend proxy and replace the stub.`,
  );
};

export const realRedmineApi: RedmineApi = {
  testConnection: async () => notImplemented('testConnection'),
  saveConnectionSettings: async () => notImplemented('saveConnectionSettings'),
  getConnectionSettings: async () => notImplemented('getConnectionSettings'),
  getCurrentUser: async () => notImplemented('getCurrentUser'),
  syncWithRedmine: async () => notImplemented('syncWithRedmine'),
  getProjects: async () => notImplemented('getProjects'),
  createProject: async () => notImplemented('createProject'),
  updateProject: async () => notImplemented('updateProject'),
  getIssues: async () => notImplemented('getIssues'),
  getMyIssues: async () => notImplemented('getMyIssues'),
  getPastDueIssues: async () => notImplemented('getPastDueIssues'),
  getIssueById: async () => notImplemented('getIssueById'),
  createIssue: async () => notImplemented('createIssue'),
  updateIssue: async () => notImplemented('updateIssue'),
  deleteIssue: async () => notImplemented('deleteIssue'),
  addIssueComment: async () => notImplemented('addIssueComment'),
  addSubtask: async () => notImplemented('addSubtask'),
  updateIssueHierarchy: async () => notImplemented('updateIssueHierarchy'),
  getTimeEntries: async () => notImplemented('getTimeEntries'),
  createTimeEntry: async () => notImplemented('createTimeEntry'),
  updateTimeEntry: async () => notImplemented('updateTimeEntry'),
  deleteTimeEntry: async () => notImplemented('deleteTimeEntry'),
  getUsers: async () => notImplemented('getUsers'),
  getProjectMembers: async () => notImplemented('getProjectMembers'),
  getIssueStatuses: async () => notImplemented('getIssueStatuses'),
  getTrackers: async () => notImplemented('getTrackers'),
  getPriorities: async () => notImplemented('getPriorities'),
  getTimeActivities: async () => notImplemented('getTimeActivities'),
  getCustomFields: async () => notImplemented('getCustomFields'),
  getWeeklyHours: async () => notImplemented('getWeeklyHours'),
  getTeamHours: async () => notImplemented('getTeamHours'),
  getResourceAllocations: async () => notImplemented('getResourceAllocations'),
  getDirectoryLinks: async () => notImplemented('getDirectoryLinks'),
};
