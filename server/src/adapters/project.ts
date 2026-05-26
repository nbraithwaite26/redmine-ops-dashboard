import type { RedmineProjectDto, RedmineMembershipDto } from '../types/redmineDto.js';
import type {
  NormalizedProjectSummary,
  NormalizedProjectDetail,
  NormalizedMembership,
} from '../types/normalized.js';

const STATUS_MAP: Record<number, NormalizedProjectSummary['status']> = {
  1: 'Active',
  5: 'Closed',
  9: 'Archived',
};

function baseProject(dto: RedmineProjectDto): NormalizedProjectSummary {
  return {
    id: dto.id,
    name: dto.name,
    identifier: dto.identifier,
    description: dto.description ?? '',
    status: STATUS_MAP[dto.status ?? 1] ?? 'Active',
    parentProjectId: dto.parent?.id ?? null,
    createdOn: dto.created_on ?? '',
    updatedOn: dto.updated_on ?? '',
  };
}

export function adaptProjectSummary(dto: RedmineProjectDto): NormalizedProjectSummary {
  return baseProject(dto);
}

export function adaptProjectDetail(dto: RedmineProjectDto): NormalizedProjectDetail {
  return {
    ...baseProject(dto),
    enabledModules: (dto.enabled_modules ?? []).map((m) => m.name),
    trackers: (dto.trackers ?? []).map((t) => t.name),
    issueCategories: (dto.issue_categories ?? []).map((c) => c.name),
  };
}

/**
 * Collapses memberships into one row per user (or group) with the union of
 * their roles. Redmine returns one row per role-on-project, so a user with
 * two roles appears twice.
 */
export function adaptMemberships(dtos: RedmineMembershipDto[]): NormalizedMembership[] {
  const byUserId = new Map<number, NormalizedMembership>();
  for (const m of dtos) {
    const principal = m.user ?? m.group;
    if (!principal) continue;
    const existing = byUserId.get(principal.id);
    const roleNames = m.roles.map((r) => r.name);
    if (existing) {
      for (const r of roleNames) {
        if (!existing.roles.includes(r)) existing.roles.push(r);
      }
    } else {
      byUserId.set(principal.id, {
        userId: principal.id,
        userName: principal.name,
        roles: roleNames,
      });
    }
  }
  return Array.from(byUserId.values());
}
