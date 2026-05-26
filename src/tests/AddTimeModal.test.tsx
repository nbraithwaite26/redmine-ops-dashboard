import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AddTimeModal from '../components/AddTimeModal';
import { clearToasts, getToasts } from '../lib/toast';
import { getIssueById } from '../services/redmineApi';

/**
 * Tests the AddTimeModal contract from plan §1:
 *   - initialProjectId / initialIssueId pre-seed the dropdowns
 *   - Past-entries panel shows entries for the selected issue
 *   - Successful save on a 'New' task bumps its status to 'In Progress'
 *   - Mock-mode adapter point: the modal still works without a network
 */

// A known mock issue with status 'New' that we can target for the
// status-bump assertion. See src/data/mockData.ts.
const NEW_TASK_ID = 1025;

describe('<AddTimeModal />', () => {
  beforeEach(() => clearToasts());
  afterEach(() => clearToasts());

  function renderModal(props: Partial<React.ComponentProps<typeof AddTimeModal>> = {}) {
    const noop = () => {};
    return render(
      <MemoryRouter>
        <AddTimeModal onClose={noop} onCreated={noop} {...props} />
      </MemoryRouter>,
    );
  }

  it('renders the form scaffolding', async () => {
    renderModal();
    expect(await screen.findByText(/add time entry/i)).toBeInTheDocument();
    expect(screen.getByTestId('add-time-project')).toBeInTheDocument();
    expect(screen.getByTestId('add-time-task')).toBeInTheDocument();
    expect(screen.getByTestId('add-time-activity')).toBeInTheDocument();
    // User dropdown was removed per the new design.
    expect(screen.queryByText(/^User$/)).not.toBeInTheDocument();
  });

  it('pre-seeds the project + task dropdowns from initialIssueId', async () => {
    const issue = await getIssueById(NEW_TASK_ID);
    expect(issue).not.toBeNull();
    renderModal({
      initialProjectId: issue!.projectId,
      initialIssueId: issue!.id,
    });

    const projectSelect = await screen.findByTestId('add-time-project') as HTMLSelectElement;
    const taskSelect = screen.getByTestId('add-time-task') as HTMLSelectElement;
    await waitFor(() => {
      expect(projectSelect.value).toBe(String(issue!.projectId));
      expect(taskSelect.value).toBe(String(NEW_TASK_ID));
    });
  });

  it('shows the past-entries panel when an issue is selected', async () => {
    const issue = await getIssueById(NEW_TASK_ID);
    renderModal({
      initialProjectId: issue!.projectId,
      initialIssueId: issue!.id,
    });
    expect(await screen.findByTestId('past-entries-panel')).toBeInTheDocument();
    // The mock issue starts with no entries, so the empty state shows.
    expect(screen.getByTestId('past-entries-empty')).toBeInTheDocument();
  });

  it('bumps a "New" task to "In Progress" on save', async () => {
    const issue = await getIssueById(NEW_TASK_ID);
    expect(issue!.status).toBe('New');

    renderModal({
      initialProjectId: issue!.projectId,
      initialIssueId: issue!.id,
    });

    // Wait for dropdowns to hydrate.
    await waitFor(() => {
      const select = screen.getByTestId('add-time-task') as HTMLSelectElement;
      expect(select.value).toBe(String(NEW_TASK_ID));
    });

    fireEvent.change(screen.getByTestId('add-time-hours'), { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('add-time-save'));

    // Two toasts: the time-entry create success + the status-bump success.
    await waitFor(() => {
      const toasts = getToasts();
      const hasLogged = toasts.some(
        (t) => t.kind === 'success' && /1h|1.0h|logged/i.test(t.message),
      );
      const hasStatusBump = toasts.some(
        (t) => t.kind === 'success' && t.message.includes(`#${NEW_TASK_ID}`),
      );
      expect(hasLogged).toBe(true);
      expect(hasStatusBump).toBe(true);
    });

    // Verify the issue's status actually flipped in the mock store.
    const after = await getIssueById(NEW_TASK_ID);
    expect(after!.status).toBe('In Progress');
  });
});
