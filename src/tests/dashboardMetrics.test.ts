import { describe, expect, it } from 'vitest';
import {
  buildDashboardMetrics,
  buildReportMetrics,
  buildTeamMetrics,
  buildTimeMetrics,
  mockIssues,
  mockUsers,
} from '../data/mockData';
import type { Issue } from '../types/redmine';

const empty: Issue[] = [];
const fullHours = { logged: 40, target: 40 };
const overHours = { logged: 50, target: 40 };
const zeroHours = { logged: 0, target: 0 };

describe('buildDashboardMetrics', () => {
  it('returns 8 cards', () => {
    const metrics = buildDashboardMetrics({
      myIssues: mockIssues,
      allIssues: mockIssues,
      pastDueCount: 3,
      weeklyHours: { logged: 8, target: 40 },
      teamHours: { logged: 60, target: 360 },
    });
    expect(metrics).toHaveLength(8);
  });

  it('handles empty issue lists without crashing', () => {
    const metrics = buildDashboardMetrics({
      myIssues: empty,
      allIssues: empty,
      pastDueCount: 0,
      weeklyHours: zeroHours,
      teamHours: zeroHours,
    });
    expect(metrics).toHaveLength(8);
    metrics.forEach((m) => {
      expect(m.progress).toBeGreaterThanOrEqual(0);
      expect(m.progress).toBeLessThanOrEqual(100);
    });
  });

  it('clamps progress at 100 when logged exceeds target', () => {
    const metrics = buildDashboardMetrics({
      myIssues: empty,
      allIssues: empty,
      pastDueCount: 0,
      weeklyHours: overHours,
      teamHours: zeroHours,
    });
    const hoursCard = metrics.find((m) => m.id === 'hours-week');
    expect(hoursCard?.progress).toBe(100);
  });

  it('returns progress 0 when both value and total are 0', () => {
    const metrics = buildDashboardMetrics({
      myIssues: empty,
      allIssues: empty,
      pastDueCount: 0,
      weeklyHours: zeroHours,
      teamHours: zeroHours,
    });
    expect(metrics.find((m) => m.id === 'hours-week')?.progress).toBe(0);
  });

  it('derives In Progress count from myIssues', () => {
    const myIssues = mockIssues.filter((i) => i.assignee?.id === mockUsers[0].id);
    const inProgress = myIssues.filter((i) => i.status === 'In Progress').length;
    const metrics = buildDashboardMetrics({
      myIssues,
      allIssues: mockIssues,
      pastDueCount: 0,
      weeklyHours: zeroHours,
      teamHours: zeroHours,
    });
    const card = metrics.find((m) => m.id === 'tasks-assigned');
    expect(card?.statusLabel).toBe(`${inProgress} In Progress`);
  });

  it('counts unassigned from allIssues', () => {
    const unassigned = mockIssues.filter((i) => !i.assignee);
    const metrics = buildDashboardMetrics({
      myIssues: empty,
      allIssues: mockIssues,
      pastDueCount: 0,
      weeklyHours: zeroHours,
      teamHours: zeroHours,
    });
    expect(metrics.find((m) => m.id === 'unassigned')?.value).toBe(unassigned.length);
  });

  it('counts Feedback issues as waiting-for-update', () => {
    const waiting = mockIssues.filter((i) => i.status === 'Feedback').length;
    const metrics = buildDashboardMetrics({
      myIssues: empty,
      allIssues: mockIssues,
      pastDueCount: 0,
      weeklyHours: zeroHours,
      teamHours: zeroHours,
    });
    expect(metrics.find((m) => m.id === 'waiting')?.value).toBe(waiting);
  });

  it('sets route on the cards that drill into pages', () => {
    const metrics = buildDashboardMetrics({
      myIssues: mockIssues,
      allIssues: mockIssues,
      pastDueCount: 1,
      weeklyHours: { logged: 8, target: 40 },
      teamHours: { logged: 60, target: 360 },
    });
    expect(metrics.find((m) => m.id === 'tasks-assigned')?.route).toBe('/my-tasks');
    expect(metrics.find((m) => m.id === 'past-due')?.route).toBe('/past-due');
    expect(metrics.find((m) => m.id === 'hours-week')?.route).toBe('/time');
  });

  it('uses unique ids across all 8 cards', () => {
    const metrics = buildDashboardMetrics({
      myIssues: mockIssues,
      allIssues: mockIssues,
      pastDueCount: 0,
      weeklyHours: zeroHours,
      teamHours: zeroHours,
    });
    const ids = metrics.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildTeamMetrics (4-card overview)', () => {
  const teamHours = { logged: 200, target: 360 };

  it('returns exactly 4 cards with the expected ids', () => {
    const metrics = buildTeamMetrics({
      activeDdpCount: 3,
      activeStcCount: 7,
      projectsDueIn7DaysCount: 5,
      teamHours,
    });
    expect(metrics).toHaveLength(4);
    expect(metrics.map((m) => m.id)).toEqual([
      'team-active-ddps',
      'team-active-stcs',
      'team-hours-week',
      'team-projects-due-week',
    ]);
  });

  it('all card ids are unique', () => {
    const metrics = buildTeamMetrics({
      activeDdpCount: 0,
      activeStcCount: 0,
      projectsDueIn7DaysCount: 0,
      teamHours,
    });
    const ids = metrics.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('omits the removed ids (team-tasks, team-past-due, team-engineers, team-due-week, team-waiting, team-assigned-tasks, team-in-progress, team-unassigned)', () => {
    const metrics = buildTeamMetrics({
      activeDdpCount: 0,
      activeStcCount: 0,
      projectsDueIn7DaysCount: 0,
      teamHours,
    });
    const removedIds = [
      'team-tasks',
      'team-past-due',
      'team-engineers',
      'team-due-week',
      'team-waiting',
      'team-assigned-tasks',
      'team-in-progress',
      'team-unassigned',
    ];
    for (const id of removedIds) {
      expect(metrics.find((m) => m.id === id)).toBeUndefined();
    }
  });

  it('Active DDPs card surfaces the count + "Custom Engineering Services" label', () => {
    const metrics = buildTeamMetrics({
      activeDdpCount: 12,
      activeStcCount: 0,
      projectsDueIn7DaysCount: 0,
      teamHours,
    });
    const card = metrics.find((m) => m.id === 'team-active-ddps');
    expect(card?.title).toBe('Active DDPs');
    expect(card?.value).toBe(12);
    expect(card?.statusLabel).toBe('Custom Engineering Services');
  });

  it('Active STC projects card surfaces the count + "STCs" label', () => {
    const metrics = buildTeamMetrics({
      activeDdpCount: 0,
      activeStcCount: 25,
      projectsDueIn7DaysCount: 0,
      teamHours,
    });
    const card = metrics.find((m) => m.id === 'team-active-stcs');
    expect(card?.title).toBe('Active STC projects');
    expect(card?.value).toBe(25);
    expect(card?.statusLabel).toBe('STCs');
  });

  it('Team hours card uses the supplied week label and exposes the hours target', () => {
    const metrics = buildTeamMetrics({
      activeDdpCount: 0,
      activeStcCount: 0,
      projectsDueIn7DaysCount: 0,
      teamHours: { logged: 180, target: 360 },
      teamHoursWeekLabel: 'last week',
    });
    const card = metrics.find((m) => m.id === 'team-hours-week');
    expect(card?.title).toBe('Team hours last week');
    expect(card?.value).toBe(180);
    expect(card?.total).toBe(360);
  });

  it('Projects-due card uses the long title with "next 7 days"', () => {
    const metrics = buildTeamMetrics({
      activeDdpCount: 0,
      activeStcCount: 0,
      projectsDueIn7DaysCount: 4,
      teamHours,
    });
    const card = metrics.find((m) => m.id === 'team-projects-due-week');
    expect(card?.title).toBe('Projects due in the next 7 days');
    expect(card?.value).toBe(4);
  });

  it('only the team-hours card carries a ring; others are flat numbers', () => {
    const metrics = buildTeamMetrics({
      activeDdpCount: 1,
      activeStcCount: 1,
      projectsDueIn7DaysCount: 1,
      teamHours,
    });
    const rings = metrics.filter((m) => m.ring !== false);
    expect(rings).toHaveLength(1);
    expect(rings[0]?.id).toBe('team-hours-week');
  });

  it('clamps every progress value to [0, 100] regardless of inputs', () => {
    const metrics = buildTeamMetrics({
      activeDdpCount: 0,
      activeStcCount: 0,
      projectsDueIn7DaysCount: 0,
      teamHours: zeroHours,
    });
    metrics.forEach((m) => {
      expect(m.progress).toBeGreaterThanOrEqual(0);
      expect(m.progress).toBeLessThanOrEqual(100);
    });
  });
});

// Reference for parity with other suites — the named import is used.
void mockIssues;
void mockUsers;

describe('buildReportMetrics', () => {
  it('returns 6 cards', () => {
    const metrics = buildReportMetrics({
      weeklyHours: { logged: 10, target: 40 },
      teamHours: { logged: 100, target: 360 },
      resolvedCount: 5,
      openKpis: 7,
      overloadedCount: 2,
      timeEntries: 20,
    });
    expect(metrics).toHaveLength(6);
  });

  it('propagates raw counts into the value field', () => {
    const metrics = buildReportMetrics({
      weeklyHours: { logged: 10, target: 40 },
      teamHours: { logged: 100, target: 360 },
      resolvedCount: 5,
      openKpis: 7,
      overloadedCount: 2,
      timeEntries: 20,
    });
    expect(metrics.find((m) => m.id === 'resolved')?.value).toBe(5);
    expect(metrics.find((m) => m.id === 'open-kpis')?.value).toBe(7);
    expect(metrics.find((m) => m.id === 'overloaded')?.value).toBe(2);
    expect(metrics.find((m) => m.id === 'entries')?.value).toBe(20);
  });

  it('every card has a non-negative bounded progress', () => {
    const metrics = buildReportMetrics({
      weeklyHours: { logged: 60, target: 40 }, // over target
      teamHours: zeroHours,
      resolvedCount: 0,
      openKpis: 99,
      overloadedCount: 0,
      timeEntries: 0,
    });
    metrics.forEach((m) => {
      expect(m.progress).toBeGreaterThanOrEqual(0);
      expect(m.progress).toBeLessThanOrEqual(100);
    });
  });
});

describe('buildTimeMetrics', () => {
  it('returns 4 cards', () => {
    const metrics = buildTimeMetrics({
      weeklyHours: { logged: 8, target: 40 },
      teamHours: { logged: 60, target: 360 },
      entryCount: 5,
      averageHours: 1.5,
      range: 'Weekly',
    });
    expect(metrics).toHaveLength(4);
  });

  it('formats the average as Xh', () => {
    const metrics = buildTimeMetrics({
      weeklyHours: zeroHours,
      teamHours: zeroHours,
      entryCount: 0,
      averageHours: 0,
      range: 'Weekly',
    });
    expect(metrics.find((m) => m.id === 'avg')?.value).toBe('0.0h');
  });

  it('includes the range label in the entries card', () => {
    const metrics = buildTimeMetrics({
      weeklyHours: zeroHours,
      teamHours: zeroHours,
      entryCount: 10,
      averageHours: 2,
      range: 'Quarterly',
    });
    expect(metrics.find((m) => m.id === 'entries')?.statusLabel).toBe('Quarterly view');
  });
});
