import { getState } from './store';
import type { Status, ViewType, LocationRef } from './types';
import { uid, defaultStatuses } from './utils';
import { addDays, formatISO, startOfDay } from 'date-fns';

const day = (n: number) => formatISO(addDays(startOfDay(new Date()), n));

export const defaultViews = (location: LocationRef): { kind: 'view'; data: any }[] =>
  (['list', 'board'] as ViewType[]).map((type, i) => ({
    kind: 'view',
    data: { name: type === 'list' ? 'List' : 'Board', type, location, config: { groupBy: 'status', showSubtasks: 'collapsed' }, order: i, pinned: false },
  }));

export interface SpaceTemplate {
  key: string;
  name: string;
  description: string;
  color: string;
  statuses: Omit<Status, 'id'>[];
  folders: { name: string; lists: { name: string; tasks: { name: string; status?: number; priority?: number; due?: number; start?: number; subtasks?: string[] }[] }[] }[];
  lists?: { name: string; tasks: { name: string; status?: number; priority?: number; due?: number; start?: number }[] }[];
  fields?: { name: string; type: any; options?: string[] }[];
  views?: ViewType[];
}

export const SPACE_TEMPLATES: SpaceTemplate[] = [
  {
    key: 'project', name: 'Project Management', description: 'Plan projects with phases, milestones and a Gantt chart.', color: '#6E56CF',
    statuses: [
      { name: 'TO DO', color: '#8E8C99', type: 'notstarted' },
      { name: 'IN PROGRESS', color: '#3E63DD', type: 'active' },
      { name: 'IN REVIEW', color: '#FFB224', type: 'active' },
      { name: 'COMPLETE', color: '#30A46C', type: 'closed' },
    ],
    folders: [{
      name: 'Projects',
      lists: [
        { name: 'Website Redesign', tasks: [
          { name: 'Kickoff meeting with stakeholders', status: 3, priority: 2, start: -6, due: -5 },
          { name: 'Audit current site content', status: 2, priority: 3, start: -4, due: -1, subtasks: ['Inventory pages', 'Collect analytics'] },
          { name: 'Wireframes for key pages', status: 1, priority: 2, start: -1, due: 3 },
          { name: 'Visual design system', status: 0, priority: 3, start: 3, due: 9 },
          { name: 'Build CMS templates', status: 0, priority: 3, start: 8, due: 16 },
          { name: 'Launch 🚀', status: 0, priority: 1, start: 18, due: 18 },
        ] },
        { name: 'Mobile App v2', tasks: [
          { name: 'Define MVP scope', status: 1, priority: 1, due: 2 },
          { name: 'User interviews', status: 0, priority: 3, due: 6 },
          { name: 'Prototype onboarding flow', status: 0, priority: 2, due: 10 },
        ] },
      ],
    }],
    fields: [{ name: 'Budget', type: 'money' }, { name: 'Phase', type: 'dropdown', options: ['Discovery', 'Design', 'Build', 'Launch'] }],
    views: ['list', 'board', 'gantt', 'calendar'],
  },
  {
    key: 'sprint', name: 'Agile / Sprints', description: 'Backlog, sprints, story points and bug tracking.', color: '#3E63DD',
    statuses: [
      { name: 'BACKLOG', color: '#8E8C99', type: 'notstarted' },
      { name: 'SELECTED', color: '#AB4ABA', type: 'active' },
      { name: 'IN PROGRESS', color: '#3E63DD', type: 'active' },
      { name: 'CODE REVIEW', color: '#FFB224', type: 'active' },
      { name: 'DONE', color: '#30A46C', type: 'done' },
      { name: 'CLOSED', color: '#2F2F37', type: 'closed' },
    ],
    folders: [{ name: 'Sprints', lists: [
      { name: 'Sprint 1', tasks: [
        { name: 'Auth: password reset flow', status: 2, priority: 2, due: 3 },
        { name: 'API rate limiting', status: 3, priority: 1, due: 1 },
        { name: 'Fix flaky CI tests', status: 1, priority: 3, due: 4 },
      ] },
      { name: 'Sprint 2', tasks: [{ name: 'Dark mode', status: 0 }, { name: 'Notifications service', status: 0 }] },
    ] }],
    lists: [{ name: 'Backlog', tasks: [{ name: 'Export to PDF' }, { name: 'SSO with Google' }, { name: 'Audit log' }] }, { name: 'Bugs', tasks: [{ name: 'Crash when uploading large file', priority: 1 }] }],
    fields: [{ name: 'Environment', type: 'labels', options: ['Web', 'iOS', 'Android', 'API'] }],
    views: ['list', 'board', 'table'],
  },
  {
    key: 'content', name: 'Content Calendar', description: 'Plan, write and publish content on a calendar.', color: '#D6409F',
    statuses: [
      { name: 'IDEA', color: '#8E8C99', type: 'notstarted' },
      { name: 'WRITING', color: '#6E56CF', type: 'active' },
      { name: 'EDITING', color: '#FFB224', type: 'active' },
      { name: 'SCHEDULED', color: '#0090FF', type: 'active' },
      { name: 'PUBLISHED', color: '#30A46C', type: 'closed' },
    ],
    folders: [],
    lists: [{ name: 'Content', tasks: [
      { name: 'Blog: 10 tips for remote teams', status: 1, due: 2 },
      { name: 'Newsletter #42', status: 2, due: 4 },
      { name: 'Case study: Acme Corp', status: 0, due: 9 },
      { name: 'Launch video script', status: 3, due: 6 },
    ] }],
    fields: [{ name: 'Channel', type: 'dropdown', options: ['Blog', 'Newsletter', 'LinkedIn', 'YouTube'] }],
    views: ['calendar', 'board', 'list'],
  },
  {
    key: 'crm', name: 'CRM / Sales Pipeline', description: 'Track leads and deals through your pipeline.', color: '#12A594',
    statuses: [
      { name: 'LEAD', color: '#8E8C99', type: 'notstarted' },
      { name: 'CONTACTED', color: '#0090FF', type: 'active' },
      { name: 'PROPOSAL', color: '#6E56CF', type: 'active' },
      { name: 'NEGOTIATION', color: '#FFB224', type: 'active' },
      { name: 'WON', color: '#30A46C', type: 'done' },
      { name: 'LOST', color: '#E5484D', type: 'closed' },
    ],
    folders: [],
    lists: [{ name: 'Deals', tasks: [{ name: 'Globex — annual plan', status: 2 }, { name: 'Initech — pilot', status: 1 }, { name: 'Umbrella — renewal', status: 3 }] }],
    fields: [{ name: 'Deal value', type: 'money' }, { name: 'Contact email', type: 'email' }, { name: 'Company size', type: 'number' }],
    views: ['board', 'list', 'table'],
  },
  {
    key: 'blank', name: 'Blank Space', description: 'Start from scratch with To Do → Complete.', color: '#8E8C99',
    statuses: [
      { name: 'TO DO', color: '#8E8C99', type: 'notstarted' },
      { name: 'IN PROGRESS', color: '#3E63DD', type: 'active' },
      { name: 'COMPLETE', color: '#30A46C', type: 'closed' },
    ],
    folders: [],
    lists: [{ name: 'List', tasks: [] }],
    views: ['list', 'board'],
  },
];

