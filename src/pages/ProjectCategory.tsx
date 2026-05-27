import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig } from 'framer-motion';
import { ArrowLeft, Search } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard';
import ProjectDetail from '../components/ProjectDetail';
import { getIssues, getProjects } from '../services/redmineApi';
import { getAllDescendants, slugify } from '../lib/projectTree';
import { stripHtml } from '../lib/format';
import type { Issue, Project, ProjectStatus } from '../types/redmine';

const STATUS_OPTIONS: Array<'All' | ProjectStatus> = [
  'All',
  'Active',
  'At Risk',
  'Closed',
  'Archived',
];

export default function ProjectCategory() {
  const { slug = '' } = useParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | ProjectStatus>('All');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);

  useEffect(() => {
    (async () => {
      const [p, i] = await Promise.all([getProjects(), getIssues()]);
      setProjects(p);
      setIssues(i);
      setLoading(false);
    })();
  }, []);

  // Resolve the category project by slug across all projects, so the
  // drill-down works regardless of which root the Projects picker used.
  const category = useMemo(
    () => projects.find((p) => slugify(p.name) === slug) ?? null,
    [projects, slug],
  );

  const categoryProjects = useMemo(
    () => (category ? getAllDescendants(projects, category.id) : []),
    [projects, category],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categoryProjects.filter((p) => {
      if (status !== 'All' && p.status !== status) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.identifier.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [categoryProjects, query, status]);

  const stats = (projectId: number) => {
    const projectIssues = issues.filter((i) => i.projectId === projectId);
    const open = projectIssues.filter(
      (i) => i.status !== 'Closed' && i.status !== 'Resolved',
    );
    return { total: projectIssues.length, open: open.length };
  };

  return (
    <div className="space-y-4">
      <div>
        <Link to="/projects" className="link inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={14} /> Projects
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4" data-testid="category-loading" aria-busy="true">
          <div>
            <div className="h-7 w-64 max-w-[60%] rounded bg-gray-200/70 animate-pulse" />
            <div className="h-4 w-80 max-w-[80%] rounded bg-gray-200/50 animate-pulse mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card p-4 h-28 animate-pulse bg-gray-100/40" />
            ))}
          </div>
        </div>
      ) : !category ? (
        <div className="card p-8 text-center text-sm text-ink-muted">
          No category found for "{slug}".{' '}
          <Link to="/projects" className="link">Back to Projects</Link>
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold">{category.name.trim()}</h1>
              <p className="text-sm text-ink-muted">
                {category.description
                  ? stripHtml(category.description)
                  : 'Projects under this category.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-white border border-gray-200 rounded">
                <Search size={14} className="text-ink-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter projects"
                  className="bg-transparent outline-none text-sm w-48"
                  aria-label="Filter projects"
                />
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'All' | ProjectStatus)}
                className="border border-gray-200 bg-white rounded px-2 py-1.5 text-sm"
                aria-label="Filter by status"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-ink-muted">
            Showing {filtered.length} of {categoryProjects.length}
          </div>

          <MotionConfig reducedMotion="user">
            <LayoutGroup>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((p) => {
                  const s = stats(p.id);
                  return (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      open={s.open}
                      total={s.total}
                      onSelect={() => setSelected(p)}
                    />
                  );
                })}
                {!loading && categoryProjects.length === 0 && (
                  <div className="col-span-3 text-center py-12 text-sm text-ink-muted">
                    No projects under this category yet.
                  </div>
                )}
                {!loading && categoryProjects.length > 0 && filtered.length === 0 && (
                  <div className="col-span-3 text-center py-12 text-sm text-ink-muted">
                    No projects match your filters.
                  </div>
                )}
              </div>

              <AnimatePresence>
                {selected && (
                  <ProjectDetail project={selected} onClose={() => setSelected(null)} />
                )}
              </AnimatePresence>
            </LayoutGroup>
          </MotionConfig>
        </>
      )}
    </div>
  );
}
