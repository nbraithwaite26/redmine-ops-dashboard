import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Save, Trash2, X } from 'lucide-react';
import DashboardCard from '../components/DashboardCard';
import DonutChart from '../components/DonutChart';
import {
  createTimeEntry,
  deleteTimeEntry,
  getTeamHours,
  getTimeEntries,
  getWeeklyHours,
} from '../services/redmineApi';
import {
  mockIssues,
  mockProjects,
  mockTimeActivities,
  mockUsers,
} from '../data/mockData';
import type { TimeEntry } from '../types/redmine';

type Range = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
type GroupBy = 'None' | 'User' | 'Project';

export default function TimeTracking() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [my, setMy] = useState({ logged: 0, target: 40 });
  const [team, setTeam] = useState({ logged: 0, target: 360 });
  const [range, setRange] = useState<Range>('Weekly');
  const [groupBy, setGroupBy] = useState<GroupBy>('None');
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    const [e, w, t] = await Promise.all([getTimeEntries(), getWeeklyHours(), getTeamHours()]);
    setEntries(e);
    setMy(w);
    setTeam(t);
  };
  useEffect(() => { void load(); }, []);

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Time Tracking</h1>
        <div className="flex items-center gap-2">
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
          <button className="btn-secondary"><Download size={14} /> Export</button>
          <button className="btn-brand" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add time
          </button>
        </div>
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
              caption="logged"
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
              caption="team"
            />
          }
        />
        <DashboardCard
          title="Entries this period"
          status={`${range} view`}
          statusColor="blue"
          visual={<div className="text-3xl font-semibold">{entries.length}</div>}
        />
        <DashboardCard
          title="Average per entry"
          status="Across team"
          statusColor="gray"
          visual={
            <div className="text-3xl font-semibold">
              {entries.length === 0
                ? '0h'
                : `${(entries.reduce((s, e) => s + e.hours, 0) / entries.length).toFixed(1)}h`}
            </div>
          }
        />
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
                      {issue ? <a className="link" href={`#/my-tasks?id=${issue.id}`}>#{issue.id}</a> : '—'}
                    </td>
                    <td className="px-3 py-2">{e.activity}</td>
                    <td className="px-3 py-2 font-medium">{e.hours}h</td>
                    <td className="px-3 py-2 text-ink-soft truncate max-w-[260px]">{e.comments}</td>
                    <td className="px-3 py-2">
                      <button
                        className="p-1 rounded hover:bg-gray-100"
                        aria-label={`Delete time entry ${e.id}`}
                        onClick={async () => {
                          await deleteTimeEntry(e.id);
                          await load();
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
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
            await load();
          }}
        />
      )}
    </div>
  );
}

function AddTimeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [userId, setUserId] = useState(mockUsers[0].id);
  const [projectId, setProjectId] = useState(mockProjects[0].id);
  const [issueId, setIssueId] = useState<number | null>(null);
  const [activity, setActivity] = useState(mockTimeActivities[0]);
  const [hours, setHours] = useState('');
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [comments, setComments] = useState('');

  const projectIssues = mockIssues.filter((i) => i.projectId === projectId);

  const save = async () => {
    const user = mockUsers.find((u) => u.id === userId)!;
    await createTimeEntry({
      user,
      projectId,
      issueId,
      activity,
      hours: Number(hours) || 0,
      spentOn,
      comments,
    });
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white w-[520px] max-w-[95vw] rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="font-semibold">Add time entry</div>
          <button onClick={onClose} aria-label="Close add time"><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4 text-sm">
          <label>
            <div className="text-xs text-ink-muted mb-1">Date</div>
            <input
              type="date"
              className="modal-input"
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
            />
          </label>
          <label>
            <div className="text-xs text-ink-muted mb-1">Hours</div>
            <input
              type="number"
              step={0.25}
              min={0}
              className="modal-input"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="0.0"
            />
          </label>
          <label>
            <div className="text-xs text-ink-muted mb-1">User</div>
            <select
              className="modal-input"
              value={userId}
              onChange={(e) => setUserId(Number(e.target.value))}
            >
              {mockUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label>
            <div className="text-xs text-ink-muted mb-1">Activity</div>
            <select
              className="modal-input"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
            >
              {mockTimeActivities.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            <div className="text-xs text-ink-muted mb-1">Project</div>
            <select
              className="modal-input"
              value={projectId}
              onChange={(e) => {
                setProjectId(Number(e.target.value));
                setIssueId(null);
              }}
            >
              {mockProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            <div className="text-xs text-ink-muted mb-1">Issue</div>
            <select
              className="modal-input"
              value={issueId ?? ''}
              onChange={(e) => setIssueId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— None —</option>
              {projectIssues.map((i) => (
                <option key={i.id} value={i.id}>#{i.id} {i.subject}</option>
              ))}
            </select>
          </label>
          <label className="col-span-2">
            <div className="text-xs text-ink-muted mb-1">Comment</div>
            <input
              className="modal-input"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </label>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-brand" onClick={save}><Save size={14} /> Save</button>
        </div>
        <style>{`
          .modal-input {
            width: 100%;
            padding: 0.4rem 0.6rem;
            border: 1px solid #E5E7EB;
            border-radius: 0.375rem;
            font-size: 0.875rem;
          }
        `}</style>
      </div>
    </div>
  );
}
