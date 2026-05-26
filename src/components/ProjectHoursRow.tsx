import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { Issue } from '../types/redmine';
import type { ProjectHoursGroup } from '../lib/hoursAggregate';
import { formatHours } from '../lib/format';
import TaskHoursRow from './TaskHoursRow';

interface Props {
  project: ProjectHoursGroup;
  readOnly: boolean;
  onLogTime: (issue: Issue) => void;
}

/**
 * One project row under a UserHoursCard. Click expands to reveal the
 * user's tasks in that project.
 */
export default function ProjectHoursRow({ project, readOnly, onLogTime }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid={`project-hours-row-${project.projectId}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 pl-6 pr-4 py-2 border-t border-gray-100 hover:bg-canvas/60 text-sm text-left"
        aria-expanded={open}
        data-testid={`project-toggle-${project.projectId}`}
      >
        <span className="text-ink-muted">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="flex-1 min-w-0 truncate font-medium">{project.projectName}</span>
        <span className="text-ink-soft tabular-nums whitespace-nowrap w-20 text-right">
          {formatHours(project.spentHours)}
        </span>
        <span className="text-ink-muted tabular-nums whitespace-nowrap w-20 text-right">
          {project.estimatedHours > 0 ? formatHours(project.estimatedHours) : '—'}
        </span>
        <span
          className="text-ink-muted text-xs whitespace-nowrap w-28 text-right"
          title={project.dueDate ? 'Latest task due date in this project' : undefined}
        >
          {project.dueDate ?? '—'}
        </span>
      </button>

      {open && (
        <div data-testid={`project-tasks-${project.projectId}`}>
          {project.tasks.length === 0 ? (
            <div className={clsx('pl-10 pr-4 py-2 text-xs text-ink-muted border-t border-gray-100')}>
              No tasks assigned in this project.
            </div>
          ) : (
            project.tasks.map((t) => (
              <TaskHoursRow
                key={t.issue.id}
                issue={t.issue}
                spentHours={t.spentHours}
                readOnly={readOnly}
                onLogTime={onLogTime}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
