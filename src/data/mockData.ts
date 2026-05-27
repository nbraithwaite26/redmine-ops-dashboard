import type {
  DashboardMetric,
  DirectoryLink,
  Issue,
  Project,
  ResourceAllocation,
  TimeEntry,
  User,
} from '../types/redmine';

// All names and emails here are intentionally generic. Do not replace with
// real employees or real internal email domains.
export const mockUsers: User[] = [
  {
    id: 1,
    name: 'Alex Morgan',
    email: 'alex.morgan@example.com',
    login: 'amorgan',
    status: 'Active',
    groups: ['Engineering'],
    roles: ['Manager', 'Developer'],
  },
  {
    id: 2,
    name: 'Jordan Lee',
    email: 'jordan.lee@example.com',
    login: 'jlee',
    status: 'Active',
    groups: ['Engineering'],
    roles: ['Developer'],
  },
  {
    id: 3,
    name: 'Taylor Rivera',
    email: 'taylor.rivera@example.com',
    login: 'trivera',
    status: 'Active',
    groups: ['Operations'],
    roles: ['Operations Lead'],
  },
  {
    id: 4,
    name: 'Casey Brooks',
    email: 'casey.brooks@example.com',
    login: 'cbrooks',
    status: 'Active',
    groups: ['QA'],
    roles: ['QA Engineer'],
  },
  {
    id: 5,
    name: 'Riley Parker',
    email: 'riley.parker@example.com',
    login: 'rparker',
    status: 'Active',
    groups: ['Engineering'],
    roles: ['Engineer'],
  },
];

export const currentMockUser: User = mockUsers[0];

