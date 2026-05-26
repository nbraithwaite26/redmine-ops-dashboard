import type { RedmineUserDto, RedmineUserRef } from '../types/redmineDto.js';
import type { NormalizedUser } from '../types/normalized.js';

const STATUS_ACTIVE = 1;

export function adaptUser(dto: RedmineUserDto): NormalizedUser {
  const name = `${dto.firstname ?? ''} ${dto.lastname ?? ''}`.trim() || dto.login || `user-${dto.id}`;
  return {
    id: dto.id,
    name,
    email: dto.mail ?? '',
    login: dto.login ?? '',
    status: (dto.status ?? STATUS_ACTIVE) === STATUS_ACTIVE ? 'Active' : 'Inactive',
    groups: [],
    roles: [],
  };
}

/**
 * Issues / time entries embed only a {id, name} ref for the assignee or
 * author. The UI's User type carries email/login/roles too. We fabricate a
 * minimal user without those fields rather than firing a per-issue
 * /users/:id lookup.
 */
export function adaptUserFromRef(ref: RedmineUserRef | undefined | null): NormalizedUser | null {
  if (!ref) return null;
  return {
    id: ref.id,
    name: ref.name,
    email: '',
    login: '',
    status: 'Active',
    groups: [],
    roles: [],
  };
}
