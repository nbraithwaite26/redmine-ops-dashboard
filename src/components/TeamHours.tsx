import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FolderKanban, ListChecks, Plus } from 'lucide-react';
import type { Issue, User } from '../types/redmine';
import {
  aggregateTeamFromIssues,
  type TeamProjectRow,
  type TeamUserRow,
} from '../lib/hoursAggregate';
import { formatHours, isOverdue, today } from '../lib/format';
import { UserGanttBars } from './UserGantt';

type View = 'Card' | 'List';

interface Props {
  users: User[];
  issues: Issue[];
  /** True while the team schedule is still being fetched. */
  loading?: boolean;
  readOnly: boolean;
  onLogTime: (issue: Issue) => void;
}

/**
 * Team Hours roster with two view modes (CR #18 item 8):
 *  - Card: one card per engineer (projects / tasks / spent / expected);
 *    expand → that engineer's hierarchical Gantt (project → tasks).
 *  - List: engineer → project rows → expandable task rows with a log-time
 *    action.
 * Both default collapsed, so no bars/rows render until you focus an engineer.
 */
export default function TeamHours({ users, issues, loading = false, readOnly, onLogTime }: Props) {
  const [view, setView] = useState<View>('Card');
  const rows = useMemo(() => aggregateTeamFromIssues(users, issues), [users, issues]);

  return (
    <div className="space-y-3" data-testid="team-hours">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Team schedule</h2>
          <p className="text-sm text-ink-muted">
            Engineers across the AIRCRAFT ENGINEERING portfolio. Expand one to
            see their work by project and task.
          </p>
        </div>
        <label className="text-sm">
          <span className="sr-only">View</span>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as View)}
            className="border border-gray-200 bg-white rounded px-2 py-1 text-sm"
            aria-label="View"
            data-testid="team-hours-view"
          >
            <option>Card</option>
            <option>List</option>
          </select>
        </label>
      </div>

      {loading && rows.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted" data-testid="team-hours-loading">
          Loading team schedule…
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted" data-testid="team-hours-empty">
          No engineers with assigned work.
        </div>
      ) : view === 'Card' ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <TeamUserCard key={row.user.id} row={row} issues={issues} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <TeamUserListSection
              key={row.user.id}
              row={row}
              readOnly={readOnly}
              onLogTime={onLogTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HoursPair({ spent, expected }: { spent: number; expected: number }) {
  return (
    <span className="tabular-nums">
      {formatHours(spent)} <span className="text-ink-muted">/ {formatHours(expected)}</span>
    </span>
  );
}

function TeamUserCard({ row, issues }: { row: TeamUserRow; issues: Issue[] }) {
  const [open, setOpen] = useState(false);
  const userIssues = useMemo(
    () => issues.filter((i) => i.assignee?.id === row.user.id),
    [issues, row.user.id],
  );

  return (
    <div className="card overflow-hidden" data-testid={`team-card-${row.user.id}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-canvas/60"
        aria-expanded={open}
        data-testid={`team-card-toggle-${row.user.id}`}
      >
        <span className="text-ink-muted shrink-0">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{row.user.name}</div>
          <div className="text-xs text-ink-muted flex items-center gap-3 mt-0.5">
            <span className="inline-flex items-center gap-1">
              <FolderKanban size={12} /> {row.projectCount} projects
            </span>
            <span className="inline-flex items-center gap-1">
              <ListChecks size={12} /> {row.taskCount} tasks
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold">
            <HoursPair spent={row.spentHours} expected={row.estimatedHours} />
          </div>
          <div className="text-xs text-ink-muted uppercase tracking-wide">spent / expected</div>
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100" data-testid={`team-card-gantt-${row.user.id}`}>
          <UserGanttBars issues={userIssues} />
        </div>
      )}
    </div>
  );
}

function TeamUserListSection({
  row,
  readOnly,
  onLogTime,
}: {
  row: TeamUserRow;
  readOnly: boolean;
  onLogTime: (issue: Issue) => void;
}) {
  return (
    <div className="card overflow-hidden" data-testid={`team-list-${row.user.id}`}>
      <div className="px-4 py-2.5 bg-canvas/50 border-b flex items-center justify-between">
        <div className="font-semibold truncate">{row.user.name}</div>
        <div className="text-xs text-ink-muted">
          {row.projectCount} projects · {row.taskCount} tasks ·{' '}
          <HoursPair spent={row.spentHours} expected={row.estimatedHours} />
        </div>
      </div>
      <div>
        {row.projects.map((p) => (
          <TeamProjectListRow
            key={p.projectId}
            project={p}
            readOnly={readOnly}
            onLogTime={onLogTime}
          />
        ))}
      </div>
    </div>
  );
}

function TeamProjectListRow({
  project,
  readOnly,
  onLogTime,
}: {
  project: TeamProjectRow;
  readOnly: boolean;
  onLogTime: (issue: Issue) => void;
}) {
  const [open, setOpen] = useState(false);
  const due = project.dueDate;
  return (
    <div className="border-t border-gray-100 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_120px_70px] items-center gap-2 px-4 py-2 text-left text-sm hover:bg-canvas/50"
        aria-expanded={open}
        data-testid={`team-project-${project.projectId}`}
      >
        <span className="flex items-center gap-1 font-medium truncate">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="truncate">{project.projectName}</span>
          <span className="text-xs text-ink-muted shrink-0">({project.tasks.length})</span>
        </span>
        <span className="hidden sm:block text-right">
          <HoursPair spent={project.spentHours} expected={project.estimatedHours} />
        </span>
        <span className="hidden sm:block text-right text-xs text-ink-muted">
          {project.tasks.length} task{project.tasks.length === 1 ? '' : 's'}
        </span>
        <span
          className={
            'text-right text-xs ' +
            (due && isOverdue(due, today()) ? 'text-red-600 font-medium' : 'text-ink-muted')
          }
        >
          {due ?? '—'}
        </span>
      </button>
      {open && (
        <div className="bg-canvas/30">
          <div className="hidden sm:grid grid-cols-[1fr_90px_92px_92px_100px_64px] gap-2 px-4 py-1.5 pl-10 text-[10px] uppercase tracking-wide text-ink-muted">
            <span>Task</span>
            <span>Status</span>
            <span className="text-right">Start</span>
            <span className="text-right">Due</span>
            <span className="text-right">Spent / Est</span>
            <span className="text-right">Log</span>
          </div>
          {project.tasks.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_90px_92px_92px_100px_64px] gap-2 px-4 py-1.5 pl-10 text-xs items-center border-t border-gray-100"
              data-testid={`team-task-${t.id}`}
            >
              <span className="truncate">
                <a className="link" href={`#/tasks?id=${t.id}`}>#{t.id}</a> {t.subject}
              </span>
              <span className="hidden sm:block">{t.status}</span>
              <span className="hidden sm:block text-right text-ink-muted">{t.startDate ?? '—'}</span>
              <span
                className={
                  'hidden sm:block text-right ' +
                  (t.dueDate && isOverdue(t.dueDate, today()) ? 'text-red-600' : 'text-ink-muted')
                }
              >
                {t.dueDate ?? '—'}
              </span>
              <span className="hidden sm:block text-right">
                <HoursPair spent={t.spentHours} expected={t.estimatedHours ?? 0} />
              </span>
              <span className="text-right">
                <button
                  type="button"
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={`Log time on issue ${t.id}`}
                  title={readOnly ? 'Read-only mode — writes disabled' : 'Log time'}
                  disabled={readOnly}
                  onClick={() => onLogTime(t)}
                  data-testid={`team-log-${t.id}`}
                >
                  <Plus size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
