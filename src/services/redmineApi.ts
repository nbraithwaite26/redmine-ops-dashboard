/**
 * Redmine API facade.
 *
 * Selects between the in-memory mock implementation and the real backend
 * stub at module load time based on the `VITE_MOCK_MODE` env var, then
 * re-exports each method as a named function. Call sites keep their
 * existing `import { getIssues } from '../services/redmineApi'` imports.
 *
 * - VITE_MOCK_MODE=true (default) → mockRedmineApi.ts (in-memory).
 * - VITE_MOCK_MODE=false          → realRedmineApi.ts (throws "not
 *   implemented" until a backend is wired up; see that file for the
 *   integration recipe).
 *
 * Importantly, even when VITE_MOCK_MODE=false the dashboard MUST NOT
 * call Redmine REST directly from the browser. The real implementation
 * is expected to call a backend proxy that injects the
 * `X-Redmine-API-Key` header server-side. See realRedmineApi.ts and
 * docs/ARCHITECTURE.md for the recommended deployment shape.
 */
import type { RedmineApi } from './redmineApiTypes';
import { mockRedmineApi } from './mockRedmineApi';
import { realRedmineApi } from './realRedmineApi';

const mockEnabled =
  (import.meta.env.VITE_MOCK_MODE ?? 'true').toString().toLowerCase() !== 'false';

const api: RedmineApi = mockEnabled ? mockRedmineApi : realRedmineApi;

// Re-export each method as a named function. The bind preserves `this`
// for the few methods (addSubtask, updateIssueHierarchy) that call other
// methods on the implementation.
export const testConnection = api.testConnection.bind(api);
export const saveConnectionSettings = api.saveConnectionSettings.bind(api);
export const getConnectionSettings = api.getConnectionSettings.bind(api);
export const getCurrentUser = api.getCurrentUser.bind(api);
export const syncWithRedmine = api.syncWithRedmine.bind(api);

export const getProjects = api.getProjects.bind(api);
export const createProject = api.createProject.bind(api);
export const updateProject = api.updateProject.bind(api);

export const getIssues = api.getIssues.bind(api);
export const getIssuesByProject = api.getIssuesByProject.bind(api);
export const getMyIssues = api.getMyIssues.bind(api);
export const getPastDueIssues = api.getPastDueIssues.bind(api);
export const getIssueById = api.getIssueById.bind(api);
export const createIssue = api.createIssue.bind(api);
export const updateIssue = api.updateIssue.bind(api);
export const deleteIssue = api.deleteIssue.bind(api);
export const addIssueComment = api.addIssueComment.bind(api);
export const addSubtask = api.addSubtask.bind(api);
export const updateIssueHierarchy = api.updateIssueHierarchy.bind(api);

export const getTimeEntries = api.getTimeEntries.bind(api);
export const createTimeEntry = api.createTimeEntry.bind(api);
export const updateTimeEntry = api.updateTimeEntry.bind(api);
export const deleteTimeEntry = api.deleteTimeEntry.bind(api);

export const getUsers = api.getUsers.bind(api);
export const getProjectMembers = api.getProjectMembers.bind(api);

export const getIssueStatuses = api.getIssueStatuses.bind(api);
export const getTrackers = api.getTrackers.bind(api);
export const getPriorities = api.getPriorities.bind(api);
export const getTimeActivities = api.getTimeActivities.bind(api);
export const getCustomFields = api.getCustomFields.bind(api);

export const getWeeklyHours = api.getWeeklyHours.bind(api);
export const getTeamHours = api.getTeamHours.bind(api);
export const getResourceAllocations = api.getResourceAllocations.bind(api);
export const getTeamSchedule = api.getTeamSchedule.bind(api);
export const getTimeOff = api.getTimeOff.bind(api);

export const getDirectoryLinks = api.getDirectoryLinks.bind(api);

// Also export the active implementation object and the interface for
// tests / future code that wants to swap or stub the whole facade in one
// shot.
export { api as redmineApi };
export type { RedmineApi } from './redmineApiTypes';
