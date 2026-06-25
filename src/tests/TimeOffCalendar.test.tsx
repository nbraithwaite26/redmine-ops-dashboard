import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TimeOffCalendar from '../components/TimeOffCalendar';

// Mock at the API facade level so we exercise the calendar against
// deterministic, week-relative data without touching the mock data store.
const mockGetTimeOff = vi.hoisted(() => vi.fn());
vi.mock('../services/redmineApi', async () => {
  const actual = await vi.importActual<typeof import('../services/redmineApi')>(
    '../services/redmineApi',
  );
  return { ...actual, getTimeOff: mockGetTimeOff };
});

function entry(
  id: number,
  date: string,
  opts: Partial<{ type: string; hours: number; userId: number; userName: string }> = {},
) {
  return {
    id,
    date,
    type: opts.type ?? 'Vacation',
    hours: opts.hours ?? 8,
    description: '',
    user: {
      id: opts.userId ?? 100 + id,
      name: opts.userName ?? `engineer-${id}@avionica.com`,
      email: '',
      login: '',
      status: 'Active' as const,
      groups: [],
      roles: [],
    },
  };
}

beforeEach(() => {
  mockGetTimeOff.mockReset();
  mockGetTimeOff.mockResolvedValue([]);
});

afterEach(() => {
  mockGetTimeOff.mockReset();
});