export const mockProjects: Project[] = [
  {
    id: 101,
    name: 'Aircraft Retrofit Planning',
    identifier: 'aircraft-retrofit',
    description: 'Plan and execute retrofit work packages across the fleet.',
    status: 'Active',
    parentProjectId: null,
    createdOn: '2025-09-01',
    updatedOn: '2026-05-15',
  },
  {
    id: 102,
    name: 'Customer Support Requests',
    identifier: 'cust-support',
    description: 'Tracking inbound customer support tickets.',
    status: 'Active',
    parentProjectId: null,
    createdOn: '2025-06-10',
    updatedOn: '2026-05-20',
  },
  {
    id: 103,
    name: 'Certification Review',
    identifier: 'cert-review',
    description: 'Document review and submission workflows.',
    status: 'At Risk',
    parentProjectId: null,
    createdOn: '2025-11-12',
    updatedOn: '2026-05-18',
  },
  {
    id: 104,
    name: 'Engineering Change Requests',
    identifier: 'ecr',
    description: 'Change requests against engineering drawings.',
    status: 'Active',
    parentProjectId: null,
    createdOn: '2025-04-08',
    updatedOn: '2026-05-19',
  },
  {
    id: 105,
    name: 'Equipment Installation',
    identifier: 'equip-install',
    description: 'Field installation milestones.',
    status: 'Active',
    parentProjectId: null,
    createdOn: '2026-01-22',
    updatedOn: '2026-05-19',
  },
  {
    id: 106,
    name: 'Continuous Improvement',
    identifier: 'ci',
    description: 'Process improvement workstream.',
    status: 'Active',
    parentProjectId: null,
    createdOn: '2025-02-14',
    updatedOn: '2026-05-10',
  },
  {
    id: 107,
    name: 'Documentation Updates',
    identifier: 'docs',
    description: 'Knowledge base and procedure updates.',
    status: 'Active',
    parentProjectId: null,
    createdOn: '2025-07-30',
    updatedOn: '2026-05-12',
  },
  {
    id: 108,
    name: 'System Integration',
    identifier: 'sys-integration',
    description: 'Cross-system integration efforts.',
    status: 'At Risk',
    parentProjectId: null,
    createdOn: '2025-10-05',
    updatedOn: '2026-05-17',
  },

  // ─── CR #15: AV Engineering → AIRCRAFT ENGINEERING category tree ───────
  // The Projects page sources its category cards from this subtree. Ids in
  // the 200+ range so the flat fixtures above (101–108) stay untouched.
  {
    id: 200,
    // Mirrors the real Redmine name (leading ** is part of the name) so mock
    // and real mode resolve the same default project source. See projectSource.ts.
    name: '**AV Engineering',
    identifier: 'av-engineering',
    description: 'Top-level engineering division.',
    status: 'Active',
    parentProjectId: null,
    createdOn: '2024-01-15',
    updatedOn: '2026-05-21',
  },
  {
    id: 201,
    name: 'AIRCRAFT ENGINEERING',
    identifier: 'aircraft-engineering',
    description: 'Aircraft engineering portfolio — parent of the service categories.',
    status: 'Active',
    parentProjectId: 200,
    createdOn: '2024-02-01',
    updatedOn: '2026-05-22',
  },

  // Category: Custom Engineering Services
  {
    id: 210,
    name: 'Custom Engineering Services',
    identifier: 'custom-engineering-services',
    description: 'Bespoke engineering work packages.',
    status: 'Active',
    parentProjectId: 201,
    createdOn: '2024-03-10',
    updatedOn: '2026-05-20',
  },
  {
    id: 211,
    name: 'CES — Bracket Redesign',
    identifier: 'ces-bracket-redesign',
    description: 'Structural bracket redesign package.',
    status: 'Active',
    parentProjectId: 210,
    createdOn: '2025-08-01',
    updatedOn: '2026-05-18',
  },
  {
    id: 212,
    name: 'CES — Wiring Harness Update',
    identifier: 'ces-wiring-harness',
    description: 'Harness routing revision.',
    status: 'Active',
    parentProjectId: 210,
    createdOn: '2025-09-12',
    updatedOn: '2026-05-19',
  },
  {
    id: 213,
    name: 'CES — Panel Reinforcement',
    identifier: 'ces-panel-reinforcement',
    description: 'Cabin panel reinforcement study.',
    status: 'At Risk',
    parentProjectId: 210,
    createdOn: '2025-11-05',
    updatedOn: '2026-05-17',
  },

  // Category: STC
  {
    id: 220,
    // Mirrors the real Redmine name ("STCs", not "STC").
    name: 'STCs',
    identifier: 'stcs',
    description: 'Supplemental Type Certificate programs.',
    status: 'Active',
    parentProjectId: 201,
    createdOn: '2024-03-10',
    updatedOn: '2026-05-23',
  },
  {
    id: 221,
    name: 'STC — Cabin Reconfiguration',
    identifier: 'stc-cabin-reconfig',
    description: 'Cabin layout STC project.',
    status: 'Active',
    parentProjectId: 220,
    createdOn: '2025-05-20',
    updatedOn: '2026-05-21',
  },
  {
    id: 222,
    name: 'STC — Avionics Upgrade',
    identifier: 'stc-avionics-upgrade',
    description: 'Flight deck avionics STC.',
    status: 'Active',
    parentProjectId: 220,
    createdOn: '2025-06-15',
    updatedOn: '2026-05-22',
  },
  {
    id: 223,
    name: 'STC — Fuel System Mod',
    identifier: 'stc-fuel-system-mod',
    description: 'Auxiliary fuel system STC.',
    status: 'At Risk',
    parentProjectId: 220,
    createdOn: '2025-10-01',
    updatedOn: '2026-05-16',
  },
  {
    id: 224,
    name: 'STC — Winglet Retrofit',
    identifier: 'stc-winglet-retrofit',
    description: 'Aerodynamic winglet STC.',
    status: 'Closed',
    parentProjectId: 220,
    createdOn: '2024-12-03',
    updatedOn: '2026-04-30',
  },

  // Category: Aircraft Engineering Continuous Improvement
  {
    id: 230,
    name: 'Aircraft Engineering Continuous Improvement',
    identifier: 'aircraft-eng-ci',
    description: 'Process and quality improvement initiatives.',
    status: 'Active',
    parentProjectId: 201,
    createdOn: '2024-04-01',
    updatedOn: '2026-05-15',
  },
  {
    id: 231,
    name: 'CI — Drawing Standardization',
    identifier: 'ci-drawing-standardization',
    description: 'Standardize engineering drawing templates.',
    status: 'Active',
    parentProjectId: 230,
    createdOn: '2025-07-08',
    updatedOn: '2026-05-14',
  },
  {
    id: 232,
    name: 'CI — Review Cycle Time',
    identifier: 'ci-review-cycle-time',
    description: 'Reduce document review turnaround.',
    status: 'Active',
    parentProjectId: 230,
    createdOn: '2025-08-22',
    updatedOn: '2026-05-13',
  },
];

