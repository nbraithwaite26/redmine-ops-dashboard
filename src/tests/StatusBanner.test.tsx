import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StatusBanner from '../components/StatusBanner';

describe('<StatusBanner />', () => {
  it.each(['info', 'success', 'warning', 'error'] as const)(
    'renders severity=%s with the right data attribute',
    (severity) => {
      render(<StatusBanner severity={severity} message={`${severity} message`} />);
      const banner = screen.getByTestId('status-banner');
      expect(banner).toHaveAttribute('data-severity', severity);
      expect(banner).toHaveTextContent(`${severity} message`);
    },
  );

  it('omits the dismiss button when onDismiss is not provided', () => {
    render(<StatusBanner severity="warning" message="x" />);
    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
  });

  it('shows the dismiss button when onDismiss is provided and invokes it', () => {
    const onDismiss = vi.fn();
    render(<StatusBanner severity="warning" message="x" onDismiss={onDismiss} />);
    const btn = screen.getByRole('button', { name: /dismiss banner/i });
    fireEvent.click(btn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
