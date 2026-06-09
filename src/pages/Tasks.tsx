import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus, Users } from 'lucide-react';
import CreateIssueModal from '../components/CreateIssueModal';
import GroupedTaskTable from '../components/GroupedTaskTable';
import MyTasksByProject from '../components/MyTasksByProject';
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

const TEAM_PREF_KEY = 'rod.tasks.showTeam';

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
  const handledDeepLink = useRef(false);

  // Team view is opt-in (this page is personal-first). Persist the choice.
  const [showTeam, setShowTeam] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TEAM_PREF_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);

  const toggleTeam = () =>
    setShowTeam((v) => {
      const next = !v;
      try {
        localStorage.setItem(TEAM_PREF_KEY, next ? '1' : '0');
      } catch {
        // ignore storage failures
      }
      return next;
    });

  // Default load: just the current user's issues — keep the personal page light.
  const load = useCallback(async () => {
    const m = await getMyIssues(currentUser?.id);
    setMyIssues(m);
  }, [currentUser?.id]);

  // Team data is fetched lazily, only the first time the team view is shown.
  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    const uid = currentUser?.id;
    const [all, u, te] = await Promise.all([getIssues(), getUsers(), getTimeEntries()]);
    setTeamIssues(uid === undefined ? all : all.filter((i) => i.assignee?.id !== uid));
    setUsers(u);
    setTimeEntries(te);
    setTeamLoaded(true);
    setTeamLoading(false);
  }, [currentUser?.id]);

  useEffect(() => {
    if (userLoading) return;
    void load();
  }, [userLoading, load]);

  useEffect(() => {
    if (userLoading) return;
    if (showTeam && !teamLoaded && !teamLoading) void loadTeam();
  }, [userLoading, showTeam, teamLoaded, teamLoading, loadTeam]);

  // Honor ?id= once per visit: after the lists load, open that issue's drawer.
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
            Your assigned work. Expand the team view when you need the bigger picture.
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
        <MyTasksByProject
          title="Assigned to me"
          issues={myIssues}
          onOpenIssue={setOpenIssue}
          onQuickEdit={setQuickIssue}
          onRefresh={load}
        />
      </section>

      <section>
        <button
          type="button"
          onClick={toggleTeam}
          className="flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
          aria-expanded={showTeam}
          data-testid="tasks-team-toggle"
        >
          {showTeam ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Users size={14} />
          {showTeam ? 'Hide team tasks' : 'Show team tasks'}
        </button>

        {showTeam && (
          <div className="card overflow-hidden mt-3" data-testid="tasks-team-section">
            {teamLoading && !teamLoaded ? (
              <div className="p-6 text-sm text-ink-muted">Loading team tasks…</div>
            ) : (
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
            )}
          </div>
        )}
      </section>

      {quickIssue && (
        <QuickEditPopup
          issue={quickIssue}
          onClose={() => setQuickIssue(null)}
          onSaved={(updated) => {
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
            const goesToMyList = issue.assignee?.id === currentUser?.id;
            if (goesToMyList) {
              setMyIssues((prev) => [issue, ...prev]);
            } else {
              setTeamIssues((prev) => [issue, ...prev]);
            }
            setOpenIssue(issue);
          }}
        />
      )}
    </div>
  );
}
