import type { EasyAttendanceDto } from '../types/redmineDto.js';
import type { NormalizedTimeOffEntry } from '../types/normalized.js';
import { adaptUserFromRef } from './user.js';

/**
 * Extract a local HH:MM (24h) string from an upstream ISO timestamp.
 *
 * Easy Redmine emits timestamps like "2026-06-09T13:05:00Z" or
 * "2026-06-09T13:05:00+00:00". The Z / offset suffix means a `new Date(...)`
 * parse would shift the hours to the runtime's local timezone — but the AE
 * Calendar displays each engineer's local schedule. Slice the HH:MM
 * directly out of the wire string so the value stays exactly what the user
 * saw in Easy Redmine.
 */
function extractClockTime(iso: string | null | undefined): string {
  if (!iso) return '';
  // Match the 'T' separator then HH:MM. Anything before the T is the date.
  const idx = iso.indexOf('T');
  if (idx < 0 || iso.length < idx + 6) return '';
  const hh = iso.slice(idx + 1, idx + 3);
  const mm = iso.slice(idx + 4, idx + 6);
  if (!/^\d{2}$/.test(hh) || !/^\d{2}$/.test(mm)) return '';
  return `${hh}:${mm}`;
}

/**
 * Map an Easy Redmine attendance row to the UI's TimeOffEntry shape.
 *
 * Returns null only when the row has no user we can identify. Callers that
 * want OOO-only filtering can check `result.atWork === false` post-adapt.
 *
 * `hours` defaults to 8 (full day) when the upstream row doesn't carry an
 * explicit duration — Easy Redmine often stores full-day OOO with hours=0.
 */
export function adaptEasyAttendanceAsTimeOff(
  dto: EasyAttendanceDto,
): NormalizedTimeOffEntry | null {
  const activity = dto.easy_attendance_activity;
  if (!activity) return null;
  const user = adaptUserFromRef(dto.user);
  if (!user) return null;
  return {
    id: dto.id,
    user,
    // arrival is an ISO timestamp; the OOO calendar only needs the date.
    date: dto.arrival.slice(0, 10),
    type: activity.name,
    hours: dto.hours > 0 ? dto.hours : 8,
    description: dto.description ?? '',
    atWork: Boolean(activity.at_work),
    startTime: extractClockTime(dto.arrival),
    endTime: extractClockTime(dto.departure),
  };
}
