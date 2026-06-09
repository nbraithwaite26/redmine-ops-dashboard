import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import EngineerKanbanBoard from './EngineerKanbanBoard';
import { findProjectByPath } from '../lib/projectTree';
import { DEFAULT_PROJECT_SOURCE } from '../services/projectSource';
import { getProjects, getTeamSchedule } from '../services/redmineApi';
import type { Issue, User } from '../types/redmine';

/**
 * "Resource Planning" Dashboard tab (CR #17). Renders the engineer Kanban
 * scoped to the AIRCRAFT ENGINEERING tree. Users are derived from assignees
 * via getTeamSchedule so the board works even though /users 403s for non-admin
 * keys (same pattern as the Hours page). The Kanban itself filters columns
 * down to the user's selected team via useSelectedTeam — that selection is
 * shared with the "Your Team's Work" panel on the Team tab, so picking
 * engineers there is immediately reflected here. The full Gantt remains
 * available via the "Full resource view" link.
 */
export default function DashboardResourcePlanning() {
  const [users, setUsers] = useState<User[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
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
            One column per engineer in your selected team, one card per project. Tap a
            card to see that engineer's tasks. Team selection is shared with the
            Team tab.
          </p>
        </div>
        <Link to="/resources" className="btn-secondary">
          Full resource view <ArrowUpRight size={14} />
        </Link>
      </div>

      <EngineerKanbanBoard users={users} issues={issues} loading={loading} />
    </div>
  );
}
