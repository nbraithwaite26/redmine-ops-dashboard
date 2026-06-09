import { describe, expect, it } from 'vitest';
import { sortEngineerRows, sortProjects } from '../lib/kanbanSort';
import type { TeamProjectRow, TeamUserRow } from '../lib/hoursAggregate';

function p(
  projectId: number,
  projectName: string,
  dueDate: string | null,
): TeamProjectRow {
  return {
    projectId,
    projectName,
    spentHours: 0,
    estimatedHours: 0,
    dueDate,
    tasks: [],
  };
}

function r(id: number, name: string, taskCount: number): TeamUserRow {
  return {
    user: { id, name, email: '', login: '', status: 'Active', groups: [], roles: [] },
    projectCount: 1,
    taskCount,
    spentHours: 0,
    estimatedHours: 0,
    projects: [],
  };
}

describe('sortProjects', () => {
  it('orders by earliest due date, nulls last', () => {
    const projects = [
      p(1, 'Project A', null),
      p(2, 'Project B', '2026-06-01'),
      p(3, 'Project C', '2026-05-01'),
      p(4, 'Project D', '2026-07-01'),
    ];
    expect(sortProjects(projects, 'dueDate').map((x) => x.projectId)).toEqual([3, 2, 4, 1]);
  });

  it('orders by type: STC → DDP → CI → other', () => {
    const projects = [
      p(1, 'Aircraft Equipment', '2026-06-01'),       // default
      p(2, 'STC Program X', '2026-07-01'),            // stc
      p(3, 'Continuous Improvement', '2026-05-01'),   // ci
      p(4, 'DDP Workflow', '2026-08-01'),             // ddp
    ];
    expect(sortProjects(projects, 'type').map((x) => x.projectId)).toEqual([2, 4, 3, 1]);
  });

  it('within type, ties broken by due date then name', () => {
    const projects = [
      p(1, 'STC Beta', '2026-06-01'),
      p(2, 'STC Alpha', '2026-06-01'), // same due date as Beta → name break
      p(3, 'STC Gamma', '2026-05-01'), // earliest due → first
    ];
    expect(sortProjects(projects, 'type').map((x) => x.projectId)).toEqual([3, 2, 1]);
  });

  it('does not mutate the input', () => {
    const projects = [p(1, 'B', '2026-06-01'), p(2, 'A', '2026-05-01')];
    const snapshot = projects.map((x) => x.projectId);
    sortProjects(projects, 'dueDate');
    expect(projects.map((x) => x.projectId)).toEqual(snapshot);
  });
});

describe('sortEngineerRows', () => {
  it('orders by task count desc, ties broken alphabetically', () => {
    const rows = [
      r(1, 'Charlie', 5),
      r(2, 'Alex', 10),
      r(3, 'Bo', 5),
    ];
    expect(sortEngineerRows(rows, 'taskCount').map((x) => x.user.id)).toEqual([2, 3, 1]);
  });

  it('orders alphabetically by user name', () => {
    const rows = [r(1, 'Charlie', 5), r(2, 'Alex', 10), r(3, 'Bo', 5)];
    expect(sortEngineerRows(rows, 'name').map((x) => x.user.id)).toEqual([2, 3, 1]);
  });

  it('does not mutate the input', () => {
    const rows = [r(1, 'B', 1), r(2, 'A', 1)];
    const snapshot = rows.map((x) => x.user.id);
    sortEngineerRows(rows, 'name');
    expect(rows.map((x) => x.user.id)).toEqual(snapshot);
  });
});
