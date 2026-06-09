import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig } from 'framer-motion';
import EngineerKanbanColumn from './EngineerKanbanColumn';
import EngineerProjectDetail from './EngineerProjectDetail';
import { aggregateTeamFromIssues, deriveUsers } from '../lib/hoursAggregate';
import {
  ENGINEER_SORT_OPTIONS,
  PROJECT_SORT_OPTIONS,
  sortEngineerRows,
  sortProjects,
  type EngineerSortMode,
  type ProjectSortMode,
} from '../lib/kanbanSort';
import { useSelectedTeam } from '../hooks/useSelectedTeam';
import type { Issue, User } from '../types/redmine';

interface Props {
  users: User[];
  issues: Issue[];
  /** When true, skip the loading placeholder text — caller manages the spinner. */
  loading?: boolean;
}

const PROJECT_SORT_KEY = 'rod.kanban.sort.project';
const ENGINEER_SORT_KEY = 'rod.kanban.sort.engineer';

const PROJECT_SORT_IDS = new Set(PROJECT_SORT_OPTIONS.map((o) => o.id));
const ENGINEER_SORT_IDS = new Set(ENGINEER_SORT_OPTIONS.map((o) => o.id));

function readStored<T extends string>(
  key: string,
  allowed: Set<string>,
  fallback: T,
): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw && allowed.has(raw)) return raw as T;
  } catch {
    // localStorage can throw in privacy mode — fall through to default.
  }
  return fallback;
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Best-effort persistence.
  }
}

/**
 * Engineer-focused Kanban view of assigned work. One column per engineer in
 * the selected team (via `useSelectedTeam`), one card per (engineer, project),
 * with a click-to-morph detail sheet that lists the engineer's tasks for that
 * project. The whole tree shares one `LayoutGroup` so cards animate cleanly
 * into the detail and back.
 *
 * Two sort controls (project cards within a column, engineer columns) are
 * exposed in a small toolbar and persist per-device. See `kanbanSort.ts` for
 * the ordering rules.
 */
export default function EngineerKanbanBoard({ users, issues, loading }: Props) {
  const { selectedIds } = useSelectedTeam();

  const [projectSort, setProjectSort] = useState<ProjectSortMode>(() =>
    readStored<ProjectSortMode>(PROJECT_SORT_KEY, PROJECT_SORT_IDS, 'dueDate'),
  );
  const [engineerSort, setEngineerSort] = useState<EngineerSortMode>(() =>
    readStored<EngineerSortMode>(ENGINEER_SORT_KEY, ENGINEER_SORT_IDS, 'taskCount'),
  );
  useEffect(() => writeStored(PROJECT_SORT_KEY, projectSort), [projectSort]);
  useEffect(() => writeStored(ENGINEER_SORT_KEY, engineerSort), [engineerSort]);

  const rows = useMemo(() => {
    // The non-admin Redmine key 403s on /users.json, so `users` may be empty
    // even in live mode. Fall back to deriving the roster from issue
    // assignees — same pattern as the Hours page.
    const roster = users.length > 0 ? users : deriveUsers(issues, []);
    const scoped = selectedIds === null
      ? roster
      : roster.filter((u) => selectedIds.includes(u.id));
    const aggregated = aggregateTeamFromIssues(scoped, issues);
    // Sort engineer columns, then re-sort the projects inside each one.
    return sortEngineerRows(aggregated, engineerSort).map((row) => ({
      ...row,
      projects: sortProjects(row.projects, projectSort),
    }));
  }, [users, issues, selectedIds, engineerSort, projectSort]);

  const [openKey, setOpenKey] = useState<string | null>(null);

  const open = useMemo(() => {
    if (!openKey) return null;
    const [userIdStr, projectIdStr] = openKey.split(':');
    const userId = Number(userIdStr);
    const projectId = Number(projectIdStr);
    const row = rows.find((r) => r.user.id === userId);
    if (!row) return null;
    const project = row.projects.find((p) => p.projectId === projectId);
    if (!project) return null;
    return { user: row.user, project };
  }, [openKey, rows]);

  if (loading) {
    return (
      <div className="p-4 text-sm text-ink-muted" data-testid="kanban-loading">
        Loading engineers…
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-2">
        {/* Sort toolbar — sits above the board so it stays visible even when
            the board is empty (e.g. team selection excludes everyone). */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 text-xs text-ink-muted"
          data-testid="kanban-sort-toolbar"
        >
          <label className="inline-flex items-center gap-2">
            <span>Engineers</span>
            <select
              className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-ink"
              value={engineerSort}
              onChange={(e) => setEngineerSort(e.target.value as EngineerSortMode)}
              data-testid="kanban-sort-engineers"
              aria-label="Sort engineers"
            >
              {ENGINEER_SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-2">
            <span>Projects</span>
            <select
              className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-ink"
              value={projectSort}
              onChange={(e) => setProjectSort(e.target.value as ProjectSortMode)}
              data-testid="kanban-sort-projects"
              aria-label="Sort project cards"
            >
              {PROJECT_SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {rows.length === 0 ? (
          <div className="p-4 text-sm text-ink-muted" data-testid="kanban-empty">
            No engineers with assigned work in the selected team.
          </div>
        ) : (
          <LayoutGroup>
            {/* CSS Grid auto-fit reflows columns at any browser zoom level:
                zoom out → more columns fit per row; zoom in → fewer.
                `minmax(15rem, 1fr)` keeps each column readable and stops them
                stretching past their content. */}
            <div
              className="grid gap-3 p-3"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))' }}
              data-testid="kanban-board"
            >
              {rows.map((row) => (
                <EngineerKanbanColumn
                  key={row.user.id}
                  row={row}
                  onSelect={(userId, projectId) => setOpenKey(`${userId}:${projectId}`)}
                />
              ))}
            </div>

            <AnimatePresence>
              {open && (
                <EngineerProjectDetail
                  key={`${open.user.id}:${open.project.projectId}`}
                  user={open.user}
                  project={open.project}
                  onClose={() => setOpenKey(null)}
                />
              )}
            </AnimatePresence>
          </LayoutGroup>
        )}
      </div>
    </MotionConfig>
  );
}
