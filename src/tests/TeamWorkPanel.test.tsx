import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TeamWorkPanel from '../components/TeamWorkPanel';

function renderPanel() {
  return render(
    <MemoryRouter>
      <TeamWorkPanel />
    </MemoryRouter>,
  );
}

describe('<TeamWorkPanel />', () => {
  beforeEach(() => {
    localStorage.clear();
    // Force prefers-reduced-motion so Framer's layout/exit animations resolve
    // synchronously in jsdom (which has no real layout to measure).
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

  it('renders an engineer card grid once the schedule loads', async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getAllByTestId(/^member-card-/).length).toBeGreaterThan(0),
    );
  });

  it('expands a card into the full-screen detail view', async () => {
    renderPanel();
    const card = (await screen.findAllByTestId(/^member-card-/))[0];
    const id = card.getAttribute('data-testid')!.replace('member-card-', '');

    fireEvent.click(card);
    const detail = await screen.findByTestId(`member-detail-${id}`);
    expect(detail).toBeInTheDocument();
    expect(within(detail).getByText('Projects')).toBeInTheDocument();
    expect(screen.getByTestId(`member-detail-close-${id}`)).toBeInTheDocument();
  });

  it('toggling an engineer off in the selector hides their card', async () => {
    renderPanel();
    const card = (await screen.findAllByTestId(/^member-card-/))[0];
    const id = Number(card.getAttribute('data-testid')!.replace('member-card-', ''));

    fireEvent.click(screen.getByTestId('team-selector-toggle'));
    fireEvent.click(screen.getByTestId(`team-selector-option-${id}`));

    await waitFor(() =>
      expect(screen.queryByTestId(`member-card-${id}`)).toBeNull(),
    );
  });
});
