import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Admin from '../pages/Admin';

describe('<Admin /> tabbed surface', () => {
  beforeEach(() => {
    localStorage.removeItem('rod.admin.mockDegraded');
  });
  afterEach(() => {
    localStorage.removeItem('rod.admin.mockDegraded');
  });

  it('defaults to the Users tab when no tab query is present', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Admin />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('panel-users')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('tab-users')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('panel-permissions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-history')).not.toBeInTheDocument();
  });

  it('honors ?tab=permissions on initial mount', async () => {
    render(
      <MemoryRouter initialEntries={['/admin?tab=permissions']}>
        <Admin />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('panel-permissions')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('tab-permissions')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('clicking a tab swaps the rendered panel', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Admin />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('panel-users'));
    fireEvent.click(screen.getByTestId('tab-history'));
    await waitFor(() =>
      expect(screen.getByTestId('panel-history')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('panel-users')).not.toBeInTheDocument();
  });

  it('ArrowRight advances the tablist (wai-aria roving tabindex)', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Admin />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('panel-users'));
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    await waitFor(() =>
      expect(screen.getByTestId('panel-permissions')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('tab-permissions')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('tab-users')).toHaveAttribute('tabindex', '-1');
  });

  it('renders Redmine users in the Users tab from the mock backend', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Admin />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('panel-users'));
    expect(screen.getByText('Avery Stone')).toBeInTheDocument();
    expect(screen.getByText('astone@example.com')).toBeInTheDocument();
  });

  it('shows the degraded banner with degradedReason when /users 403s', async () => {
    localStorage.setItem('rod.admin.mockDegraded', '1');
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Admin />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('users-degraded')).toBeInTheDocument(),
    );
    expect(screen.getByText(/admin-only/i)).toBeInTheDocument();
    // No table, no rows.
    expect(screen.queryByTestId('panel-users')).not.toBeInTheDocument();
  });

  it('History tab filters narrow the event list', async () => {
    render(
      <MemoryRouter initialEntries={['/admin?tab=history']}>
        <Admin />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('panel-history'));
    // Unfiltered: both sync and login pills visible.
    expect(screen.getAllByText('sync').length).toBeGreaterThan(0);
    expect(screen.getAllByText('login').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByTestId('history-kind'), {
      target: { value: 'login' },
    });
    await waitFor(() => {
      expect(screen.queryByText('sync')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('login').length).toBeGreaterThan(0);
  });

  it('History tab status filter further narrows results', async () => {
    render(
      <MemoryRouter initialEntries={['/admin?tab=history']}>
        <Admin />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('panel-history'));
    fireEvent.change(screen.getByTestId('history-status'), {
      target: { value: 'error' },
    });
    await waitFor(() => {
      // Only the one mock error-status sync event remains.
      expect(screen.getByText(/Upstream 503/)).toBeInTheDocument();
    });
    expect(screen.queryByText('login')).not.toBeInTheDocument();
  });

  it('Permissions tab renders the project × user matrix', async () => {
    render(
      <MemoryRouter initialEntries={['/admin?tab=permissions']}>
        <Admin />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('panel-permissions'));
    expect(screen.getByText('Project A')).toBeInTheDocument();
    expect(screen.getByText('Project B')).toBeInTheDocument();
    expect(screen.getByText('Project C')).toBeInTheDocument();
    expect(screen.getByText('Avery Stone')).toBeInTheDocument();
  });
});
