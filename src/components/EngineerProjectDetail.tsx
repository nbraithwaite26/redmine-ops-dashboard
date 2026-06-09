import { useEffect } from 'react';
import { motion, useDragControls, useReducedMotion } from 'framer-motion';
import { CalendarDays, Clock, FolderKanban, ListChecks, X } from 'lucide-react';
import type { TeamProjectRow } from '../lib/hoursAggregate';
import type { User } from '../types/redmine';
import { formatHours, isOverdue, today } from '../lib/format';
import { projectColor } from '../lib/projectColor';

interface Props {
  user: User;
  project: TeamProjectRow;
  onClose: () => void;
}

/**
 * Full-screen detail sheet for one engineer × project. Morphs out of the
 * tapped EngineerProjectCard via matching `layoutId`s. Lists that engineer's
 * tasks for the project with `#/tasks?id=` links. Dismiss via close button,
 * Escape, backdrop tap, or swipe-down on the grab handle. Honors
 * reduced-motion.
 */
export default function EngineerProjectDetail({ user, project, onClose }: Props) {
  const reduce = useReducedMotion();
  const dragControls = useDragControls();
  const overdue = isOverdue(project.dueDate, today());
  const color = projectColor(project.projectName, project.projectId);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const reveal = (index: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: {
            delay: 0.12 + index * 0.04,
            type: 'spring' as const,
            stiffness: 320,
            damping: 30,
          },
        };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${user.name} — ${project.projectName} tasks`}
    >
      <motion.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        data-testid={`eng-project-detail-backdrop-${user.id}-${project.projectId}`}
      />

      <motion.div
        layoutId={`eng-project-card-${user.id}-${project.projectId}`}
        drag={reduce ? false : 'y'}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onClose();
        }}
        style={{ borderRadius: 0, background: 'var(--bg-card)' }}
        className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden shadow-2xl"
        data-testid={`eng-project-detail-${user.id}-${project.projectId}`}
      >
        {/* Hero — shared layoutId anchors the morph. Gradient is keyed off
            the project (same as the card) so the gradient stays put during
            the morph rather than crossfading. */}
        <motion.div
          layoutId={`eng-project-header-${user.id}-${project.projectId}`}
          className="relative shrink-0 px-5 pb-5 text-white"
          style={{
            background: color.gradient,
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)',
          }}
          data-project-tone={color.tone}
        >
          {!reduce && (
            <div
              className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 cursor-grab touch-none rounded-full bg-white/40 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
              data-testid={`eng-project-detail-grab-${user.id}-${project.projectId}`}
              aria-hidden
            />
          )}

          <motion.button
            type="button"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0 : 0.2 }}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/30"
            aria-label="Close"
            data-testid={`eng-project-detail-close-${user.id}-${project.projectId}`}
          >
            <X size={18} />
          </motion.button>

          <div className="flex items-center gap-4 pt-2">
            <motion.div
              layoutId={`eng-project-icon-${user.id}-${project.projectId}`}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/20 text-white backdrop-blur"
              aria-hidden
            >
              <FolderKanban size={26} />
            </motion.div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-white/70">
                {user.name}
              </div>
              <motion.div
                layoutId={`eng-project-name-${user.id}-${project.projectId}`}
                className="mt-0.5 text-2xl font-semibold leading-tight"
              >
                {project.projectName}
              </motion.div>
            </div>
          </div>

          <motion.div
            {...reveal(0)}
            className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/90"
          >
            <span className="inline-flex items-center gap-1.5">
              <ListChecks size={14} /> {project.tasks.length} task
              {project.tasks.length === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock size={14} /> {formatHours(project.spentHours)}
              <span className="text-white/70">/{formatHours(project.estimatedHours)}</span>
            </span>
            <span
              className={
                'inline-flex items-center gap-1.5 ' +
                (overdue ? 'font-semibold text-red-200' : '')
              }
            >
              <CalendarDays size={14} />
              {project.dueDate
                ? overdue
                  ? `overdue · ${project.dueDate}`
                  : `due ${project.dueDate}`
                : 'no due date'}
            </span>
          </motion.div>
        </motion.div>

        {/* Body — task list with #/tasks?id=… links. */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <motion.h3 {...reveal(1)} className="px-1 pb-2 text-sm font-semibold text-ink">
            Tasks
          </motion.h3>
          {project.tasks.length === 0 ? (
            <motion.div {...reveal(2)} className="card p-4 text-sm text-ink-muted">
              No tasks for this project.
            </motion.div>
          ) : (
            <motion.ul
              {...reveal(2)}
              className="divide-y divide-gray-100 rounded-lg border border-gray-100"
              data-testid={`eng-project-detail-tasks-${user.id}-${project.projectId}`}
            >
              {project.tasks.map((issue) => {
                const issueOverdue = isOverdue(issue.dueDate, today());
                return (
                  <li key={issue.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <a className="link" href={`#/tasks?id=${issue.id}`}>
                        #{issue.id}
                      </a>{' '}
                      <span className="text-ink">{issue.subject}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-xs">
                      <span className="text-ink-muted">{issue.status}</span>
                      <span className="tabular-nums">
                        {formatHours(issue.spentHours)}
                        <span className="text-ink-soft">/{formatHours(issue.estimatedHours ?? 0)}</span>
                      </span>
                      <span
                        className={
                          issueOverdue ? 'font-medium text-red-600' : 'text-ink-muted'
                        }
                      >
                        {issue.dueDate ?? '—'}
                      </span>
                    </span>
                  </li>
                );
              })}
            </motion.ul>
          )}
        </div>
      </motion.div>
    </div>
  );
}
