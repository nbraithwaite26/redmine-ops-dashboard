/**
 * Real Redmine API implementation. Talks to the backend proxy at
 * VITE_API_BASE (default `/api/redmine`). Read-only for now — write
 * methods throw, and the backend's REDMINE_READ_ONLY guard would 403 them
 * anyway.
 *
 * The proxy injects X-Redmine-API-Key server-side. The browser never sees
 * the key and never talks to Redmine directly.
 */
import type {
  ConnectionSettings,
  ConnectionStatus,
  DirectoryLink,
  Issue,
  IssuePriority,
  IssueStatus,
  Project,
  ProjectStatus,
  ResourceAllocation,
  TimeEntry,
  Tracker,
  User,
} from '../types/redmine';
import type { RedmineApi } from './redmineApiTypes';
import { HttpError, httpGet, httpJson } from './http';

interface PaginatedWire<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

interface MetadataBundle {
  statuses: string[];
  trackers: string[];
  priorities: string[];
  timeActivities: string[];
  customFields: string[];
}

interface GanttRow {
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
  relations: Issue['relations'];
  isOverloaded: boolean;
  isAtRisk: boolean;
}

interface ProjectDetailWire extends Project {
  enabledModules?: string[];
  trackers?: string[];
  issueCategories?: string[];
}

// ─── Metadata coordinator (plan §7.8.1) ──────────────────────────────────
// All four metadata methods share a single in-flight Promise<MetadataBundle>.
// First caller triggers /metadata; subsequent callers await the same
// promise. syncWithRedmine() resets it.

const METADATA_TTL_MS = 5 * 60 * 1000;
let metadataPromise: Promise<MetadataBundle> | null = null;
let metadataFetchedAt = 0;

function getMetadata(): Promise<MetadataBundle> {
  const now = Date.now();
  if (metadataPromise && now - metadataFetchedAt < METADATA_TTL_MS) {
    return metadataPromise;
  }
  metadataFetchedAt = now;
  metadataPromise = httpGet<MetadataBundle>('/metadata').catch((err) => {
    // Reset so the next call re-tries; do not cache a failure indefinitely.
    metadataPromise = null;
    throw err;
  });
  return metadataPromise;
}

// ─── Generic TTL cache for GETs (plan §7.4) ──────────────────────────────
// Reduces Redmine round-trips. Keyed by `${path}?${sortedQuery}`. List
// endpoints use a longer TTL than per-issue detail because list pages are
// hit repeatedly during a single page load.

const LIST_TTL_MS = 60 * 1000; // 60s for list endpoints
const DETAIL_TTL_MS = 10 * 1000; // 10s for issue detail

interface CacheEntry {
  fetchedAt: number;
  data: unknown;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(
  path: string,
  query: Record<string, string | number | undefined | null> | undefined,
): string {
  if (!query) return path;
  const pairs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return pairs.length ? `${path}?${pairs.join('&')}` : path;
}

async function cachedGet<T>(
  path: string,
  query?: Record<string, string | number | undefined | null>,
  ttlMs: number = LIST_TTL_MS,
): Promise<T> {
  const key = cacheKey(path, query);
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && now - entry.fetchedAt < ttlMs) {
    return entry.data as T;
  }
  const data = await httpGet<T>(path, query);
  cache.set(key, { fetchedAt: now, data });
  return data;
}

function clearCaches() {
  metadataPromise = null;
  metadataFetchedAt = 0;
  cache.clear();
}

/**
 * Invalidate every cache entry that could be stale after a single-issue
 * mutation: the issue's own detail row, and every list endpoint (since
 * the new state may affect filters, counts, sort order). Cheaper than
 * `clearCaches()` because it keeps unrelated GETs warm.
 */
function clearIssueCacheFor(id: number) {
  for (const key of cache.keys()) {
    if (key.startsWith('/issues') || key === `/issues/${id}`) {
      cache.delete(key);
    }
  }
}

