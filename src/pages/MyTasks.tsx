import { useEffect, useState } from 'react';
import IssueTable from '../components/IssueTable';
import QuickEditPopup from '../components/QuickEditPopup';
import TicketDrawer from '../components/TicketDrawer';
import type { Issue } from '../types/redmine';
import { getMyIssues } from '../services/redmineApi';
import { currentMockUser } from '../data/mockData';

export default function MyTasks() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [openIssue, setOpenIssue] = useState<Issue | null>(null);
  const [quickIssue, setQuickIssue] = useState<Issue | null>(null);

  const load = async () => {
    const data = await getMyIssues(currentMockUser.id);
    setIssues(data);
  };
  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Tasks</h1>
        <div className="text-xs text-ink-muted">
          Signed in as <span className="font-medium text-ink">{currentMockUser.name}</span>
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
