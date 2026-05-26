/**
 * Aggregation helpers for the Hours page.
 *
 * The Hours page renders two stacked sections (this week, last week). Each
 * section needs the same shape of data: per-user totals + a nested
 * per-project breakdown + the per-task list. These helpers compute that
 * shape from the three primitives the redmineApi facade returns:
 * users, issues, and time entries.
 *
 * Everything here is pure (modulo `today()`). `loadHoursData` is the only
 * function that hits the network; it's the single isolation point so a
 * future server-side aggregated endpoint can replace its body without
 * touching the components.
 */

import { getIssues, getTimeEntries } from '../services/redmineApi';
import { today } from './format';
import type { Issue, TimeEntry, User } from '../types/redmine';

// ─── Week range ──────────────────────────────────────────────────────────

export interface WeekRange {
  /** ISO YYYY-MM-DD, Monday. */
  from: string;
  /** ISO YYYY-MM-DD, Sunday (inclusive). */
  to: string;
  /** Human label used in section subtitles, e.g. "18 May – 24 May 2026". */
  label: string;
  /** -1 = last week, 0 = current week (Monday-to-today). */
  offset: number;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(reference: Date): Date {
  // Monday-anchored week. JS's getDay() returns 0 for Sunday, 1 for Monday, etc.
  const day = reference.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(reference);
  monday.setDate(reference.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Returns the inclusive ISO range and human label for the week at the
 * given offset relative to `today()`. Offset 0 = current week (Monday to
 * today); offset -1 = the full previous calendar week (Monday to Sunday).
 *
 * Current-week `to` is `today` rather than Sunday so the week's logged
 * hours don't get inflated by entries that haven't happened yet.
 */
export function weekRange(offset: number, reference: Date = today()): WeekRange {
  const monday = startOfWeek(reference);
  monday.setDate(monday.getDate() + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const from = isoDay(monday);
  const isCurrent = offset === 0;
  const to = isCurrent ? isoDay(reference) : isoDay(sunday);

  const year = sunday.getFullYear();
  const label = `${shortDate(monday)} – ${shortDate(sunday)} ${year}`;
  return { from, to, label, offset };
}

// ─── Aggregations ────────────────────────────────────────────────────────

export interface TaskHoursRow {
  issue: Issue;
  spentHours: number;
}

export interface ProjectHoursGroup {
  projectId: number;
  projectName: string;
  /** Hours the user logged on this project during the week. */
  spentHours: number;
  /** Sum of estimatedHours across the user's tasks in this project. */
  estimatedHours: number;
  /** Latest dueDate across the user's tasks in this project (or null). */
  dueDate: string | null;
  tasks: TaskHoursRow[];
}

export interface UserHoursSummary {
  user: User;
  totalHours: number;
  projectCount: number;
  taskCount: number;
  projects: ProjectHoursGroup[];
}

export interface HoursData {
  weekRange: WeekRange;
  users: UserHoursSummary[];
}

/**
 * Sum of `entry.hours` for entries that fall inside the range (inclusive).
 * Range bounds are ISO date strings.
 */
export function weeklyHoursFor(
  userId: number,
  entries: ReadonlyArray<TimeEntry>,
  range: { from: string; to: string },
): number {
  let total = 0;
  for (const e of entries) {
    if (e.user.id !== userId) continue;
    if (e.spentOn < range.from || e.spentOn > range.to) continue;
    total += e.hours;
  }
  return total;
}

/** All entries (any user) for the given issue id. */
export function entriesForIssue(
  issueId: number,
  entries: ReadonlyArray<TimeEntry>,
): TimeEntry[] {
  return entries.filter((e) => e.issueId === issueId);
}

/**
 * Returns the latest dueDate (ISO YYYY-MM-DD) across a set of issues, or
 * null if none of them have a dueDate.
 */
export function maxDueDateIn(issues: ReadonlyArray<Issue>): string | null {
  let max: string | null = null;
  for (const i of issues) {
    if (!i.dueDate) continue;
    if (max === null || i.dueDate > max) max = i.dueDate;
  }
  return max;
}

/**
 * Build the per-user → per-project → tasks structure used by the Hours
 * page. The user's "projects" are derived from the projects of their
 * assigned tasks (we don't have a project-members endpoint yet — see
 * scope item #15).
 *
 * `range` filters the time-entry aggregation. Task and project lists are
 * NOT filtered by range — a task is "yours" regardless of whether you
 * logged time on it this particular week.
 */
export function aggregateHours(
  users: ReadonlyArray<User>,
  issues: ReadonlyArray<Issue>,
  entries: ReadonlyArray<TimeEntry>,
  range: WeekRange,
): UserHoursSummary[] {
  const summaries: UserHoursSummary[] = [];

  for (const user of users) {
    // The user's tasks = anything assigned to them.
    const userIssues = issues.filter((i) => i.assignee?.id === user.id);

    // Group those tasks by project.
    const byProject = new Map<number, Issue[]>();
    for (const issue of userIssues) {
      const bucket = byProject.get(issue.projectId);
      if (bucket) {
        bucket.push(issue);
      } else {
        byProject.set(issue.projectId, [issue]);
      }
    }

    // Build per-project rows. Spent hours are filtered to the user + range.
    const projects: ProjectHoursGroup[] = [];
    for (const [projectId, projectIssues] of byProject) {
      const projectName = projectIssues[0]?.projectName ?? '—';
      const taskRows: TaskHoursRow[] = projectIssues.map((issue) => ({
        issue,
        spentHours: entries
          .filter(
            (e) =>
              e.issueId === issue.id &&
              e.user.id === user.id &&
              e.spentOn >= range.from &&
              e.spentOn <= range.to,
          )
          .reduce((sum, e) => sum + e.hours, 0),
      }));

      const spentHours = taskRows.reduce((s, r) => s + r.spentHours, 0)
        // Hours the user logged at the project level (no issueId) are
        // still theirs — fold those in too.
        + entries
          .filter(
            (e) =>
              e.user.id === user.id &&
              e.projectId === projectId &&
              e.issueId === null &&
              e.spentOn >= range.from &&
              e.spentOn <= range.to,
          )
          .reduce((s, e) => s + e.hours, 0);

      const estimatedHours = projectIssues.reduce(
        (s, i) => s + (i.estimatedHours ?? 0),
        0,
      );
      const dueDate = maxDueDateIn(projectIssues);

      projects.push({
        projectId,
        projectName,
        spentHours,
        estimatedHours,
        dueDate,
        tasks: taskRows,
      });
    }

    // Stable sort: project name asc.
    projects.sort((a, b) => a.projectName.localeCompare(b.projectName));

    summaries.push({
      user,
      totalHours: weeklyHoursFor(user.id, entries, range),
      projectCount: projects.length,
      taskCount: userIssues.length,
      projects,
    });
  }

  // Surface users with the most hours first; ties broken by task count.
  summaries.sort((a, b) => {
    if (a.totalHours !== b.totalHours) return b.totalHours - a.totalHours;
    return b.taskCount - a.taskCount;
  });

  return summaries;
}

/**
 * Derive the engineer list from the data we actually have — issue assignees
 * and time-entry authors — rather than `GET /users`.
 *
 * Why: the configured Redmine API key is not an admin, so `/users.json`
 * 403s and the backend returns an empty list. Building the roster from
 * assignees + entry authors means the Hours page (and anything consuming
 * this) populates correctly without admin rights.
 */
export function deriveUsers(
  issues: ReadonlyArray<Issue>,
  entries: ReadonlyArray<TimeEntry>,
): User[] {
  const byId = new Map<number, User>();
  for (const issue of issues) {
    if (issue.assignee) byId.set(issue.assignee.id, issue.assignee);
  }
  for (const entry of entries) {
    if (entry.user) byId.set(entry.user.id, entry.user);
  }
  return Array.from(byId.values());
}

// ─── Team roster aggregation (issue-derived, range-independent) ───────────

export interface TeamProjectRow {
  projectId: number;
  projectName: string;
  /** Σ spentHours across the user's tasks in this project. */
  spentHours: number;
  /** Σ estimatedHours across the user's tasks in this project. */
  estimatedHours: number;
  /** Latest dueDate across the user's tasks in this project (or null). */
  dueDate: string | null;
  tasks: Issue[];
}

export interface TeamUserRow {
  user: User;
  projectCount: number;
  taskCount: number;
  spentHours: number;
  estimatedHours: number;
  projects: TeamProjectRow[];
}

/**
 * Per-engineer roster derived purely from their assigned issues. Spent and
 * expected (estimated) hours come from the issue fields themselves, so this
 * is independent of any week range — it's the "overall" team view used by the
 * Team Hours card/list (CR #18 item 8). Issues are expected to already be
 * scoped (e.g. AIRCRAFT ENGINEERING) by the caller.
 */
export function aggregateTeamFromIssues(
  users: ReadonlyArray<User>,
  issues: ReadonlyArray<Issue>,
): TeamUserRow[] {
  const rows: TeamUserRow[] = [];
  for (const user of users) {
    const userIssues = issues.filter((i) => i.assignee?.id === user.id);
    if (userIssues.length === 0) continue;

    const byProject = new Map<number, TeamProjectRow>();
    for (const issue of userIssues) {
      let g = byProject.get(issue.projectId);
      if (!g) {
        g = {
          projectId: issue.projectId,
          projectName: issue.projectName,
          spentHours: 0,
          estimatedHours: 0,
          dueDate: null,
          tasks: [],
        };
        byProject.set(issue.projectId, g);
      }
      g.tasks.push(issue);
      g.spentHours += issue.spentHours;
      g.estimatedHours += issue.estimatedHours ?? 0;
      if (issue.dueDate && (g.dueDate === null || issue.dueDate > g.dueDate)) {
        g.dueDate = issue.dueDate;
      }
    }

    const projects = Array.from(byProject.values()).sort((a, b) =>
      a.projectName.localeCompare(b.projectName),
    );
    rows.push({
      user,
      projectCount: projects.length,
      taskCount: userIssues.length,
      spentHours: userIssues.reduce((s, i) => s + i.spentHours, 0),
      estimatedHours: userIssues.reduce((s, i) => s + (i.estimatedHours ?? 0), 0),
      projects,
    });
  }

  rows.sort((a, b) => {
    if (b.spentHours !== a.spentHours) return b.spentHours - a.spentHours;
    return a.user.name.localeCompare(b.user.name);
  });
  return rows;
}

// ─── Adapter (the only network-touching function) ────────────────────────

/**
 * Fetches everything needed to render one Hours section and returns the
 * aggregated structure. This is the isolation point — if a future
 * `/api/redmine/hours-summary` endpoint lands, swap the body here and
 * the components stay identical.
 *
 * The roster is derived from assignees + entry authors (see deriveUsers)
 * instead of `/users`, which 403s for the non-admin key.
 */
export async function loadHoursData(range: WeekRange): Promise<HoursData> {
  const [issues, entries] = await Promise.all([
    getIssues(),
    getTimeEntries({ from: range.from, to: range.to }),
  ]);
  const users = deriveUsers(issues, entries);
  return {
    weekRange: range,
    users: aggregateHours(users, issues, entries, range),
  };
}
