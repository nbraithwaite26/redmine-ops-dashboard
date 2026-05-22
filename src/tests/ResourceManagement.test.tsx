import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResourceManagement from '../pages/ResourceManagement';
import { currentMockUser } from '../data/mockData';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('<ResourceManagement /> (single-view legacy routes)', () => {
  it('shows only the personal section when view="personal"', async () => {
    render(
      <MemoryRouter>
        <ResourceManagement view="personal" />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getAllByText(currentMockUser.name).length).toBeGreaterThan(0),
    );
    expect(screen.getByTestId('section-personal')).toBeInTheDocument();
    expect(screen.queryByTestId('section-team')).not.toBeInTheDocument();
  });

  it('shows only the team section when view="team"', async () => {
    render(
      <MemoryRouter>
        <ResourceManagement view="team" />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Jordan Lee')).toBeInTheDocument());
    expect(screen.getByTestId('section-team')).toBeInTheDocument();
    expect(screen.queryByTestId('section-personal')).not.toBeInTheDocument();
  });
});

describe('<ResourceManagement /> (default reorderable view)', () => {
  it('renders both sections in default order with reorder arrows enabled', async () => {
    render(
      <MemoryRouter>
        <ResourceManagement />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('section-personal'));
    const personalIdx = screen
      .getAllByText(/personal — my gantt|team — full workload/i)
      .findIndex((el) => el.textContent?.toLowerCase().includes('personal'));
    expect(personalIdx).toBe(0); // personal first by default
  });

  it('move-down on Personal swaps it below Team and persists', async () => {
    render(
      <MemoryRouter>
        <ResourceManagement />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('section-personal'));
    fireEvent.click(
      screen.getByRole('button', { name: /move personal — my gantt down/i }),
    );
    const orderAfter = screen
      .getAllByText(/personal — my gantt|team — full workload/i)
      .map((el) => el.textContent ?? '');
    // The first occurrence should now be the Team title.
    expect(orderAfter[0]?.toLowerCase()).toContain('team');
    // Persisted to localStorage.
    expect(window.localStorage.getItem('rod.resources.order')).toBe(
      JSON.stringify(['team', 'personal']),
    );
  });

  it('move-up at top of order is disabled', async () => {
    render(
      <MemoryRouter>
        <ResourceManagement />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('section-personal'));
    expect(
      screen.getByRole('button', { name: /move personal — my gantt up/i }),
    ).toBeDisabled();
  });
});
