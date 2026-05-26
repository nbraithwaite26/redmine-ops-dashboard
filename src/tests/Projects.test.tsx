import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Projects from '../pages/Projects';

function renderProjects() {
  return render(
    <MemoryRouter initialEntries={['/projects']}>
      <Routes>
        <Route path="/projects" element={<Projects />} />
        <Route
          path="/projects/category/:slug"
          element={<div data-testid="category-page">category</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('<Projects /> category dashboard', () => {
  it('defaults to the AIRCRAFT ENGINEERING source and shows its category cards', async () => {
    renderProjects();
    await waitFor(() =>
      expect(screen.getByTestId('category-card-stcs')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('category-card-custom-engineering-services')).toBeInTheDocument();
    expect(
      screen.getByTestId('category-card-aircraft-engineering-continuous-improvement'),
    ).toBeInTheDocument();
    // Hero shows the resolved root name.
    expect(screen.getByRole('heading', { name: 'AIRCRAFT ENGINEERING' })).toBeInTheDocument();
  });

  it('pins the three named categories first, in order', async () => {
    renderProjects();
    await waitFor(() => expect(screen.getByTestId('category-card-stcs')).toBeInTheDocument());
    const cards = screen.getAllByTestId(/^category-card-/);
    expect(cards.slice(0, 3).map((c) => c.getAttribute('data-testid'))).toEqual([
      'category-card-custom-engineering-services',
      'category-card-stcs',
      'category-card-aircraft-engineering-continuous-improvement',
    ]);
  });

  it('renders the headline metrics row', async () => {
    renderProjects();
    await waitFor(() => expect(screen.getByTestId('projects-metrics')).toBeInTheDocument());
    const metrics = screen.getByTestId('projects-metrics');
    expect(within(metrics).getByText('Total projects')).toBeInTheDocument();
    expect(within(metrics).getByText('Categories')).toBeInTheDocument();
    expect(within(metrics).getByText('At risk')).toBeInTheDocument();
  });

  it('clicking a category card navigates to the drill-down route', async () => {
    renderProjects();
    await waitFor(() => expect(screen.getByTestId('category-card-stcs')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('category-card-stcs'));
    expect(screen.getByTestId('category-page')).toBeInTheDocument();
  });

  it('swapping the project source re-derives the categories', async () => {
    renderProjects();
    await waitFor(() => expect(screen.getByTestId('category-card-stcs')).toBeInTheDocument());
    // Switch the source to STCs itself — its children become the categories.
    const picker = screen.getByLabelText('Project source') as HTMLSelectElement;
    const stcOption = Array.from(picker.options).find((o) => o.textContent === 'STCs')!;
    fireEvent.change(picker, { target: { value: stcOption.value } });
    // STC's children are leaf projects (0 sub-projects) and unpinned, so they
    // land under the "empty categories" disclosure — reveal it first.
    await waitFor(() =>
      expect(screen.getByTestId('toggle-empty-categories')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('toggle-empty-categories'));
    expect(screen.getByTestId('category-card-stc-cabin-reconfiguration')).toBeInTheDocument();
    // The old top-level STC card is gone now that STC is the root.
    expect(screen.queryByTestId('category-card-custom-engineering-services')).toBeNull();
  });
});