const u = (id: number): User => mockUsers.find((x) => x.id === id)!;
const p = (id: number) => mockProjects.find((x) => x.id === id)!;

const buildIssue = (
  id: number,
  projectId: number,
  assigneeId: number | null,
  partial: Partial<Issue>,
): Issue => {
  const project = p(projectId);
  return {
    id,
    projectId,
    projectName: project.name,
    tracker: 'Task',
    status: 'In Progress',
    priority: 'Normal',
    subject: 'Untitled issue',
    description: '',
    assignee: assigneeId ? u(assigneeId) : null,
    author: u(1),
    startDate: '2026-05-01',
    dueDate: '2026-05-25',
    estimatedHours: 8,
    spentHours: 2,
    doneRatio: 25,
    parentIssueId: null,
    children: [],
    relations: [],
    customFields: [],
    nextAction: null,
    createdOn: '2026-05-01',
    updatedOn: '2026-05-18',
    closedOn: null,
    ...partial,
  };
};

export const mockIssues: Issue[] = [
  buildIssue(1024, 101, 1, {
    subject: 'Wiring review for retrofit kit A12',
    tracker: 'Task',
    priority: 'High',
    status: 'In Progress',
    estimatedHours: 16,
    spentHours: 6.5,
    doneRatio: 40,
    nextAction: 'Schedule peer review with avionics team.',
    dueDate: '2026-05-22',
  }),
  buildIssue(1025, 101, 1, {
    subject: 'Engineering order EO-2026-014',
    tracker: 'Task',
    priority: 'Normal',
    status: 'New',
    estimatedHours: 12,
    spentHours: 0,
    doneRatio: 0,
    nextAction: 'Draft order and circulate for approval.',
    dueDate: '2026-06-02',
  }),
  buildIssue(1026, 105, 1, {
    subject: 'Final configuration review',
    tracker: 'Task',
    priority: 'High',
    status: 'Feedback',
    estimatedHours: 6,
    spentHours: 4,
    doneRatio: 70,
    nextAction: 'Incorporate review comments.',
    dueDate: '2026-05-19',
  }),
  buildIssue(1027, 103, 2, {
    subject: 'Compliance matrix update',
    tracker: 'Task',
    priority: 'Urgent',
    status: 'In Progress',
    estimatedHours: 20,
    spentHours: 10,
    doneRatio: 50,
    nextAction: 'Pull latest reg references.',
    dueDate: '2026-05-15',
  }),
  buildIssue(1028, 102, 3, {
    subject: 'CRM is down — investigate sync errors',
    tracker: 'Bug',
    priority: 'Urgent',
    status: 'In Progress',
    estimatedHours: 4,
    spentHours: 1.5,
    doneRatio: 30,
    nextAction: 'Check broker logs for stuck messages.',
    dueDate: '2026-05-12',
  }),
  buildIssue(1029, 102, 3, {
    subject: 'Laptop performance not improving',
    tracker: 'Support',
    priority: 'Normal',
    status: 'Feedback',
    estimatedHours: 2,
    spentHours: 1,
    doneRatio: 50,
    nextAction: 'Awaiting customer reply.',
    dueDate: '2026-05-25',
  }),
  buildIssue(1030, 104, 4, {
    subject: 'ECR-441 redline reconciliation',
    tracker: 'Task',
    priority: 'High',
    status: 'In Progress',
    estimatedHours: 10,
    spentHours: 4,
    doneRatio: 40,
    nextAction: 'Reconcile against drawing rev D.',
    dueDate: '2026-05-21',
  }),
  buildIssue(1031, 106, 5, {
    subject: 'Process audit follow-up',
    tracker: 'Task',
    priority: 'Low',
    status: 'New',
    estimatedHours: 6,
    spentHours: 0,
    doneRatio: 0,
    nextAction: 'Schedule audit kickoff.',
    dueDate: '2026-06-10',
  }),
  buildIssue(1032, 107, 5, {
    subject: 'Refresh request for VP of Operations',
    tracker: 'Task',
    priority: 'High',
    status: 'Resolved',
    estimatedHours: 4,
    spentHours: 4.25,
    doneRatio: 100,
    nextAction: null,
    dueDate: '2026-05-14',
  }),
  buildIssue(1033, 108, 2, {
    subject: 'Integration broker error handling',
    tracker: 'Bug',
    priority: 'High',
    status: 'In Progress',
    estimatedHours: 14,
    spentHours: 9,
    doneRatio: 60,
    nextAction: 'Add idempotency keys to retry path.',
    dueDate: '2026-05-09',
  }),
  buildIssue(1034, 101, null, {
    subject: 'Unassigned: kit B07 documentation gap',
    tracker: 'Task',
    priority: 'Normal',
    status: 'New',
    estimatedHours: 8,
    spentHours: 0,
    doneRatio: 0,
    dueDate: '2026-06-01',
  }),
  buildIssue(1035, 103, null, {
    subject: 'Unassigned: certification gap analysis',
    tracker: 'KPI',
    priority: 'High',
    status: 'New',
    estimatedHours: 12,
    spentHours: 0,
    doneRatio: 0,
    dueDate: '2026-05-30',
  }),
  buildIssue(1036, 105, null, {
    subject: 'Unassigned: spare parts plan',
    tracker: 'Task',
    priority: 'Normal',
    status: 'New',
    estimatedHours: 6,
    spentHours: 0,
    doneRatio: 0,
    dueDate: '2026-06-05',
  }),
];

