import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import TeamMemberDetail from '../components/TeamMemberDetail';
import type { TeamUserRow } from '../lib/hoursAggregate';
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

const row: TeamUserRow = {
  user: user(7, 'Jose Garcia'),
  projectCount: 1,
  taskCount: 2,
  spentHours: 8,
  estimatedHours: 16,
  projects: [
    {
      projectId: 1,
      projectName: 'STC Program',
      spentHours: 8,
      estimatedHours: 16,
      dueDate: '2026-06-01',
      tasks: [issue(101, 'Draft compliance memo'), issue(102, 'Review drawings')],
    },
  ],
};

describe('<TeamMemberDetail />', () => {
  it('renders the engineer hero, metrics, and project breakdown', () => {
    render(<TeamMemberDetail row={row} onClose={() => {}} />);
    const detail = screen.getByTestId('member-detail-7');
    expect(within(detail).getByText('Jose Garcia')).toBeInTheDocument();
    expect(within(detail).getByText('STC Program')).toBeInTheDocument();
    expect(within(detail).getByText(/Draft compliance memo/)).toBeInTheDocument();
    expect(within(detail).getByText(/1 projects/)).toBeInTheDocument();
  });

  it('calls onClose from the close button, the backdrop, and Escape', () => {
    const onClose = vi.fn();
    render(<TeamMemberDetail row={row} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('member-detail-close-7'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('member-detail-backdrop-7'));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
