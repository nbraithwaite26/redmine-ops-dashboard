import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserGantt from '../components/UserGantt';
import type { Issue, User } from '../types/redmine';

function makeUser(id: number, name: string): User {
  return { id, name, email: '', login: `u${id}`, status: 'Active', groups: [], roles: [] };
}

function makeIssue(id: number, overrides: Partial<Issue>): Issue {
  return {
    id,
    projectId: 1,
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

const alice = makeUser(1, 'Alice');
const bob = makeUser(2, 'Bob');
const issues: Issue[] = [
  makeIssue(10, { assignee: alice, projectId: 1, projectName: 'Alpha', startDate: '2026-05-01', dueDate: '2026-05-10' }),
  makeIssue(11, { assignee: alice, projectId: 1, projectName: 'Alpha', startDate: '2026-05-05', dueDate: '2026-05-20' }),
  makeIssue(12, { assignee: alice, projectId: 2, projectName: 'Beta', startDate: '2026-06-01', dueDate: '2026-06-15' }),
  makeIssue(13, { assignee: bob, projectId: 1, projectName: 'Alpha', startDate: '2026-05-02', dueDate: '2026-05-09' }),
];

function renderGantt() {
  return render(
    <MemoryRouter>
      <UserGantt users={[alice, bob]} issues={issues} />
    </MemoryRouter>,
  );
}

describe('<UserGantt />', () => {
  it('shows an empty state until an engineer is selected', () => {
    renderGantt();
    expect(screen.getByTestId('gantt-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('gantt-project-1')).not.toBeInTheDocument();
  });

  it('after selecting a user, shows only their projects grouped with tasks', () => {
    renderGantt();
    fireEvent.change(screen.getByTestId('gantt-user-select'), { target: { value: '1' } });
    // Alice has Alpha (2 tasks) and Beta (1 task).
    expect(screen.getByTestId('gantt-project-1')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-project-2')).toBeInTheDocument();
    // Bob's-only project rows shouldn't appear beyond Alice's set; Alice's
    // Alpha shows 2 tasks (10, 11), not Bob's issue 13.
    expect(screen.getByText(/Issue 10/)).toBeInTheDocument();
    expect(screen.getByText(/Issue 11/)).toBeInTheDocument();
    expect(screen.queryByText(/Issue 13/)).not.toBeInTheDocument();
  });

  it('collapsing a project hides its task rows', () => {
    renderGantt();
    fireEvent.change(screen.getByTestId('gantt-user-select'), { target: { value: '1' } });
    expect(screen.getByText(/Issue 10/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gantt-project-1'));
    expect(screen.queryByText(/Issue 10/)).not.toBeInTheDocument();
  });

  it('shows a no-dates message when the selected user has no dated tasks', () => {
    const undated = [makeIssue(20, { assignee: bob, startDate: null, dueDate: null })];
    render(
      <MemoryRouter>
        <UserGantt users={[bob]} issues={undated} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByTestId('gantt-user-select'), { target: { value: '2' } });
    expect(screen.getByTestId('gantt-no-dates')).toBeInTheDocument();
  });
});
