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
  Group,
  GroupSummary,
  Issue,
  IssuePriority,
  IssueStatus,
  Project,
  ProjectStatus,
  ResourceAllocation,
  TimeEntry,
  TimeOffEntry,
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

function ganttRowToAllocation(row: GanttRow): ResourceAllocation {
  return {
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
  };
}

/**
 * Build a minimal Issue from a Gantt row for the team-schedule left panel.
 * Gantt rows omit a few Issue fields (priority, author, timestamps); those
 * get sensible defaults since the timeline only reads subject / project /
 * estimated / spent / assignee / dates.
 */
function ganttRowToIssue(row: GanttRow): Issue {
  const assignee: User | null =
    row.assigneeId !== null
      ? {
          id: row.assigneeId,
          name: row.assigneeName ?? `User ${row.assigneeId}`,
          email: '',
          login: '',
          status: 'Active',
          groups: [],
          roles: [],
        }
      : null;
  return {
    id: row.issueId,
    projectId: row.projectId,
    projectName: row.projectName,
    tracker: row.tracker as Tracker,
    status: row.status as IssueStatus,
    priority: 'Normal',
    subject: row.subject,
    description: '',
    assignee,
    author:
      assignee ?? {
        id: 0,
        name: 'Unknown',
        email: '',
        login: '',
        status: 'Active',
        groups: [],
        roles: [],
      },
    startDate: row.startDate,
    dueDate: row.dueDate,
    estimatedHours: row.estimatedHours,
    spentHours: row.spentHours,
    doneRatio: row.doneRatio,
    parentIssueId: row.parentIssueId,
    children: row.children,
    relations: row.relations,
    customFields: [],
    nextAction: null,
    createdOn: '',
    updatedOn: '',
    closedOn: null,
  };
}

// ─── In-flight GET dedup ──────────────────────────────────────────────────
// Module-level Map of GET URL+query → in-flight Promise. Concurrent identical
// reads share a single network call; on settle (resolve or reject) the entry
// is dropped so the next caller refetches normally. The server already does
// per-key coalescing (cache.ts), but doing it on the client too means even
// stacked component-mount fetches in the SAME render share one round-trip.
//
// Reset by syncWithRedmine() so a manual refresh isn't served from stale
// in-flight promises (rare race but cheap to guard).

const inFlight = new Map<string, Promise<unknown>>();

function dedupKey(path: string, query?: Record<string, string | number>): string {
  if (!query) return path;
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return parts.length ? `${path}?${parts.join('&')}` : path;
}

export function dedupedGet<T>(
  path: string,
  query?: Record<string, string | number>,
): Promise<T> {
  const key = dedupKey(path, query);
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = httpGet<T>(path, query).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise as Promise<T>;
}

/** Test-only hook so unit tests can start each case with a clean slate. */
export function __resetDedupCache(): void {
  inFlight.clear();
}

// ─── Metadata coordinator (plan §7.8.1) ──────────────────────────────────
// CR #29: list/detail caches are now authoritative on the server. The
// metadata coordinator stays here only as in-render dedup — multiple
// dropdown selectors mounted in the same render share one /metadata call
// instead of issuing N parallel ones. syncWithRedmine() resets it.

function getMetadata(): Promise<MetadataBundle> {
  return dedupedGet<MetadataBundle>('/metadata');
}

/**
 * Best-effort: ask the server to clear its cache so the next reads go
 * upstream. Fails open — if the user is not an admin session, the 401
 * is silently swallowed and the next reads still hit the server cache
 * (whose TTLs are short enough that the user gets fresh data soon
 * anyway).
 */
async function invalidateServerCache(): Promise<void> {
  try {
    await fetch('/api/admin/_cache/invalidate', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch {
    // Network error or non-admin session — ignore.
  }
}

/**
 * Walks every page of a paginated list endpoint and concatenates the results.
 *
 * Strategy (mirrors server-side `/gantt`): fetch page 0 first to learn
 * `total_count`, then fan out the remaining offsets in parallel with bounded
 * concurrency. For an N-page list, wall-clock goes from N sequential
 * round-trips to roughly `1 + ceil((N-1)/CONCURRENCY)`.
 *
 * - `PAGE` is fixed at Redmine's max (100); single-page lists short-circuit.
 * - `CONCURRENCY` matches the server-side Gantt route so we don't burst
 *   harder against this Redmine instance than the warmer already does.
 * - `maxPages` caps a runaway upstream `total_count`. Default 50 covers
 *   ~5000 items.
 */
async function fetchPage<T>(
  path: string,
  baseQuery: Record<string, string | number>,
  offset: number,
  pageSize: number,
): Promise<PaginatedWire<T>> {
  return dedupedGet<PaginatedWire<T>>(path, {
    ...baseQuery,
    limit: pageSize,
    offset,
  });
}

async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T, i);
    }
  }
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Per-paginated-endpoint in-flight cap. Centralized topology defaults
 * to 2 — comment below explains why. Portable .exe builds bump this via
 * `VITE_PAGINATE_CONCURRENCY` (set in `scripts/build-portable.mjs`)
 * because the single-user case has no other concurrent dashboard
 * sessions competing for the upstream's connection pool.
 */
