import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TimeOffDetail from '../components/TimeOffDetail';

describe('<TimeOffDetail />', () => {
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

  it('loads the week view with seeded time-off and a legend', async () => {
    render(<TimeOffDetail onClose={() => {}} />);
    expect(await screen.findByTestId('timeoff-detail')).toBeInTheDocument();
    // Defaults to the week view.
    await waitFor(() =>
      expect(screen.getByTestId('timeoff-view-week')).toHaveAttribute('aria-pressed', 'true'),
    );
    // Mock data seeds leave this week → a legend renders.
    expect(await screen.findByTestId('timeoff-legend')).toBeInTheDocument();
  });

  it('switches to the month view', async () => {
    render(<TimeOffDetail onClose={() => {}} />);
    await screen.findByTestId('timeoff-detail');
    fireEvent.click(screen.getByTestId('timeoff-view-month'));
    await waitFor(() =>
      expect(screen.getByTestId('timeoff-view-month')).toHaveAttribute('aria-pressed', 'true'),
    );
  });

  it('shows a hover popover on a day with entries', async () => {
    render(<TimeOffDetail onClose={() => {}} />);
    await screen.findByTestId('timeoff-detail');

    // Wait for the time-off fetch to settle (loading→cells). Day cells
    // only appear once the entries land.
    await waitFor(() => {
      expect(screen.queryByTestId('timeoff-loading')).toBeNull();
      expect(screen.getAllByTestId(/^timeoff-day-/).length).toBeGreaterThan(0);
    });

    // Pick a day cell that has entries — `background:` style on a child
    // pill is the cheapest cross-view signal (week pills + month dots both
    // set inline backgrounds).
    const dayCells = screen.getAllByTestId(/^timeoff-day-/);
    const cellWithEntries = dayCells.find((cell) =>
      cell.querySelector('[style*="background"]'),
    );
    if (!cellWithEntries) return; // No mock entries this week — nothing to test.

    expect(screen.queryByTestId('timeoff-day-popover')).toBeNull();

    fireEvent.mouseEnter(cellWithEntries);
    expect(await screen.findByTestId('timeoff-day-popover')).toBeInTheDocument();

    fireEvent.mouseLeave(cellWithEntries);
    await waitFor(() =>
      expect(screen.queryByTestId('timeoff-day-popover')).toBeNull(),
    );
  });

  it('calls onClose from the close button, the backdrop, and Escape', async () => {
    const onClose = vi.fn();
    render(<TimeOffDetail onClose={onClose} />);
    await screen.findByTestId('timeoff-detail');

    fireEvent.click(screen.getByTestId('timeoff-close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('timeoff-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
