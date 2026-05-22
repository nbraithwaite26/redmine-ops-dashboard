import { useEffect, useState } from 'react';
import DonutChart from '../components/DonutChart';
import { currentMockUser, mockProjects } from '../data/mockData';
import { getTimeEntries, getWeeklyHours } from '../services/redmineApi';
import type { TimeEntry } from '../types/redmine';

export default function MyHours() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [my, setMy] = useState({ logged: 0, target: 40 });

  useEffect(() => {
    (async () => {
      const [te, w] = await Promise.all([getTimeEntries(), getWeeklyHours()]);
      setEntries(te.filter((t) => t.user.id === currentMockUser.id));
      setMy(w);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">My hours this week</h1>
        <p className="text-sm text-ink-muted">
          Signed in as {currentMockUser.name}.
        </p>
      </div>

      <div className="card p-6 flex items-center gap-6">
        <DonutChart
          value={my.logged}
          total={my.target}
          color="#10B981"
          label={`${my.logged}/${my.target}`}
        />
        <div>
          <div className="text-3xl font-semibold">{my.logged}h logged</div>
          <div className="text-sm text-ink-muted">of {my.target}h target</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-2 border-b text-sm font-semibold">Recent entries</div>
        <table className="w-full text-sm">
          <thead className="bg-canvas text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-3 py-2 text-left">Issue</th>
              <th className="px-3 py-2 text-left">Activity</th>
              <th className="px-3 py-2 text-right">Hours</th>
              <th className="px-3 py-2 text-left">Comment</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const proj = mockProjects.find((p) => p.id === e.projectId);
              return (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-canvas/60">
                  <td className="px-3 py-2">{e.spentOn}</td>
                  <td className="px-3 py-2">{proj?.name ?? '—'}</td>
                  <td className="px-3 py-2">
                    {e.issueId ? <a className="link" href={`#/tasks?id=${e.issueId}`}>#{e.issueId}</a> : '—'}
                  </td>
                  <td className="px-3 py-2">{e.activity}</td>
                  <td className="px-3 py-2 text-right font-medium">{e.hours}h</td>
                  <td className="px-3 py-2 text-ink-soft truncate max-w-[260px]">{e.comments}</td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-ink-muted">
                  No entries yet this week.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
