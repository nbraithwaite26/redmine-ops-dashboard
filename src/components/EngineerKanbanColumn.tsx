import { FolderKanban } from 'lucide-react';
import EngineerProjectCard from './EngineerProjectCard';
import type { TeamUserRow } from '../lib/hoursAggregate';
import { avatarGradient, initials } from '../lib/avatar';

interface Props {
  row: TeamUserRow;
  /** Called with (userId, projectId) when a card is tapped. */
  onSelect: (userId: number, projectId: number) => void;
}

/**
 * One Kanban column: engineer header (avatar gradient, name, distinct project
 * count) on top of a vertical stack of EngineerProjectCard. Project count is
 * `row.projectCount` — already de-duplicated per (engineer, project) by
 * `aggregateTeamFromIssues`.
 */
export default function EngineerKanbanColumn({ row, onSelect }: Props) {
  const { user, projects, projectCount } = row;

  return (
    <section
      className="flex w-full min-w-0 flex-col rounded-xl border border-gray-200 bg-canvas/40"
      data-testid={`kanban-column-${user.id}`}
      aria-label={`${user.name} — ${projectCount} project${projectCount === 1 ? '' : 's'}`}
    >
      <header
        className="flex items-center gap-2 rounded-t-xl px-3 py-2 text-white"
        style={{ background: avatarGradient(user.id) }}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 text-xs font-semibold backdrop-blur">
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{user.name}</span>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-xs tabular-nums backdrop-blur"
          data-testid={`kanban-column-count-${user.id}`}
        >
          <FolderKanban size={12} />
          {projectCount}
        </span>
      </header>

      <div className="flex flex-col gap-2 p-2">
        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-xs text-ink-muted">
            No assigned projects.
          </div>
        ) : (
          projects.map((project) => (
            <EngineerProjectCard
              key={project.projectId}
              userId={user.id}
              project={project}
              onSelect={() => onSelect(user.id, project.projectId)}
            />
          ))
        )}
      </div>
    </section>
  );
}
