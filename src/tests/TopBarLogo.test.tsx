import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopBar from '../components/TopBar';

const baseProps = {
  apiConnected: false,
  mockMode: true,
  isSyncing: false,
  onClickSync: () => {},
  sidebarCollapsed: false,
  onToggleSidebar: () => {},
  onToggleTheme: () => {},
};

describe('<TopBar /> theme-aware logo', () => {
  it('loads logo.png in light mode', () => {
    render(<TopBar {...baseProps} effectiveTheme="light" />);
    const img = screen.getByTestId('logo-image');
    expect(img).toHaveAttribute('data-logo-variant', 'logo.png');
    expect(img.getAttribute('src')).toMatch(/logo\.png$/);
  });

  it('loads logo-white.png in dark mode', () => {
    render(<TopBar {...baseProps} effectiveTheme="dark" />);
    const img = screen.getByTestId('logo-image');
    expect(img).toHaveAttribute('data-logo-variant', 'logo-white.png');
    expect(img.getAttribute('src')).toMatch(/logo-white\.png$/);
  });

  it('swaps the variant when effectiveTheme prop changes', () => {
    const { rerender } = render(<TopBar {...baseProps} effectiveTheme="light" />);
    expect(screen.getByTestId('logo-image')).toHaveAttribute(
      'data-logo-variant',
      'logo.png',
    );
    rerender(<TopBar {...baseProps} effectiveTheme="dark" />);
    expect(screen.getByTestId('logo-image')).toHaveAttribute(
      'data-logo-variant',
      'logo-white.png',
    );
  });
});
