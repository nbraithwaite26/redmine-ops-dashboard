import type {
  RedmineIssueDto,
  RedmineIssueRelationDto,
  RedmineCustomFieldDto,
} from '../types/redmineDto.js';
import type {
  NormalizedCustomField,
  NormalizedIssue,
  NormalizedIssueRelation,
} from '../types/normalized.js';
import { adaptUserFromRef } from './user.js';

const RELATION_TYPES: NormalizedIssueRelation['relationType'][] = [
  'relates',
  'duplicates',
  'blocks',
  'precedes',
  'follows',
];

function adaptRelation(dto: RedmineIssueRelationDto, sourceIssueId: number): NormalizedIssueRelation {
  const type = (RELATION_TYPES as string[]).includes(dto.relation_type)
    ? (dto.relation_type as NormalizedIssueRelation['relationType'])
    : 'relates';
  const issueId = dto.issue_id === sourceIssueId ? dto.issue_to_id : dto.issue_id;
  return {
    id: dto.id,
    relationType: type,
    issueId,
  };
}

function adaptCustomField(dto: RedmineCustomFieldDto): NormalizedCustomField {
  let value: NormalizedCustomField['value'];
  const raw = dto.value;
  if (raw === null || raw === undefined) value = null;
  else if (Array.isArray(raw)) value = raw.join(', ');
  else if (typeof raw === 'boolean' || typeof raw === 'number') value = raw;
  else value = String(raw);
  return { id: dto.id, name: dto.name, value };
}

export function adaptIssue(dto: RedmineIssueDto): NormalizedIssue {
  const author = adaptUserFromRef(dto.author);
  if (!author) {
    // Author is required by the wire shape; synthesize a placeholder if Redmine omitted it.
    throw new Error(`issue ${dto.id} missing author`);
  }

  const relations = (dto.relations ?? []).map((r) => adaptRelation(r, dto.id));
  const children = (dto.children ?? []).map((c) => c.id);
  const customFields = (dto.custom_fields ?? []).map(adaptCustomField);

  const nextActionField = customFields.find(
    (f) => f.name.toLowerCase() === 'next action' || f.name.toLowerCase() === 'next_action',
  );

  return {
    id: dto.id,
    projectId: dto.project.id,
    projectName: dto.project.name,
    tracker: dto.tracker.name,
    status: dto.status.name,
    priority: dto.priority.name,
    subject: dto.subject,
    description: dto.description ?? '',
    assignee: adaptUserFromRef(dto.assigned_to),
    author,
    startDate: dto.start_date ?? null,
    dueDate: dto.due_date ?? null,
    estimatedHours: dto.estimated_hours ?? null,
    spentHours: dto.total_spent_hours ?? dto.spent_hours ?? 0,
    doneRatio: dto.done_ratio ?? 0,
    parentIssueId: dto.parent?.id ?? null,
    children,
    relations,
    customFields,
    nextAction: nextActionField?.value != null ? String(nextActionField.value) : null,
    createdOn: dto.created_on,
    updatedOn: dto.updated_on,
    closedOn: dto.closed_on ?? null,
  };
}
