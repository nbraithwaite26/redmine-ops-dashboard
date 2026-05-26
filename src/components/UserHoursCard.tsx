import { useState } from 'react';
import { ChevronDown, ChevronRight, FolderKanban, ListChecks } from 'lucide-react';
import type { Issue } from '../types/redmine';
import type { UserHoursSummary } from '../lib/hoursAggregate';
import { formatHours } from '../lib/format';
import ProjectHoursRow from './ProjectHoursRow';

interface Props {
  summary: UserHoursSummary;
  readOnly: boolean;
  onLogTime: (issue: Issue) => void;
}

/**
 * One user card on the Hours page. The header is the headline summary
 * (total hours, project count, task count). Clicking expands to reveal
 * the per-project breakdown.
 */
export default function UserHoursCard({ summary, readOnly, onLogTime }: Props) {
  const [open, setOpen] = useState(false);
  const userId = summary.user.id;
  const panelId = `user-projects-list-${userId}`;

  return (
    <div
      data-testid={`user-hours-card-${userId}`}
      className="card overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-canvas/60"
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={`user-toggle-${userId}`}
      >
        <span className="text-ink-muted shrink-0">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{summary.user.name}</div>
          <div className="text-xs text-ink-muted truncate">{summary.user.email || summary.user.login}</div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xl font-semibold tabular-nums">
            {formatHours(summary.totalHours)}
          </div>
          <div className="text-xs text-ink-muted uppercase tracking-wide">logged</div>
        </div>

        <div className="text-right shrink-0 w-20" data-testid={`user-projects-${userId}`}>
          <div className="text-2xl font-semibold tabular-nums flex items-center justify-end gap-1">
            <FolderKanban size={16} className="text-ink-muted" />
            {summary.projectCount}
          </div>
          <div className="text-xs text-ink-muted uppercase tracking-wide">projects</div>
          <div className="text-xs text-ink-soft mt-1 flex items-center justify-end gap-1" data-testid={`user-tasks-${userId}`}>
            <ListChecks size={12} className="text-ink-muted" />
            <span className="tabular-nums">{summary.taskCount}</span>
            <span className="uppercase tracking-wide text-ink-muted">tasks</span>
          </div>
        </div>
      </button>

      {open && (
        <div id={panelId} role="region" aria-label={`${summary.user.name}'s projects`} data-testid={`user-projects-list-${userId}`}>
          {summary.projects.length === 0 ? (
            <div className="px-6 py-3 text-sm text-ink-muted border-t border-gray-100">
              No tasks assigned.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 pl-6 pr-4 py-1.5 text-[10px] uppercase tracking-wide text-ink-muted border-t border-gray-100 bg-canvas/40">
                <span className="w-3.5" />
                <span className="flex-1">Project</span>
                <span className="w-20 text-right">Spent</span>
                <span className="w-20 text-right">Estimated</span>
                <span className="w-28 text-right">Due</span>
              </div>
              {summary.projects.map((p) => (
                <ProjectHoursRow
                  key={p.projectId}
                  project={p}
                  readOnly={readOnly}
                  onLogTime={onLogTime}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