/** Drop every cached `/time-entries*` list response. */
function clearTimeEntryCache() {
  for (const key of cache.keys()) {
    if (key.startsWith('/time-entries')) {
      cache.delete(key);
    }
  }
}

// ─── Connection / config (UI-side, localStorage) ─────────────────────────

const CONNECTION_SETTINGS_KEY = 'redmine-ops:connection-settings';
let lastSync: string | null = null;

function readSettings(): ConnectionSettings {
  if (typeof window === 'undefined') {
    return { baseUrl: '', apiKey: '', mockMode: false };
  }
  try {
    const raw = window.localStorage.getItem(CONNECTION_SETTINGS_KEY);
    if (raw) return { ...JSON.parse(raw), mockMode: false } as ConnectionSettings;
  } catch {
    /* ignore */
  }
  return { baseUrl: '', apiKey: '', mockMode: false };
}

function writeSettings(settings: ConnectionSettings) {
  if (typeof window === 'undefined') return;
  // Never persist apiKey — the real key lives server-side. Strip on write.
  const safe = { ...settings, apiKey: '' };
  window.localStorage.setItem(CONNECTION_SETTINGS_KEY, JSON.stringify(safe));
}

// ─── Issue / time entry helpers ──────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfThisWeekIso(): string {
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  return monday.toISOString().slice(0, 10);
}

function timeEntryUserMatches(entry: TimeEntry, userId?: number): boolean {
  if (userId === undefined) return true;
  return entry.user.id === userId;
}

function notImplementedWrite(method: string): never {
  throw new HttpError(
    405,
    'READ_ONLY_CLIENT',
    `${method} is not available in read-only mode.`,
  );
}

// ─── Implementation ──────────────────────────────────────────────────────

