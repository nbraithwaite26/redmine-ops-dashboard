import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Tasks from '../pages/Tasks';
import Calendar from '../pages/Calendar';
import Hours from '../pages/Hours';
import MyHours from '../pages/MyHours';
import TeamHours from '../pages/TeamHours';
import AllProjects from '../pages/AllProjects';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

describe('<Tasks /> page', () => {
  it('renders both My tasks and Team tasks sections', async () => {
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>,
    );
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('My tasks')).toBeInTheDocument(),
    );
    expect(screen.getByText(/team tasks/i)).toBeInTheDocument();
  });

  it('renders the GroupedTaskTable below My tasks', async () => {
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('grouped-task-table')).toBeInTheDocument(),
    );
  });
});

describe('<Calendar /> page', () => {
  it('renders a calendar grid', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>,
    );
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('calendar-grid')).toBeInTheDocument(),
    );
  });

  it('navigates between months', async () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('calendar-grid'));
    const monthBefore = screen.getByTestId('calendar-grid').querySelector('header')?.textContent;
    fireEvent.click(screen.getByRole('button', { name: /next month/i }));
    const monthAfter = screen.getByTestId('calendar-grid').querySelector('header')?.textContent;
    expect(monthBefore).not.toEqual(monthAfter);
  });
});

describe('<Hours /> landing page', () => {
  it('renders both drill-in cards', async () => {
    render(
      <MemoryRouter>
        <Hours />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/my hours this week/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/team hours this week/i)).toBeInTheDocument();
  });

  it('clicking the personal card navigates to /hours/me', async () => {
    render(
      <MemoryRouter initialEntries={['/hours']}>
        <Routes>
          <Route path="/hours" element={<Hours />} />
          <Route path="/hours/me" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    const card = await waitFor(() =>
      screen.getByRole('button', { name: /my hours this week/i }),
    );
    fireEvent.click(card);
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/hours/me'),
    );
  });

  it('clicking the team card navigates to /hours/team', async () => {
    render(
      <MemoryRouter initialEntries={['/hours']}>
        <Routes>
          <Route path="/hours" element={<Hours />} />
          <Route path="/hours/team" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    const card = await waitFor(() =>
      screen.getByRole('button', { name: /team hours this week/i }),
    );
    fireEvent.click(card);
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/hours/team'),
    );
  });
});

describe('<MyHours /> page', () => {
  it('renders headline, gauge, and entries table', async () => {
    render(
      <MemoryRouter>
        <MyHours />
      </MemoryRouter>,
    );
    expect(screen.getByText('My hours this week')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/recent entries/i)).toBeInTheDocument(),
    );
  });
});

describe('<TeamHours /> page', () => {
  it('renders headline + grouped table', async () => {
    render(
      <MemoryRouter>
        <TeamHours />
      </MemoryRouter>,
    );
    expect(screen.getByText('Team hours this week')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('grouped-task-table')).toBeInTheDocument(),
    );
  });
});

describe('<AllProjects /> page', () => {
  it('renders the project cards', async () => {
    render(
      <MemoryRouter>
        <AllProjects />
      </MemoryRouter>,
    );
    expect(screen.getByText('All projects')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/showing \d+ of \d+/i)).toBeInTheDocument();
    });
  });

  it('filters by query', async () => {
    render(
      <MemoryRouter>
        <AllProjects />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/Aircraft Retrofit Planning/i)).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText(/filter projects/i), {
      target: { value: 'aircraft' },
    });
    expect(screen.getByText(/Aircraft Retrofit Planning/i)).toBeInTheDocument();
    expect(screen.queryByText('Customer Support Requests')).not.toBeInTheDocument();
  });

  it('filters by status', async () => {
    render(
      <MemoryRouter>
        <AllProjects />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/Certification Review/i)).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText(/filter by status/i), {
      target: { value: 'At Risk' },
    });
    expect(screen.getByText(/Certification Review/i)).toBeInTheDocument();
  });
});