/** Create a Space (with folders, lists, tasks, fields, views) from a template. Returns the space id. */
export function createSpaceFromTemplate(tplKey: string, name?: string, color?: string): string {
  const s = getState();
  const tpl = SPACE_TEMPLATES.find((t) => t.key === tplKey) || SPACE_TEMPLATES[SPACE_TEMPLATES.length - 1];
  const me = s.user!.id;
  const others = s.members.map((m) => m.user_id);
  const pick = (i: number) => (others.length ? [others[i % others.length]] : [me]);
  const statuses = tpl.statuses.map((x) => ({ ...x, id: uid() }));
  const spaceId = uid();
  const order = Object.values(s.data.space).length;
  const items: { kind: any; id?: string; data: any }[] = [
    { kind: 'space', id: spaceId, data: { name: name || tpl.name, color: color || tpl.color, statuses, order, private: false } },
  ];
  const fieldIds: Record<string, { id: string; options?: { id: string; label: string; color: string }[] }> = {};
  for (const f of tpl.fields || []) {
    const id = uid();
    const opts = f.options?.map((label, i) => ({ id: uid(), label, color: ['#6E56CF', '#0090FF', '#12A594', '#FFB224', '#E5484D'][i % 5] }));
    fieldIds[f.name] = { id, options: opts };
    items.push({ kind: 'field', id, data: { name: f.name, type: f.type, scope: { type: 'space', id: spaceId }, options: opts } });
  }
  (tpl.views || ['list', 'board']).forEach((type, i) =>
    items.push({ kind: 'view', data: { name: type[0].toUpperCase() + type.slice(1), type, location: { type: 'space', id: spaceId }, config: { groupBy: 'status', showSubtasks: 'collapsed' }, order: i } }));
  let ti = 0;
  const addList = (l: SpaceTemplate['lists'] extends (infer U)[] | undefined ? U : never, folderId: string | null, idx: number) => {
    const listId = uid();
    items.push({ kind: 'list', id: listId, data: { name: l.name, spaceId, folderId, order: idx } });
    (l.tasks as any[]).forEach((t, k) => {
      const taskId = uid();
      const fields: Record<string, any> = {};
      const phase = fieldIds['Phase'];
      if (phase?.options) fields[phase.id] = phase.options[Math.min(k, phase.options.length - 1)].id;
      if (fieldIds['Budget']) fields[fieldIds['Budget'].id] = (k + 1) * 1500;
      if (fieldIds['Deal value']) fields[fieldIds['Deal value'].id] = (k + 2) * 4800;
      items.push({ kind: 'task', id: taskId, data: {
        name: t.name, listId, parentId: null, status: statuses[t.status || 0]?.id || statuses[0].id,
        priority: t.priority || null, assignees: pick(ti++), watchers: [me], tags: [], order: (k + 1) * 1000,
        startDate: t.start != null ? day(t.start) : null, dueDate: t.due != null ? day(t.due) : null, fields,
        type: /launch/i.test(t.name) ? 'milestone' : 'task', checklists: [],
      } });
      (t.subtasks || []).forEach((sub: string, j: number) => items.push({ kind: 'task', data: {
        name: sub, listId, parentId: taskId, status: statuses[0].id, assignees: [], watchers: [me], tags: [], order: (j + 1) * 1000, checklists: [],
      } }));
    });
  };
  tpl.folders.forEach((f, i) => {
    const folderId = uid();
    items.push({ kind: 'folder', id: folderId, data: { name: f.name, spaceId, order: i } });
    f.lists.forEach((l, j) => addList(l as any, folderId, j));
  });
  (tpl.lists || []).forEach((l, j) => addList(l as any, null, 100 + j));
  s.createMany(items);
  return spaceId;
}

