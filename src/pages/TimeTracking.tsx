import { useMemo, useState } from 'react';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import AddTimeModal from '../components/AddTimeModal';
import DashboardCard from '../components/DashboardCard';
import {
  getTeamHours,
  getTimeEntries,
  getWeeklyHours,
} from '../services/redmineApi';
import { buildTimeMetrics, mockIssues, mockProjects } from '../data/mockData';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { useReadOnly } from '../hooks/useReadOnly';
import { useTimeEntryActions } from '../hooks/useTimeEntryActions';
import type { TimeEntry } from '../types/redmine';

type Range = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
type GroupBy = 'None' | 'User' | 'Project';

interface BundledData {
  entries: TimeEntry[];
  my: { logged: number; target: number };
  team: { logged: number; target: number };
}

const EMPTY_BUNDLE: BundledData = {
  entries: [],
  my: { logged: 0, target: 40 },
  team: { logged: 0, target: 360 },
};

export default function TimeTracking() {
  const resource = useAsyncResource<BundledData>(async () => {
    const [entries, my, team] = await Promise.all([
      getTimeEntries(),
      getWeeklyHours(),
      getTeamHours(),
    ]);
    return { entries, my, team };
  }, EMPTY_BUNDLE);
  const { entries, my, team } = resource.data;
  const reload = resource.reload;

  const [range, setRange] = useState<Range>('Weekly');
  const [groupBy, setGroupBy] = useState<GroupBy>('None');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const { readOnly } = useReadOnly();
  const { remove: removeEntry, saving: removing } = useTimeEntryActions();

  const grouped = useMemo(() => {
    if (groupBy === 'None') return [{ label: 'All entries', entries }];
    if (groupBy === 'User') {
      const map = new Map<string, TimeEntry[]>();
      entries.forEach((e) => {
        const k = e.user.name;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(e);
      });
      return Array.from(map.entries()).map(([label, entries]) => ({ label, entries }));
    }
    const map = new Map<string, TimeEntry[]>();
    entries.forEach((e) => {
      const proj = mockProjects.find((p) => p.id === e.projectId);
      const k = proj?.name ?? 'Unknown';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return Array.from(map.entries()).map(([label, entries]) => ({ label, entries }));
  }, [entries, groupBy]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <h1 className="text-2xl font-semibold">Time Tracking</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
            className="border border-gray-200 bg-white rounded px-2 py-1 text-sm"
          >
            {(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'] as Range[]).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="border border-gray-200 bg-white rounded px-2 py-1 text-sm"
          >
            <option>None</option>
            <option>User</option>
            <option>Project</option>
          </select>
          <button className="btn-secondary hidden sm:inline-flex">
            <Download size={14} /> Export
          </button>
          <button className="btn-brand" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> <span className="hidden sm:inline">Add time</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {buildTimeMetrics({
          weeklyHours: my,
          teamHours: team,
          entryCount: entries.length,
          averageHours:
            entries.length === 0
              ? 0
              : entries.reduce((s, e) => s + e.hours, 0) / entries.length,
          range,
        }).map((metric) => (
          <DashboardCard key={metric.id} metric={metric} />
        ))}
      </div>

      {grouped.map(({ label, entries }) => (
        <div key={label} className="card overflow-hidden">
          <div className="px-4 py-2 border-b text-sm font-semibold">{label}</div>
          <table className="w-full text-sm">
            <thead className="bg-canvas text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Project</th>
                <th className="px-3 py-2 text-left">Issue</th>
                <th className="px-3 py-2 text-left">Activity</th>
                <th className="px-3 py-2 text-left">Hours</th>
                <th className="px-3 py-2 text-left">Comment</th>
                <th className="px-3 py-2 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const issue = mockIssues.find((i) => i.id === e.issueId);
                const project = mockProjects.find((p) => p.id === e.projectId);
                return (
                  <tr key={e.id} className="border-t border-gray-100 hover:bg-canvas/60">
                    <td className="px-3 py-2">{e.spentOn}</td>
                    <td className="px-3 py-2">{e.user.name}</td>
                    <td className="px-3 py-2">{project?.name ?? '—'}</td>
                    <td className="px-3 py-2">
                      {issue ? <a className="link" href={`#/tasks?id=${issue.id}`}>#{issue.id}</a> : '—'}
                    </td>
                    <td className="px-3 py-2">{e.activity}</td>
                    <td className="px-3 py-2 font-medium">{e.hours}h</td>
                    <td className="px-3 py-2 text-ink-soft truncate max-w-[260px]">{e.comments}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Edit time entry ${e.id}`}
                          disabled={removing || readOnly}
                          title={readOnly ? 'Read-only mode — writes disabled' : 'Edit'}
                          onClick={() => setEditing(e)}
                          data-testid={`edit-time-entry-${e.id}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Delete time entry ${e.id}`}
                          disabled={removing || readOnly}
                          title={readOnly ? 'Read-only mode — writes disabled' : 'Delete'}
                          onClick={async () => {
                            try {
                              await removeEntry(e.id);
                              await reload();
                            } catch {
                              // Toast already surfaced.
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-ink-muted">
                    No entries
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}

      {addOpen && (
        <AddTimeModal
          onClose={() => setAddOpen(false)}
          onCreated={async () => {
            setAddOpen(false);
            await reload();
          }}
        />
      )}

      {editing && (
        <AddTimeModal
          editing={editing}
          onClose={() => setEditing(null)}
          onCreated={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}
