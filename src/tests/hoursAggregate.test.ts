import { describe, expect, it } from 'vitest';
import {
  aggregateHours,
  entriesForIssue,
  maxDueDateIn,
  weeklyHoursFor,
  weekRange,
} from '../lib/hoursAggregate';
import type { Issue, TimeEntry, User } from '../types/redmine';

// ─── Fixtures (anonymized; no real data) ──────────────────────────────────

function makeUser(id: number, name = `User ${id}`): User {
  return {
    id,
    name,
    email: `${name.toLowerCase().replace(/ /g, '.')}@example.com`,
    login: `u${id}`,
    status: 'Active',
    groups: [],
    roles: [],
  };
}

function makeIssue(
  id: number,
  overrides: Partial<Issue> = {},
): Issue {
  return {
    id,
    projectId: 100,
    projectName: 'Project A',
    tracker: 'Task',
    status: 'New',
    priority: 'Normal',
    subject: `Issue ${id}`,
    description: '',
    assignee: null,
    author: makeUser(99, 'Author'),
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
    createdOn: '2026-05-01',
    updatedOn: '2026-05-01',
    closedOn: null,
    ...overrides,
  };
}

function makeEntry(
  id: number,
  overrides: Partial<TimeEntry> = {},
): TimeEntry {
  return {
    id,
    projectId: 100,
    projectName: 'Project A',
    issueId: null,
    user: makeUser(1),
    activity: 'Development',
    spentOn: '2026-05-26',
    hours: 1,
    comments: '',
    createdOn: '2026-05-26',
    updatedOn: '2026-05-26',
    ...overrides,
  };
}

// ─── weekRange ────────────────────────────────────────────────────────────

describe('weekRange', () => {
  // A Wednesday so we can verify Monday anchoring on both sides.
  const wed = new Date('2026-05-27T12:00:00Z'); // Wednesday

  it('current week (offset 0) starts on Monday and ends today', () => {
    const r = weekRange(0, wed);
    expect(r.from).toBe('2026-05-25'); // Monday before the 27th
    expect(r.to).toBe('2026-05-27');
    expect(r.offset).toBe(0);
  });

  it('last week (offset -1) is a full Monday–Sunday block', () => {
    const r = weekRange(-1, wed);
    expect(r.from).toBe('2026-05-18');
    expect(r.to).toBe('2026-05-24');
    expect(r.offset).toBe(-1);
  });

  it('label includes both dates and the year', () => {
    const r = weekRange(-1, wed);
    expect(r.label).toMatch(/2026/);
    // Locale-sensitive on day/month order; the test is light on format.
    expect(r.label).toMatch(/18/);
    expect(r.label).toMatch(/24/);
  });

  it('Sunday reference dates anchor to the prior Monday', () => {
    const sun = new Date('2026-05-31T12:00:00Z'); // Sunday
    const r = weekRange(0, sun);
    expect(r.from).toBe('2026-05-25');
    expect(r.to).toBe('2026-05-31');
  });

  it('Monday reference dates anchor to themselves', () => {
    const mon = new Date('2026-05-25T12:00:00Z');
    const r = weekRange(0, mon);
    expect(r.from).toBe('2026-05-25');
    expect(r.to).toBe('2026-05-25');
  });
});

// ─── weeklyHoursFor ──────────────────────────────────────────────────────

describe('weeklyHoursFor', () => {
  const range = { from: '2026-05-25', to: '2026-05-31' };
  const u1 = makeUser(1);
  const u2 = makeUser(2);

  const entries: TimeEntry[] = [
    makeEntry(1, { user: u1, spentOn: '2026-05-25', hours: 2 }),
    makeEntry(2, { user: u1, spentOn: '2026-05-26', hours: 3 }),
    makeEntry(3, { user: u1, spentOn: '2026-06-01', hours: 4 }), // out of range
    makeEntry(4, { user: u2, spentOn: '2026-05-27', hours: 5 }), // other user
    makeEntry(5, { user: u1, spentOn: '2026-05-31', hours: 1 }), // inclusive end
    makeEntry(6, { user: u1, spentOn: '2026-05-24', hours: 9 }), // before range
  ];

  it('sums hours for the user within the inclusive range', () => {
    expect(weeklyHoursFor(1, entries, range)).toBe(2 + 3 + 1);
  });

  it('returns 0 when the user has no entries in range', () => {
    expect(weeklyHoursFor(99, entries, range)).toBe(0);
  });

  it('ignores entries from other users', () => {
    expect(weeklyHoursFor(2, entries, range)).toBe(5);
  });
});

// ─── entriesForIssue ──────────────────────────────────────────────────────

describe('entriesForIssue', () => {
  const entries: TimeEntry[] = [
    makeEntry(1, { issueId: 10 }),
    makeEntry(2, { issueId: 11 }),
    makeEntry(3, { issueId: 10 }),
    makeEntry(4, { issueId: null }),
  ];

  it('returns only entries that reference the given issue id', () => {
    const got = entriesForIssue(10, entries);
    expect(got).toHaveLength(2);
    expect(got.map((e) => e.id).sort()).toEqual([1, 3]);
  });

  it('returns [] for an unknown issue', () => {
    expect(entriesForIssue(999, entries)).toEqual([]);
  });
});

// ─── maxDueDateIn ─────────────────────────────────────────────────────────