export const mockTimeEntries: TimeEntry[] = [
  {
    id: 5001,
    projectId: 101,
    issueId: 1024,
    user: u(1),
    activity: 'Design',
    spentOn: '2026-05-19',
    hours: 1,
    comments: 'Reviewed wiring diagrams',
    createdOn: '2026-05-19',
    updatedOn: '2026-05-19',
  },
  {
    id: 5002,
    projectId: 102,
    issueId: 1028,
    user: u(3),
    activity: 'Investigation',
    spentOn: '2026-05-19',
    hours: 1.5,
    comments: 'Triage of CRM outage',
    createdOn: '2026-05-19',
    updatedOn: '2026-05-19',
  },
  {
    id: 5003,
    projectId: 103,
    issueId: 1027,
    user: u(2),
    activity: 'Analysis',
    spentOn: '2026-05-18',
    hours: 4,
    comments: 'Compliance matrix work',
    createdOn: '2026-05-18',
    updatedOn: '2026-05-18',
  },
  {
    id: 5004,
    projectId: 104,
    issueId: 1030,
    user: u(4),
    activity: 'Development',
    spentOn: '2026-05-18',
    hours: 3,
    comments: 'Drawing reconciliation',
    createdOn: '2026-05-18',
    updatedOn: '2026-05-18',
  },
  {
    id: 5005,
    projectId: 108,
    issueId: 1033,
    user: u(2),
    activity: 'Development',
    spentOn: '2026-05-17',
    hours: 5,
    comments: 'Integration retry path',
    createdOn: '2026-05-17',
    updatedOn: '2026-05-17',
  },
];

export const mockAllocations: ResourceAllocation[] = [
  {
    id: 9001,
    userId: 1,
    issueId: 1024,
    projectId: 101,
    startDate: '2026-05-18',
    endDate: '2026-05-25',
    allocatedHours: 16,
    spentHours: 6.5,
    allocationType: 'Auto',
    isOverloaded: false,
  },
  {
    id: 9002,
    userId: 1,
    issueId: 1026,
    projectId: 105,
    startDate: '2026-05-16',
    endDate: '2026-05-19',
    allocatedHours: 6,
    spentHours: 4,
    allocationType: 'Manual',
    isOverloaded: false,
  },
  {
    id: 9003,
    userId: 2,
    issueId: 1027,
    projectId: 103,
    startDate: '2026-05-11',
    endDate: '2026-05-22',
    allocatedHours: 24,
    spentHours: 10,
    allocationType: 'Auto',
    isOverloaded: true,
  },
  {
    id: 9004,
    userId: 3,
    issueId: 1028,
    projectId: 102,
    startDate: '2026-05-12',
    endDate: '2026-05-16',
    allocatedHours: 8,
    spentHours: 1.5,
    allocationType: 'Auto',
    isOverloaded: false,
  },
];

