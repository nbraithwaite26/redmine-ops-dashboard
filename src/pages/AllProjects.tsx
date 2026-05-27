import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig } from 'framer-motion';
import { Search } from 'lucide-react';
import ProjectCard from '../components/ProjectCard';
import ProjectDetail from '../components/ProjectDetail';
import { getIssues, getProjects } from '../services/redmineApi';
import { stripHtml } from '../lib/format';
import type { Issue, Project, ProjectStatus } from '../types/redmine';

const STATUS_OPTIONS: Array<'All' | ProjectStatus> = [
  'All',
  'Active',
  'At Risk',
  'Closed',
  'Archived',
];

export default function AllProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | ProjectStatus>('All');
  const [selected, setSelected] = useState<Project | null>(null);

  useEffect(() => {
    (async () => {
      const [p, i] = await Promise.all([getProjects(), getIssues()]);
      setProjects(p);
      setIssues(i);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== 'All' && p.status !== status) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.identifier.toLowerCase().includes(q) ||
        stripHtml(p.description).toLowerCase().includes(q)
      );
    });
  }, [projects, query, status]);

  const stats = (projectId: number) => {
    const projectIssues = issues.filter((i) => i.projectId === projectId);
    const open = projectIssues.filter(
      (i) => i.status !== 'Closed' && i.status !== 'Resolved',
    );
    return { total: projectIssues.length, open: open.length };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">All projects</h1>
          <p className="text-sm text-ink-muted">
            Every project in Redmine — including archived. Use the filters to narrow down.
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
        Showing {filtered.length} of {projects.length}
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
            {filtered.length === 0 && (
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
    </div>
  );
}
