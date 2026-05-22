import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
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

type Tab = 'kpi' | 'issues';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'kpi', label: 'KPI Tracker' },
  { id: 'issues', label: 'Issue Reports' },
];

export default function Reports() {
  const [my, setMy] = useState({ logged: 0, target: 40 });
  const [team, setTeam] = useState({ logged: 0, target: 360 });
  const [issues, setIssues] = useState<Issue[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: Tab = searchParams.get('tab') === 'issues' ? 'issues' : 'kpi';

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

  const resolvedCount = issues.filter(
    (i) => i.status === 'Resolved' || i.status === 'Closed',
  ).length;
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

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-ink-muted">
            KPI status and issue throughput in one place.
          </p>
        </div>
        <button className="btn-secondary">
          <Download size={14} /> Export weekly report
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Report views"
        className="flex items-center gap-2 border-b border-gray-200"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const idx = TABS.findIndex((t) => t.id === activeTab);
          const dir = e.key === 'ArrowLeft' ? -1 : 1;
          const next = TABS[(idx + dir + TABS.length) % TABS.length];
          setTab(next.id);
          // Move focus to the newly-active tab so the focus ring tracks it.
          const target = (e.currentTarget.querySelector(
            `[data-testid="tab-${next.id}"]`,
          ) as HTMLElement | null);
          target?.focus();
        }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            tabIndex={activeTab === id ? 0 : -1}
            data-testid={`tab-${id}`}
            onClick={() => setTab(id)}
            className={clsx(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition',
              activeTab === id
                ? 'border-brand-500 text-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'kpi' ? (
        <KpiPanel metrics={metrics} />
      ) : (
        <IssueReportsPanel metrics={metrics} />
      )}
    </div>
  );
}

function KpiPanel({ metrics }: { metrics: ReturnType<typeof buildReportMetrics> }) {
  // Only the metrics relevant to KPI live here.
  const kpiIds = new Set(['open-kpis', 'resolved']);
  const filtered = metrics.filter((m) => kpiIds.has(m.id));
  return (
    <div data-testid="panel-kpi" className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {filtered.map((metric) => (
          <DashboardCard key={metric.id} metric={metric} />
        ))}
      </div>
      <div className="card p-4">
        <h2 className="font-semibold mb-2">KPI tracker</h2>
        <p className="text-sm text-ink-muted">
          Quarterly KPI cards will live here once the KPI plugin endpoints are wired up.
        </p>
      </div>
    </div>
  );
}

function IssueReportsPanel({
  metrics,
}: {
  metrics: ReturnType<typeof buildReportMetrics>;
}) {
  // Issue-throughput-flavored metrics.
  const issueIds = new Set(['my-hours-week', 'team-hours-week', 'overloaded', 'entries']);
  const filtered = metrics.filter((m) => issueIds.has(m.id));
  return (
    <div data-testid="panel-issues" className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {filtered.map((metric) => (
          <DashboardCard key={metric.id} metric={metric} />
        ))}
      </div>
      <div className="card p-4">
        <h2 className="font-semibold mb-2">Coming soon</h2>
        <p className="text-sm text-ink-muted">
          Drill-down charts (throughput, lead time, resolution rates, resource heatmap) will
          live here. They'll wire up to the same mock API service for now.
        </p>
      </div>
    </div>
  );
}
