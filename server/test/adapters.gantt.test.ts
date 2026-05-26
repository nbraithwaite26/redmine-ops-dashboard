import { describe, expect, it } from 'vitest';
import { buildGanttRows } from '../src/adapters/gantt.js';
import type { NormalizedIssue, NormalizedUser } from '../src/types/normalized.js';

function user(id: number, name: string): NormalizedUser {
  return { id, name, email: '', login: '', status: 'Active', groups: [], roles: [] };
}

function issue(overrides: Partial<NormalizedIssue> & Pick<NormalizedIssue, 'id'>): NormalizedIssue {
  const base: NormalizedIssue = {
    id: overrides.id,
    projectId: 1,
    projectName: 'Project A',
    tracker: 'Task',
    status: 'In Progress',
    priority: 'Normal',
    subject: 'Anonymized',
    description: '',
    assignee: null,
    author: user(10, 'Test One'),
    startDate: null,
    dueDate: null,
    estimatedHours: null,
    spentHours: 0,
    doneRatio: 0,
    parentIssueId: null,
    children: [],
    relations: [],
    customFields: [],
    nextAction: null,
    createdOn: '2026-05-01T00:00:00Z',
    updatedOn: '2026-05-01T00:00:00Z',
    closedOn: null,
  };
  return { ...base, ...overrides };
}

describe('buildGanttRows', () => {
  it('flags overdue, unfinished, non-closed issues as at risk', () => {
    const today = new Date('2026-05-30');
    const rows = buildGanttRows(
      [
        issue({ id: 1, dueDate: '2026-05-10', doneRatio: 30, status: 'In Progress' }),
        issue({ id: 2, dueDate: '2026-05-10', doneRatio: 100, status: 'Closed' }),
        issue({ id: 3, dueDate: '2026-06-10', doneRatio: 0, status: 'New' }),
      ],
      { today },
    );
    expect(rows.find((r) => r.id === 1)?.isAtRisk).toBe(true);
    expect(rows.find((r) => r.id === 2)?.isAtRisk).toBe(false);
    expect(rows.find((r) => r.id === 3)?.isAtRisk).toBe(false);
  });

  it('marks an assignee overloaded when overlapping estimated hours exceed capacity', () => {
    const today = new Date('2026-05-30');
    const alice = user(7, 'Alice');
    const rows = buildGanttRows(
      [
        issue({
          id: 10,
          assignee: alice,
          startDate: '2026-05-01',
          dueDate: '2026-05-10',
          estimatedHours: 30,
        }),
        issue({
          id: 11,
          assignee: alice,
          startDate: '2026-05-05',
          dueDate: '2026-05-15',
          estimatedHours: 30,
        }),
      ],
      { today, capacityHours: 40 },
    );
    expect(rows.every((r) => r.isOverloaded)).toBe(true);
  });

  it('does not flag overload when ranges do not overlap', () => {
    const today = new Date('2026-05-30');
    const bob = user(8, 'Bob');
    const rows = buildGanttRows(
      [
        issue({
          id: 20,
          assignee: bob,
          startDate: '2026-05-01',
          dueDate: '2026-05-05',
          estimatedHours: 100,
        }),
        issue({
          id: 21,
          assignee: bob,
          startDate: '2026-05-10',
          dueDate: '2026-05-15',
          estimatedHours: 100,
        }),
      ],
      { today, capacityHours: 40 },
    );
    expect(rows.every((r) => r.isOverloaded)).toBe(false);
  });
});
