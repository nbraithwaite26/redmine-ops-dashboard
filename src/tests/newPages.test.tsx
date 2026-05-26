import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Tasks from '../pages/Tasks';
import Calendar from '../pages/Calendar';
import AllProjects from '../pages/AllProjects';

// Hours coverage lives in Hours.test.tsx. The old MyHours / TeamHours
// pages were deleted in Phase 3 cleanup — /hours/me and /hours/team
// redirect to /hours via App.tsx.

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

  it('auto-opens the ticket drawer when ?id= deep-links a known issue', async () => {
    // 1025 exists in the mock fixture (see src/data/mockData.ts).
    render(
      <MemoryRouter initialEntries={['/tasks?id=1025']}>
        <Tasks />
      </MemoryRouter>,
    );

    // Drawer renders the issue's "#id · subject" header.
    await waitFor(() =>
      expect(
        screen.getByText(/^#1025 · /),
      ).toBeInTheDocument(),
    );
  });

  it('does not crash when ?id= points at an unknown issue', async () => {
    render(
      <MemoryRouter initialEntries={['/tasks?id=999999']}>
        <Tasks />
      </MemoryRouter>,
    );
    // Page renders normally; no drawer opens.
    await waitFor(() => expect(screen.getByText('Tasks')).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
