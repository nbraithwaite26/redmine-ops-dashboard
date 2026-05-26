import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  // Track whether we've already honored the ?id= deep-link for this page
  // visit. Without this, manually closing the drawer would immediately
  // reopen it because the URL still carries the id.
  const handledDeepLink = useRef(false);

  const load = useCallback(async () => {
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
  }, [currentUser?.id]);

  useEffect(() => {
    if (userLoading) return;
    void load();
  }, [userLoading, load]);

  // Honor ?id= once per visit: after the lists load, open that issue's
  // drawer. Clears the param so subsequent navigation away + back doesn't
  // re-trigger.
  useEffect(() => {
    if (handledDeepLink.current) return;
    const raw = searchParams.get('id');
    if (!raw) return;
    const id = Number(raw);
    if (!Number.isFinite(id)) return;
    const match = myIssues.find((i) => i.id === id) ?? teamIssues.find((i) => i.id === id);
    if (!match) return;
    setOpenIssue(match);
    handledDeepLink.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('id');
    setSearchParams(next, { replace: true });
  }, [myIssues, teamIssues, searchParams, setSearchParams]);

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
          onSaved={(updated) => {
            // The update may flip assignment between my/team lists.
            // Replace where it lives + move if the assignee changed.
            const nowMine = updated.assignee?.id === currentUser?.id;
            if (nowMine) {
              setMyIssues((prev) =>
                prev.some((i) => i.id === updated.id)
                  ? prev.map((i) => (i.id === updated.id ? updated : i))
                  : [updated, ...prev],
              );
              setTeamIssues((prev) => prev.filter((i) => i.id !== updated.id));
            } else {
              setTeamIssues((prev) =>
                prev.some((i) => i.id === updated.id)
                  ? prev.map((i) => (i.id === updated.id ? updated : i))
                  : [updated, ...prev],
              );
              setMyIssues((prev) => prev.filter((i) => i.id !== updated.id));
            }
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
            const nowMine = updated.assignee?.id === currentUser?.id;
            if (nowMine) {
              setMyIssues((prev) =>
                prev.some((i) => i.id === updated.id)
                  ? prev.map((i) => (i.id === updated.id ? updated : i))
                  : [updated, ...prev],
              );
              setTeamIssues((prev) => prev.filter((i) => i.id !== updated.id));
            } else {
              setTeamIssues((prev) =>
                prev.some((i) => i.id === updated.id)
                  ? prev.map((i) => (i.id === updated.id ? updated : i))
                  : [updated, ...prev],
              );
              setMyIssues((prev) => prev.filter((i) => i.id !== updated.id));
            }
          }}
          onDeleted={(id) => {
            setOpenIssue(null);
            setMyIssues((prev) => prev.filter((i) => i.id !== id));
            setTeamIssues((prev) => prev.filter((i) => i.id !== id));
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
            // Place the new issue in the correct list based on assignment.
            const goesToMyList = issue.assignee?.id === currentUser?.id;
            if (goesToMyList) {
              setMyIssues((prev) => [issue, ...prev]);
            } else {
              setTeamIssues((prev) => [issue, ...prev]);
            }
            // Auto-open the drawer so the user can flesh out the new issue.
            setOpenIssue(issue);
          }}
        />
      )}
    </div>
  );
}
