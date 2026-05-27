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
