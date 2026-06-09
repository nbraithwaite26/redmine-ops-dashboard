import type { RedmineGroupDto } from '../types/redmineDto.js';
import type { NormalizedGroup, NormalizedUser } from '../types/normalized.js';
import { adaptUserFromRef } from './user.js';

/**
 * Map a Redmine /groups/:id response (with optional embedded users) to
 * the normalized Group shape. Drops members the ref couldn't resolve.
 */
export function adaptGroup(dto: RedmineGroupDto): NormalizedGroup {
  const members: NormalizedUser[] = [];
  for (const ref of dto.users ?? []) {
    const u = adaptUserFromRef(ref);
    if (u) members.push(u);
  }
  return { id: dto.id, name: dto.name, members };
}
