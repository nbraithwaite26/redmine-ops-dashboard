import { useEffect, useState } from 'react';
import { ChevronDown, Download, Edit3, MoreVertical, RefreshCw } from 'lucide-react';
import DashboardCard from '../components/DashboardCard';
import IssueTable from '../components/IssueTable';
import QuickEditPopup from '../components/QuickEditPopup';
import TicketDrawer from '../components/TicketDrawer';
import type { Issue } from '../types/redmine';
import {
  getIssues,
  getMyIssues,
  getPastDueIssues,
  getTeamHours,
  getWeeklyHours,
} from '../services/redmineApi';
import { buildDashboardMetrics } from '../data/mockData';
import { useCurrentUser } from '../hooks/useCurrentUser';

const TABS = ['Your Work', "Your Team's Work", 'Project Health', 'Resource Planning'];

export default function Dashboard() {
  const [tab, setTab] = useState(TABS[0]);
  const { user: currentUser, loading: userLoading } = useCurrentUser();
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [pastDue, setPastDue] = useState<Issue[]>([]);
  const [weekly, setWeekly] = useState({ logged: 0, target: 40 });
  const [team, setTeam] = useState({ logged: 0, target: 360 });
  const [openIssue, setOpenIssue] = useState<Issue | null>(null);
  const [quickIssue, setQuickIssue] = useState<Issue | null>(null);

  const load = async (uid: number | undefined) => {
    const [m, a, pd, w, t] = await Promise.all([
      getMyIssues(uid),
      getIssues(),
      getPastDueIssues(),
      getWeeklyHours(uid),
      getTeamHours(),
    ]);
    setMyIssues(m);
    setAllIssues(a);
    setPastDue(pd);
    setWeekly(w);
    setTeam(t);
  };

  useEffect(() => {
    if (userLoading) return;
    void load(currentUser?.id);
  }, [userLoading, currentUser?.id]);

  const metrics = buildDashboardMetrics({
    myIssues,
    allIssues,
    pastDueCount: pastDue.length,
    weeklyHours: weekly,
    teamHours: team,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <button className="inline-flex items-center gap-1 text-ink-muted hover:text-ink">
          <ChevronDown size={18} />
        </button>
        <div className="flex-1" />
        <button className="btn-secondary"><RefreshCw size={14} /></button>
        <button className="btn-secondary"><Edit3 size={14} /></button>
        <button className="btn-secondary"><MoreVertical size={14} /></button>
      </div>

      <div className="flex items-center gap-4 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              'px-1 py-2 text-sm font-medium ' +
              (tab === t
                ? 'border-b-2 border-brand-500 text-ink'
                : 'text-ink-muted hover:text-ink')
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <DashboardCard key={metric.id} metric={metric} />
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">My Tasks</h2>
            <div className="text-xs text-ink-muted">
              Last refreshed just now
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary"><Edit3 size={14} /> Edit</button>
            <button className="btn-secondary"><Download size={14} /> Export</button>
          </div>
        </div>
        <IssueTable
          title="Issues assigned to me"
          issues={myIssues}
          onOpenIssue={setOpenIssue}
          onQuickEdit={setQuickIssue}
          onRefresh={() => void load(currentUser?.id)}
        />
      </div>

      {quickIssue && (
        <QuickEditPopup
          issue={quickIssue}
          onClose={() => setQuickIssue(null)}
          onSaved={(updated) => {
            setMyIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            setAllIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          }}
          onOpenFullEditor={(i) => {
            setQuickIssue(null);
            setOpenIssue(i);
          }}
        />
      )}
      {openIssue && (
        <TicketDrawer
          issue={openIssue}
          onClose={() => setOpenIssue(null)}
          onSaved={(updated) => {
            setOpenIssue(null);
            setMyIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            setAllIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          }}
          onDeleted={(id) => {
            setOpenIssue(null);
            setMyIssues((prev) => prev.filter((i) => i.id !== id));
            setAllIssues((prev) => prev.filter((i) => i.id !== id));
            setPastDue((prev) => prev.filter((i) => i.id !== id));
          }}
          onQuickEdit={(i) => {
            setOpenIssue(null);
            setQuickIssue(i);
          }}
        />
      )}
    </div>
  );
}
