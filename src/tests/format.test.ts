import { describe, expect, it } from 'vitest';
import {
  MOCK_TODAY,
  daysOverdue,
  formatDate,
  formatHours,
  isOverdue,
  priorityPill,
  statusPill,
} from '../lib/format';

describe('isOverdue', () => {
  const today = new Date('2026-05-21');

  it('returns false for null due date', () => {
    expect(isOverdue(null, today)).toBe(false);
  });

  it('returns true for a date in the past', () => {
    expect(isOverdue('2026-05-01', today)).toBe(true);
  });

  it('returns false for today', () => {
    expect(isOverdue('2026-05-21', today)).toBe(false);
  });

  it('returns false for a future date', () => {
    expect(isOverdue('2026-06-01', today)).toBe(false);
  });

  it('uses the current date when today is not provided', () => {
    expect(isOverdue('1970-01-01')).toBe(true);
    expect(isOverdue('2999-12-31')).toBe(false);
  });
});

describe('daysOverdue', () => {
  const today = new Date('2026-05-21');

  it('returns 0 for null due date', () => {
    expect(daysOverdue(null, today)).toBe(0);
  });

  it('returns 0 for a future date', () => {
    expect(daysOverdue('2026-06-01', today)).toBe(0);
  });

  it('counts whole days past due', () => {
    expect(daysOverdue('2026-05-14', today)).toBe(7);
  });
});

describe('priorityPill', () => {
  it('maps urgent variants to red', () => {
    expect(priorityPill('Urgent')).toBe('pill-red');
    expect(priorityPill('Immediate')).toBe('pill-red');
  });
  it('maps High to orange', () => {
    expect(priorityPill('High')).toBe('pill-orange');
  });
  it('maps Normal/Low to expected pills', () => {
    expect(priorityPill('Normal')).toBe('pill-blue');
    expect(priorityPill('Low')).toBe('pill-gray');
  });
});

describe('statusPill', () => {
  it('maps Resolved and Closed to green', () => {
    expect(statusPill('Resolved')).toBe('pill-green');
    expect(statusPill('Closed')).toBe('pill-green');
  });
  it('maps In Progress to blue', () => {
    expect(statusPill('In Progress')).toBe('pill-blue');
  });
});

describe('formatHours', () => {
  it('returns em-dash for null/undefined', () => {
    expect(formatHours(null)).toBe('—');
    expect(formatHours(undefined)).toBe('—');
  });
  it('formats integer hours without decimals', () => {
    expect(formatHours(4)).toBe('4h');
  });
  it('formats fractional hours with 2 decimals', () => {
    expect(formatHours(4.5)).toBe('4.50h');
  });
});

describe('formatDate', () => {
  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });
  it('passes through valid date strings', () => {
    expect(formatDate('2026-05-21')).toBe('2026-05-21');
  });
});

describe('MOCK_TODAY constant', () => {
  it('is the pinned demo date', () => {
    expect(MOCK_TODAY.toISOString().slice(0, 10)).toBe('2026-05-21');
  });
});
