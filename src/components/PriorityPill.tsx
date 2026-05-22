import { AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import type { IssuePriority } from '../types/redmine';

interface Props {
  priority: IssuePriority;
  /** Optional override of the icon size in pixels. */
  iconSize?: number;
}

/**
 * Priority pill with an alert-triangle icon shown for High, Urgent, and
 * Immediate. Encapsulates the visual treatment so callers only need to
 * pass the priority value.
 */
export default function PriorityPill({ priority, iconSize = 10 }: Props) {
  const showIcon =
    priority === 'High' || priority === 'Urgent' || priority === 'Immediate';
  return (
    <span
      data-testid="priority-pill"
      data-priority={priority}
      className={clsx('inline-flex items-center gap-1', priorityPillClass(priority))}
    >
      {showIcon && <AlertTriangle size={iconSize} aria-hidden="true" />}
      <span>{priority}</span>
    </span>
  );
}

export function priorityPillClass(priority: IssuePriority): string {
  switch (priority) {
    case 'Immediate':
    case 'Urgent':
      return 'pill-red';
    case 'High':
      return 'pill-orange';
    case 'Normal':
      return 'pill-blue';
    case 'Low':
    default:
      return 'pill-gray';
  }
}
