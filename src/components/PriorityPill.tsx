import { AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import type { IssuePriority } from '../types/redmine';
import { priorityPill } from '../lib/format';

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
      className={clsx('inline-flex items-center gap-1', priorityPill(priority))}
    >
      {showIcon && <AlertTriangle size={iconSize} aria-hidden="true" />}
      <span>{priority}</span>
    </span>
  );
}
