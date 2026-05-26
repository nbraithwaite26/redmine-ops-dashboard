import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Tasks from '../pages/Tasks';
import Calendar from '../pages/Calendar';
import MyHours from '../pages/MyHours';
import TeamHours from '../pages/TeamHours';
import AllProjects from '../pages/AllProjects';

// Hours landing tests live in Hours.test.tsx since the page was rewritten
// from a two-card drill-in into the user-cards layout. MyHours / TeamHours
// pages still render fine standalone; only the routing into them changed
// (App.tsx now redirects /hours/me and /hours/team to /hours).

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
