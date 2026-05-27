import { motion } from 'framer-motion';
import { FolderKanban } from 'lucide-react';
import type { Project } from '../types/redmine';
import { stripHtml } from '../lib/format';

interface Props {
  project: Project;
  /** Open / total task counts for the summary line. */
  open: number;
  total: number;
  onSelect: () => void;
}

function statusPill(status: Project['status']): string {
  if (status === 'At Risk') return 'pill-orange';
  if (status === 'Closed' || status === 'Archived') return 'pill-gray';
  return 'pill-green';
}

/**
 * Clickable project card. Shares a `layoutId` with ProjectDetail so tapping
 * morphs it into the full-screen task list (Framer Motion shared layout).
 */
export default function ProjectCard({ project, open, total, onSelect }: Props) {
  return (
    <motion.button
      type="button"
      layoutId={`project-card-${project.id}`}
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      style={{ borderRadius: 16 }}
      className="card flex w-full flex-col p-4 text-left transition hover:border-gray-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-300"
      data-testid={`project-card-${project.id}`}
      aria-label={`${project.name.trim()} — ${open} open of ${total} tasks. Tap to view tasks.`}
    >
      <div className="flex items-center gap-2 text-ink-muted">
        <FolderKanban size={18} />
        <span className={statusPill(project.status) + ' ml-auto'}>{project.status}</span>
      </div>
      <div className="mt-2 font-semibold">{project.name.trim()}</div>
      <div className="text-xs text-ink-muted">{project.identifier}</div>
      {project.description && (
        <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{stripHtml(project.description)}</p>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
        <span>{open} open / {total} total</span>
        <span>Updated {project.updatedOn}</span>
      </div>
    </motion.button>
  );
}
