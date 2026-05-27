import { useEffect, useState } from 'react';
import { motion, useDragControls, useReducedMotion } from 'framer-motion';
import { FolderKanban, X } from 'lucide-react';
import { getIssuesByProject } from '../services/redmineApi';
import { isOverdue, stripHtml, today } from '../lib/format';
import { initials } from '../lib/avatar';
import type { Issue, Project } from '../types/redmine';

interface Props {
  project: Project;
  onClose: () => void;
}

const HERO = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';

/**
 * Full-screen task list for one project. Morphs out of the tapped ProjectCard
 * (shared `layoutId`) and lazy-loads the project's related tasks. Dismiss via
 * close / Escape / backdrop / swipe-down. Honors reduced-motion.
 */
export default function ProjectDetail({ project, onClose }: Props) {
  const reduce = useReducedMotion();
  const dragControls = useDragControls();
  const [tasks, setTasks] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const data = await getIssuesByProject(project.id);
      if (cancelled) return;
      setTasks(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const reveal = (index: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: 0.1 + index * 0.06, type: 'spring' as const, stiffness: 320, damping: 30 },
        };

  const openCount = tasks.filter((t) => t.status !== 'Closed' && t.status !== 'Rejected').length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${project.name.trim()} tasks`}
    >
      <motion.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        data-testid={`project-detail-backdrop-${project.id}`}
      />

      <motion.div
        layoutId={`project-card-${project.id}`}
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
        data-testid={`project-detail-${project.id}`}
      >
        {/* Hero */}
        <div
          className="relative shrink-0 px-5 pb-5 text-white"
          style={{ background: HERO, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}
        >
          {!reduce && (
            <div
              className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 cursor-grab touch-none rounded-full bg-white/40 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
              aria-hidden
            />
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/30"
            aria-label="Close"
            data-testid={`project-detail-close-${project.id}`}
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 pt-2">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur">
              <FolderKanban size={20} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold leading-tight">{project.name.trim()}</div>
              <div className="text-sm text-white/80">{project.identifier} · {project.status}</div>
            </div>
          </div>
          {project.description && (
            <p className="mt-3 line-clamp-3 text-sm text-white/85">{stripHtml(project.description)}</p>
          )}
        </div>

        {/* Body — related tasks */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <motion.h3 {...reveal(0)} className="px-1 pb-2 text-sm font-semibold text-ink">
            Related tasks{' '}
            {!loading && (
              <span className="font-normal text-ink-muted">
                ({openCount} open / {tasks.length} total)
              </span>
            )}
          </motion.h3>

          {loading ? (
            <div className="card p-6 text-center text-sm text-ink-muted" data-testid="project-tasks-loading">
              Loading tasks…
            </div>
          ) : tasks.length === 0 ? (
            <div
              className="card p-6 text-center text-sm text-ink-muted"
              data-testid={`project-tasks-empty-${project.id}`}
            >
              No tasks in this project.
            </div>
          ) : (
            <motion.ul
              {...reveal(1)}
              className="overflow-hidden rounded-lg border border-gray-100"
              data-testid={`project-tasks-${project.id}`}
            >
              {tasks.map((t) => {
                const overdue = t.dueDate && isOverdue(t.dueDate, today());
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-b-0"
                  >
                    <span className="min-w-0 truncate">
                      <a className="link" href={`#/tasks?id=${t.id}`}>#{t.id}</a> {t.subject}
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-xs">
                      <span className="text-ink-muted">{t.status}</span>
                      <span
                        className="text-ink-muted"
                        title={t.assignee ? t.assignee.name : 'Unassigned'}
                      >
                        {t.assignee ? initials(t.assignee.name) : '—'}
                      </span>
                      <span className={overdue ? 'font-medium text-red-600' : 'text-ink-muted'}>
                        {t.dueDate ?? '—'}
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
