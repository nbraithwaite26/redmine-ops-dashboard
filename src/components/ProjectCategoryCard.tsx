import { ChevronRight, FolderKanban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ProjectCategory } from '../services/projectSource';
import { stripHtml } from '../lib/format';

interface Props {
  category: ProjectCategory;
  /** Override navigation (tests / embedding). Defaults to the drill-down route. */
  onSelect?: (category: ProjectCategory) => void;
}

/**
 * Clickable category card for the Projects landing. Drill-down entry point:
 * selecting it navigates to /projects/category/:slug. CR #15.
 */
export default function ProjectCategoryCard({ category, onSelect }: Props) {
  const navigate = useNavigate();
  const handle = () =>
    onSelect ? onSelect(category) : navigate(`/projects/category/${category.slug}`);

  const { project, totalProjects } = category;
  const label = totalProjects === 1 ? '1 project' : `${totalProjects} projects`;

  return (
    <button
      type="button"
      onClick={handle}
      data-testid={`category-card-${category.slug}`}
      className="card p-4 text-left flex flex-col gap-3 cursor-pointer hover:border-gray-200 hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-brand-300"
      aria-label={`${project.name} — ${label}`}
    >
      <div className="flex items-center gap-2 text-ink-muted">
        <FolderKanban size={18} />
        <ChevronRight size={16} className="ml-auto" />
      </div>
      <div>
        <div className="font-semibold text-ink">{project.name}</div>
        {project.description && (
          <p className="text-sm text-ink-soft mt-1 line-clamp-2">
            {stripHtml(project.description)}
          </p>
        )}
      </div>
      <div className="mt-auto flex items-baseline gap-1">
        <span className="text-3xl font-semibold text-ink">{totalProjects}</span>
        <span className="text-xs text-ink-muted">{totalProjects === 1 ? 'project' : 'projects'}</span>
      </div>
    </button>
  );
}
