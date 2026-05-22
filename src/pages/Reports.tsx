import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import DashboardCard from '../components/DashboardCard';
import {
  getIssues,
  getResourceAllocations,
  getTeamHours,
  getTimeEntries,
  getWeeklyHours,
} from '../services/redmineApi';
import type { Issue, ResourceAllocation, TimeEntry } from '../types/redmine';
import { buildReportMetrics } from '../data/mockData';

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

  const metrics = buildReportMetrics({
    weeklyHours: my,
    teamHours: team,
    resolvedCount,
    openKpis,
    overloadedCount,
    timeEntries: timeEntries.length,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <button className="btn-secondary"><Download size={14} /> Export weekly report</button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <DashboardCard key={metric.id} metric={metric} />
        ))}
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