describe('<TimeOffCalendar />', () => {
  it('renders inline (no modal) with the month toggle pressed by default', async () => {
    render(<TimeOffCalendar />);
    expect(await screen.findByTestId('timeoff-calendar')).toBeInTheDocument();
    // The AE Calendar opens in month view to match Easy Redmine.
    await waitFor(() =>
      expect(screen.getByTestId('timeoff-toggle-month')).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(screen.getByTestId('timeoff-today')).toBeInTheDocument();
    expect(screen.getByTestId('timeoff-prev')).toBeInTheDocument();
    expect(screen.getByTestId('timeoff-next')).toBeInTheDocument();
    // Period label looks like "June 2026".
    const label = screen.getByTestId('timeoff-period-label').textContent ?? '';
    expect(label).toMatch(/[A-Za-z]+ \d{4}/);
  });

  it('preserves the anchor when toggling month → week', async () => {
    mockGetTimeOff.mockResolvedValue([]);
    render(<TimeOffCalendar />);
    await screen.findByTestId('timeoff-calendar');

    // Move two months back from the default month view.
    const labelBefore = screen.getByTestId('timeoff-period-label').textContent;
    fireEvent.click(screen.getByTestId('timeoff-prev'));
    fireEvent.click(screen.getByTestId('timeoff-prev'));
    await waitFor(() => {
      expect(screen.getByTestId('timeoff-period-label').textContent).not.toBe(labelBefore);
    });
    const movedMonthLabel = screen.getByTestId('timeoff-period-label').textContent ?? '';
    expect(movedMonthLabel).toMatch(/[A-Za-z]+ \d{4}/);

    // Toggle to week — the anchor must NOT reset to today.
    fireEvent.click(screen.getByTestId('timeoff-toggle-week'));
    await waitFor(() =>
      expect(screen.getByTestId('timeoff-toggle-week')).toHaveAttribute('aria-pressed', 'true'),
    );
    const weekLabel = screen.getByTestId('timeoff-period-label').textContent ?? '';
    // Week label looks like "1 May – 7 2026" (not a "Month YYYY" form).
    expect(weekLabel).not.toBe(movedMonthLabel);
    expect(weekLabel).toMatch(/–/);
  });

  it('shows the AE-style month grid with weekday headers and ISO week numbers', async () => {
    render(<TimeOffCalendar />);
    await screen.findByTestId('timeoff-calendar');
    await waitFor(() =>
      expect(screen.getByTestId('timeoff-calendar-grid')).toBeInTheDocument(),
    );
    // Sunday-anchored weekday labels.
    expect(screen.getByText('Sunday')).toBeInTheDocument();
    expect(screen.getByText('Saturday')).toBeInTheDocument();
    // Hours column header.
    expect(screen.getByText('Hours')).toBeInTheDocument();
    // 6 week-number cells (one per row).
    const weekNums = screen.getAllByTestId(/^timeoff-week-number-\d+$/);
    expect(weekNums).toHaveLength(6);
    // 42 day cells (6×7).
    expect(screen.getAllByTestId(/^timeoff-day-/)).toHaveLength(42);
  });

  it('Today button restores the current period', async () => {
    render(<TimeOffCalendar />);
    await screen.findByTestId('timeoff-calendar');
    const baseline = screen.getByTestId('timeoff-period-label').textContent;

    fireEvent.click(screen.getByTestId('timeoff-prev'));
    fireEvent.click(screen.getByTestId('timeoff-prev'));
    await waitFor(() => {
      expect(screen.getByTestId('timeoff-period-label').textContent).not.toBe(baseline);
    });

    fireEvent.click(screen.getByTestId('timeoff-today'));
    await waitFor(() =>
      expect(screen.getByTestId('timeoff-period-label').textContent).toBe(baseline),
    );
  });

  it('keeps the calendar grid mounted while refetching (layout-stable)', async () => {
    render(<TimeOffCalendar />);
    await screen.findByTestId('timeoff-calendar');
    await waitFor(() =>
      expect(screen.getByTestId('timeoff-calendar-grid')).toBeInTheDocument(),
    );

    let resolveNext: ((v: unknown) => void) | null = null;
    mockGetTimeOff.mockImplementationOnce(
      () => new Promise((resolve) => { resolveNext = resolve; }),
    );
    fireEvent.click(screen.getByTestId('timeoff-next'));

    await waitFor(() => expect(screen.getByTestId('timeoff-fetching')).toBeInTheDocument());
    expect(screen.getByTestId('timeoff-calendar-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('timeoff-loading')).toBeNull();

    resolveNext!([]);
    await waitFor(() => expect(screen.queryByTestId('timeoff-fetching')).toBeNull());
  });

  it('filters entries by memberIds when supplied', async () => {
    // Two engineers — only #200 is in the aircraft set.
    mockGetTimeOff.mockImplementation(async (range: { from: string; to: string }) => {
      const inRange = new Date(range.from);
      inRange.setDate(inRange.getDate() + 1);
      const iso = inRange.toISOString().slice(0, 10);
      return [
        entry(1, iso, { userId: 200, userName: 'aviator@example.com' }),
        entry(2, iso, { userId: 999, userName: 'outsider@example.com' }),
      ];
    });
    render(<TimeOffCalendar memberIds={new Set([200])} />);
    await screen.findByTestId('timeoff-calendar');

    await waitFor(() => {
      expect(screen.queryByTestId('timeoff-loading')).toBeNull();
    });

    // Aviator visible; outsider filtered out.
    await waitFor(() => {
      expect(screen.queryByTestId('timeoff-entry-1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('timeoff-entry-2')).toBeNull();
  });

  it('renders entries inline on the day cell with user + time + activity type', async () => {
    mockGetTimeOff.mockImplementation(async (range: { from: string; to: string }) => {
      const d = new Date(range.from);
      d.setDate(d.getDate() + 1);
      const iso = d.toISOString().slice(0, 10);
      return [
        {
          ...entry(42, iso, { userName: 'jgarcia@example.com', type: 'Vacation' }),
          startTime: '09:00',
          endTime: '17:00',
          atWork: false,
        },
      ];
    });
    render(<TimeOffCalendar />);
    await screen.findByTestId('timeoff-calendar');

    await waitFor(() => {
      expect(screen.queryByTestId('timeoff-loading')).toBeNull();
      expect(screen.getAllByTestId(/^timeoff-day-/).length).toBeGreaterThan(0);
    });

    const entryEl = await screen.findByTestId('timeoff-entry-42');
    expect(entryEl).toBeInTheDocument();
    // User name shows the email local-part, not the full address.
    expect(within(entryEl).getByText(/jgarcia/)).toBeInTheDocument();
    // Time range visible.
    expect(within(entryEl).getByText(/09:00 - 17:00/)).toBeInTheDocument();
    // Activity type label visible.
    expect(within(entryEl).getByText(/Vacation/)).toBeInTheDocument();
  });

  it('prev/next refetches each time with valid ranges', async () => {
    render(<TimeOffCalendar />);
    await screen.findByTestId('timeoff-calendar');
    await waitFor(() => expect(mockGetTimeOff).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('timeoff-next'));
    await waitFor(() => expect(mockGetTimeOff).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByTestId('timeoff-prev'));
    await waitFor(() => expect(mockGetTimeOff).toHaveBeenCalledTimes(3));

    for (const call of mockGetTimeOff.mock.calls) {
      const arg = call[0];
      expect(arg.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(arg.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(arg.from <= arg.to).toBe(true);
    }
  });
});
