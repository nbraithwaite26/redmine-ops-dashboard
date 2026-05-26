import { useEffect, useState } from 'react';
import IssueTable from '../components/IssueTable';
import QuickEditPopup from '../components/QuickEditPopup';
import TicketDrawer from '../components/TicketDrawer';
import type { Issue } from '../types/redmine';
import { getMyIssues } from '../services/redmineApi';
import { useCurrentUser } from '../hooks/useCurrentUser';

export default function MyTasks() {
  const { user: currentUser, loading: userLoading } = useCurrentUser();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [openIssue, setOpenIssue] = useState<Issue | null>(null);
  const [quickIssue, setQuickIssue] = useState<Issue | null>(null);

  const load = async () => {
    const data = await getMyIssues(currentUser?.id);
    setIssues(data);
  };
  useEffect(() => {
    if (userLoading) return;
    void load();
  }, [userLoading, currentUser?.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Tasks</h1>
        <div className="text-xs text-ink-muted">
          {userLoading ? '…' : <>Signed in as <span className="font-medium text-ink">{currentUser?.name ?? 'Guest'}</span></>}
        </div>
      </div>
      <IssueTable
        title="Assigned to me"
        issues={issues}
        onOpenIssue={setOpenIssue}
        onQuickEdit={setQuickIssue}
        onRefresh={load}
      />
      {quickIssue && (
        <QuickEditPopup
          issue={quickIssue}
          onClose={() => setQuickIssue(null)}
          onSaved={(updated) =>
            setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
          }
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
            setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          }}
          onDeleted={(id) => {
            setOpenIssue(null);
            setIssues((prev) => prev.filter((i) => i.id !== id));
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
