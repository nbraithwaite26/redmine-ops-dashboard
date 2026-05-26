import { describe, expect, it } from 'vitest';
import {
  adaptMemberships,
  adaptProjectDetail,
  adaptProjectSummary,
} from '../src/adapters/project.js';
import projectFixture from './fixtures/project.detail.json' with { type: 'json' };
import membershipsFixture from './fixtures/memberships.json' with { type: 'json' };
import type {
  RedmineMembershipDto,
  RedmineProjectDto,
} from '../src/types/redmineDto.js';

describe('adaptProjectDetail', () => {
  const out = adaptProjectDetail(projectFixture.project as unknown as RedmineProjectDto);

  it('exposes enabled modules, trackers, categories as string arrays', () => {
    expect(out.enabledModules).toEqual([
      'issue_tracking',
      'time_tracking',
      'wiki',
      'easy_gantt_resources',
    ]);
    expect(out.trackers).toEqual(['Bug', 'Task']);
    expect(out.issueCategories).toEqual(['Category A']);
  });

  it('maps status 1 to Active', () => {
    expect(out.status).toBe('Active');
  });
});

describe('adaptProjectSummary', () => {
  it('omits the include-only fields', () => {
    const out = adaptProjectSummary(projectFixture.project as unknown as RedmineProjectDto);
    const asRecord = out as unknown as Record<string, unknown>;
    expect(asRecord.enabledModules).toBeUndefined();
    expect(asRecord.trackers).toBeUndefined();
  });
});

describe('adaptMemberships', () => {
  it('collapses multiple membership rows for the same user into one row with union of roles', () => {
    const out = adaptMemberships(
      membershipsFixture.memberships as unknown as RedmineMembershipDto[],
    );
    expect(out).toHaveLength(2);
    const testOne = out.find((m) => m.userId === 10);
    expect(testOne?.roles).toEqual(['Developer', 'Reporter']);
    const testTwo = out.find((m) => m.userId === 11);
    expect(testTwo?.roles).toEqual(['Developer']);
  });
});
