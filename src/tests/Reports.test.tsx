import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Reports from '../pages/Reports';

describe('<Reports /> (tabbed)', () => {
  it('defaults to the KPI tab when no tab query is present', async () => {
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <Reports />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('panel-kpi')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('tab-kpi')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-issues')).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByTestId('panel-issues')).not.toBeInTheDocument();
  });

  it('honors ?tab=issues on initial mount', async () => {
    render(
      <MemoryRouter initialEntries={['/reports?tab=issues']}>
        <Reports />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('panel-issues')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('tab-issues')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('panel-kpi')).not.toBeInTheDocument();
  });

  it('clicking a tab swaps the rendered panel', async () => {
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <Reports />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('panel-kpi'));
    fireEvent.click(screen.getByTestId('tab-issues'));
    await waitFor(() =>
      expect(screen.getByTestId('panel-issues')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('panel-kpi')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tab-kpi'));
    await waitFor(() =>
      expect(screen.getByTestId('panel-kpi')).toBeInTheDocument(),
    );
  });

  it('Arrow-right moves selection to the next tab (a11y wai-aria pattern)', async () => {
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <Reports />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('panel-kpi'));
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    await waitFor(() =>
      expect(screen.getByTestId('panel-issues')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('tab-issues')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('Arrow-left wraps to the last tab from the first', async () => {
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <Reports />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('panel-kpi'));
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(screen.getByTestId('panel-issues')).toBeInTheDocument(),
    );
  });

  it('tabs follow the roving-tabindex pattern (active tab gets tabIndex=0)', async () => {
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <Reports />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('panel-kpi'));
    expect(screen.getByTestId('tab-kpi')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('tab-issues')).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    await waitFor(() =>
      expect(screen.getByTestId('tab-issues')).toHaveAttribute('tabindex', '0'),
    );
    expect(screen.getByTestId('tab-kpi')).toHaveAttribute('tabindex', '-1');
  });
});