export const mockDirectoryLinks: DirectoryLink[] = [
  // Projects
  { id: 1, group: 'Projects', label: 'Major Projects', url: '#/projects/major', type: 'internal' },
  { id: 2, group: 'Projects', label: 'Basic Engineering Services', url: '#/projects/basic-eng', type: 'internal' },
  { id: 3, group: 'Projects', label: 'Custom Engineering Services', url: '#/projects/custom-eng', type: 'internal' },
  { id: 4, group: 'Projects', label: 'Certification Engineering Services', url: '#/projects/cert-eng', type: 'internal' },
  { id: 5, group: 'Projects', label: 'Continuous Improvement', url: '#/projects/ci', type: 'internal' },
  { id: 6, group: 'Projects', label: 'Work Instructions', url: '#/projects/work-instructions', type: 'internal' },
  { id: 7, group: 'Projects', label: 'CIQ Requests', url: '#/projects/ciq', type: 'internal' },
  // Support
  { id: 10, group: 'Support', label: 'Customer Support', url: '#/support/customer', type: 'internal' },
  { id: 11, group: 'Support', label: 'Sales Support', url: '#/support/sales', type: 'internal' },
  { id: 12, group: 'Support', label: 'Production Support', url: '#/support/production', type: 'internal' },
  { id: 13, group: 'Support', label: 'Quality Support', url: '#/support/quality', type: 'internal' },
  { id: 14, group: 'Support', label: 'Engineering Change Requests', url: '#/support/ecr', type: 'internal' },
  // Meetings
  { id: 20, group: 'Meetings', label: 'Engineering Huddles', url: '#/meetings/eng-huddles', type: 'internal' },
  { id: 21, group: 'Meetings', label: 'Continuous Improvement Meetings', url: '#/meetings/ci', type: 'internal' },
  { id: 22, group: 'Meetings', label: 'Production Alignment', url: '#/meetings/prod-align', type: 'internal' },
  { id: 23, group: 'Meetings', label: 'Management Review', url: '#/meetings/mgmt-review', type: 'internal' },
  // Other
  { id: 30, group: 'Other', label: 'Equipment', url: '#/other/equipment', type: 'internal' },
  { id: 31, group: 'Other', label: 'Management Tickets', url: '#/other/mgmt-tickets', type: 'internal' },
  { id: 32, group: 'Other', label: 'Reports', url: '#/reports', type: 'internal' },
  { id: 33, group: 'Other', label: 'Knowledge Base', url: '#/other/kb', type: 'internal' },
  // External
  { id: 40, group: 'External Links', label: 'SharePoint Home', url: 'https://example.com/sharepoint', type: 'external' },
  { id: 41, group: 'External Links', label: 'Quality Management System', url: 'https://example.com/qms', type: 'external' },
  { id: 42, group: 'External Links', label: 'CRM Support Hub', url: 'https://example.com/crm', type: 'external' },
  { id: 43, group: 'External Links', label: 'Document Library', url: 'https://example.com/docs', type: 'external' },
];

export const mockIssueStatuses: string[] = [
  'New',
  'In Progress',
  'Resolved',
  'Feedback',
  'Closed',
  'Rejected',
  'On Hold',
];

export const mockTrackers: string[] = ['Bug', 'Feature', 'Support', 'Task', 'KPI', 'Milestone'];
export const mockPriorities: string[] = ['Low', 'Normal', 'High', 'Urgent', 'Immediate'];
export const mockTimeActivities: string[] = [
  'Design',
  'Development',
  'Analysis',
  'Investigation',
  'QA',
  'Documentation',
  'Meeting',
];

