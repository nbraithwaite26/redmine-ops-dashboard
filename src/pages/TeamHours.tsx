import { useEffect, useState } from 'react';
import DonutChart from '../components/DonutChart';
import GroupedTaskTable from '../components/GroupedTaskTable';
import {
  getIssues,
  getTeamHours,
  getTimeEntries,
  getUsers,
} from '../services/redmineApi';
import type { Issue, TimeEntry, User } from '../types/redmine';

export default function TeamHours() {
  const [users, setUsers] = useState<User[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [team, setTeam] = useState({ logged: 0, target: 360 });

  useEffect(() => {
    (async () => {
      const [u, i, te, t] = await Promise.all([
        getUsers(),
        getIssues(),
        getTimeEntries(),
        getTeamHours(),
      ]);
      setUsers(u);
      setIssues(i);
      setEntries(te);
      setTeam(t);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Team hours this week</h1>
        <p className="text-sm text-ink-muted">
          Aggregated across all engineers. Expand a row to see the underlying tasks.
        </p>
      </div>

      <div className="card p-6 flex items-center gap-6">
        <DonutChart
          value={team.logged}
          total={team.target}
          color="#F59E0B"
          label={`${team.logged}/${team.target}`}
        />
        <div>
          <div className="text-3xl font-semibold">{team.logged}h logged</div>
          <div className="text-sm text-ink-muted">of {team.target}h target</div>
        </div>
      </div>

      <section className="card overflow-hidden">
        <GroupedTaskTable
          title="Hours by engineer"
          users={users}
          issues={issues}
          timeEntries={entries}
        />
      </section>
    </div>
  );
}
