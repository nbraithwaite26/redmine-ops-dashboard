import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import IssueTable from '../components/IssueTable';
import QuickEditPopup from '../components/QuickEditPopup';
import TicketDrawer from '../components/TicketDrawer';
import type { Issue } from '../types/redmine';
import { getPastDueIssues } from '../services/redmineApi';

export default function PastDue() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [assignee, setAssignee] = useState<string>('All');
  const [project, setProject] = useState<string>('All');
  const [openIssue, setOpenIssue] = useState<Issue | null>(null);
  const [quickIssue, setQuickIssue] = useState<Issue | null>(null);

  const load = async () => {
    const data = await getPastDueIssues();
    setIssues(data);
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    return issues.filter((i) => {
      if (assignee !== 'All' && (i.assignee?.name ?? 'Unassigned') !== assignee) return false;
      if (project !== 'All' && i.projectName !== project) return false;
      return true;
    });
  }, [issues, assignee, project]);

  const assignees = Array.from(
    new Set(issues.map((i) => i.assignee?.name ?? 'Unassigned')),
  );
  const projects = Array.from(new Set(issues.map((i) => i.projectName)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <AlertTriangle className="text-red-500" /> Past Due Tasks
          </h1>
          <div className="text-sm text-ink-muted">
            {issues.length} task{issues.length === 1 ? '' : 's'} past their due date
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="border border-gray-200 bg-white rounded px-2 py-1"
          >
            <option value="All">All assignees</option>
            {assignees.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="border border-gray-200 bg-white rounded px-2 py-1"
          >
            <option value="All">All projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      <IssueTable
        title="Overdue queue"
        issues={filtered}
        showDaysOverdue
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