// ─── Dashboard metric builders ───────────────────────────────────────────
//
// These functions take the data the page already has on hand (issues, time
// totals, etc.) and produce the typed DashboardMetric array used to render
// metric cards. Centralising card config keeps the page bodies short and
// lets the same metric show up on multiple pages (e.g. weekly hours on
// Dashboard, Reports, and Time Tracking) without three copies of the JSX.

interface MetricInputs {
  myIssues: Issue[];
  allIssues: Issue[];
  pastDueCount: number;
  weeklyHours: { logged: number; target: number };
  teamHours: { logged: number; target: number };
}

const safePercent = (value: number, total: number): number => {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
};

export function buildDashboardMetrics({
  myIssues,
  allIssues,
  pastDueCount,
  weeklyHours,
  teamHours,
}: MetricInputs): DashboardMetric[] {
  const inProgressCount = myIssues.filter((i) => i.status === 'In Progress').length;
  const unassignedCount = allIssues.filter((i) => !i.assignee).length;
  const waitingCount = allIssues.filter((i) => i.status === 'Feedback').length;
  const projectsAtRisk = 2; // mock — derived from project status in real impl
  const openKpis = 7; // mock — would come from a KPI tracker plugin

  const cards: DashboardMetric[] = [
    {
      id: 'tasks-assigned',
      title: 'Tasks assigned to you',
      value: myIssues.length,
      progress: safePercent(myIssues.length, Math.max(myIssues.length, 20)),
      statusLabel: `${inProgressCount} In Progress`,
      statusColor: 'blue',
      color: '#8B5CF6',
      caption: 'open',
      route: '/my-tasks',
    },
    {
      id: 'past-due',
      title: 'Past due tasks',
      value: pastDueCount,
      progress: safePercent(pastDueCount, Math.max(pastDueCount + 4, 10)),
      statusLabel: 'Action needed',
      statusColor: 'red',
      color: '#EF4444',
      caption: 'overdue',
      route: '/past-due',
    },
    {
      id: 'hours-week',
      title: 'Hours this week',
      value: weeklyHours.logged,
      total: weeklyHours.target,
      progress: safePercent(weeklyHours.logged, weeklyHours.target),
      statusLabel: `${weeklyHours.target}h target`,
      statusColor: 'gray',
      color: '#10B981',
      caption: 'logged',
      route: '/time',
    },
    {
      id: 'team-hours-week',
      title: 'Team hours this week',
      value: teamHours.logged,
      total: teamHours.target,
      progress: safePercent(teamHours.logged, teamHours.target),
      statusLabel: `${teamHours.target}h target`,
      statusColor: 'gray',
      color: '#F59E0B',
      caption: 'team',
      route: '/reports',
    },
    {
      id: 'unassigned',
      title: 'Unassigned tasks',
      value: unassignedCount,
      progress: safePercent(unassignedCount, Math.max(unassignedCount, 8)),
      statusLabel: 'Triage queue',
      statusColor: 'orange',
      color: '#F97316',
      caption: 'unassigned',
    },
    {
      id: 'at-risk',
      title: 'Projects at risk',
      value: projectsAtRisk,
      progress: safePercent(projectsAtRisk, 8),
      statusLabel: 'Schedule slipping',
      statusColor: 'red',
      color: '#EF4444',
      caption: 'at risk',
      route: '/projects',
    },
    {
      id: 'waiting',
      title: 'Tasks waiting for update',
      value: waitingCount,
      progress: safePercent(waitingCount, Math.max(waitingCount, 6)),
      statusLabel: 'Awaiting response',
      statusColor: 'yellow',
      color: '#EAB308',
      caption: 'awaiting',
    },
    {
      id: 'open-kpis',
      title: 'Open KPIs',
      value: openKpis,
      progress: safePercent(openKpis, 12),
      statusLabel: 'Quarterly view',
      statusColor: 'blue',
      color: '#3B82F6',
      caption: 'open',
      route: '/reports',
    },
  ];

  // Rings only on the hours cards (my hours + team hours); the rest show a
  // plain number.
  const RING_IDS = new Set(['hours-week', 'team-hours-week']);
  return cards.map((c) => (RING_IDS.has(c.id) ? c : { ...c, ring: false }));
}

