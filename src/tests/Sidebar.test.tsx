import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

// Top-level rail labels. Reports + Directory are turned off; Past Due is
// no longer a sub-link of Tasks. All Projects + Project Builder are
// sub-links of Projects; Timesheet + Time Tracking + Resource Management
// are sub-links of Hours.
const TOP_LEVEL_LABELS = [
  'Home',
  'Dashboard',
  'Tasks',
  'Calendar',
  'Hours',
  'Projects',
  'Settings',
];

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('<Sidebar /> (collapsed vs expanded)', () => {
  it('renders the top-level rail items', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );
    TOP_LEVEL_LABELS.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('shows All Projects as a sub-link of Projects (group open by default)', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'All Projects' })).toHaveAttribute(
      'href',
      '/projects/all',
    );
  });

  it('shows Time Tracking and Resource Management as sub-links of Hours', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Time Tracking' })).toHaveAttribute(
      'href',
      '/time',
    );
    expect(screen.getByRole('link', { name: 'Resource Management' })).toHaveAttribute(
      'href',
      '/resources',
    );
  });

  it('toggling the Hours group hides/shows its sub-links', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Time Tracking' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('sidebar-group-toggle-hours'));
    expect(screen.queryByRole('link', { name: 'Time Tracking' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Resource Management' })).not.toBeInTheDocument();
  });

  it('Projects exposes Project Builder; turned-off pages are gone from the rail', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Project Builder' })).toHaveAttribute(
      'href',
      '/project-builder',
    );
    // Past Due, Reports, and Directory are intentionally hidden for now.
    expect(screen.queryByRole('link', { name: 'Past Due' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Directory' })).not.toBeInTheDocument();
  });

  it('toggling the Projects group hides/shows its sub-links', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'All Projects' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('sidebar-group-toggle-projects'));
    expect(screen.queryByRole('link', { name: 'All Projects' })).not.toBeInTheDocument();
    // And the group state persists to localStorage.
    expect(localStorage.getItem('rod.sidebar.groups')).toContain('/projects');
  });

  it('hides text labels and sub-links when collapsed but keeps top-level titles', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={true} onToggle={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('primary-sidebar')).toHaveAttribute('data-collapsed', 'true');
    TOP_LEVEL_LABELS.forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
      expect(screen.getByTitle(label)).toBeInTheDocument();
    });
    // Q6: sub-links are not rendered at all when the rail is collapsed.
    expect(screen.queryByRole('link', { name: 'All Projects' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-group-toggle-projects')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Time Tracking' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Resource Management' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-group-toggle-hours')).not.toBeInTheDocument();
  });

  it('popout/toggle button is visible when expanded and fires onToggle', () => {
    const onToggle = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={onToggle} />
      </MemoryRouter>,
    );
    const popout = screen.getByTestId('sidebar-popout');
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
    expect(aside.getAttribute('style')).toContain('--brand-surface');
  });
});
