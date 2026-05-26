import clsx from 'clsx';
import { Timer } from 'lucide-react';
import type { Issue } from '../types/redmine';
import { formatHours, statusPill } from '../lib/format';

interface Props {
  issue: Issue;
  spentHours: number;
  /** Disables the Log time button + adds the read-only tooltip. */
  readOnly: boolean;
  /** Fired when the user clicks Log time on this task. */
  onLogTime: (issue: Issue) => void;
}

/**
 * Single task row under a ProjectHoursRow. Mirrors the task-detail
 * pattern from My Tasks: id, subject, status, spent, estimated, action.
 */
export default function TaskHoursRow({
  issue,
  spentHours,
  readOnly,
  onLogTime,
}: Props) {
  return (
    <div
      data-testid={`task-hours-row-${issue.id}`}
      className="flex items-center gap-3 pl-10 pr-4 py-2 border-t border-gray-100 hover:bg-canvas/40 text-sm"
    >
      <div className="flex-1 min-w-0">
        <a
          className="link font-medium"
          href={`#/tasks?id=${issue.id}`}
        >
          #{issue.id}
        </a>{' '}
        <span className="text-ink-soft">{issue.subject}</span>
      </div>
      <span className={clsx(statusPill(issue.status), 'text-xs whitespace-nowrap')}>
        {issue.status}
      </span>
      <span className="text-ink-soft tabular-nums whitespace-nowrap w-16 text-right">
        {formatHours(spentHours)}
      </span>
      <span className="text-ink-muted tabular-nums whitespace-nowrap w-16 text-right">
        {issue.estimatedHours != null ? formatHours(issue.estimatedHours) : '—'}
      </span>
      <button
        className="btn-secondary text-xs"
        disabled={readOnly}
        title={readOnly ? 'Read-only mode — writes disabled' : 'Log time for this task'}
        onClick={() => onLogTime(issue)}
        data-testid={`log-time-${issue.id}`}
      >
        <Timer size={12} /> Log time
      </button>
    </div>
  );
}
