import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import type { Issue } from '../types/redmine';
import type { TeamProjectRow } from '../lib/hoursAggregate';
import { isOverdue, today } from '../lib/format';
import { projectColor } from '../lib/projectColor';

interface Props {
  /** Engineer who owns this column — scopes the morph layoutId. */
  userId: number;
  project: TeamProjectRow;
  onSelect: () => void;
}

/**
 * Minimal Kanban card — project title + earliest due date only. All the
 * detail (task count, hours, full task list with links) lives in the morph
 * target [`EngineerProjectDetail`](./EngineerProjectDetail.tsx). Hero color
 * is project-keyed via [`projectColor`](../lib/projectColor.ts), so STC /
 * DDP / Continuous Improvement projects read the same color language they do
 * on the All Projects page and the project detail sheet.
 *
 * Engineer id scopes the layoutId so two engineers on the same project
 * animate independently.
 */
export default function EngineerProjectCard({ userId, project, onSelect }: Props) {
  const overdue = isOverdue(project.dueDate, today());
  const color = useMemo(
    () => projectColor(project.projectName, project.projectId),
    [project.projectName, project.projectId],
  );

  return (
    <motion.button
      type="button"
      layoutId={`eng-project-card-${userId}-${project.projectId}`}
      onClick={onSelect}
      whileTap={{ scale: 0.97 }}
      style={{ borderRadius: 16 }}
      className="card flex w-full flex-col overflow-hidden p-0 text-left focus:outline-none focus:ring-2 focus:ring-brand-300"
      data-testid={`eng-project-card-${userId}-${project.projectId}`}
      data-project-tone={color.tone}
      aria-label={`${project.projectName} — ${color.label} project, ${project.tasks.length} tasks. Tap to expand.`}
    >
      <motion.div
        layoutId={`eng-project-header-${userId}-${project.projectId}`}
        className="px-3 py-2.5"
        style={{ background: color.gradient }}
      >
        <motion.div
          layoutId={`eng-project-name-${userId}-${project.projectId}`}
          className="truncate text-sm font-semibold leading-snug text-white"
          title={project.projectName}
        >
          {project.projectName}
        </motion.div>
      </motion.div>

      <div
        className={
          'flex items-center gap-1 px-3 py-1.5 text-xs ' +
          (overdue ? 'font-medium text-red-600' : 'text-ink-muted')
        }
      >
        <CalendarDays size={12} />
        {project.dueDate
          ? overdue
            ? `overdue · ${project.dueDate}`
            : `due ${project.dueDate}`
          : 'no due date'}
      </div>
    </motion.button>
  );
}

/**
 * Sort the project's tasks by closest due date and return the top `n`. Tasks
 * without a dueDate sort to the bottom; overdue tasks naturally bubble up
 * because their ISO dates are lexicographically earliest.
 *
 * Exported because the detail sheet still uses it for its "Up next" emphasis.
 */
export function pickNextDue(tasks: ReadonlyArray<Issue>, n: number): Issue[] {
  return [...tasks]
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return 0;
    })
    .slice(0, n);
}
