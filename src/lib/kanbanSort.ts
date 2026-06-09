import type { TeamProjectRow, TeamUserRow } from './hoursAggregate';
import { projectColor } from './projectColor';

/**
 * Sort options exposed in the Kanban toolbar. Keep these stable string ids so
 * they can be persisted in localStorage and read back safely.
 */
export type ProjectSortMode = 'dueDate' | 'type';
export type EngineerSortMode = 'taskCount' | 'name';

export const PROJECT_SORT_OPTIONS: { id: ProjectSortMode; label: string }[] = [
  { id: 'dueDate', label: 'Due date (earliest)' },
  { id: 'type', label: 'Type (STC › DDP › CI)' },
];

export const ENGINEER_SORT_OPTIONS: { id: EngineerSortMode; label: string }[] = [
  { id: 'taskCount', label: 'Most tasks first' },
  { id: 'name', label: 'Alphabetical' },
];

/** Project type priority — lower number = sorted first. */
const TONE_RANK: Record<string, number> = {
  stc: 0,
  ddp: 1,
  ci: 2,
  default: 3,
};

/**
 * `null`-aware date compare: dated entries come before undated; among dated
 * entries, earliest first (lexicographic ISO comparison — overdue past dates
 * land first naturally).
 */
function compareDueDates(a: string | null, b: string | null): number {
  if (a && b) return a < b ? -1 : a > b ? 1 : 0;
  if (a && !b) return -1;
  if (!a && b) return 1;
  return 0;
}

/**
 * Sort project cards within a single engineer column. Returns a new array;
 * never mutates the input.
 *
 *   - `dueDate`: earliest dueDate first; nulls last.
 *   - `type`: STC → DDP → CI → other; tie-break by due date, then by name.
 */
export function sortProjects(
  projects: ReadonlyArray<TeamProjectRow>,
  mode: ProjectSortMode,
): TeamProjectRow[] {
  const copy = projects.slice();
  if (mode === 'dueDate') {
    copy.sort((a, b) => {
      const d = compareDueDates(a.dueDate, b.dueDate);
      if (d !== 0) return d;
      return a.projectName.localeCompare(b.projectName);
    });
  } else {
    // mode === 'type'
    copy.sort((a, b) => {
      const ra = TONE_RANK[projectColor(a.projectName, a.projectId).tone] ?? TONE_RANK.default;
      const rb = TONE_RANK[projectColor(b.projectName, b.projectId).tone] ?? TONE_RANK.default;
      if (ra !== rb) return ra - rb;
      const d = compareDueDates(a.dueDate, b.dueDate);
      if (d !== 0) return d;
      return a.projectName.localeCompare(b.projectName);
    });
  }
  return copy;
}

/**
 * Sort the engineer columns. Returns a new array; never mutates the input.
 *
 *   - `taskCount`: descending; ties broken alphabetically.
 *   - `name`: alphabetical by user.name (case-insensitive via localeCompare).
 */
export function sortEngineerRows(
  rows: ReadonlyArray<TeamUserRow>,
  mode: EngineerSortMode,
): TeamUserRow[] {
  const copy = rows.slice();
  if (mode === 'taskCount') {
    copy.sort((a, b) => {
      if (b.taskCount !== a.taskCount) return b.taskCount - a.taskCount;
      return a.user.name.localeCompare(b.user.name);
    });
  } else {
    // mode === 'name'
    copy.sort((a, b) => a.user.name.localeCompare(b.user.name));
  }
  return copy;
}
