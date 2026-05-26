import { Hono } from 'hono';
import { redmineFetch, RedmineHttpError } from '../redmineClient.js';
import type { RedmineEnumerationDto, RedmineIssueDto } from '../types/redmineDto.js';
import type { MetadataBundle } from '../types/normalized.js';

const metadata = new Hono();

/**
 * Bundles all the dropdown metadata the UI needs into one response. Issued
 * as four parallel Redmine calls. The custom-fields catalog is DERIVED
 * because /custom_fields.json returns 403 on this instance (plan §6 Notes).
 */
metadata.get('/', async (c) => {
  const [statuses, trackers, priorities, activities, sampleIssues] = await Promise.all([
    redmineFetch<{ issue_statuses: RedmineEnumerationDto[] }>('/issue_statuses.json'),
    redmineFetch<{ trackers: RedmineEnumerationDto[] }>('/trackers.json'),
    redmineFetch<{ issue_priorities: RedmineEnumerationDto[] }>(
      '/enumerations/issue_priorities.json',
    ),
    redmineFetch<{ time_entry_activities: RedmineEnumerationDto[] }>(
      '/enumerations/time_entry_activities.json',
    ),
    // Sample a small set of issues to harvest custom field names. Soft-fail
    // — if this call 403s we just return an empty customFields catalog.
    redmineFetch<{ issues: RedmineIssueDto[] }>('/issues.json', {
      query: { limit: 25 },
    }).catch((err: unknown) => {
      if (err instanceof RedmineHttpError && (err.status === 403 || err.status === 401)) {
        return { issues: [] as RedmineIssueDto[] };
      }
      throw err;
    }),
  ]);

  const customFieldNames = new Set<string>();
  for (const issue of sampleIssues.issues) {
    for (const cf of issue.custom_fields ?? []) {
      if (cf.name) customFieldNames.add(cf.name);
    }
  }

  const bundle: MetadataBundle = {
    statuses: statuses.issue_statuses.map((s) => s.name),
    trackers: trackers.trackers.map((t) => t.name),
    priorities: priorities.issue_priorities.map((p) => p.name),
    timeActivities: activities.time_entry_activities.map((a) => a.name),
    customFields: Array.from(customFieldNames).sort(),
  };

  return c.json(bundle);
});

export default metadata;
