import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreateIssueModal from '../components/CreateIssueModal';
import { clearToasts, getToasts } from '../lib/toast';
import { getProjects } from '../services/redmineApi';

describe('<CreateIssueModal />', () => {
  beforeEach(() => clearToasts());
  afterEach(() => clearToasts());

  function renderModal(overrides: Partial<React.ComponentProps<typeof CreateIssueModal>> = {}) {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    const utils = render(
      <MemoryRouter>
        <CreateIssueModal onClose={onClose} onCreated={onCreated} {...overrides} />
      </MemoryRouter>,
    );
    return { onClose, onCreated, ...utils };
  }

  it('renders required fields and a disabled Create button until subject is set', async () => {
    renderModal();
    expect(await screen.findByText(/new issue/i)).toBeInTheDocument();

    const projectSelect = screen.getByTestId('create-issue-project') as HTMLSelectElement;
    const subjectInput = screen.getByTestId('create-issue-subject') as HTMLInputElement;
    const saveBtn = screen.getByTestId('create-issue-save') as HTMLButtonElement;

    // Wait for projects to hydrate so the select has a real value.
    await waitFor(() => expect(projectSelect.value).not.toBe(''));

    expect(subjectInput.value).toBe('');
    expect(saveBtn.disabled).toBe(true);

    fireEvent.change(subjectInput, { target: { value: 'Anonymized new issue' } });
    expect(saveBtn.disabled).toBe(false);
  });

  it('creates the issue, fires onCreated, and surfaces a toast', async () => {
    const projects = await getProjects();
    const targetProject = projects[0]!;
    const { onCreated, onClose } = renderModal();

    const projectSelect = await waitFor(() => {
      const el = screen.getByTestId('create-issue-project') as HTMLSelectElement;
      expect(el.value).not.toBe('');
      return el;
    });
    fireEvent.change(projectSelect, { target: { value: String(targetProject.id) } });
    fireEvent.change(screen.getByTestId('create-issue-subject'), {
      target: { value: 'Anonymized create-issue smoke' },
    });
    fireEvent.click(screen.getByTestId('create-issue-save'));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const created = onCreated.mock.calls[0]![0];
    expect(created.subject).toBe('Anonymized create-issue smoke');
    expect(created.projectId).toBe(targetProject.id);

    await waitFor(() => {
      const toasts = getToasts();
      expect(
        toasts.some(
          (t) => t.kind === 'success' && t.message.toLowerCase().includes('created'),
        ),
      ).toBe(true);
    });
  });
});
