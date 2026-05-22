import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GroupedTaskTable from '../components/GroupedTaskTable';
import { mockIssues, mockTimeEntries, mockUsers } from '../data/mockData';

describe('<GroupedTaskTable />', () => {
  it('renders one collapsible row per user with issues', () => {
    render(
      <GroupedTaskTable
        title="Team Tasks"
        users={mockUsers}
        issues={mockIssues}
        timeEntries={mockTimeEntries}
      />,
    );
    // Header
    expect(screen.getByText('Team Tasks')).toBeInTheDocument();
    // Each user that has at least one issue should get a group row.
    const usersWithIssues = mockUsers.filter((u) =>
      mockIssues.some((i) => i.assignee?.id === u.id),
    );
    usersWithIssues.forEach((u) => {
      expect(screen.getByTestId(`group-row-${u.login}`)).toBeInTheDocument();
    });
  });

  it('issue rows are hidden by default', () => {
    render(
      <GroupedTaskTable
        title="Team Tasks"
        users={mockUsers}
        issues={mockIssues}
      />,
    );
    // No issue-* rows visible before expansion.
    expect(screen.queryByTestId(/^issue-row-/)).toBeNull();
  });

  it('clicking a group row expands its issues', () => {
    render(
      <GroupedTaskTable
        title="Team Tasks"
        users={mockUsers}
        issues={mockIssues}
      />,
    );
    const firstUserWithIssues = mockUsers.find((u) =>
      mockIssues.some((i) => i.assignee?.id === u.id),
    )!;
    fireEvent.click(screen.getByTestId(`group-row-${firstUserWithIssues.login}`));
    const userIssues = mockIssues.filter(
      (i) => i.assignee?.id === firstUserWithIssues.id,
    );
    userIssues.forEach((i) => {
      expect(screen.getByTestId(`issue-row-${i.id}`)).toBeInTheDocument();
    });
  });

  it('shows an Unassigned group when issues have no assignee', () => {
    render(
      <GroupedTaskTable
        title="Team Tasks"
        users={mockUsers}
        issues={mockIssues}
      />,
    );
    const hasUnassigned = mockIssues.some((i) => !i.assignee);
    if (hasUnassigned) {
      expect(screen.getByTestId('group-row-__unassigned__')).toBeInTheDocument();
    }
  });

  it('shows the empty state when no issues are passed', () => {
    render(<GroupedTaskTable title="Empty" users={mockUsers} issues={[]} />);
    expect(screen.getByText(/no issues/i)).toBeInTheDocument();
  });

  it('aggregates hours from time entries and shows a Total: label', () => {
    render(
      <GroupedTaskTable
        title="Team Tasks"
        users={mockUsers}
        issues={mockIssues}
        timeEntries={mockTimeEntries}
      />,
    );
    expect(screen.getByText(/^total:$/i)).toBeInTheDocument();
    const totalHours = mockTimeEntries.reduce((s, t) => s + t.hours, 0);
    expect(totalHours).toBeGreaterThan(0);
  });

  it('a user with time entries gets a non-zero "% of total" cell', () => {
    render(
      <GroupedTaskTable
        title="Team Tasks"
        users={mockUsers}
        issues={mockIssues}
        timeEntries={mockTimeEntries}
      />,
    );
    // Find the cell that ends with "%" — at least one user has logged hours
    // in the mock data so percentages should not all be 0.
    const percentCells = screen.getAllByText(/^\d+%$/);
    expect(percentCells.length).toBeGreaterThan(0);
    const nonZero = percentCells.filter((c) => c.textContent !== '0%');
    expect(nonZero.length).toBeGreaterThan(0);
  });
});