export const realRedmineApi: RedmineApi = {
  async testConnection(): Promise<ConnectionStatus> {
    // Probe /me (Redmine reachable) and /health (backend reachable + readOnly
    // flag) in parallel. Each fails independently so the UI can label them
    // separately.
    const [meRes, healthRes] = await Promise.allSettled([
      httpGet<User>('/me'),
      httpGet<{ ok: boolean; readOnly: boolean }>('/health'),
    ]);

    const connected = meRes.status === 'fulfilled';
    const user = connected ? meRes.value : null;
    const readOnly =
      healthRes.status === 'fulfilled' ? healthRes.value.readOnly : true;

    let message: string;
    if (connected) {
      message = readOnly
        ? 'Connected via secure backend proxy. Read-only mode.'
        : 'Connected via secure backend proxy.';
    } else if (healthRes.status === 'fulfilled') {
      message = 'Backend reachable but Redmine call failed.';
    } else {
      message =
        meRes.status === 'rejected' && meRes.reason instanceof Error
          ? meRes.reason.message
          : 'Backend unreachable.';
    }

    return {
      connected,
      mockMode: false,
      readOnly,
      lastSync,
      currentUser: user,
      message,
    };
  },

  async saveConnectionSettings(settings: ConnectionSettings): Promise<ConnectionSettings> {
    writeSettings(settings);
    return readSettings();
  },

  async getConnectionSettings(): Promise<ConnectionSettings> {
    return readSettings();
  },

  async getCurrentUser(): Promise<User> {
    return httpGet<User>('/me');
  },

  async syncWithRedmine(): Promise<{ syncedAt: string }> {
    clearCaches();
    lastSync = new Date().toISOString();
    return { syncedAt: lastSync };
  },

  async getProjects(): Promise<Project[]> {
    const res = await cachedGet<PaginatedWire<ProjectDetailWire>>('/projects', { limit: 100 });
    return res.items.map((p) => ({
      id: p.id,
      name: p.name,
      identifier: p.identifier,
      description: p.description,
      status: p.status as ProjectStatus,
      parentProjectId: p.parentProjectId,
      createdOn: p.createdOn,
      updatedOn: p.updatedOn,
    }));
  },

  async createProject(): Promise<Project> {
    notImplementedWrite('createProject');
  },

  async updateProject(): Promise<Project> {
    notImplementedWrite('updateProject');
  },

  async getIssues(): Promise<Issue[]> {
    const res = await cachedGet<PaginatedWire<Issue>>('/issues', { limit: 100 });
    return res.items;
  },

  async getMyIssues(userId?: number): Promise<Issue[]> {
    const assignedTo = userId === undefined ? 'me' : String(userId);
    const res = await cachedGet<PaginatedWire<Issue>>('/issues', {
      assigned_to_id: assignedTo,
      limit: 100,
    });
    return res.items;
  },

  async getPastDueIssues(today?: Date): Promise<Issue[]> {
    const cutoff = (today ?? new Date()).toISOString().slice(0, 10);
    const res = await cachedGet<PaginatedWire<Issue>>('/issues', {
      due_date: `<=${cutoff}`,
      status_id: 'open',
      limit: 100,
    });
    return res.items;
  },

  async getIssueById(id: number): Promise<Issue | null> {
    try {
      return await cachedGet<Issue>(`/issues/${id}`, undefined, DETAIL_TTL_MS);
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return null;
      throw err;
    }
  },

  async createIssue(input: Partial<Issue>): Promise<Issue> {
    // Backend requires projectId + subject. Surface a clear error if
    // either is missing rather than letting the backend echo a generic
    // BAD_REQUEST.
    if (input.projectId === undefined) {
      throw new HttpError(400, 'BAD_REQUEST', 'createIssue requires projectId.');
    }
    if (!input.subject) {
      throw new HttpError(400, 'BAD_REQUEST', 'createIssue requires subject.');
    }
    const body: Record<string, unknown> = {
      projectId: input.projectId,
      subject: input.subject,
    };
    if (input.description !== undefined) body.description = input.description;
    if (input.status !== undefined) body.status = input.status;
    if (input.priority !== undefined) body.priority = input.priority;
    if (input.tracker !== undefined) body.tracker = input.tracker;
    if ('assignee' in input) body.assignedToId = input.assignee?.id ?? null;
    if (input.startDate !== undefined) body.startDate = input.startDate;
    if (input.dueDate !== undefined) body.dueDate = input.dueDate;
    if (input.estimatedHours !== undefined) body.estimatedHours = input.estimatedHours;
    if (input.doneRatio !== undefined) body.doneRatio = input.doneRatio;
    if ('parentIssueId' in input) body.parentIssueId = input.parentIssueId;

    const created = await httpJson<Issue>('POST', '/issues', body);
    // List endpoints are stale now.
    for (const key of cache.keys()) {
      if (key.startsWith('/issues')) cache.delete(key);
    }
    return created;
  },
  async updateIssue(id: number, patch: Partial<Issue>): Promise<Issue> {
    // Build a curated patch body matching the backend's PATCH allowlist.
    // Unknown fields are silently dropped here so callers (e.g. dialog
    // Save handlers that pass the entire Issue draft) don't need to know
    // which fields are editable.
    const body: Record<string, unknown> = {};
    if (patch.subject !== undefined) body.subject = patch.subject;
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.priority !== undefined) body.priority = patch.priority;
    if (patch.tracker !== undefined) body.tracker = patch.tracker;
    if ('assignee' in patch) {
      body.assignedToId = patch.assignee?.id ?? null;
    }
    if (patch.startDate !== undefined) body.startDate = patch.startDate;
    if (patch.dueDate !== undefined) body.dueDate = patch.dueDate;
    if (patch.estimatedHours !== undefined) body.estimatedHours = patch.estimatedHours;
    if (patch.doneRatio !== undefined) body.doneRatio = patch.doneRatio;
    if ('parentIssueId' in patch) body.parentIssueId = patch.parentIssueId;
    if (patch.customFields !== undefined) {
      // The backend accepts { id, value } pairs; the wire-shape mapping
      // to Redmine's snake_case + string-coerced values happens server-side.
      body.customFields = patch.customFields.map((cf) => ({
        id: cf.id,
        value: cf.value,
      }));
    }

    const updated = await httpJson<Issue>('PATCH', `/issues/${id}`, body);
    // Invalidate the cache entries that could now be stale.
    clearIssueCacheFor(id);
    return updated;
  },
  async deleteIssue(id: number): Promise<{ id: number }> {
    const result = await httpJson<{ id: number }>('DELETE', `/issues/${id}`);
    clearIssueCacheFor(id);
    return result;
  },
  async addIssueComment(id: number, comment: string): Promise<{ id: number }> {
    // Redmine attaches a comment as a journal entry on PUT /issues/:id.json
    // with a `notes` field. Our backend PATCH allowlist already supports it.
    await httpJson<Issue>('PATCH', `/issues/${id}`, { notes: comment });
    clearIssueCacheFor(id);
    return { id };
  },
  async addSubtask(parentId: number, input: Partial<Issue>): Promise<Issue> {
    // Subtasks are issues with parent_issue_id set. Route through createIssue
    // so the same validation + cache invalidation applies.
    const child = await this.createIssue({ ...input, parentIssueId: parentId });
    // The parent's children[] is now stale; drop its detail entry.
    clearIssueCacheFor(parentId);
    return child;
  },
  async updateIssueHierarchy(id: number, parentId: number | null): Promise<Issue> {
    const updated = await httpJson<Issue>('PATCH', `/issues/${id}`, { parentIssueId: parentId });
    clearIssueCacheFor(id);
    if (parentId !== null) clearIssueCacheFor(parentId);
    return updated;
  },

  async getTimeEntries(opts: {
    from?: string;
    to?: string;
    userId?: number;
    issueId?: number;
  } = {}): Promise<TimeEntry[]> {
    // Backend honors from / to / user_id / issue_id as passthrough query
    // params (see server/src/routes/timeEntries.ts LIST_FILTERS). Cache key
    // includes them via cacheKey()'s sorted-query serialization so different
    // ranges don't collide.
    const query: Record<string, string | number> = { limit: 100 };
    if (opts.from) query.from = opts.from;
    if (opts.to) query.to = opts.to;
    if (opts.userId !== undefined) query.user_id = opts.userId;
    if (opts.issueId !== undefined) query.issue_id = opts.issueId;
    const res = await cachedGet<PaginatedWire<TimeEntry>>('/time-entries', query);
    return res.items;
  },

  async createTimeEntry(input: Partial<TimeEntry>): Promise<TimeEntry> {
    if (input.hours === undefined || input.hours === null) {
      throw new HttpError(400, 'BAD_REQUEST', 'createTimeEntry requires hours.');
    }
    if (!input.spentOn) {
      throw new HttpError(400, 'BAD_REQUEST', 'createTimeEntry requires spentOn.');
    }
    if (input.projectId === undefined && input.issueId === undefined) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'createTimeEntry requires projectId or issueId.',
      );
    }
    const body: Record<string, unknown> = {
      hours: input.hours,
      spentOn: input.spentOn,
    };
    if (input.activity !== undefined) body.activity = input.activity;
    if (input.comments !== undefined) body.comments = input.comments;
    if (input.projectId !== undefined) body.projectId = input.projectId;
    if (input.issueId !== undefined) body.issueId = input.issueId;

    const created = await httpJson<TimeEntry>('POST', '/time-entries', body);
    clearTimeEntryCache();
    return created;
  },
  async updateTimeEntry(id: number, patch: Partial<TimeEntry>): Promise<TimeEntry> {
    const body: Record<string, unknown> = {};
    if (patch.hours !== undefined) body.hours = patch.hours;
    if (patch.spentOn !== undefined) body.spentOn = patch.spentOn;
    if (patch.activity !== undefined) body.activity = patch.activity;
    if (patch.comments !== undefined) body.comments = patch.comments;
    if (patch.projectId !== undefined) body.projectId = patch.projectId;
    if (patch.issueId !== undefined) body.issueId = patch.issueId;

    const updated = await httpJson<TimeEntry>('PATCH', `/time-entries/${id}`, body);
    clearTimeEntryCache();
    return updated;
  },
  async deleteTimeEntry(id: number): Promise<{ id: number }> {
    const result = await httpJson<{ id: number }>('DELETE', `/time-entries/${id}`);
    clearTimeEntryCache();
    return result;
  },

  async getUsers(): Promise<User[]> {
    try {
      const res = await cachedGet<PaginatedWire<User>>('/users', { limit: 100 });
      return res.items;
    } catch (err) {
      // /users.json is admin-only on most Redmine instances. Degrade
      // gracefully — callers get an empty list rather than a 403 toast.
      if (err instanceof HttpError && (err.status === 403 || err.status === 401)) {
        return [];
      }
      throw err;
    }
  },

  async getProjectMembers(projectId: number): Promise<User[]> {
    interface MembershipWire {
      userId: number;
      userName: string;
      roles: string[];
    }
    const res = await cachedGet<PaginatedWire<MembershipWire>>(
      `/projects/${projectId}/members`,
      { limit: 100 },
    );
    return res.items.map<User>((m) => ({
      id: m.userId,
      name: m.userName,
      email: '',
      login: '',
      status: 'Active',
      groups: [],
      roles: m.roles,
    }));
  },

  async getIssueStatuses(): Promise<string[]> {
    return (await getMetadata()).statuses;
  },
  async getTrackers(): Promise<string[]> {
    return (await getMetadata()).trackers;
  },
  async getPriorities(): Promise<string[]> {
    return (await getMetadata()).priorities;
  },
  async getTimeActivities(): Promise<string[]> {
    return (await getMetadata()).timeActivities;
  },
  async getCustomFields(): Promise<string[]> {
    return (await getMetadata()).customFields;
  },

  async getWeeklyHours(userId?: number): Promise<{ logged: number; target: number }> {
    const from = startOfThisWeekIso();
    const to = todayIso();
    const res = await cachedGet<PaginatedWire<TimeEntry>>('/time-entries', {
      user_id: userId === undefined ? 'me' : String(userId),
      from,
      to,
      limit: 100,
    });
    const logged = res.items.reduce((sum, e) => sum + e.hours, 0);
    return { logged, target: 40 };
  },

  async getTeamHours(): Promise<{ logged: number; target: number }> {
    const from = startOfThisWeekIso();
    const to = todayIso();
    const res = await cachedGet<PaginatedWire<TimeEntry>>('/time-entries', {
      from,
      to,
      limit: 100,
    });
    const logged = res.items.reduce((sum, e) => sum + e.hours, 0);
    return { logged, target: 360 };
  },

  async getResourceAllocations(): Promise<ResourceAllocation[]> {
    const res = await cachedGet<{ items: GanttRow[]; total: number }>('/gantt');
    return res.items.map<ResourceAllocation>((row) => ({
      id: row.id,
      userId: row.assigneeId ?? 0,
      issueId: row.issueId,
      projectId: row.projectId,
      startDate: row.startDate ?? '',
      endDate: row.dueDate ?? '',
      allocatedHours: row.estimatedHours ?? 0,
      spentHours: row.spentHours,
      allocationType: 'Auto',
      isOverloaded: row.isOverloaded,
    }));
  },

  async getDirectoryLinks(): Promise<DirectoryLink[]> {
    // UI configuration, not Redmine state. Section 7 leaves this empty in
    // real mode — the Directory page will wire its own config source later.
    return [];
  },
};

// Suppress unused warnings for the typed unions Issue/Tracker rely on at
// the wire boundary (TypeScript narrows the strings but the values are
// pass-through from the backend).
export type _Unused = IssueStatus | IssuePriority | Tracker;
