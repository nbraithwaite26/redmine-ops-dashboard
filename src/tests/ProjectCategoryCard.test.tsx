import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProjectCategoryCard from '../components/ProjectCategoryCard';
import type { ProjectCategory } from '../services/projectSource';
import type { Project } from '../types/redmine';

function makeCategory(name: string, slug: string, totalProjects: number): ProjectCategory {
  const project: Project = {
    id: 1,
    name,
    identifier: slug,
    description: `${name} description`,
    status: 'Active',
    parentProjectId: 2,
    createdOn: '2026-01-01',
    updatedOn: '2026-01-01',
  };
  return { project, slug, totalProjects };
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

describe('<ProjectCategoryCard />', () => {
  it('renders the category name, description, and project count', () => {
    render(
      <MemoryRouter>
        <ProjectCategoryCard category={makeCategory('STC', 'stc', 4)} />
      </MemoryRouter>,
    );
    expect(screen.getByText('STC')).toBeInTheDocument();
    expect(screen.getByText('STC description')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('uses singular wording for a single project', () => {
    render(
      <MemoryRouter>
        <ProjectCategoryCard category={makeCategory('STC', 'stc', 1)} />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('STC — 1 project')).toBeInTheDocument();
  });

  it('navigates to the drill-down route on click', () => {
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <Routes>
          <Route
            path="/projects"
            element={<ProjectCategoryCard category={makeCategory('STC', 'stc', 4)} />}
          />
          <Route path="/projects/category/:slug" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('category-card-stc'));
    expect(screen.getByTestId('location')).toHaveTextContent('/projects/category/stc');
  });

  it('calls onSelect override instead of navigating when provided', () => {
    let picked = '';
    render(
      <MemoryRouter>
        <ProjectCategoryCard
          category={makeCategory('STC', 'stc', 4)}
          onSelect={(c) => {
            picked = c.slug;
          }}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('category-card-stc'));
    expect(picked).toBe('stc');
  });
});
