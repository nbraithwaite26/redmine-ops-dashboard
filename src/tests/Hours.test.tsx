import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Hours from '../pages/Hours';

/**
 * The Hours page renders two stacked sections (this week, last week)
 * against the mock backend. These tests exercise structure (both
 * sections mount), interaction (accordion expand/collapse), and
 * the Log-time launch wiring.
 *
 * Mock-data specifics are covered by `hoursAggregate.test.ts` — here
 * we lean on the structural shape so the test stays resilient to
 * fixture tweaks.
 */
describe('<Hours />', () => {
  function renderHours() {
    return render(
      <MemoryRouter initialEntries={['/hours']}>
        <Hours />
      </MemoryRouter>,
    );
  }

  it('renders both this-week and last-week sections', async () => {
    renderHours();
    expect(await screen.findByText('Hours')).toBeInTheDocument();
    expect(await screen.findByText('This week')).toBeInTheDocument();
    expect(await screen.findByText('Last week')).toBeInTheDocument();
    // Each section has its own test id ("hours-section-0" / "hours-section--1").
    expect(screen.getByTestId('hours-section-0')).toBeInTheDocument();
    expect(screen.getByTestId('hours-section--1')).toBeInTheDocument();
  });

  it('renders the Team Hours section with a Card/List view selector', async () => {
    renderHours();
    const team = await screen.findByTestId('team-hours');
    expect(team).toBeInTheDocument();
    expect(within(team).getByText('Team schedule')).toBeInTheDocument();
    // View selector defaults to Card.
    await waitFor(() => {
      const sel = within(team).getByTestId('team-hours-view') as HTMLSelectElement;
      expect(sel.value).toBe('Card');
    });
  });

  it('each section loads, then either renders user cards or an empty state', async () => {
    renderHours();
    // Wait for the loading rows to disappear in both sections.
    await waitFor(() => {
      expect(screen.queryByTestId('hours-loading-0')).not.toBeInTheDocument();
      expect(screen.queryByTestId('hours-loading--1')).not.toBeInTheDocument();
    });

    const thisWeek = screen.getByTestId('hours-section-0');
    const lastWeek = screen.getByTestId('hours-section--1');

    // Either at least one user card OR the empty-state card.
    const thisWeekRendered =
      within(thisWeek).queryAllByTestId(/^user-hours-card-/).length > 0 ||
      within(thisWeek).queryByTestId('hours-empty-0') !== null;
    const lastWeekRendered =
      within(lastWeek).queryAllByTestId(/^user-hours-card--?/).length > 0 ||
      within(lastWeek).queryByTestId('hours-empty--1') !== null;

    expect(thisWeekRendered).toBe(true);
    expect(lastWeekRendered).toBe(true);
  });

  it('clicking a user card expands the project list', async () => {
    renderHours();

    // Wait for either section to have at least one user card; if neither
    // does (improbable with the mock data) the empty-state test above
    // already covered the no-data path.
    const card = await waitFor(() => {
      const cards = screen.queryAllByTestId(/^user-hours-card-/);
      if (cards.length === 0) throw new Error('No user cards rendered yet');
      return cards[0]!;
    });

    const userId = card.getAttribute('data-testid')!.replace('user-hours-card-', '');
    expect(screen.queryByTestId(`user-projects-list-${userId}`)).not.toBeInTheDocument();

    const toggle = within(card).getByTestId(`user-toggle-${userId}`);
    fireEvent.click(toggle);

    expect(screen.getByTestId(`user-projects-list-${userId}`)).toBeInTheDocument();
  });

  it('clicking a project expands tasks; Log time button opens the modal', async () => {
    renderHours();

    const card = await waitFor(() => {
      const cards = screen.queryAllByTestId(/^user-hours-card-/);
      if (cards.length === 0) throw new Error('No user cards rendered');
      return cards[0]!;
    });
    const userId = card.getAttribute('data-testid')!.replace('user-hours-card-', '');
    fireEvent.click(within(card).getByTestId(`user-toggle-${userId}`));

    // First project row in the list.
    const projects = await waitFor(() => {
      const list = screen.getByTestId(`user-projects-list-${userId}`);
      const rows = within(list).queryAllByTestId(/^project-hours-row-/);
      if (rows.length === 0) throw new Error('No project rows visible');
      return rows;
    });
    const firstProject = projects[0]!;
    const projectId = firstProject.getAttribute('data-testid')!.replace('project-hours-row-', '');

    fireEvent.click(within(firstProject).getByTestId(`project-toggle-${projectId}`));

    // Tasks panel exists.
    const tasksPanel = await waitFor(() => screen.getByTestId(`project-tasks-${projectId}`));
    const taskRows = within(tasksPanel).queryAllByTestId(/^task-hours-row-/);
    // Project must have at least one task (it wouldn't be in the list otherwise).
    expect(taskRows.length).toBeGreaterThan(0);

    // Modal isn't open yet.
    expect(screen.queryByRole('dialog', { name: /add time entry/i })).not.toBeInTheDocument();

    // Click Log time on the first task.
    const taskRow = taskRows[0]!;
    const taskId = taskRow.getAttribute('data-testid')!.replace('task-hours-row-', '');
    fireEvent.click(within(taskRow).getByTestId(`log-time-${taskId}`));

    expect(
      await screen.findByRole('dialog', { name: /add time entry/i }),
    ).toBeInTheDocument();
  });
});
