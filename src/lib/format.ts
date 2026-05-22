import type { IssuePriority, IssueStatus } from '../types/redmine';

/**
 * Mock-mode "today" used by demo pages so the data appears stable. Real
 * call sites should pass `new Date()` explicitly via the `today` parameter.
 */
export const MOCK_TODAY = new Date('2026-05-21');

export function isOverdue(dueDate: string | null, today: Date = new Date()): boolean {
  if (!dueDate) return false;
  return dueDate < today.toISOString().slice(0, 10);
}

export function daysOverdue(dueDate: string | null, today: Date = new Date()): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const diff = today.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function priorityPill(priority: IssuePriority): string {
  switch (priority) {
    case 'Immediate':
    case 'Urgent':
      return 'pill-red';
    case 'High':
      return 'pill-orange';
    case 'Normal':
      return 'pill-blue';
    case 'Low':
      return 'pill-gray';
    default:
      return 'pill-gray';
  }
}

export function statusPill(status: IssueStatus): string {
  switch (status) {
    case 'Resolved':
    case 'Closed':
      return 'pill-green';
    case 'In Progress':
      return 'pill-blue';
    case 'Feedback':
      return 'pill-yellow';
    case 'Rejected':
      return 'pill-red';
    case 'On Hold':
      return 'pill-gray';
    case 'New':
    default:
      return 'pill-gray';
  }
}

export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—';
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 2)}h`;
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return date;
}
