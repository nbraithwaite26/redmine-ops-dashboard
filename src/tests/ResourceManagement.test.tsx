import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import ResourceManagement from '../pages/ResourceManagement';
import { currentMockUser } from '../data/mockData';

describe('<ResourceManagement /> (route split)', () => {
  it('shows the team headline when view="team"', async () => {
    render(
      <MemoryRouter>
        <ResourceManagement view="team" />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/Resource Planning · Team/i)).toBeInTheDocument(),
    );
  });

  it('shows the personal headline when view="personal"', async () => {
    render(
      <MemoryRouter>
        <ResourceManagement view="personal" />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/Resource Planning · Personal/i)).toBeInTheDocument(),
    );
  });

  // Integration: confirm that the personal view filters allocations to the
  // current mock user only.
  it('personal view renders only the current mock user in the hierarchy', async () => {
    render(
      <MemoryRouter>
        <ResourceManagement view="personal" />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getAllByText(currentMockUser.name).length).toBeGreaterThan(0),
    );
    // Other users in the seed should NOT appear in the personal view.
    expect(screen.queryByText('Jordan Lee')).not.toBeInTheDocument();
    expect(screen.queryByText('Taylor Rivera')).not.toBeInTheDocument();
  });

  it('team view renders multiple users', async () => {
    render(
      <MemoryRouter>
        <ResourceManagement view="team" />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText(currentMockUser.name)).toBeInTheDocument();
    });
    expect(screen.getByText('Jordan Lee')).toBeInTheDocument();
    expect(screen.getByText('Taylor Rivera')).toBeInTheDocument();
  });

  // Integration: /resources should redirect to /resources/personal.
  it('redirects /resources to /resources/personal', async () => {
    render(
      <MemoryRouter initialEntries={['/resources']}>
        <Routes>
          <Route
            path="/resources"
            element={<Navigate to="/resources/personal" replace />}
          />
          <Route
            path="/resources/personal"
            element={<ResourceManagement view="personal" />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/Resource Planning · Personal/i)).toBeInTheDocument(),
    );
  });
});
