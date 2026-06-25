import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Tasks from '../pages/Tasks';

function renderTasks() {
  return render(
    <MemoryRouter initialEntries={['/tasks']}>
      <Tasks />
    </MemoryRouter>,
  );
}

describe('<Tasks /> (engineer-centered)', () => {
  beforeEach(() => localStorage.clear());

  it('shows only the current user\'s tasks; no team toggle', async () => {
    renderTasks();
    expect(await screen.findByText('Assigned to me')).toBeInTheDocument();
    // Team panel + toggle are intentionally absent in the engineer-centered view.
    expect(screen.queryByTestId('tasks-team-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tasks-team-toggle')).not.toBeInTheDocument();
  });

  it('groups My tasks by project (header rows, collapsible)', async () => {
    renderTasks();
    // Wait until the current user loads and `myIssues` populate the groups.
    const groupHeaders = await waitFor(() => {
      const found = screen.queryAllByTestId(/^my-tasks-toggle-\d+$/);
      if (found.length === 0) throw new Error('no project groups yet');
      return found;
    });
    expect(groupHeaders.length).toBeGreaterThan(0);

    // First group is open by default — its task list should be in the DOM.
    const firstTestId = groupHeaders[0]!.getAttribute('data-testid')!;
    const projectId = Number(firstTestId.split('-').pop());
    expect(screen.getByTestId(`my-tasks-list-${projectId}`)).toBeInTheDocument();

    // Collapsing the first group hides its task list.
    fireEvent.click(groupHeaders[0]!);
    await waitFor(() =>
      expect(screen.queryByTestId(`my-tasks-list-${projectId}`)).not.toBeInTheDocument(),
    );
  });
});
