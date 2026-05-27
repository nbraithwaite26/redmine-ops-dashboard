import { describe, expect, it } from 'vitest';
import {
  distinctEngineersOut,
  legendTypes,
  rangeOf,
  timeOffColor,
  weekDays,
} from '../lib/timeOff';
import type { TimeOffEntry, User } from '../types/redmine';

function user(id: number): User {
  return { id, name: `U${id}`, email: '', login: '', status: 'Active', groups: [], roles: [] };
}
function entry(id: number, userId: number, date: string, type: string): TimeOffEntry {
  return { id, user: user(userId), date, type, hours: 8 };
}

describe('timeOffColor', () => {
  it('maps known types to fixed colors', () => {
    expect(timeOffColor('Vacation')).toBe('#0EA5E9');
    expect(timeOffColor('Personal Time')).toBe('#8B5CF6');
    expect(timeOffColor('Holiday')).toBe('#F59E0B');
    expect(timeOffColor('Customer Visit')).toBe('#10B981');
  });

  it('matches a known prefix (e.g. "Customer Visit (FOF/FOT)")', () => {
    expect(timeOffColor('Customer Visit (FOF/FOT)')).toBe('#10B981');
  });

  it('is deterministic for unknown types', () => {
    expect(timeOffColor('Jury Duty')).toBe(timeOffColor('Jury Duty'));
  });
});

describe('aggregation', () => {
  const entries = [
    entry(1, 10, '2026-05-25', 'Vacation'),
    entry(2, 10, '2026-05-26', 'Vacation'),
    entry(3, 11, '2026-05-25', 'Personal Time'),
  ];

  it('counts distinct engineers out', () => {
    expect(distinctEngineersOut(entries)).toBe(2);
  });

  it('lists legend types in first-seen order', () => {
    expect(legendTypes(entries)).toEqual(['Vacation', 'Personal Time']);
  });
});

describe('weekDays / rangeOf', () => {
  it('returns 7 Monday-anchored days and an inclusive range', () => {
    const days = weekDays(new Date('2026-05-27')); // a Wednesday
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1); // Monday
    expect(days[6].getDay()).toBe(0); // Sunday
    const r = rangeOf(days);
    expect(r.from <= '2026-05-27').toBe(true);
    expect(r.to >= '2026-05-27').toBe(true);
  });

  it('shifts by whole weeks via the offset', () => {
    const thisWeek = rangeOf(weekDays(new Date('2026-05-27'), 0));
    const nextWeek = rangeOf(weekDays(new Date('2026-05-27'), 1));
    expect(nextWeek.from > thisWeek.to).toBe(true);
  });
});
