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

  it('defaults to the Team tab: team metrics + the team panel', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    // Team-scoped metric cards.
    expect(await screen.findByText('Team tasks')).toBeInTheDocument();
    expect(screen.getByText('Engineers')).toBeInTheDocument();
    // The engineer panel renders.
    expect(screen.getByTestId('team-work-panel')).toBeInTheDocument();
    // Personal content is gone — it lives on Tasks/Hours now.
    expect(screen.queryByText('Tasks assigned to you')).toBeNull();
    expect(screen.queryByText('Issues assigned to me')).toBeNull();
    expect(screen.queryByText('Your Work')).toBeNull();
  });

  it('shows a ring only on the team-hours card; the rest are plain numbers', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    // Only "Team hours …" keeps a donut ring.
    await waitFor(() => expect(screen.getAllByTestId('conic-ring').length).toBe(1));
    // The other 7 team metric cards render a plain number.
    expect(screen.getAllByTestId('metric-number').length).toBe(7);
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

  it('embeds the team Gantt on the Resource Planning tab', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('dashboard-tab-Resource Planning'));
    expect(await screen.findByText('Team workload')).toBeInTheDocument();
  });

  it('navigates to Past Due when the team past-due card is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/past-due" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    const card = await waitFor(() =>
      screen.getByRole('button', { name: /team past due/i }),
    );
    fireEvent.click(card);
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/past-due'),
    );
  });
});