describe('maxDueDateIn', () => {
  it('returns null when no issue has a dueDate', () => {
    const issues = [makeIssue(1), makeIssue(2)];
    expect(maxDueDateIn(issues)).toBeNull();
  });

  it('returns the latest dueDate, ignoring nulls', () => {
    const issues = [
      makeIssue(1, { dueDate: '2026-06-10' }),
      makeIssue(2, { dueDate: null }),
      makeIssue(3, { dueDate: '2026-06-15' }),
      makeIssue(4, { dueDate: '2026-06-01' }),
    ];
    expect(maxDueDateIn(issues)).toBe('2026-06-15');
  });
});

// ─── aggregateHours ──────────────────────────────────────────────────────

describe('aggregateHours', () => {
  const range = { from: '2026-05-25', to: '2026-05-31', label: 'wk', offset: 0 };
  const alice = makeUser(1, 'Alice');
  const bob = makeUser(2, 'Bob');

  const issues: Issue[] = [
    makeIssue(101, {
      projectId: 10,
      projectName: 'Alpha',
      assignee: alice,
      estimatedHours: 4,
      dueDate: '2026-06-05',
    }),
    makeIssue(102, {
      projectId: 10,
      projectName: 'Alpha',
      assignee: alice,
      estimatedHours: 2,
      dueDate: '2026-06-10',
    }),
    makeIssue(201, {
      projectId: 20,
      projectName: 'Beta',
      assignee: alice,
      estimatedHours: 8,
      dueDate: null,
    }),
    makeIssue(301, {
      projectId: 30,
      projectName: 'Gamma',
      assignee: bob,
      estimatedHours: 3,
    }),
    makeIssue(400, {
      projectId: 40,
      projectName: 'Unassigned project',
      assignee: null,
    }),
  ];

  const entries: TimeEntry[] = [
    // Alice logs 2h on issue 101 inside the range
    makeEntry(1, { user: alice, projectId: 10, issueId: 101, hours: 2, spentOn: '2026-05-26' }),
    // Alice logs 0.5h at the project level (no issueId) inside the range
    makeEntry(2, { user: alice, projectId: 20, issueId: null, hours: 0.5, spentOn: '2026-05-27' }),
    // Alice logs outside the range — should not count
    makeEntry(3, { user: alice, projectId: 10, issueId: 101, hours: 99, spentOn: '2026-05-20' }),
    // Bob logs 1h on his task
    makeEntry(4, { user: bob, projectId: 30, issueId: 301, hours: 1, spentOn: '2026-05-28' }),
  ];

  it('groups tasks by user and by project', () => {
    const summaries = aggregateHours([alice, bob], issues, entries, range);
    const aliceSummary = summaries.find((s) => s.user.id === alice.id)!;
    expect(aliceSummary).toBeDefined();
    expect(aliceSummary.projectCount).toBe(2); // Alpha + Beta
    expect(aliceSummary.taskCount).toBe(3); // 101 + 102 + 201
    expect(aliceSummary.projects.map((p) => p.projectName).sort()).toEqual(['Alpha', 'Beta']);
  });

  it('totals only the in-range hours per user', () => {
    const summaries = aggregateHours([alice, bob], issues, entries, range);
    const aliceSummary = summaries.find((s) => s.user.id === alice.id)!;
    expect(aliceSummary.totalHours).toBe(2.5); // 2h on issue + 0.5h at project level
    const bobSummary = summaries.find((s) => s.user.id === bob.id)!;
    expect(bobSummary.totalHours).toBe(1);
  });

  it('sums estimated hours across the user\'s tasks per project', () => {
    const summaries = aggregateHours([alice, bob], issues, entries, range);
    const aliceAlpha = summaries
      .find((s) => s.user.id === alice.id)!
      .projects.find((p) => p.projectName === 'Alpha')!;
    expect(aliceAlpha.estimatedHours).toBe(6); // 4 + 2
  });

  it('derives project due date as max task due date', () => {
    const summaries = aggregateHours([alice, bob], issues, entries, range);
    const aliceAlpha = summaries
      .find((s) => s.user.id === alice.id)!
      .projects.find((p) => p.projectName === 'Alpha')!;
    const aliceBeta = summaries
      .find((s) => s.user.id === alice.id)!
      .projects.find((p) => p.projectName === 'Beta')!;
    expect(aliceAlpha.dueDate).toBe('2026-06-10');
    expect(aliceBeta.dueDate).toBeNull();
  });

  it('attributes project-level entries (issueId = null) to the project', () => {
    const summaries = aggregateHours([alice, bob], issues, entries, range);
    const aliceBeta = summaries
      .find((s) => s.user.id === alice.id)!
      .projects.find((p) => p.projectName === 'Beta')!;
    expect(aliceBeta.spentHours).toBe(0.5);
  });

  it('excludes users with no tasks (no card to render)', () => {
    const carol = makeUser(3, 'Carol');
    const summaries = aggregateHours([alice, bob, carol], issues, entries, range);
    const carolSummary = summaries.find((s) => s.user.id === carol.id)!;
    expect(carolSummary.taskCount).toBe(0);
    expect(carolSummary.projectCount).toBe(0);
    expect(carolSummary.totalHours).toBe(0);
  });

  it('sorts users by total hours desc, ties broken by task count', () => {
    const summaries = aggregateHours([bob, alice], issues, entries, range);
    expect(summaries.map((s) => s.user.name)).toEqual(['Alice', 'Bob']);
  });
});
