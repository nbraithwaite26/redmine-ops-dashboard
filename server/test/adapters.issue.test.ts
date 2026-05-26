import { describe, expect, it } from 'vitest';
import { adaptIssue } from '../src/adapters/issue.js';
import issueFixture from './fixtures/issue.detail.json' with { type: 'json' };
import type { RedmineIssueDto } from '../src/types/redmineDto.js';

describe('adaptIssue', () => {
  const out = adaptIssue(issueFixture.issue as unknown as RedmineIssueDto);

  it('translates snake_case scheduling fields to camelCase', () => {
    expect(out.startDate).toBe('2026-05-01');
    expect(out.dueDate).toBe('2026-05-20');
    expect(out.estimatedHours).toBe(8.5);
    expect(out.doneRatio).toBe(40);
    expect(out.parentIssueId).toBe(999);
  });

  it('flattens children and relations', () => {
    expect(out.children).toEqual([1002]);
    expect(out.relations).toHaveLength(2);
    // The "other side" of the relation should be normalized — never the
    // source issue itself.
    for (const rel of out.relations) {
      expect(rel.issueId).not.toBe(out.id);
    }
    expect(out.relations[0]).toEqual({
      id: 5,
      relationType: 'blocks',
      issueId: 1010,
    });
  });

  it('lifts a "Next Action" custom field to the top-level nextAction', () => {
    expect(out.nextAction).toBe('Anonymized next action');
  });

  it('keeps the assignee and author as User objects', () => {
    expect(out.assignee?.id).toBe(11);
    expect(out.assignee?.name).toBe('Test Two');
    expect(out.author.id).toBe(10);
  });

  it('does not leak snake_case keys onto the wire shape', () => {
    const json = JSON.stringify(out);
    for (const key of [
      'start_date',
      'due_date',
      'estimated_hours',
      'done_ratio',
      'parent_issue_id',
      'custom_fields',
      'spent_hours',
    ]) {
      expect(json).not.toContain(`"${key}"`);
    }
  });
});
