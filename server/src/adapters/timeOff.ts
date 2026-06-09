import type { EasyAttendanceDto } from '../types/redmineDto.js';
import type { NormalizedTimeOffEntry } from '../types/normalized.js';
import { adaptUserFromRef } from './user.js';

/**
 * Map an Easy Redmine attendance row to the UI's TimeOffEntry shape.
 *
 * Returns null when:
 *   - the row has no user we can identify, or
 *   - the activity is at_work=true (i.e. the engineer is working, not out).
 *
 * `hours` defaults to 8 (full day) when the upstream row doesn't carry an
 * explicit duration — Easy Redmine often stores full-day OOO with hours=0.
 */
export function adaptEasyAttendanceAsTimeOff(
  dto: EasyAttendanceDto,
): NormalizedTimeOffEntry | null {
  const activity = dto.easy_attendance_activity;
  if (!activity || activity.at_work) return null;
  const user = adaptUserFromRef(dto.user);
  if (!user) return null;
  return {
    id: dto.id,
    user,
    // arrival is an ISO timestamp; the OOO calendar only needs the date.
    date: dto.arrival.slice(0, 10),
    type: activity.name,
    hours: dto.hours > 0 ? dto.hours : 8,
  };
}
