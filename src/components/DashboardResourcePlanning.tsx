import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import ResourceTimeline from './ResourceTimeline';
import { findProjectByPath } from '../lib/projectTree';
import { DEFAULT_PROJECT_SOURCE } from '../services/projectSource';
import { getProjects, getTeamSchedule } from '../services/redmineApi';
import type { Issue, ResourceAllocation, User } from '../types/redmine';

/**
 * "Resource Planning" Dashboard tab (CR #17). Embeds the team Gantt scoped to
 * the AIRCRAFT ENGINEERING tree. Users are derived from assignees via
 * getTeamSchedule so the chart works even though /users 403s for non-admin
 * keys (same pattern as the Hours page). Data loads lazily on first open.
 */
export default function DashboardResourcePlanning() {
  const [users, setUsers] = useState<User[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const projects = await getProjects();
      const root = findProjectByPath(projects, DEFAULT_PROJECT_SOURCE.path);
      const schedule = await getTeamSchedule(root?.id);
      if (cancelled) return;
      setUsers(schedule.users);
      setIssues(schedule.issues);
      setAllocations(schedule.allocations);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team workload</h2>
          <p className="text-xs text-ink-muted">
            Gantt across the team — red bars indicate overload.
          </p>
        </div>
        <Link to="/resources" className="btn-secondary">
          Full resource view <ArrowUpRight size={14} />
        </Link>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-ink-muted">
          Loading team schedule…
        </div>
      ) : (
        <ResourceTimeline users={users} issues={issues} allocations={allocations} />
      )}
    </div>
  );
}
