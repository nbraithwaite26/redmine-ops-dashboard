import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ToastHost from '../components/ToastHost';
import { clearToasts, dismissToast, pushToast } from '../lib/toast';

describe('<ToastHost />', () => {
  beforeEach(() => clearToasts());
  afterEach(() => clearToasts());

  it('renders nothing when there are no toasts', () => {
    render(<ToastHost />);
    expect(screen.queryByTestId('toast-host')).not.toBeInTheDocument();
  });

  it('renders a success toast pushed at runtime', () => {
    render(<ToastHost />);
    act(() => {
      pushToast({ kind: 'success', message: 'Saved #42.' }, { dismissAfterMs: 0 });
    });
    expect(screen.getByTestId('toast-host')).toBeInTheDocument();
    expect(screen.getByTestId('toast-success')).toHaveTextContent('Saved #42.');
  });

  it('renders an error toast with the supplied message', () => {
    render(<ToastHost />);
    act(() => {
      pushToast(
        { kind: 'error', message: "Couldn't save #99: Network down." },
        { dismissAfterMs: 0 },
      );
    });
    expect(screen.getByTestId('toast-error')).toHaveTextContent('Network down');
  });

  it('dismisses a toast when the close button is clicked', () => {
    let id = 0;
    render(<ToastHost />);
    act(() => {
      id = pushToast({ kind: 'info', message: 'Hello.' }, { dismissAfterMs: 0 });
    });
    expect(screen.getByTestId('toast-info')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    expect(screen.queryByTestId('toast-info')).not.toBeInTheDocument();
    expect(id).toBeGreaterThan(0);
  });

  it('dismissToast(id) by API hides the toast', () => {
    let id = 0;
    render(<ToastHost />);
    act(() => {
      id = pushToast({ kind: 'success', message: 'Saved.' }, { dismissAfterMs: 0 });
    });
    expect(screen.queryByTestId('toast-success')).toBeInTheDocument();
    act(() => dismissToast(id));
    expect(screen.queryByTestId('toast-success')).not.toBeInTheDocument();
  });
});
