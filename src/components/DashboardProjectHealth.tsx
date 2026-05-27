import { useEffect, useMemo, useState } from 'react';
import DashboardCard from './DashboardCard';
import ProjectCategoryCard from './ProjectCategoryCard';
import { buildSourceMetrics } from '../lib/projectHealth';
import {
  DEFAULT_PROJECT_SOURCE,
  PINNED_CATEGORY_SLUGS,
  resolveProjectSource,
} from '../services/projectSource';
import { getProjects } from '../services/redmineApi';
import type { Project } from '../types/redmine';

/**
 * "Project Health" Dashboard tab (CR #17). Portfolio health scoped to the
 * default AIRCRAFT ENGINEERING tree: headline metrics (total / active /
 * at-risk / categories) plus the direct category cards, which drill into
 * /projects/category/:slug. Data loads lazily when the tab is first opened.
 */
export default function DashboardProjectHealth() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getProjects();
      if (cancelled) return;
      setProjects(p);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const source = useMemo(() => resolveProjectSource(projects), [projects]);

  const pinned = useMemo(() => new Set(PINNED_CATEGORY_SLUGS), []);
  const mainCategories = useMemo(
    () => source.categories.filter((c) => c.totalProjects > 0 || pinned.has(c.slug)),
    [source.categories, pinned],
  );

  const metrics = useMemo(
    () =>
      source.root
        ? buildSourceMetrics(
            projects,
            source.root.id,
            source.totalProjects,
            source.categories.length,
          )
        : [],
    [projects, source],
  );

  if (loading) {
    return (
      <div className="card p-8 text-center text-sm text-ink-muted">
        Loading project health…
      </div>
    );
  }

  if (!source.root) {
    return (
      <div className="card p-8 text-center text-sm text-ink-muted">
        No projects found under {DEFAULT_PROJECT_SOURCE.label}.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{source.root.name.trim()}</h2>
        <p className="text-xs text-ink-muted">
          Portfolio health across the project tree. Open a category to drill in.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <DashboardCard key={metric.id} metric={metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {mainCategories.map((category) => (
          <ProjectCategoryCard key={category.slug} category={category} />
        ))}
      </div>
    </div>
  );
}