interface TeamMetricInputs {
  /** Every issue across the team (all assignees). */
  allIssues: Issue[];
  /** Count of overdue team issues. */
  pastDueCount: number;
  /** Count of open team issues due within the next 7 days. */
  dueThisWeekCount: number;
  teamHours: { logged: number; target: number };
  /** Week label for the team-hours card title, e.g. "this week" / "last week". */
  teamHoursWeekLabel?: string;
}

/**
 * Team-scoped metric cards for the Dashboard "Your Team's Work" tab. Unlike
 * buildDashboardMetrics (which centers on the current user), every card here
 * reflects the whole team: total tasks, in-progress, past-due, unassigned,
 * the engineer roster, and team hours. Engineers are derived from assignees
 * since /users 403s for the non-admin key.
 */
export function buildTeamMetrics({
  allIssues,
  pastDueCount,
  dueThisWeekCount,
  teamHours,
  teamHoursWeekLabel = 'this week',
}: TeamMetricInputs): DashboardMetric[] {
  const inProgressCount = allIssues.filter((i) => i.status === 'In Progress').length;
  const unassignedCount = allIssues.filter((i) => !i.assignee).length;
  const waitingCount = allIssues.filter((i) => i.status === 'Feedback').length;
  const engineerIds = new Set(
    allIssues.map((i) => i.assignee?.id).filter((id): id is number => id !== undefined),
  );
  const engineerCount = engineerIds.size;

  const cards: DashboardMetric[] = [
    {
      id: 'team-tasks',
      title: 'Team tasks',
      value: allIssues.length,
      progress: safePercent(allIssues.length, Math.max(allIssues.length, 50)),
      statusLabel: 'All assignees',
      statusColor: 'blue',
      color: '#3B82F6',
      caption: 'total open',
    },
    {
      id: 'team-in-progress',
      title: 'In progress',
      value: inProgressCount,
      total: allIssues.length,
      progress: safePercent(inProgressCount, Math.max(allIssues.length, 1)),
      statusLabel: 'Active work',
      statusColor: 'blue',
      color: '#8B5CF6',
      caption: 'being worked',
    },
    {
      id: 'team-past-due',
      title: 'Team past due',
      value: pastDueCount,
      progress: safePercent(pastDueCount, Math.max(pastDueCount + 4, 10)),
      statusLabel: 'Action needed',
      statusColor: 'red',
      color: '#EF4444',
      caption: 'overdue',
      route: '/past-due',
    },
    {
      id: 'team-unassigned',
      title: 'Unassigned tasks',
      value: unassignedCount,
      progress: safePercent(unassignedCount, Math.max(unassignedCount, 8)),
      statusLabel: 'Triage queue',
      statusColor: 'orange',
      color: '#F97316',
      caption: 'unassigned',
    },
    {
      id: 'team-hours-week',
      title: `Team hours ${teamHoursWeekLabel}`,
      value: teamHours.logged,
      total: teamHours.target,
      progress: safePercent(teamHours.logged, teamHours.target),
      statusLabel: `${teamHours.target}h target`,
      statusColor: 'gray',
      color: '#F59E0B',
      caption: 'team',
      route: '/reports',
    },
    {
      id: 'team-engineers',
      title: 'Engineers',
      value: engineerCount,
      progress: 100,
      statusLabel: 'With assigned work',
      statusColor: 'green',
      color: '#10B981',
      caption: 'on the team',
    },
    {
      id: 'team-due-week',
      title: 'Due this week',
      value: dueThisWeekCount,
      progress: safePercent(dueThisWeekCount, Math.max(dueThisWeekCount, 10)),
      statusLabel: 'Next 7 days',
      statusColor: 'blue',
      color: '#0EA5E9',
      caption: 'due soon',
    },
    {
      id: 'team-waiting',
      title: 'Awaiting response',
      value: waitingCount,
      progress: safePercent(waitingCount, Math.max(waitingCount, 6)),
      statusLabel: 'Feedback',
      statusColor: 'yellow',
      color: '#EAB308',
      caption: 'waiting',
    },
  ];

  // Rings are reserved for the hours card; the rest show a plain number.
  return cards.map((c) => (c.id === 'team-hours-week' ? c : { ...c, ring: false }));
}

