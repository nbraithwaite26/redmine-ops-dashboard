import { useEffect, useState } from 'react';
import GroupedTaskTable from '../components/GroupedTaskTable';
import IssueTable from '../components/IssueTable';
import QuickEditPopup from '../components/QuickEditPopup';
import TicketDrawer from '../components/TicketDrawer';
import { currentMockUser } from '../data/mockData';
import {
  getIssues,
  getMyIssues,
  getTimeEntries,
  getUsers,
} from '../services/redmineApi';
import type { Issue, TimeEntry, User } from '../types/redmine';

export default function Tasks() {
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [teamIssues, setTeamIssues] = useState<Issue[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [openIssue, setOpenIssue] = useState<Issue | null>(null);
  const [quickIssue, setQuickIssue] = useState<Issue | null>(null);

  const load = async () => {
    const [m, all, u, te] = await Promise.all([
      getMyIssues(currentMockUser.id),
      getIssues(),
      getUsers(),
      getTimeEntries(),
    ]);
    setMyIssues(m);
    setTeamIssues(all.filter((i) => i.assignee?.id !== currentMockUser.id));
    setUsers(u);
    setTimeEntries(te);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="text-sm text-ink-muted">
          Your work plus a per-user view of the rest of the team.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">My tasks</h2>
        <IssueTable
          title="Assigned to me"
          issues={myIssues}
          onOpenIssue={setOpenIssue}
          onQuickEdit={setQuickIssue}
          onRefresh={load}
        />
      </section>

      <section className="card overflow-hidden">
        <GroupedTaskTable
          title="Team tasks (this week)"
          users={users.filter((u) => u.id !== currentMockUser.id)}
          issues={teamIssues}
          timeEntries={timeEntries.filter(
            (t) => t.user.id !== currentMockUser.id,
          )}
        />
      </section>

      {quickIssue && (
        <QuickEditPopup
          issue={quickIssue}
          onClose={() => setQuickIssue(null)}
          onSaved={() => void load()}
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
