import { useEffect, useState } from 'react';
import { FolderKanban, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getIssues, getProjects } from '../services/redmineApi';
import type { Issue, Project } from '../types/redmine';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const [p, i] = await Promise.all([getProjects(), getIssues()]);
      setProjects(p);
      setIssues(i);
    })();
  }, []);

  const stats = (projectId: number) => {
    const projectIssues = issues.filter((i) => i.projectId === projectId);
    const open = projectIssues.filter((i) => i.status !== 'Closed' && i.status !== 'Resolved');
    return { total: projectIssues.length, open: open.length };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <button className="btn-brand" onClick={() => navigate('/project-builder')}>
          <Plus size={14} /> New project
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p) => {
          const s = stats(p.id);
          return (
            <div key={p.id} className="card p-4">
              <div className="flex items-center gap-2 text-ink-muted">
                <FolderKanban size={18} />
                <span
                  className={
                    p.status === 'At Risk'
                      ? 'pill-orange ml-auto'
                      : p.status === 'Closed'
                      ? 'pill-gray ml-auto'
                      : 'pill-green ml-auto'
                  }
                >
                  {p.status}
                </span>
              </div>
              <div className="mt-2 font-semibold">{p.name}</div>
              <div className="text-xs text-ink-muted">{p.identifier}</div>
              <p className="text-sm text-ink-soft mt-2 line-clamp-2">{p.description}</p>
              <div className="flex items-center justify-between mt-3 text-xs text-ink-muted">
                <span>{s.open} open / {s.total} total</span>
                <span>Updated {p.updatedOn}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
