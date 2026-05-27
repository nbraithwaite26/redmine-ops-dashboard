import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AllProjects from '../pages/AllProjects';

describe('project card → spring-up detail', () => {
  beforeEach(() => {
    // Reduced motion so Framer layout/exit resolves in jsdom.
    window.matchMedia = (query: string) =>
      ({
        matches: query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  });

  it('opens the project task list when a project card is clicked', async () => {
    render(
      <MemoryRouter>
        <AllProjects />
      </MemoryRouter>,
    );
    const card = (await screen.findAllByTestId(/^project-card-/))[0];
    const id = card.getAttribute('data-testid')!.replace('project-card-', '');

    fireEvent.click(card);

    const detail = await screen.findByTestId(`project-detail-${id}`);
    expect(within(detail).getByText(/Related tasks/)).toBeInTheDocument();
    expect(screen.getByTestId(`project-detail-close-${id}`)).toBeInTheDocument();
  });

  it('lists the project tasks (or an empty state) after loading', async () => {
    render(
      <MemoryRouter>
        <AllProjects />
      </MemoryRouter>,
    );
    const card = (await screen.findAllByTestId(/^project-card-/))[0];
    const id = card.getAttribute('data-testid')!.replace('project-card-', '');
    fireEvent.click(card);

    await waitFor(() => {
      const rendered =
        screen.queryByTestId(`project-tasks-${id}`) !== null ||
        screen.queryByTestId(`project-tasks-empty-${id}`) !== null;
      expect(rendered).toBe(true);
    });
  });
});
