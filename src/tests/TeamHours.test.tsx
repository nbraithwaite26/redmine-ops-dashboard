import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TeamHours from '../components/TeamHours';
import type { Issue, User } from '../types/redmine';

function makeUser(id: number, name: string): User {
  return { id, name, email: '', login: `u${id}`, status: 'Active', groups: [], roles: [] };
}

function makeIssue(id: number, o: Partial<Issue>): Issue {
  return {
    id, projectId: 1, projectName: 'Alpha', tracker: 'Task', status: 'New', priority: 'Normal',
    subject: `Issue ${id}`, description: '', assignee: null, author: makeUser(99, 'A'),
    startDate: null, dueDate: null, estimatedHours: null, spentHours: 0, doneRatio: 0,
    parentIssueId: null, children: [], relations: [], customFields: [], nextAction: null,
    createdOn: '2026-05-01', updatedOn: '2026-05-01', closedOn: null, ...o,
  };
}

const alice = makeUser(1, 'Alice');
const issues: Issue[] = [
  makeIssue(10, { assignee: alice, projectId: 1, projectName: 'Alpha', startDate: '2026-05-01', dueDate: '2026-05-10', estimatedHours: 8, spentHours: 4 }),
  makeIssue(11, { assignee: alice, projectId: 1, projectName: 'Alpha', startDate: '2026-05-05', dueDate: '2026-05-20', estimatedHours: 12, spentHours: 6 }),
  makeIssue(12, { assignee: alice, projectId: 2, projectName: 'Beta', estimatedHours: 5, spentHours: 1 }),
];

function renderTeam(onLogTime = vi.fn()) {
  return render(
    <MemoryRouter>
      <TeamHours users={[alice]} issues={issues} readOnly={false} onLogTime={onLogTime} />
    </MemoryRouter>,
  );
}

describe('<TeamHours />', () => {
  it('defaults to Card view with one card per engineer showing counts + hours', () => {
    renderTeam();
    const sel = screen.getByTestId('team-hours-view') as HTMLSelectElement;
    expect(sel.value).toBe('Card');
    const card = screen.getByTestId('team-card-1');
    expect(within(card).getByText('Alice')).toBeInTheDocument();
    expect(within(card).getByText(/2 projects/)).toBeInTheDocument();
    expect(within(card).getByText(/3 tasks/)).toBeInTheDocument();
    // spent 11 / expected 25
    expect(within(card).getByText(/25/)).toBeInTheDocument();
  });

  it('expanding a card reveals the per-user Gantt bars', () => {
    renderTeam();
    expect(screen.queryByTestId('team-card-gantt-1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-card-toggle-1'));
    expect(screen.getByTestId('team-card-gantt-1')).toBeInTheDocument();
    // Alpha has dated tasks → its project row renders in the Gantt.
    expect(screen.getByTestId('gantt-project-1')).toBeInTheDocument();
  });

  it('List view shows project rows that expand to task rows with a log action', () => {
    const onLogTime = vi.fn();
    renderTeam(onLogTime);
    fireEvent.change(screen.getByTestId('team-hours-view'), { target: { value: 'List' } });
    expect(screen.getByTestId('team-list-1')).toBeInTheDocument();
    // Expand the Alpha project (id 1).
    fireEvent.click(screen.getByTestId('team-project-1'));
    expect(screen.getByTestId('team-task-10')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-log-10'));
    expect(onLogTime).toHaveBeenCalledTimes(1);
  });
});