const PAGINATE_CONCURRENCY = (() => {
  const raw = import.meta.env.VITE_PAGINATE_CONCURRENCY;
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
})();

async function paginateAll<T>(
  path: string,
  baseQuery: Record<string, string | number> = {},
  maxPages = 50,
): Promise<T[]> {
  const PAGE = 100;
  // Concurrency 2 (centralized default): ~2× faster than sequential
  // while limiting the upstream burst. With multiple paginated endpoints
  // kicking off in parallel (Home fires ~5 of these on mount) any higher
  // number saturates the Redmine REST endpoint and starves concurrent
  // writes (e.g. POST /time-entries hitting the upstream 15s timeout).
  // Portable .exe builds raise this via VITE_PAGINATE_CONCURRENCY since
  // the single-user case has no other dashboard sessions competing.
  const CONCURRENCY = PAGINATE_CONCURRENCY;

  const first = await fetchPage<T>(path, baseQuery, 0, PAGE);
  if (first.items.length === 0 || first.items.length >= first.total) {
    return first.items;
  }

  const totalPages = Math.min(maxPages, Math.ceil(first.total / PAGE));
  const remainingOffsets: number[] = [];
  for (let p = 1; p < totalPages; p += 1) remainingOffsets.push(p * PAGE);

  const pages = await withConcurrency(
    remainingOffsets,
    CONCURRENCY,
    (offset) => fetchPage<T>(path, baseQuery, offset, PAGE),
  );

  const collected: T[] = first.items.slice();
  for (const page of pages) collected.push(...page.items);
  return collected;
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
    inFlight.clear();
    await invalidateServerCache();
    lastSync = new Date().toISOString();
    return { syncedAt: lastSync };
  },

  async getProjects(): Promise<Project[]> {
    // The project tree on the Projects page needs the full list, not just
    // the first page. 50-page cap (≈5000 projects) since project sets can
    // be larger than the default 20-page cap on issue/time-entry queries.
    const items = await paginateAll<ProjectDetailWire>('/projects', {}, 50);
    return items.map((p) => ({
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
    return paginateAll<Issue>('/issues');
  },

  async getIssuesByProject(projectId: number): Promise<Issue[]> {
    return paginateAll<Issue>('/issues', { project_id: projectId });
  },

  async getMyIssues(userId?: number): Promise<Issue[]> {
    const assignedTo = userId === undefined ? 'me' : String(userId);
    return paginateAll<Issue>('/issues', { assigned_to_id: assignedTo });
  },

  async getPastDueIssues(today?: Date): Promise<Issue[]> {
    const cutoff = (today ?? new Date()).toISOString().slice(0, 10);
    return paginateAll<Issue>('/issues', {
      due_date: `<=${cutoff}`,
      status_id: 'open',
    });
  },

  async getIssueById(id: number): Promise<Issue | null> {
    try {
      return await httpGet<Issue>(`/issues/${id}`);
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

    // Server-side write routes invalidate the server cache (CR #29).
    return httpJson<Issue>('POST', '/issues', body);
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

    // Server-side write routes invalidate the server cache (CR #29).
    return httpJson<Issue>('PATCH', `/issues/${id}`, body);
  },
  async deleteIssue(id: number): Promise<{ id: number }> {
    return httpJson<{ id: number }>('DELETE', `/issues/${id}`);
  },
  async addIssueComment(id: number, comment: string): Promise<{ id: number }> {
    // Redmine attaches a comment as a journal entry on PUT /issues/:id.json
    // with a `notes` field. Our backend PATCH allowlist already supports it.
    await httpJson<Issue>('PATCH', `/issues/${id}`, { notes: comment });
    return { id };
  },
  async addSubtask(parentId: number, input: Partial<Issue>): Promise<Issue> {
    // Subtasks are issues with parent_issue_id set. Route through createIssue
    // so the same validation applies.
    return this.createIssue({ ...input, parentIssueId: parentId });
  },
  async updateIssueHierarchy(id: number, parentId: number | null): Promise<Issue> {
    return httpJson<Issue>('PATCH', `/issues/${id}`, { parentIssueId: parentId });
  },

  async getTimeEntries(opts: {
    from?: string;
    to?: string;
    userId?: number;
    issueId?: number;
  } = {}): Promise<TimeEntry[]> {
    // Backend honors from / to / user_id / issue_id as passthrough query
    // params (see server/src/routes/timeEntries.ts LIST_FILTERS). The server
    // cache (CR #29) keys list responses by filter set.
    const baseQuery: Record<string, string | number> = {};
    if (opts.from) baseQuery.from = opts.from;
    if (opts.to) baseQuery.to = opts.to;
    if (opts.userId !== undefined) baseQuery.user_id = opts.userId;
    if (opts.issueId !== undefined) baseQuery.issue_id = opts.issueId;
    return paginateAll<TimeEntry>('/time-entries', baseQuery);
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

    // Server-side write route invalidates the server cache (CR #29).
    return httpJson<TimeEntry>('POST', '/time-entries', body);
  },
  async updateTimeEntry(id: number, patch: Partial<TimeEntry>): Promise<TimeEntry> {
    const body: Record<string, unknown> = {};
    if (patch.hours !== undefined) body.hours = patch.hours;
    if (patch.spentOn !== undefined) body.spentOn = patch.spentOn;
    if (patch.activity !== undefined) body.activity = patch.activity;
    if (patch.comments !== undefined) body.comments = patch.comments;
    if (patch.projectId !== undefined) body.projectId = patch.projectId;
    if (patch.issueId !== undefined) body.issueId = patch.issueId;

    return httpJson<TimeEntry>('PATCH', `/time-entries/${id}`, body);
  },
  async deleteTimeEntry(id: number): Promise<{ id: number }> {
    return httpJson<{ id: number }>('DELETE', `/time-entries/${id}`);
  },

  async getUsers(): Promise<User[]> {
    try {
      return await paginateAll<User>('/users');
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
    const items = await paginateAll<MembershipWire>(
      `/projects/${projectId}/members`,
    );
    return items.map<User>((m) => ({
      id: m.userId,
      name: m.userName,
      email: '',
      login: '',
      status: 'Active',
      groups: [],
      roles: m.roles,
    }));
  },

  async getGroups(): Promise<GroupSummary[]> {
    const res = await dedupedGet<{ items: GroupSummary[] }>('/groups');
    return res.items;
  },

  async getGroup(id: number): Promise<Group> {
    return dedupedGet<Group>(`/groups/${id}`);
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
    const items = await paginateAll<TimeEntry>('/time-entries', {
      user_id: userId === undefined ? 'me' : String(userId),
      from,
      to,
    });
    const logged = items.reduce((sum, e) => sum + e.hours, 0);
    return { logged, target: 40 };
  },

  async getTeamHours(): Promise<{ logged: number; target: number }> {
    const from = startOfThisWeekIso();
    const to = todayIso();
    const items = await paginateAll<TimeEntry>('/time-entries', { from, to });
    const logged = items.reduce((sum, e) => sum + e.hours, 0);
    return { logged, target: 360 };
  },

  async getResourceAllocations(projectId?: number): Promise<ResourceAllocation[]> {
    const res = await dedupedGet<{ items: GanttRow[]; total: number }>(
      '/gantt',
      projectId !== undefined ? { project_id: projectId } : undefined,
    );
    return res.items.map(ganttRowToAllocation);
  },

  async getTeamSchedule(projectId?: number): Promise<{
    users: User[];
    issues: Issue[];
    allocations: ResourceAllocation[];
  }> {
    const res = await dedupedGet<{ items: GanttRow[]; total: number }>(
      '/gantt',
      projectId !== undefined ? { project_id: projectId } : undefined,
    );
    const userMap = new Map<number, User>();
    const issues: Issue[] = [];
    const allocations: ResourceAllocation[] = [];
    for (const row of res.items) {
      const issue = ganttRowToIssue(row);
      issues.push(issue);
      if (issue.assignee) userMap.set(issue.assignee.id, issue.assignee);
      allocations.push(ganttRowToAllocation(row));
    }
    return { users: [...userMap.values()], issues, allocations };
  },

  async getTimeOff(range: {
    from: string;
    to: string;
    includeAtWork?: boolean;
  }): Promise<TimeOffEntry[]> {
    // Sourced from Easy Redmine's /easy_attendances.json on this instance.
    // The backend default keeps the OOO-only filter (activity.at_work=false);
    // pass `includeAtWork: true` for the AE Calendar view which also wants
    // Conference/Seminar, Customer Visit, etc.
    const query: Record<string, string | number> = {
      from: range.from,
      to: range.to,
    };
    if (range.includeAtWork) query.include_at_work = 'true';
    const res = await dedupedGet<{ items: TimeOffEntry[] }>('/time-off', query);
    return res.items;
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
