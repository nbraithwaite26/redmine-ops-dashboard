import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import { buildDashboardMetrics, currentMockUser, mockIssues } from '../data/mockData';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

describe('<Dashboard /> (functional + integration)', () => {
  it('renders the overview heading and the work tabs', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Your Work')).toBeInTheDocument();
    expect(screen.getByText("Your Team's Work")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/Tasks assigned to you/i)).toBeInTheDocument(),
    );
  });

  it('swaps to team metrics and the team panel on the Team\'s Work tab', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Your Team's Work"));
    // Metric cards swap from personal to team-scoped.
    expect(await screen.findByText('Team tasks')).toBeInTheDocument();
    expect(screen.getByText('Engineers')).toBeInTheDocument();
    expect(screen.queryByText('Tasks assigned to you')).toBeNull();
    // The team-members panel renders (and the My Tasks table does not).
    expect(screen.getByTestId('team-work-panel')).toBeInTheDocument();
    expect(screen.queryByText('Issues assigned to me')).toBeNull();
  });

  it('shows project category cards on the Project Health tab', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Project Health'));
    expect(await screen.findByTestId('category-card-stcs')).toBeInTheDocument();
  });

  it('embeds the team Gantt on the Resource Planning tab', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Resource Planning'));
    expect(await screen.findByText('Team workload')).toBeInTheDocument();
  });

  // Integration: the page should render exactly the 8 cards produced by
  // buildDashboardMetrics — proves the data-driven refactor is wired up.
  it('renders one card per metric returned by buildDashboardMetrics', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/Tasks assigned to you/i)).toBeInTheDocument(),
    );

    // Use a sample input that resembles what the page will load to know the
    // expected titles. We don't need the exact same data — only that the
    // titles produced by the builder all appear in the DOM.
    const expected = buildDashboardMetrics({
      myIssues: mockIssues.filter((i) => i.assignee?.id === currentMockUser.id),
      allIssues: mockIssues,
      pastDueCount: 0,
      weeklyHours: { logged: 0, target: 40 },
      teamHours: { logged: 0, target: 360 },
    });
    expect(expected).toHaveLength(8);
    for (const m of expected) {
      expect(screen.getByText(m.title)).toBeInTheDocument();
    }
  });

  // Integration: clicking a card with a route should navigate to that route.
  it('navigates to the Past Due page when the Past due tasks card is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/past-due" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    const card = await waitFor(() =>
      screen.getByRole('button', { name: /past due tasks/i }),
    );
    fireEvent.click(card);
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/past-due'),
    );
  });

  // Integration: every metric card on the dashboard uses the conic-gradient
  // ring visual (and there are 8 of them).
  it('renders a conic-gradient ring per metric card', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('conic-ring').length).toBeGreaterThan(0),
    );
    expect(screen.getAllByTestId('conic-ring')).toHaveLength(8);
  });

  // Integration: My Tasks table renders below the cards and includes a row
  // for one of the seeded issues.
  it('renders the My Tasks table with at least one seeded issue', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/Issues assigned to me/i)).toBeInTheDocument(),
    );
    // The seed data has #1024 assigned to the current mock user.
    expect(await screen.findByText(/#1024/)).toBeInTheDocument();
  });
});
