/**
 * Raw Redmine REST response shapes (snake_case, mirrors REST).
 *
 * NEVER imported from the browser bundle. The adapter layer is the only
 * place that translates these into camelCase normalized types. The browser
 * only ever sees the normalized shapes.
 */

export interface RedmineUserDto {
  id: number;
  login?: string;
  firstname: string;
  lastname: string;
  mail?: string;
  status?: number;
  created_on?: string;
  last_login_on?: string | null;
  api_key?: string;
}

export interface RedmineUserRef {
  id: number;
  name: string;
}

export interface RedmineCustomFieldDto {
  id: number;
  name: string;
  value: string | number | boolean | string[] | null;
}

export interface RedmineProjectDto {
  id: number;
  name: string;
  identifier: string;
  description?: string;
  status?: number;
  parent?: { id: number; name: string };
  created_on?: string;
  updated_on?: string;
  enabled_modules?: Array<{ id: number; name: string }>;
  trackers?: Array<{ id: number; name: string }>;
  issue_categories?: Array<{ id: number; name: string }>;
  custom_fields?: RedmineCustomFieldDto[];
}

export interface RedmineMembershipDto {
  id: number;
  user?: RedmineUserRef;
  group?: RedmineUserRef;
  project: RedmineUserRef;
  roles: Array<{ id: number; name: string; inherited?: boolean }>;
}

export interface RedmineIssueRelationDto {
  id: number;
  issue_id: number;
  issue_to_id: number;
  relation_type: string;
  delay?: number | null;
}

export interface RedmineIssueChildDto {
  id: number;
  tracker?: RedmineUserRef;
  subject?: string;
}

export interface RedmineJournalDto {
  id: number;
  user: RedmineUserRef;
  notes?: string;
  created_on: string;
  details?: Array<{
    property: string;
    name: string;
    old_value: string | null;
    new_value: string | null;
  }>;
}

export interface RedmineIssueDto {
  id: number;
  project: RedmineUserRef;
  tracker: RedmineUserRef;
  status: RedmineUserRef;
  priority: RedmineUserRef;
  author: RedmineUserRef;
  assigned_to?: RedmineUserRef;
  subject: string;
  description?: string;
  start_date?: string | null;
  due_date?: string | null;
  done_ratio: number;
  estimated_hours?: number | null;
  spent_hours?: number;
  total_spent_hours?: number;
  is_private?: boolean;
  parent?: { id: number };
  custom_fields?: RedmineCustomFieldDto[];
  children?: RedmineIssueChildDto[];
  relations?: RedmineIssueRelationDto[];
  journals?: RedmineJournalDto[];
  created_on: string;
  updated_on: string;
  closed_on?: string | null;
}

export interface RedmineTimeEntryDto {
  id: number;
  project: RedmineUserRef;
  issue?: { id: number };
  user: RedmineUserRef;
  activity: RedmineUserRef;
  hours: number;
  comments?: string;
  spent_on: string;
  created_on: string;
  updated_on: string;
}

export interface RedmineEnumerationDto {
  id: number;
  name: string;
  is_default?: boolean;
}

export interface RedminePaginated<TKey extends string, TItem> {
  total_count: number;
  offset: number;
  limit: number;
}
// Pagination wrappers vary by endpoint; helpers read the right key inline.
