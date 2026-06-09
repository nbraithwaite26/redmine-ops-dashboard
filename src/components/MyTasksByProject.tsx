import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Pencil, RefreshCw } from 'lucide-react';
import type { Issue } from '../types/redmine';
import { formatHours, isOverdue, today } from '../lib/format';

interface Props {
  /** Title shown above the grouped list. */
  title: string;
  issues: Issue[];
  onOpenIssue: (issue: Issue) => void;
  onQuickEdit: (issue: Issue) => void;
  /** Optional refresh handler — wires into the title row's refresh button. */
  onRefresh?: () => void;
}

interface ProjectGroup {
  projectId: number;
  projectName: string;
  issues: Issue[];
  estimatedHours: number;
  spentHours: number;
  overdueCount: number;
  /** Earliest non-null dueDate across the project's issues. */
  nextDue: string | null;
}

/**
 * "My tasks" rendered as collapsible per-project groups instead of one flat
 * table. Each header shows the project name, task count, est/spent totals,
 * and the earliest upcoming due date (red if any task is overdue). Expanding
 * a group reveals a compact list whose rows route through the same
 * onOpenIssue / onQuickEdit handlers as the prior IssueTable.
 *
 * Groups are sorted: overdue projects first, then by earliest due date,
 * then alphabetically — so the user's attention lands on what's most at risk.
 */
export default function MyTasksByProject({
  title,
  issues,
  onOpenIssue,
  onQuickEdit,
  onRefresh,
}: Props) {
  const groups = useMemo<ProjectGroup[]>(() => {
    const byProject = new Map<number, ProjectGroup>();
    const t = today();
    for (const issue of issues) {
      let g = byProject.get(issue.projectId);
      if (!g) {
        g = {
          projectId: issue.projectId,
          projectName: issue.projectName,
          issues: [],
          estimatedHours: 0,
          spentHours: 0,
          overdueCount: 0,
          nextDue: null,
        };
        byProject.set(issue.projectId, g);
      }
      g.issues.push(issue);
      g.estimatedHours += issue.estimatedHours ?? 0;
      g.spentHours += issue.spentHours;
      if (isOverdue(issue.dueDate, t)) g.overdueCount += 1;
      if (issue.dueDate && (g.nextDue === null || issue.dueDate < g.nextDue)) {
        g.nextDue = issue.dueDate;
      }
    }
    return Array.from(byProject.values()).sort((a, b) => {
      // Overdue projects bubble to the top.
      if ((b.overdueCount > 0 ? 1 : 0) !== (a.overdueCount > 0 ? 1 : 0)) {
        return (b.overdueCount > 0 ? 1 : 0) - (a.overdueCount > 0 ? 1 : 0);
      }
      // Then earliest due date.
      if (a.nextDue && b.nextDue && a.nextDue !== b.nextDue) {
        return a.nextDue < b.nextDue ? -1 : 1;
      }
      if (a.nextDue && !b.nextDue) return -1;
      if (b.nextDue && !a.nextDue) return 1;
      // Stable: project name.
      return a.projectName.localeCompare(b.projectName);
    });
  }, [issues]);

  // `expanded[id] === undefined` means "use the default" — the first group
  // (highest priority after sort) starts open so the user lands on their most
  // pressing project without an extra click. A real true/false from a user
  // click takes precedence. Avoids the stale-closure trap of seeding
  // useState before `groups` is populated.
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const isOpen = (id: number, index: number) =>
    expanded[id] === undefined ? index === 0 : expanded[id]!;
  const toggle = (id: number, index: number) =>
    setExpanded((prev) => ({
      ...prev,
      [id]: !(prev[id] === undefined ? index === 0 : prev[id]!),
    }));

  return (
    <div className="card overflow-hidden" data-testid="my-tasks-by-project">
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-ink-muted">
          {issues.length} task{issues.length === 1 ? '' : 's'} across {groups.length} project
          {groups.length === 1 ? '' : 's'}
        </span>
        <div className="flex-1" />
        {onRefresh && (
          <button
            type="button"
            className="btn-ghost"
            onClick={onRefresh}
            aria-label="Refresh"
            data-testid="my-tasks-refresh"
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">
          No tasks assigned to you.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {groups.map((group, index) => {
            const open = isOpen(group.projectId, index);
            const t = today();
            const overdue = group.overdueCount > 0;
            return (
              <li key={group.projectId} data-testid={`my-tasks-group-${group.projectId}`}>
                <button
                  type="button"
                  onClick={() => toggle(group.projectId, index)}
                  aria-expanded={open}
                  data-testid={`my-tasks-toggle-${group.projectId}`}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-canvas/40"
                >
                  <span className="text-ink-muted">
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {group.projectName}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {group.issues.length} task{group.issues.length === 1 ? '' : 's'}
                      {overdue && (
                        <span className="ml-2 font-medium text-red-600">
                          · {group.overdueCount} overdue
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-right text-xs tabular-nums text-ink-muted sm:block">
                    <span className="block">
                      {formatHours(group.spentHours)} / {formatHours(group.estimatedHours)}
                    </span>
                    <span className={overdue ? 'font-medium text-red-600' : ''}>
                      {group.nextDue ? `next due ${group.nextDue}` : 'no due date'}
                    </span>
                  </span>
                </button>

                {open && (
                  <ul
                    className="divide-y divide-gray-100 border-t border-gray-100 bg-canvas/30"
                    data-testid={`my-tasks-list-${group.projectId}`}
                  >
                    {group.issues.map((issue) => {
                      const iOverdue = isOverdue(issue.dueDate, t);
                      return (
                        <li
                          key={issue.id}
                          className="flex items-center gap-3 px-4 py-2 pl-9 text-sm"
                          data-testid={`my-tasks-row-${issue.id}`}
                        >
                          <button
                            type="button"
                            onClick={() => onOpenIssue(issue)}
                            className="link min-w-0 flex-1 truncate text-left"
                            data-testid={`my-tasks-open-${issue.id}`}
                          >
                            <span className="text-ink-muted">#{issue.id}</span>{' '}
                            <span className="text-ink">{issue.subject}</span>
                          </button>
                          <span className="hidden shrink-0 text-xs text-ink-muted sm:inline">
                            {issue.status}
                          </span>
                          <span className="hidden shrink-0 text-xs tabular-nums text-ink-muted md:inline">
                            {formatHours(issue.spentHours)}
                            <span className="text-ink-soft">
                              /{formatHours(issue.estimatedHours ?? 0)}
                            </span>
                          </span>
                          <span
                            className={
                              'shrink-0 text-xs ' +
                              (iOverdue ? 'font-medium text-red-600' : 'text-ink-muted')
                            }
                          >
                            {issue.dueDate ?? '—'}
                          </span>
                          <button
                            type="button"
                            onClick={() => onQuickEdit(issue)}
                            className="btn-ghost shrink-0"
                            aria-label={`Quick edit #${issue.id}`}
                            data-testid={`my-tasks-quickedit-${issue.id}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenIssue(issue)}
                            className="btn-ghost shrink-0"
                            aria-label={`Open #${issue.id}`}
                          >
                            <ExternalLink size={14} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