/** Fills a brand-new workspace with a useful starting point. */
export async function seedWorkspace() {
  const s = getState();
  const me = s.user!.id;
  const spaceId = createSpaceFromTemplate('project', 'Team Space', '#6E56CF');
  const st = getState();
  const tasks = Object.values(st.data.task).filter((t) => st.data.list[t.listId]?.spaceId === spaceId && !t.parentId).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  // a dependency chain so the Gantt view has something to show
  const links = tasks.slice(0, 4).map((t, i, arr) => (i < arr.length - 1 ? { kind: 'link', data: { from: t.id, to: arr[i + 1].id, type: 'blocks' } } : null)).filter(Boolean) as any[];
  const channelId = uid();
  const docId = uid();
  st.createMany([
    ...links,
    { kind: 'tag', data: { name: 'design', color: '#D6409F', spaceId } },
    { kind: 'tag', data: { name: 'frontend', color: '#0090FF', spaceId } },
    { kind: 'tag', data: { name: 'blocked', color: '#E5484D', spaceId } },
    { kind: 'channel', id: channelId, data: { name: 'general', description: 'Company-wide announcements and chatter', members: [] } },
    { kind: 'message', data: { channelId, author: me, body: '<p>Welcome to <strong>ProMan</strong> 👋 Use this channel for team-wide updates.</p>', reactions: {} } },
    { kind: 'doc', id: docId, data: {
      title: 'Welcome to ProMan', icon: '👋', location: { type: 'space', id: spaceId }, parentId: null, order: 0, wiki: true,
      content: `<h1>Welcome to ProMan</h1><p>ProMan keeps your team's tasks, docs, chat, goals and dashboards in one place.</p><h2>How work is organised</h2><ul><li><p><strong>Workspace</strong> → your whole organisation</p></li><li><p><strong>Spaces</strong> → teams or departments</p></li><li><p><strong>Folders</strong> → projects (optional)</p></li><li><p><strong>Lists</strong> → hold tasks</p></li><li><p><strong>Tasks</strong> → subtasks → checklists</p></li></ul><h2>Get started</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Create your workspace</p></li><li data-type="taskItem" data-checked="false"><p>Invite your team from <em>Settings → People</em></p></li><li data-type="taskItem" data-checked="false"><p>Open a List and switch between List, Board, Calendar and Gantt views</p></li><li data-type="taskItem" data-checked="false"><p>Press <code>Ctrl/⌘ + K</code> to search anything</p></li></ul><blockquote><p>Tip: type <code>/</code> in any Doc for formatting commands.</p></blockquote>`,
    } },
    { kind: 'dashboard', data: { name: 'Team Overview', location: null, widgets: [
      { id: uid(), type: 'count', title: 'Open tasks', w: 3, h: 1, config: { location: { type: 'everything', id: 'all' } } },
      { id: uid(), type: 'overdue', title: 'Overdue', w: 3, h: 1, config: { location: { type: 'everything', id: 'all' } } },
      { id: uid(), type: 'calc', title: 'Total budget', w: 3, h: 1, config: { location: { type: 'everything', id: 'all' }, op: 'sum', field: Object.values(st.data.field).find((f) => f.name === 'Budget')?.id } },
      { id: uid(), type: 'timeTracked', title: 'Time tracked', w: 3, h: 1, config: {} },
      { id: uid(), type: 'statusPie', title: 'Tasks by status', w: 6, h: 2, config: { location: { type: 'everything', id: 'all' } } },
      { id: uid(), type: 'assigneeBar', title: 'Workload by assignee', w: 6, h: 2, config: { location: { type: 'everything', id: 'all' } } },
      { id: uid(), type: 'completedLine', title: 'Completed over time', w: 6, h: 2, config: { location: { type: 'everything', id: 'all' } } },
      { id: uid(), type: 'taskList', title: 'Due this week', w: 6, h: 2, config: { location: { type: 'everything', id: 'all' }, filters: [{ id: uid(), field: 'dueDate', op: 'next7' }] } },
    ] } },
    { kind: 'goal', data: { name: 'Launch the new website', color: '#6E56CF', dueDate: day(30), owners: [me], description: 'Ship the redesigned website by end of quarter.', folderId: null, targets: [
      { id: uid(), name: 'Website tasks complete', type: 'tasks', start: 0, target: 0, current: 0, listId: tasks[0]?.listId },
      { id: uid(), name: 'Pages migrated', type: 'number', start: 0, target: 40, current: 12, unit: 'pages' },
      { id: uid(), name: 'Stakeholder sign-off', type: 'boolean', start: 0, target: 1, current: 0 },
    ] } },
    { kind: 'template', data: { name: 'Bug report', type: 'task', description: 'Standard bug report with repro checklist', payload: {
      description: '<h3>Steps to reproduce</h3><ol><li><p></p></li></ol><h3>Expected</h3><p></p><h3>Actual</h3><p></p>',
      checklists: [{ id: uid(), name: 'Triage', items: [{ id: uid(), text: 'Reproduced', done: false }, { id: uid(), text: 'Severity assessed', done: false }, { id: uid(), text: 'Owner assigned', done: false }] }],
      tags: [], subtasks: [], priority: 2, type: 'bug',
    } } },
    { kind: 'template', data: { name: 'Meeting notes', type: 'task', description: 'Agenda, notes and action items', payload: {
      description: '<h3>Agenda</h3><ul><li><p></p></li></ul><h3>Notes</h3><p></p><h3>Action items</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
      checklists: [], tags: [], subtasks: [],
    } } },
  ]);
}
