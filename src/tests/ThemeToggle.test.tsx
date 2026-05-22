import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ThemeToggle from '../components/ThemeToggle';

describe('<ThemeToggle />', () => {
  it('renders a Moon icon and "Switch to dark" label when in light mode', () => {
    render(<ThemeToggle effectiveTheme="light" onToggle={() => {}} />);
    const btn = screen.getByTestId('theme-toggle');
    expect(btn).toHaveAttribute('aria-label', 'Switch to dark mode');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveAttribute('data-effective-theme', 'light');
  });

  it('renders a Sun icon and "Switch to light" label when in dark mode', () => {
    render(<ThemeToggle effectiveTheme="dark" onToggle={() => {}} />);
    const btn = screen.getByTestId('theme-toggle');
    expect(btn).toHaveAttribute('aria-label', 'Switch to light mode');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveAttribute('data-effective-theme', 'dark');
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<ThemeToggle effectiveTheme="light" onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('honors a custom label override', () => {
    render(<ThemeToggle effectiveTheme="light" onToggle={() => {}} label="Flip theme" />);
    expect(screen.getByLabelText('Flip theme')).toBeInTheDocument();
  });
});
