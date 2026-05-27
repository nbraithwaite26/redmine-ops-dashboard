import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import TeamMemberDetail from '../components/TeamMemberDetail';
import type { UserHoursSummary } from '../lib/hoursAggregate';
import type { Issue, User } from '../types/redmine';

function user(id: number, name: string): User {
  return { id, name, email: '', login: '', status: 'Active', groups: [], roles: [] };
}

function issue(id: number, subject: string): Issue {
  return {
    id,
    projectId: 1,
    projectName: 'STC Program',
    tracker: 'Task',
    status: 'In Progress',
    priority: 'Normal',
    subject,
    description: '',
    assignee: user(7, 'Jose Garcia'),
    author: user(7, 'Jose Garcia'),
    startDate: null,
    dueDate: '2026-06-01',
    estimatedHours: 8,
    spentHours: 4,
    doneRatio: 50,
    parentIssueId: null,
    children: [],
    relations: [],
    customFields: [],
    nextAction: null,
    createdOn: '2026-05-01',
    updatedOn: '2026-05-10',
    closedOn: null,
  };
}

const summary: UserHoursSummary = {
  user: user(7, 'Jose Garcia'),
  totalHours: 6,
  projectCount: 1,
  taskCount: 2,
  projects: [
    {
      projectId: 1,
      projectName: 'STC Program',
      spentHours: 6,
      estimatedHours: 16,
      dueDate: '2026-06-01',
      tasks: [
        { issue: issue(101, 'Draft compliance memo'), spentHours: 4 },
        { issue: issue(102, 'Review drawings'), spentHours: 2 },
      ],
    },
  ],
};

describe('<TeamMemberDetail />', () => {
  it('renders the hero, logged hours, and projects collapsed by default', () => {
    render(<TeamMemberDetail summary={summary} onClose={() => {}} />);
    const detail = screen.getByTestId('member-detail-7');
    expect(within(detail).getByText('Jose Garcia')).toBeInTheDocument();
    expect(within(detail).getByText('STC Program')).toBeInTheDocument();
    // Logged hours, not "expected".
    expect(within(detail).getByText(/6h logged/)).toBeInTheDocument();
    expect(within(detail).queryByText(/expected/)).toBeNull();
    // Subtasks are hidden until the project is expanded.
    expect(within(detail).queryByText(/Draft compliance memo/)).toBeNull();
    expect(screen.queryByTestId('member-project-tasks-1')).toBeNull();
  });

  it('expands a project to reveal its subtasks', () => {
    render(<TeamMemberDetail summary={summary} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('member-project-toggle-1'));
    const tasks = screen.getByTestId('member-project-tasks-1');
    expect(within(tasks).getByText(/Draft compliance memo/)).toBeInTheDocument();
    expect(within(tasks).getByText(/Review drawings/)).toBeInTheDocument();
  });

  it('calls onClose from the close button, the backdrop, and Escape', () => {
    const onClose = vi.fn();
    render(<TeamMemberDetail summary={summary} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('member-detail-close-7'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('member-detail-backdrop-7'));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
