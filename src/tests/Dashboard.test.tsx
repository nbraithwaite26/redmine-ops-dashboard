import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

describe('<Dashboard /> (team-first)', () => {
  it('renders the overview heading and the three tabs', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tab-Team')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tab-Project Health')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tab-Resource Planning')).toBeInTheDocument();
  });

  it('defaults to the Team tab: 4 headline cards + team panel; AE Calendar gone', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    // New headline cards.
    expect(await screen.findByText('Active DDPs')).toBeInTheDocument();
    expect(screen.getByText('Active STC projects')).toBeInTheDocument();
    expect(screen.getByText(/Team hours (this|last) week/)).toBeInTheDocument();
    expect(screen.getByText('Projects due in the next 7 days')).toBeInTheDocument();
    // Removed cards (titles and testids).
    expect(screen.queryByText('Team tasks')).toBeNull();
    expect(screen.queryByText('Tasks assigned')).toBeNull();
    expect(screen.queryByText('Team past due')).toBeNull();
    expect(screen.queryByText('Unassigned tasks')).toBeNull();
    expect(screen.queryByText('Engineers')).toBeNull();
    expect(screen.queryByText('Due this week')).toBeNull();
    expect(screen.queryByText('Awaiting response')).toBeNull();
    expect(screen.queryByTestId('engineers-out-card')).toBeNull();
    // The full AE Calendar lives below the 4-card row.
    expect(await screen.findByTestId('timeoff-calendar')).toBeInTheDocument();
    // The engineer panel still renders below the metric row.
    expect(screen.getByTestId('team-work-panel')).toBeInTheDocument();
    // Personal content is gone — it lives on Tasks/Hours now.
    expect(screen.queryByText('Tasks assigned to you')).toBeNull();
    expect(screen.queryByText('Issues assigned to me')).toBeNull();
    expect(screen.queryByText('Your Work')).toBeNull();
  });

  it('shows a ring only on the team-hours card; the other 3 are plain numbers', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    // Only "Team hours …" keeps a donut ring.
    await waitFor(() => expect(screen.getAllByTestId('conic-ring').length).toBe(1));
    // Three plain-number cards in the overview row (4 cards total, 1 is the ring).
    expect(screen.getAllByTestId('metric-number').length).toBe(3);
  });

  it('shows project category cards on the Project Health tab', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('dashboard-tab-Project Health'));
    expect(await screen.findByTestId('category-card-stcs')).toBeInTheDocument();
  });

  it('embeds the engineer Kanban on the Resource Planning tab', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('dashboard-tab-Resource Planning'));
    expect(await screen.findByText('Team workload')).toBeInTheDocument();
    // The Kanban board mounts as soon as the schedule resolves.
    await waitFor(() =>
      expect(screen.getByTestId('kanban-board')).toBeInTheDocument(),
    );
  });

  it('navigates to Reports when the team-hours card is clicked', async () => {
    // The "Team past due" card was removed from the 4-card overview. The
    // hours card is now the canonical drill-down route from the headline row.
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/reports" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    const card = await waitFor(() =>
      screen.getByRole('button', { name: /team hours/i }),
    );
    fireEvent.click(card);
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/reports'),
    );
  });
});