interface ReportMetricInputs {
  weeklyHours: { logged: number; target: number };
  teamHours: { logged: number; target: number };
  resolvedCount: number;
  openKpis: number;
  overloadedCount: number;
  timeEntries: number;
}

export function buildReportMetrics({
  weeklyHours,
  teamHours,
  resolvedCount,
  openKpis,
  overloadedCount,
  timeEntries,
}: ReportMetricInputs): DashboardMetric[] {
  return [
    {
      id: 'my-hours-week',
      title: 'My hours this week',
      value: weeklyHours.logged,
      total: weeklyHours.target,
      progress: safePercent(weeklyHours.logged, weeklyHours.target),
      statusLabel: 'Target 40h',
      statusColor: 'gray',
      color: '#10B981',
    },
    {
      id: 'team-hours-week',
      title: 'Team hours this week',
      value: teamHours.logged,
      total: teamHours.target,
      progress: safePercent(teamHours.logged, teamHours.target),
      statusLabel: 'Target 360h',
      statusColor: 'gray',
      color: '#F59E0B',
    },
    {
      id: 'resolved',
      title: 'Resolved issues',
      value: resolvedCount,
      progress: safePercent(resolvedCount, Math.max(resolvedCount + 5, 10)),
      statusLabel: 'This quarter',
      statusColor: 'green',
      color: '#10B981',
    },
    {
      id: 'open-kpis',
      title: 'Open KPIs',
      value: openKpis,
      progress: safePercent(openKpis, 12),
      statusLabel: 'Quarterly',
      statusColor: 'blue',
      color: '#3B82F6',
    },
    {
      id: 'overloaded',
      title: 'Overloaded engineers',
      value: overloadedCount,
      progress: safePercent(overloadedCount, Math.max(overloadedCount + 3, 8)),
      statusLabel: 'Watchlist',
      statusColor: 'red',
      color: '#EF4444',
    },
    {
      id: 'entries',
      title: 'Time entries',
      value: timeEntries,
      progress: safePercent(timeEntries, Math.max(timeEntries, 20)),
      statusLabel: 'This period',
      statusColor: 'blue',
      color: '#3B82F6',
    },
  ];
}

interface TimeMetricInputs {
  weeklyHours: { logged: number; target: number };
  teamHours: { logged: number; target: number };
  entryCount: number;
  averageHours: number;
  range: string;
}

export function buildTimeMetrics({
  weeklyHours,
  teamHours,
  entryCount,
  averageHours,
  range,
}: TimeMetricInputs): DashboardMetric[] {
  return [
    {
      id: 'my-hours',
      title: 'My hours this week',
      value: weeklyHours.logged,
      total: weeklyHours.target,
      progress: safePercent(weeklyHours.logged, weeklyHours.target),
      statusLabel: 'Target 40h',
      statusColor: 'gray',
      color: '#10B981',
      caption: 'logged',
    },
    {
      id: 'team-hours',
      title: 'Team hours this week',
      value: teamHours.logged,
      total: teamHours.target,
      progress: safePercent(teamHours.logged, teamHours.target),
      statusLabel: 'Target 360h',
      statusColor: 'gray',
      color: '#F59E0B',
      caption: 'team',
    },
    {
      id: 'entries',
      title: 'Entries this period',
      value: entryCount,
      progress: safePercent(entryCount, Math.max(entryCount, 30)),
      statusLabel: `${range} view`,
      statusColor: 'blue',
      color: '#3B82F6',
    },
    {
      id: 'avg',
      title: 'Average per entry',
      value: `${averageHours.toFixed(1)}h`,
      progress: safePercent(averageHours, 8),
      statusLabel: 'Across team',
      statusColor: 'gray',
      color: '#6366F1',
    },
  ];
}
