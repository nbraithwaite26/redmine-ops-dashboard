import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Settings from '../pages/Settings';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  document.documentElement.classList.remove('dark');
  vi.useRealTimers();
});

describe('theme integration', () => {
  it('clicking the TopBar toggle adds the dark class to <html>', async () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div>page</div>
        </AppShell>
      </MemoryRouter>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    await waitFor(() => screen.getByTestId('theme-toggle'));
    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('rod.theme')).toBe('dark');
  });

  it('pressing "]" toggles theme via the keyboard shortcut', async () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div>page</div>
        </AppShell>
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('theme-toggle'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    fireEvent.keyDown(window, { key: ']' });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    fireEvent.keyDown(window, { key: ']' });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('restores the saved theme on mount', async () => {
    window.localStorage.setItem('rod.theme', 'dark');
    render(
      <MemoryRouter>
        <AppShell>
          <div>page</div>
        </AppShell>
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('theme-toggle'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByTestId('theme-toggle')).toHaveAttribute(
      'data-effective-theme',
      'dark',
    );
  });

  it('Settings page Appearance section toggles theme alongside TopBar', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('appearance-section')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('theme-option-dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('rod.theme')).toBe('dark');
    fireEvent.click(screen.getByTestId('theme-option-light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem('rod.theme')).toBe('light');
    fireEvent.click(screen.getByTestId('theme-option-system'));
    expect(window.localStorage.getItem('rod.theme')).toBe('system');
  });

  it('Settings effective-theme label updates with the choice', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('theme-option-dark'));
    expect(screen.getByTestId('effective-theme')).toHaveTextContent('dark');
    fireEvent.click(screen.getByTestId('theme-option-light'));
    expect(screen.getByTestId('effective-theme')).toHaveTextContent('light');
  });
});
