import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const EXPECTED_LABELS = [
  'Home',
  'Dashboard',
  'Tasks',
  'Calendar',
  'Hours',
  'Directory',
  'All Projects',
  'Projects',
  'Settings',
];

describe('<Sidebar /> (collapsed vs expanded)', () => {
  it('renders 9 primary-rail items', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );
    EXPECTED_LABELS.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('hides text labels when collapsed but keeps title attributes', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={true} onToggle={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('primary-sidebar')).toHaveAttribute(
      'data-collapsed',
      'true',
    );
    EXPECTED_LABELS.forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
      expect(screen.getByTitle(label)).toBeInTheDocument();
    });
  });

  it('popout/toggle button is visible when expanded and fires onToggle', () => {
    const onToggle = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={onToggle} />
      </MemoryRouter>,
    );
    const popout = screen.getByTestId('sidebar-popout');
    expect(popout).toBeInTheDocument();
    expect(popout).toHaveAttribute('aria-label', 'Collapse sidebar');
    fireEvent.click(popout);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('popout/toggle button stays visible when collapsed (CR #13)', () => {
    const onToggle = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar collapsed={true} onToggle={onToggle} />
      </MemoryRouter>,
    );
    const popout = screen.getByTestId('sidebar-popout');
    expect(popout).toBeInTheDocument();
    expect(popout).toHaveAttribute('aria-label', 'Expand sidebar');
    expect(popout).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(popout);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('Projects does not highlight when on /projects/all', () => {
    render(
      <MemoryRouter initialEntries={['/projects/all']}>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );
    const projectsLink = screen.getByRole('link', { name: 'Projects' });
    const allProjectsLink = screen.getByRole('link', { name: 'All Projects' });
    expect(projectsLink.className).not.toContain('sidebar-link-active');
    expect(allProjectsLink.className).toContain('sidebar-link-active');
  });

  it('Projects highlights when on /projects exactly', () => {
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );
    const projectsLink = screen.getByRole('link', { name: 'Projects' });
    expect(projectsLink.className).toContain('sidebar-link-active');
  });

  it('uses the brand-surface CSS variable for the background', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );
    const aside = screen.getByTestId('primary-sidebar');
    // Inline style references the CSS variable so theme can swap it.
    expect(aside.getAttribute('style')).toContain('--brand-surface');
  });
});
