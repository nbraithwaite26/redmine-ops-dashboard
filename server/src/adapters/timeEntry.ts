import type { RedmineTimeEntryDto } from '../types/redmineDto.js';
import type { NormalizedTimeEntry } from '../types/normalized.js';
import { adaptUserFromRef } from './user.js';

export function adaptTimeEntry(dto: RedmineTimeEntryDto): NormalizedTimeEntry {
  const user = adaptUserFromRef(dto.user);
  if (!user) throw new Error(`time entry ${dto.id} missing user`);
  return {
    id: dto.id,
    projectId: dto.project.id,
    projectName: dto.project.name,
    issueId: dto.issue?.id ?? null,
    user,
    activity: dto.activity?.name ?? '',
    spentOn: dto.spent_on,
    hours: dto.hours,
    comments: dto.comments ?? '',
    createdOn: dto.created_on,
    updatedOn: dto.updated_on,
  };
}
