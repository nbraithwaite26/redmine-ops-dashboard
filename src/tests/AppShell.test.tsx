import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppShell from '../components/AppShell';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('<AppShell /> banner integration', () => {
  it('renders the mock-mode warning banner by default', async () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div>page</div>
        </AppShell>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('status-banner')).toHaveAttribute('data-severity', 'warning'),
    );
    expect(screen.getByTestId('status-banner')).toHaveTextContent(/mock mode/i);
  });

  it('clicking sync transitions banner: syncing → success', async () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div>page</div>
        </AppShell>
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('status-banner'));

    fireEvent.click(screen.getByRole('button', { name: /sync with redmine/i }));
    // syncWithRedmine resolves on a 120ms mock delay; advance to flush it.
    await waitFor(() =>
      expect(screen.getByTestId('status-banner')).toHaveAttribute('data-severity', 'success'),
    );
  });

  it('success banner auto-reverts to the mock warning', async () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div>page</div>
        </AppShell>
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('status-banner'));
    fireEvent.click(screen.getByRole('button', { name: /sync with redmine/i }));
    await waitFor(() =>
      expect(screen.getByTestId('status-banner')).toHaveAttribute('data-severity', 'success'),
    );
    // 5000ms is the default reversion window.
    vi.advanceTimersByTime(5100);
    await waitFor(() =>
      expect(screen.getByTestId('status-banner')).toHaveAttribute('data-severity', 'warning'),
    );
  });

  it('clicking the TopBar toggle collapses the sidebar', async () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div>page</div>
        </AppShell>
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('primary-sidebar'));
    expect(screen.getByTestId('primary-sidebar')).toHaveAttribute(
      'data-collapsed',
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }));
    expect(screen.getByTestId('primary-sidebar')).toHaveAttribute(
      'data-collapsed',
      'true',
    );
    expect(screen.getByTestId('secondary-nav')).toHaveAttribute(
      'data-collapsed',
      'true',
    );
    expect(window.localStorage.getItem('rod.sidebar.collapsed')).toBe('1');
  });

  it('pressing "[" toggles the sidebar via the keyboard shortcut', async () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div>page</div>
        </AppShell>
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('primary-sidebar'));
    fireEvent.keyDown(window, { key: '[' });
    expect(screen.getByTestId('primary-sidebar')).toHaveAttribute(
      'data-collapsed',
      'true',
    );
    fireEvent.keyDown(window, { key: '[' });
    expect(screen.getByTestId('primary-sidebar')).toHaveAttribute(
      'data-collapsed',
      'false',
    );
  });

  it('restores the collapsed state from localStorage on mount', async () => {
    window.localStorage.setItem('rod.sidebar.collapsed', '1');
    render(
      <MemoryRouter>
        <AppShell>
          <div>page</div>
        </AppShell>
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('primary-sidebar'));
    expect(screen.getByTestId('primary-sidebar')).toHaveAttribute(
      'data-collapsed',
      'true',
    );
  });

  it('dismissing the mock warning hides the banner for the session', async () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div>page</div>
        </AppShell>
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('status-banner'));
    fireEvent.click(screen.getByRole('button', { name: /dismiss banner/i }));
    await waitFor(() => expect(screen.queryByTestId('status-banner')).toBeNull());
    expect(window.sessionStorage.getItem('rod.banner.mockDismissed')).toBe('1');
  });
});
