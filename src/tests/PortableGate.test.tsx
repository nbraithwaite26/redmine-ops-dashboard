import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PortableLogin from '../pages/PortableLogin';
import { usePortableGate } from '../hooks/usePortableGate';

const originalFetch = global.fetch;

function mockFetchOnce(map: Record<string, { status?: number; body: unknown }>) {
  global.fetch = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const [pattern, response] of Object.entries(map)) {
      if (url.includes(pattern)) {
        return new Response(JSON.stringify(response.body), {
          status: response.status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  global.fetch = originalFetch;
});

// Tiny harness so we can assert against the hook output without pulling
// in the whole AppShell. Renders the resolved state as text.
function GateProbe() {
  const gate = usePortableGate();
  return (
    <div>
      <div data-testid="state">{gate.state}</div>
      <div data-testid="portable">{String(gate.portable)}</div>
    </div>
  );
}

describe('usePortableGate', () => {
  it('settles to "ready" immediately in centralized mode', async () => {
    mockFetchOnce({
      '/health': { body: { ok: true, mode: 'read-write', portable: false } },
    });
    render(<GateProbe />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready'));
    expect(screen.getByTestId('portable')).toHaveTextContent('false');
  });

  it('shows "login-required" in portable mode with no config', async () => {
    mockFetchOnce({
      '/health': { body: { ok: true, mode: 'read-write', portable: true } },
      '/api/portable/status': { body: { configured: false } },
    });
    render(<GateProbe />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('login-required'));
    expect(screen.getByTestId('portable')).toHaveTextContent('true');
  });

  it('skips login when portable + already configured', async () => {
    mockFetchOnce({
      '/health': { body: { ok: true, mode: 'read-write', portable: true } },
      '/api/portable/status': {
        body: { configured: true, redmineUrl: 'https://r.example.com', login: 'nb' },
      },
    });
    render(<GateProbe />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready'));
  });

  it('falls through to "ready" if /health is unreachable', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    render(<GateProbe />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready'));
  });
});

describe('<PortableLogin />', () => {
  it('surfaces INVALID_CREDENTIALS with a friendly message', async () => {
    mockFetchOnce({
      '/api/portable/login': {
        status: 401,
        body: { error: { code: 'INVALID_CREDENTIALS', message: 'no' } },
      },
    });

    render(<PortableLogin onLoggedIn={() => {}} />);
    fireEvent.change(screen.getByTestId('portable-login-url'), {
      target: { value: 'https://r.example.com' },
    });
    fireEvent.change(screen.getByTestId('portable-login-username'), {
      target: { value: 'nb' },
    });
    fireEvent.change(screen.getByTestId('portable-login-password'), {
      target: { value: 'pw' },
    });
    fireEvent.submit(screen.getByTestId('portable-login-submit').closest('form')!);

    const err = await screen.findByTestId('portable-login-error');
    expect(err.textContent).toMatch(/rejected by Redmine/i);
  });

  it('calls onLoggedIn after a successful login', async () => {
    mockFetchOnce({
      '/api/portable/login': {
        body: {
          configured: true,
          redmineUrl: 'https://r.example.com',
          login: 'nb',
          user: { id: 1, login: 'nb', name: 'Nick' },
        },
      },
    });
    const onLoggedIn = vi.fn();
    render(<PortableLogin onLoggedIn={onLoggedIn} />);
    fireEvent.change(screen.getByTestId('portable-login-url'), {
      target: { value: 'https://r.example.com' },
    });
    fireEvent.change(screen.getByTestId('portable-login-username'), {
      target: { value: 'nb' },
    });
    fireEvent.change(screen.getByTestId('portable-login-password'), {
      target: { value: 'pw' },
    });
    fireEvent.submit(screen.getByTestId('portable-login-submit').closest('form')!);

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledTimes(1));
  });
});
