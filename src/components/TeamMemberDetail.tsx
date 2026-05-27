import { useEffect, useState } from 'react';
import { motion, useDragControls, useReducedMotion } from 'framer-motion';
import { ChevronDown, ChevronRight, FolderKanban, ListChecks, X } from 'lucide-react';
import type { ProjectHoursGroup, UserHoursSummary } from '../lib/hoursAggregate';
import { formatHours, isOverdue, today } from '../lib/format';
import { avatarGradient, initials } from '../lib/avatar';

interface Props {
  summary: UserHoursSummary;
  onClose: () => void;
}

/**
 * Full-screen detail sheet for one engineer. Shares `layoutId`s with
 * TeamMemberCard so it morphs out of the tapped card (border-radius, hero,
 * avatar, and name all interpolate). Body content reveals with a stagger.
 * Projects start collapsed; expand one to reveal its subtasks. Hours are the
 * hours logged in the selected week. Dismiss via close button, Escape,
 * backdrop tap, or swipe-down on the grab handle. Honors reduced-motion.
 */
export default function TeamMemberDetail({ summary, onClose }: Props) {
  const { user } = summary;
  const reduce = useReducedMotion();
  const dragControls = useDragControls();

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
            delay: 0.12 + index * 0.05,
            type: 'spring' as const,
            stiffness: 320,
            damping: 30,
          },
        };

  return (
    <div className="fixed inset-0 z-50 flex justify-center" role="dialog" aria-modal="true" aria-label={`${user.name} workload`}>
      <motion.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        data-testid={`member-detail-backdrop-${user.id}`}
      />

      <motion.div
        layoutId={`member-card-${user.id}`}
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
        data-testid={`member-detail-${user.id}`}
      >
        {/* Hero — shared anchor; full-bleed gradient header. */}
        <motion.div
          layoutId={`member-hero-${user.id}`}
          className="relative shrink-0 px-5 pb-6 text-white"
          style={{
            background: avatarGradient(user.id),
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)',
          }}
        >
          {!reduce && (
            <div
              className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 cursor-grab touch-none rounded-full bg-white/40 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
              data-testid={`member-detail-grab-${user.id}`}
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
            data-testid={`member-detail-close-${user.id}`}
          >
            <X size={18} />
          </motion.button>

          <div className="flex items-center gap-4 pt-2">
            <motion.div
              layoutId={`member-avatar-${user.id}`}
              className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/20 text-2xl font-semibold backdrop-blur"
            >
              {initials(user.name)}
            </motion.div>
            <motion.div
              layoutId={`member-name-${user.id}`}
              className="min-w-0 text-2xl font-semibold leading-tight"
            >
              {user.name}
            </motion.div>
          </div>

          <motion.div
            {...reveal(0)}
            className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/90"
          >
            <span className="inline-flex items-center gap-1.5">
              <FolderKanban size={14} /> {summary.projectCount} projects
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ListChecks size={14} /> {summary.taskCount} tasks
            </span>
            <span className="tabular-nums">{formatHours(summary.totalHours)} logged</span>
          </motion.div>
        </motion.div>

        {/* Body — per-project breakdown (collapsed), revealed with a stagger. */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <motion.h3 {...reveal(1)} className="px-1 pb-2 text-sm font-semibold text-ink">
            Projects
          </motion.h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {summary.projects.map((project, i) => (
              <motion.div key={project.projectId} {...reveal(i + 2)}>
                <ProjectBlock project={project} />
              </motion.div>
            ))}
            {summary.projects.length === 0 && (
              <motion.div {...reveal(2)} className="card p-4 text-sm text-ink-muted">
                No assigned projects.
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ProjectBlock({ project }: { project: ProjectHoursGroup }) {
  const [open, setOpen] = useState(false);
  const overdue = project.dueDate && isOverdue(project.dueDate, today());

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid={`member-project-toggle-${project.projectId}`}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-canvas/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-ink-muted">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{project.projectName}</span>
            <span className="text-xs text-ink-muted">
              {project.tasks.length} task{project.tasks.length === 1 ? '' : 's'}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-right text-sm">
          <span className="block font-semibold tabular-nums">
            {formatHours(project.spentHours)} <span className="font-normal text-ink-muted">logged</span>
          </span>
          <span className={'text-xs ' + (overdue ? 'font-medium text-red-600' : 'text-ink-muted')}>
            {project.dueDate ? `due ${project.dueDate}` : 'no due date'}
          </span>
        </span>
      </button>

      {open && (
        <ul
          className="divide-y divide-gray-100 border-t border-gray-100"
          data-testid={`member-project-tasks-${project.projectId}`}
        >
          {project.tasks.map(({ issue, spentHours }) => (
            <li key={issue.id} className="flex items-center justify-between gap-2 px-4 py-2 pl-9 text-xs">
              <span className="min-w-0 truncate">
                <a className="link" href={`#/tasks?id=${issue.id}`}>#{issue.id}</a> {issue.subject}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-ink-muted">{issue.status}</span>
                <span className="tabular-nums">{formatHours(spentHours)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
