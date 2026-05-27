import { motion } from 'framer-motion';
import { FolderKanban, ListChecks } from 'lucide-react';
import type { UserHoursSummary } from '../lib/hoursAggregate';
import { formatHours } from '../lib/format';
import { avatarGradient, initials } from '../lib/avatar';

interface Props {
  summary: UserHoursSummary;
  onSelect: () => void;
}

/**
 * Collapsed preview card for one engineer (CR: card-expand interaction).
 * Shares `layoutId`s with TeamMemberDetail so tapping morphs this card into
 * the full-screen sheet with spatial continuity. The gradient/initials hero
 * is the dominant motion anchor. Hours shown are logged in the selected week.
 */
export default function TeamMemberCard({ summary, onSelect }: Props) {
  const { user } = summary;
  const topProject = summary.projects[0]?.projectName;

  return (
    <motion.button
      type="button"
      layoutId={`member-card-${user.id}`}
      onClick={onSelect}
      whileTap={{ scale: 0.97 }}
      style={{ borderRadius: 20 }}
      className="card overflow-hidden p-0 text-left flex flex-col focus:outline-none focus:ring-2 focus:ring-brand-300"
      data-testid={`member-card-${user.id}`}
      aria-label={`${user.name} — ${summary.projectCount} projects, ${summary.taskCount} tasks. Tap to expand.`}
    >
      <motion.div
        layoutId={`member-hero-${user.id}`}
        className="relative flex items-center gap-3 px-4 py-4"
        style={{ background: avatarGradient(user.id) }}
      >
        <motion.div
          layoutId={`member-avatar-${user.id}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20 text-base font-semibold text-white backdrop-blur"
        >
          {initials(user.name)}
        </motion.div>
        <motion.div
          layoutId={`member-name-${user.id}`}
          className="min-w-0 truncate text-base font-semibold leading-tight text-white"
        >
          {user.name}
        </motion.div>
      </motion.div>

      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <FolderKanban size={12} /> {summary.projectCount} projects
          </span>
          <span className="inline-flex items-center gap-1">
            <ListChecks size={12} /> {summary.taskCount} tasks
          </span>
        </div>
        <div className="text-sm">
          <span className="font-semibold tabular-nums">{formatHours(summary.totalHours)}</span>
          <span className="text-ink-muted"> logged</span>
        </div>
        {topProject && (
          <div className="truncate text-xs text-ink-soft">Top: {topProject}</div>
        )}
      </div>
    </motion.button>
  );
}
