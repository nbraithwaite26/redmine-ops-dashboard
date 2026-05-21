import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import DashboardCard from '../components/DashboardCard';
import DonutChart from '../components/DonutChart';
import {
  getIssues,
  getResourceAllocations,
  getTeamHours,
  getTimeEntries,
  getWeeklyHours,
} from '../services/redmineApi';
import type { Issue, ResourceAllocation, TimeEntry } from '../types/redmine';

export default function Reports() {
  const [my, setMy] = useState({ logged: 0, target: 40 });
  const [team, setTeam] = useState({ logged: 0, target: 360 });
  const [issues, setIssues] = useState<Issue[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);

  useEffect(() => {
    (async () => {
      const [w, t, i, te, a] = await Promise.all([
        getWeeklyHours(),
        getTeamHours(),
        getIssues(),
        getTimeEntries(),
        getResourceAllocations(),
      ]);
      setMy(w);
      setTeam(t);
      setIssues(i);
      setTimeEntries(te);
      setAllocations(a);
    })();
  }, []);

  const resolvedCount = issues.filter((i) => i.status === 'Resolved' || i.status === 'Closed').length;
  const openKpis = issues.filter((i) => i.tracker === 'KPI').length;
  const overloadedCount = allocations.filter((a) => a.isOverloaded).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <button className="btn-secondary"><Download size={14} /> Export weekly report</button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <DashboardCard
          title="My hours this week"
          status="Target 40h"
          statusColor="gray"
          visual={
            <DonutChart
              value={my.logged}
              total={my.target}
              color="#10B981"
              label={`${my.logged}/${my.target}`}
            />
          }
        />
        <DashboardCard
          title="Team hours this week"
          status="Target 360h"
          statusColor="gray"
          visual={
            <DonutChart
              value={team.logged}
              total={team.target}
              color="#F59E0B"
              label={`${team.logged}/${team.target}`}
            />
          }
        />
        <DashboardCard
          title="Resolved issues"
          status="This quarter"
          statusColor="green"
          visual={<DonutChart value={resolvedCount} total={Math.max(resolvedCount + 5, 10)} color="#10B981" />}
        />
        <DashboardCard
          title="Open KPIs"
          status="Quarterly"
          statusColor="blue"
          visual={<DonutChart value={openKpis} total={12} color="#3B82F6" />}
        />
        <DashboardCard
          title="Overloaded engineers"
          status="Watchlist"
          statusColor="red"
          visual={<DonutChart value={overloadedCount} total={Math.max(overloadedCount + 3, 8)} color="#EF4444" />}
        />
        <DashboardCard
          title="Time entries"
          status="This period"
          statusColor="blue"
          visual={<div className="text-3xl font-semibold">{timeEntries.length}</div>}
        />
      </div>

      <div className="card p-4">
        <h2 className="font-semibold mb-2">Coming soon</h2>
        <p className="text-sm text-ink-muted">
          Drill-down charts (throughput, lead time, KPI status by quarter, resource heatmap)
          will live here. They'll wire up to the same mock API service for now.
        </p>
      </div>
    </div>
  );
}
