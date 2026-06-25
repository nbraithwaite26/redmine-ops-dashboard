import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import CreateIssueModal from '../components/CreateIssueModal';
import MyTasksByProject from '../components/MyTasksByProject';
import QuickEditPopup from '../components/QuickEditPopup';
import TicketDrawer from '../components/TicketDrawer';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useReadOnly } from '../hooks/useReadOnly';
import { getMyIssues } from '../services/redmineApi';
import type { Issue } from '../types/redmine';

/**
 * Tasks — engineer-centered view. Shows only the issues assigned to the
 * currently authenticated Redmine user (the engineer using the app). The
 * old team panel is intentionally hidden for now; full Tasks team view
 * still lives in component history if we bring it back.
 */
export default function Tasks() {
  const { user: currentUser, loading: userLoading } = useCurrentUser();
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [openIssue, setOpenIssue] = useState<Issue | null>(null);
  const [quickIssue, setQuickIssue] = useState<Issue | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { readOnly } = useReadOnly();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledDeepLink = useRef(false);

  const load = useCallback(async () => {
    const m = await getMyIssues(currentUser?.id);
    setMyIssues(m);
  }, [currentUser?.id]);

  useEffect(() => {
    if (userLoading) return;
    void load();
  }, [userLoading, load]);

  // Honor ?id= once per visit: after the list loads, open that issue's drawer.
  useEffect(() => {
    if (handledDeepLink.current) return;
    const raw = searchParams.get('id');
    if (!raw) return;
    const id = Number(raw);
    if (!Number.isFinite(id)) return;
    const match = myIssues.find((i) => i.id === id);
    if (!match) return;
    setOpenIssue(match);
    handledDeepLink.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('id');
    setSearchParams(next, { replace: true });
  }, [myIssues, searchParams, setSearchParams]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-ink-muted">
            Your assigned work, grouped by project.
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
        <MyTasksByProject
          title="Assigned to me"
          issues={myIssues}
          onOpenIssue={setOpenIssue}
          onQuickEdit={setQuickIssue}
          onRefresh={load}
        />
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
            } else {
              // Reassigned away — drop it from the personal list.
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
            } else {
              setMyIssues((prev) => prev.filter((i) => i.id !== updated.id));
            }
          }}
          onDeleted={(id) => {
            setOpenIssue(null);
            setMyIssues((prev) => prev.filter((i) => i.id !== id));
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
            if (issue.assignee?.id === currentUser?.id) {
              setMyIssues((prev) => [issue, ...prev]);
            }
            setOpenIssue(issue);
          }}
        />
      )}
    </div>
  );
}
