import { useEffect, useState } from 'react';
import { ChevronDown, Download, Edit3, MoreVertical, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard';
import DonutChart from '../components/DonutChart';
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
import { currentMockUser } from '../data/mockData';

const TABS = ['Your Work', "Your Team's Work", 'Project Health', 'Resource Planning'];

export default function Dashboard() {
  const [tab, setTab] = useState(TABS[0]);
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [pastDue, setPastDue] = useState<Issue[]>([]);
  const [weekly, setWeekly] = useState({ logged: 0, target: 40 });
  const [team, setTeam] = useState({ logged: 0, target: 360 });
  const [openIssue, setOpenIssue] = useState<Issue | null>(null);
  const [quickIssue, setQuickIssue] = useState<Issue | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    const [m, a, pd, w, t] = await Promise.all([
      getMyIssues(currentMockUser.id),
      getIssues(),
      getPastDueIssues(),
      getWeeklyHours(),
      getTeamHours(),
    ]);
    setMyIssues(m);
    setAllIssues(a);
    setPastDue(pd);
    setWeekly(w);
    setTeam(t);
  };

  useEffect(() => { void load(); }, []);

  const unassigned = allIssues.filter((i) => !i.assignee);
  const atRiskProjects = 2;
  const waitingForUpdate = allIssues.filter((i) => i.status === 'Feedback').length;
  const openKpis = 7;

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

      <div className="grid grid-cols-4 gap-4">
        <DashboardCard
          title="Tasks assigned to you"
          status={`${myIssues.filter((i) => i.status === 'In Progress').length} In Progress`}
          statusColor="blue"
          visual={<DonutChart value={myIssues.length} total={Math.max(myIssues.length, 20)} color="#8B5CF6" caption="open" />}
          onClick={() => navigate('/my-tasks')}
        />
        <DashboardCard
          title="Past due tasks"
          status="Action needed"
          statusColor="red"
          visual={<DonutChart value={pastDue.length} total={Math.max(pastDue.length + 4, 10)} color="#EF4444" caption="overdue" />}
          onClick={() => navigate('/past-due')}
        />
        <DashboardCard
          title="Hours this week"
          status={`${weekly.target}h target`}
          statusColor="gray"
          visual={
            <DonutChart
              value={weekly.logged}
              total={weekly.target}
              color="#10B981"
              label={`${weekly.logged}/${weekly.target}`}
              caption="logged"
            />
          }
          onClick={() => navigate('/time')}
        />
        <DashboardCard
          title="Team hours this week"
          status={`${team.target}h target`}
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
          onClick={() => navigate('/reports')}
        />
        <DashboardCard
          title="Unassigned tasks"
          status="Triage queue"
          statusColor="orange"
          visual={<DonutChart value={unassigned.length} total={Math.max(unassigned.length, 8)} color="#F97316" caption="unassigned" />}
        />
        <DashboardCard
          title="Projects at risk"
          status="Schedule slipping"
          statusColor="red"
          visual={<DonutChart value={atRiskProjects} total={8} color="#EF4444" caption="at risk" />}
          onClick={() => navigate('/projects')}
        />
        <DashboardCard
          title="Tasks waiting for update"
          status="Awaiting response"
          statusColor="yellow"
          visual={<DonutChart value={waitingForUpdate} total={Math.max(waitingForUpdate, 6)} color="#EAB308" caption="awaiting" />}
        />
        <DashboardCard
          title="Open KPIs"
          status="Quarterly view"
          statusColor="blue"
          visual={<DonutChart value={openKpis} total={12} color="#3B82F6" caption="open" />}
          onClick={() => navigate('/reports')}
        />
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
          onRefresh={load}
        />
      </div>

      {quickIssue && (
        <QuickEditPopup
          issue={quickIssue}
          onClose={() => setQuickIssue(null)}
          onSaved={() => {
            void load();
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
          onSaved={() => {
            setOpenIssue(null);
            void load();
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
