import { useEffect, useMemo, useState } from 'react';
import { getProjects } from '../services/redmineApi';
import DashboardCard from '../components/DashboardCard';
import ProjectCategoryCard from '../components/ProjectCategoryCard';
import {
  DEFAULT_PROJECT_SOURCE,
  PINNED_CATEGORY_SLUGS,
  getParentCandidates,
  resolveProjectSource,
} from '../services/projectSource';
import { buildSourceMetrics } from '../lib/projectHealth';
import type { Project } from '../types/redmine';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedRootId, setSelectedRootId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const p = await getProjects();
      setProjects(p);
      setLoading(false);
    })();
  }, []);

  const candidates = useMemo(() => getParentCandidates(projects), [projects]);
  const [showEmptyCategories, setShowEmptyCategories] = useState(false);

  // Resolve the source: explicit picker choice wins, else the default path.
  const source = useMemo(
    () =>
      resolveProjectSource(
        projects,
        selectedRootId !== undefined ? { rootId: selectedRootId } : {},
      ),
    [projects, selectedRootId],
  );

  // Keep the pinned categories + any with projects up top; tuck empty,
  // unpinned categories behind a disclosure to de-clutter the landing.
  const pinned = useMemo(() => new Set(PINNED_CATEGORY_SLUGS), []);
  const mainCategories = useMemo(
    () => source.categories.filter((c) => c.totalProjects > 0 || pinned.has(c.slug)),
    [source.categories, pinned],
  );
  const emptyCategories = useMemo(
    () => source.categories.filter((c) => c.totalProjects === 0 && !pinned.has(c.slug)),
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

  return (
    <div className="space-y-6">
      <section
        data-testid="projects-hero"
        className="rounded-2xl p-6 text-white shadow-card"
        style={{
          background:
            'linear-gradient(to right, var(--hero-from), var(--hero-to))',
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-brand">Projects</p>
            <h1 className="text-3xl font-semibold mt-1">
              {source.root?.name ?? DEFAULT_PROJECT_SOURCE.label}
            </h1>
            <p className="text-sm text-white/70 mt-1 max-w-lg">
              An at-a-glance view of the project portfolio. Pick a source below,
              then drill into a category to see its projects.
            </p>
          </div>
          <label className="text-sm">
            <span className="sr-only">Project source</span>
            <select
              value={selectedRootId ?? source.root?.id ?? ''}
              onChange={(e) =>
                setSelectedRootId(e.target.value ? Number(e.target.value) : undefined)
              }
              aria-label="Project source"
              className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {source.root && metrics.length > 0 && (
        <section data-testid="projects-metrics">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <DashboardCard key={metric.id} metric={metric} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-lg font-semibold">Categories</h2>
        </div>
        {source.categories.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {mainCategories.map((category) => (
                <ProjectCategoryCard key={category.slug} category={category} />
              ))}
            </div>

            {emptyCategories.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowEmptyCategories((v) => !v)}
                  className="text-sm link"
                  aria-expanded={showEmptyCategories}
                  data-testid="toggle-empty-categories"
                >
                  {showEmptyCategories ? 'Hide' : 'Show'} {emptyCategories.length} empty{' '}
                  {emptyCategories.length === 1 ? 'category' : 'categories'}
                </button>
                {showEmptyCategories && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-3 opacity-70">
                    {emptyCategories.map((category) => (
                      <ProjectCategoryCard key={category.slug} category={category} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="card p-8 text-center text-sm text-ink-muted">
            {loading
              ? 'Loading projects…'
              : 'No categories found under the selected project source.'}
          </div>
        )}
      </section>
    </div>
  );
}
