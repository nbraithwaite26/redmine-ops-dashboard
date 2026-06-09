import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import EngineerProjectCard, { pickNextDue } from '../components/EngineerProjectCard';
import type { Issue } from '../types/redmine';
import type { TeamProjectRow } from '../lib/hoursAggregate';

function user(id: number, name: string) {
  return { id, name, email: '', login: '', status: 'Active' as const, groups: [], roles: [] };
}

function issue(id: number, subject: string, dueDate: string | null): Issue {
  return {
    id,
    projectId: 9,
    projectName: 'Demo project',
    tracker: 'Task',
    status: 'In Progress',
    priority: 'Normal',
    subject,
    description: '',
    assignee: user(1, 'Alex Morgan'),
    author: user(1, 'Alex Morgan'),
    startDate: null,
    dueDate,
    estimatedHours: 4,
    spentHours: 1,
    doneRatio: 0,
    parentIssueId: null,
    children: [],
    relations: [],
    customFields: [],
    nextAction: null,
    createdOn: '2026-01-01',
    updatedOn: '2026-01-02',
    closedOn: null,
  };
}

describe('pickNextDue', () => {
  it('returns the n earliest-due tasks, with no-due tasks last', () => {
    const tasks = [
      issue(3, 'No date task', null),
      issue(1, 'Earliest', '2026-05-01'),
      issue(2, 'Middle', '2026-06-01'),
      issue(4, 'Latest', '2026-07-01'),
    ];
    const result = pickNextDue(tasks, 2);
    expect(result.map((t) => t.id)).toEqual([1, 2]);
  });

  it('treats overdue tasks (past dates) as earliest', () => {
    const tasks = [
      issue(1, 'Future', '2030-01-01'),
      issue(2, 'Overdue 1', '2020-01-01'),
      issue(3, 'Overdue 2', '2019-06-15'),
    ];
    const result = pickNextDue(tasks, 2);
    expect(result.map((t) => t.id)).toEqual([3, 2]);
  });
});

describe('<EngineerProjectCard /> minimal preview', () => {
  const baseProject: TeamProjectRow = {
    projectId: 9,
    projectName: 'Demo STC Program',
    spentHours: 3,
    estimatedHours: 12,
    dueDate: '2026-07-01',
    tasks: [
      issue(1, 'Alpha task', '2026-05-01'),
      issue(2, 'Bravo task', '2026-06-01'),
    ],
  };

  it('shows only title + due date in the collapsed card', () => {
    render(
      <EngineerProjectCard userId={1} project={baseProject} onSelect={() => {}} />,
    );
    expect(screen.getByText('Demo STC Program')).toBeInTheDocument();
    expect(screen.getByText(/due 2026-07-01/)).toBeInTheDocument();
    // The detailed task / hours / "Up next" blocks are intentionally absent.
    expect(screen.queryByText(/Alpha task/)).toBeNull();
    expect(screen.queryByText(/Bravo task/)).toBeNull();
    expect(screen.queryByText(/Up next/i)).toBeNull();
    expect(screen.queryByText(/\/12h/)).toBeNull();
  });

  it('falls back to "no due date" when the project has none', () => {
    const noDue: TeamProjectRow = { ...baseProject, dueDate: null };
    render(<EngineerProjectCard userId={1} project={noDue} onSelect={() => {}} />);
    expect(screen.getByText(/no due date/)).toBeInTheDocument();
  });

  it('exposes the project color tone via data-project-tone', () => {
    render(
      <EngineerProjectCard userId={1} project={baseProject} onSelect={() => {}} />,
    );
    const card = screen.getByTestId('eng-project-card-1-9');
    expect(card.getAttribute('data-project-tone')).toBe('stc');
  });
});
