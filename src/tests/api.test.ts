import { describe, expect, it } from 'vitest';
import {
  createIssue,
  createTimeEntry,
  getIssues,
  getMyIssues,
  getPastDueIssues,
  getTeamHours,
  getWeeklyHours,
  testConnection,
  updateIssue,
} from '../services/redmineApi';
import { currentMockUser } from '../data/mockData';

describe('mock redmine api', () => {
  it('returns mock connection status in mock mode', async () => {
    const status = await testConnection();
    expect(status.mockMode).toBe(true);
    expect(status.message).toMatch(/mock/i);
  });

  it('returns issues for the current user', async () => {
    const mine = await getMyIssues(currentMockUser.id);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((i) => i.assignee?.id === currentMockUser.id)).toBe(true);
  });

  it('returns past-due issues that exclude resolved and closed', async () => {
    const overdue = await getPastDueIssues(new Date('2026-05-21'));
    expect(overdue.every((i) => i.status !== 'Closed' && i.status !== 'Resolved')).toBe(true);
  });

  it('updateIssue mutates and returns the new issue', async () => {
    const before = (await getIssues())[0];
    const updated = await updateIssue(before.id, { doneRatio: 95, status: 'Feedback' });
    expect(updated.doneRatio).toBe(95);
    expect(updated.status).toBe('Feedback');
  });

  it('createTimeEntry adds spent hours back to the issue', async () => {
    const issues = await getIssues();
    const target = issues[0];
    const before = target.spentHours;
    await createTimeEntry({
      projectId: target.projectId,
      issueId: target.id,
      hours: 1.25,
      activity: 'Development',
      comments: 'test',
      spentOn: '2026-05-20',
    });
    const after = (await getIssues()).find((i) => i.id === target.id)!;
    expect(after.spentHours).toBeCloseTo(before + 1.25, 2);
  });

  it('weekly and team hours reflect the time entries store', async () => {
    const w = await getWeeklyHours();
    const t = await getTeamHours();
    expect(w.target).toBe(40);
    expect(t.target).toBe(360);
  });

  it('createIssue assigns a new id', async () => {
    const before = await getIssues();
    const next = await createIssue({ subject: 'A new mock issue' });
    expect(next.id).toBeGreaterThan(Math.max(...before.map((i) => i.id)));
    expect(next.subject).toBe('A new mock issue');
  });
});
