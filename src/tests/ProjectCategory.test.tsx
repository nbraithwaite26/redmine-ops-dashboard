import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectCategory from '../pages/ProjectCategory';

function renderAt(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/projects/category/${slug}`]}>
      <Routes>
        <Route path="/projects/category/:slug" element={<ProjectCategory />} />
        <Route path="/projects" element={<div data-testid="projects-landing">Projects</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('<ProjectCategory /> drill-down', () => {
  it('lists all projects under the STC category', async () => {
    renderAt('stcs');
    await waitFor(() => expect(screen.getByText('STCs')).toBeInTheDocument());
    // Mock STC subtree has 4 descendant projects.
    await waitFor(() =>
      expect(screen.getByText(/Showing 4 of 4/)).toBeInTheDocument(),
    );
    expect(screen.getByText('STC — Cabin Reconfiguration')).toBeInTheDocument();
    expect(screen.getByText('STC — Avionics Upgrade')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    renderAt('stcs');
    await waitFor(() => expect(screen.getByText(/Showing 4 of 4/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'Closed' },
    });
    // Only the Winglet Retrofit is Closed.
    await waitFor(() => expect(screen.getByText(/Showing 1 of 4/)).toBeInTheDocument());
    expect(screen.getByText('STC — Winglet Retrofit')).toBeInTheDocument();
  });

  it('filters by search query', async () => {
    renderAt('stcs');
    await waitFor(() => expect(screen.getByText(/Showing 4 of 4/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Filter projects'), {
      target: { value: 'avionics' },
    });
    await waitFor(() => expect(screen.getByText(/Showing 1 of 4/)).toBeInTheDocument());
  });

  it('shows a breadcrumb back to Projects', async () => {
    renderAt('stcs');
    await waitFor(() => expect(screen.getByText('STCs')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Projects/ })).toHaveAttribute(
      'href',
      '/projects',
    );
  });

  it('shows a not-found state for an unknown slug', async () => {
    renderAt('does-not-exist');
    await waitFor(() =>
      expect(screen.getByText(/No category found for/)).toBeInTheDocument(),
    );
  });
});
