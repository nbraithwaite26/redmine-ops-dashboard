import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import CreateIssueModal from '../components/CreateIssueModal';
import GroupedTaskTable from '../components/GroupedTaskTable';
import IssueTable from '../components/IssueTable';
import QuickEditPopup from '../components/QuickEditPopup';
import TicketDrawer from '../components/TicketDrawer';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useReadOnly } from '../hooks/useReadOnly';
import {
  getIssues,
  getMyIssues,
  getTimeEntries,
  getUsers,
} from '../services/redmineApi';
import type { Issue, TimeEntry, User } from '../types/redmine';

export default function Tasks() {
  const { user: currentUser, loading: userLoading } = useCurrentUser();
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [teamIssues, setTeamIssues] = useState<Issue[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [openIssue, setOpenIssue] = useState<Issue | null>(null);
  const [quickIssue, setQuickIssue] = useState<Issue | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { readOnly } = useReadOnly();

  const load = async () => {
    const uid = currentUser?.id;
    const [m, all, u, te] = await Promise.all([
      getMyIssues(uid),
      getIssues(),
      getUsers(),
      getTimeEntries(),
    ]);
    setMyIssues(m);
    setTeamIssues(uid === undefined ? all : all.filter((i) => i.assignee?.id !== uid));
    setUsers(u);
    setTimeEntries(te);
  };

  useEffect(() => {
    if (userLoading) return;
    void load();
  }, [userLoading, currentUser?.id]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-ink-muted">
            Your work plus a per-user view of the rest of the team.
          </p>
        </div>
        <button
          className="btn-brand whitespace-nowrap"
          onClick={() => setCreateOpen(true)}
          disabled={readOnly}
          title={readOnly ? 'Read-only mode — writes disabled' : undefined}
          data-testid="tasks-new-issue"
        >
          <Plus size={14} /> New issue
        </button>
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
          users={currentUser ? users.filter((u) => u.id !== currentUser.id) : users}
          issues={teamIssues}
          timeEntries={
            currentUser
              ? timeEntries.filter((t) => t.user.id !== currentUser.id)
              : timeEntries
          }
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
          onDeleted={() => {
            setOpenIssue(null);
            void load();
          }}
          onQuickEdit={(i) => {
            setOpenIssue(null);
            setQuickIssue(i);
          }}
        />
      )}

      {createOpen && (
        <CreateIssueModal
          onClose={() => setCreateOpen(false)}
          onCreated={(issue) => {
            setCreateOpen(false);
            void load();
            // Open the new issue's drawer so the user can flesh it out.
            setOpenIssue(issue);
          }}
        />
      )}
    </div>
  );
}
