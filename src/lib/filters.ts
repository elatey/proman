import type { FilterRule, Task, ViewConfig, FieldDef, Status } from './types';
import { statusOf, isClosed, getState, statusesForList, memberName } from './store';
import { toDate, PRIORITIES } from './utils';
import { isToday, isPast, isThisWeek, addDays, isBefore, isAfter, startOfDay, endOfDay, differenceInCalendarDays } from 'date-fns';

export const BUILTIN_FILTER_FIELDS: { field: string; label: string; kind: 'status' | 'member' | 'priority' | 'date' | 'tag' | 'list' | 'text' | 'bool' | 'type' }[] = [
  { field: 'status', label: 'Status', kind: 'status' },
  { field: 'assignee', label: 'Assignee', kind: 'member' },
  { field: 'priority', label: 'Priority', kind: 'priority' },
  { field: 'dueDate', label: 'Due date', kind: 'date' },
  { field: 'startDate', label: 'Start date', kind: 'date' },
  { field: 'tags', label: 'Tags', kind: 'tag' },
  { field: 'list', label: 'List', kind: 'list' },
  { field: 'created_by', label: 'Created by', kind: 'member' },
  { field: 'watcher', label: 'Follower', kind: 'member' },
  { field: 'name', label: 'Task name', kind: 'text' },
  { field: 'type', label: 'Task type', kind: 'type' },
  { field: 'archived', label: 'Archived', kind: 'bool' },
];

export const DATE_OPS = [
  { op: 'today', label: 'Today' },
  { op: 'overdue', label: 'Overdue' },
  { op: 'thisweek', label: 'This week' },
  { op: 'next7', label: 'Next 7 days' },
  { op: 'before', label: 'Before' },
  { op: 'after', label: 'After' },
  { op: 'set', label: 'Is set' },
  { op: 'notset', label: 'Is not set' },
];

function dateMatch(v: string | null | undefined, op: string, value: any) {
  const d = toDate(v);
  if (op === 'set') return !!d;
  if (op === 'notset') return !d;
  if (!d) return false;
  switch (op) {
    case 'today': return isToday(d);
    case 'overdue': return isPast(d) && !isToday(d);
    case 'thisweek': return isThisWeek(d);
    case 'next7': return !isBefore(d, startOfDay(new Date())) && isBefore(d, endOfDay(addDays(new Date(), 7)));
    case 'before': return value ? isBefore(d, startOfDay(new Date(value))) : true;
    case 'after': return value ? isAfter(d, endOfDay(new Date(value))) : true;
  }
  return true;
}

function anyOf(have: any[], op: string, value: any) {
  const vals: any[] = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
  if (op === 'set') return have.length > 0;
  if (op === 'notset') return have.length === 0;
  if (!vals.length) return true;
  const hit = have.some((h) => vals.includes(h));
  return op === 'isnot' ? !hit : hit;
}

export function ruleMatches(t: Task, r: FilterRule, fields: Record<string, FieldDef>): boolean {
  const me = getState().user?.id;
  const sub = (v: any) => (v === '__me' ? me : v);
  const value = Array.isArray(r.value) ? r.value.map(sub) : sub(r.value);
  switch (r.field) {
    case 'status': return anyOf([statusOf(t)?.name], r.op, value);
    case 'assignee': return anyOf(t.assignees || [], r.op, value);
    case 'watcher': return anyOf(t.watchers || [], r.op, value);
    case 'created_by': return anyOf([t.created_by], r.op, value);
    case 'priority': return anyOf([t.priority || 0], r.op, Array.isArray(value) ? value.map(Number) : value != null ? Number(value) : value);
    case 'tags': return anyOf(t.tags || [], r.op, value);
    case 'list': return anyOf([t.listId, ...(t.extraLists || [])], r.op, value);
    case 'type': return anyOf([t.type || 'task'], r.op, value);
    case 'archived': return !!t.archived === (value === true || value === 'true');
    case 'dueDate': return dateMatch(t.dueDate, r.op, value);
    case 'startDate': return dateMatch(t.startDate, r.op, value);
    case 'name': {
      const has = t.name.toLowerCase().includes(String(value || '').toLowerCase());
      return r.op === 'notcontains' ? !has : has;
    }
  }
  const f = fields[r.field];
  if (f) {
    const v = t.fields?.[f.id];
    if (r.op === 'set') return v != null && v !== '' && !(Array.isArray(v) && !v.length);
    if (r.op === 'notset') return v == null || v === '' || (Array.isArray(v) && !v.length);
    if (['dropdown', 'labels', 'people'].includes(f.type)) return anyOf(Array.isArray(v) ? v : v ? [v] : [], r.op, value);
    if (f.type === 'checkbox') return !!v === (value === true || value === 'true');
    if (['number', 'money', 'rating', 'progress'].includes(f.type)) {
      const n = Number(v), x = Number(value);
      return r.op === 'gt' ? n > x : r.op === 'lt' ? n < x : n === x;
    }
    if (f.type === 'date') return dateMatch(v, r.op, value);
    const has = String(v || '').toLowerCase().includes(String(value || '').toLowerCase());
    return r.op === 'notcontains' ? !has : has;
  }
  return true;
}

export function applyFilters(tasks: Task[], cfg: ViewConfig, opts: { keepSubtasksTogether?: boolean } = {}): Task[] {
  const s = getState();
  const me = s.user?.id;
  const fields = s.data.field;
  const q = (cfg.search || '').trim().toLowerCase();
  const out = tasks.filter((t) => {
    if (t.archived && !(cfg.filters || []).some((r) => r.field === 'archived')) return false;
    if (!cfg.showClosed && isClosed(t)) return false;
    if (cfg.meMode && !(t.assignees || []).includes(me!)) return false;
    if (cfg.assigneeFilter?.length && !cfg.assigneeFilter.some((a) => (a === '__none' ? !t.assignees?.length : t.assignees?.includes(a)))) return false;
    if (q && !(t.name.toLowerCase().includes(q) || t.id.startsWith(q) || Object.values(t.fields || {}).some((v) => typeof v === 'string' && v.toLowerCase().includes(q)))) return false;
    const rules = cfg.filters || [];
    if (rules.length) {
      const res = rules.map((r) => ruleMatches(t, r, fields));
      if (cfg.filterMatch === 'any' ? !res.some(Boolean) : !res.every(Boolean)) return false;
    }
    return true;
  });
  return out;
}

export function sortTasks(tasks: Task[], cfg: ViewConfig): Task[] {
  const sorts = cfg.sortBy?.length ? cfg.sortBy : [];
  const val = (t: Task, f: string): any => {
    switch (f) {
      case 'name': return t.name.toLowerCase();
      case 'dueDate': return t.dueDate || '9999';
      case 'startDate': return t.startDate || '9999';
      case 'priority': return t.priority || 9;
      case 'created': return t.created_at || '';
      case 'updated': return t.updated_at || '';
      case 'status': {
        const st = statusesForList(t.listId);
        return st.findIndex((x) => x.id === t.status);
      }
      case 'assignee': return memberName(t.assignees?.[0]) || 'zzz';
      case 'estimate': return t.estimate || 0;
      case 'points': return t.points || 0;
      default: {
        const v = t.fields?.[f];
        return v == null ? '' : typeof v === 'string' ? v.toLowerCase() : v;
      }
    }
  };
  return [...tasks].sort((a, b) => {
    for (const s of sorts) {
      const x = val(a, s.field), y = val(b, s.field);
      if (x < y) return s.dir === 'asc' ? -1 : 1;
      if (x > y) return s.dir === 'asc' ? 1 : -1;
    }
    return (a.order || 0) - (b.order || 0);
  });
}

export interface Group { key: string; label: string; color: string; tasks: Task[]; status?: Status; meta?: any }

export const GROUP_OPTIONS = [
  { value: 'status', label: 'Status' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'priority', label: 'Priority' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'tags', label: 'Tags' },
  { value: 'list', label: 'List' },
  { value: 'type', label: 'Task type' },
  { value: 'none', label: 'None' },
];

export function statusesForLocation(listIds: string[]): Status[] {
  const seen = new Map<string, Status>();
  for (const l of listIds) for (const s of statusesForList(l)) if (!seen.has(s.name)) seen.set(s.name, s);
  if (!listIds.length) for (const s of statusesForList(null)) seen.set(s.name, s);
  const order: Record<string, number> = { notstarted: 0, active: 1, done: 2, closed: 3 };
  return [...seen.values()].sort((a, b) => order[a.type] - order[b.type]);
}

export function groupTasks(tasks: Task[], by: string | undefined, listIds: string[], showEmptyStatuses = true): Group[] {
  const s = getState();
  by = by || 'status';
  if (by === 'none') return [{ key: 'all', label: 'All tasks', color: '#8E8C99', tasks }];
  if (by === 'status') {
    const statuses = statusesForLocation(listIds);
    const groups: Group[] = statuses.map((st) => ({ key: st.name, label: st.name, color: st.color, status: st, tasks: [] }));
    for (const t of tasks) {
      const st = statusOf(t);
      let g = groups.find((x) => x.key === st?.name);
      if (!g) { g = { key: st?.name || '?', label: st?.name || 'Unknown', color: st?.color || '#888', status: st, tasks: [] }; groups.push(g); }
      g.tasks.push(t);
    }
    return showEmptyStatuses ? groups : groups.filter((g) => g.tasks.length);
  }
  if (by === 'assignee') {
    const map = new Map<string, Group>();
    for (const m of s.members) map.set(m.user_id, { key: m.user_id, label: m.profile.name, color: m.profile.color, tasks: [], meta: m.profile });
    const none: Group = { key: '__none', label: 'Unassigned', color: '#8E8C99', tasks: [] };
    for (const t of tasks) {
      if (!t.assignees?.length) none.tasks.push(t);
      for (const a of t.assignees || []) {
        if (!map.has(a)) map.set(a, { key: a, label: memberName(a), color: '#8E8C99', tasks: [] });
        map.get(a)!.tasks.push(t);
      }
    }
    return [...[...map.values()].filter((g) => g.tasks.length), none];
  }
  if (by === 'priority') {
    const gs: Group[] = PRIORITIES.map((p) => ({ key: String(p.value), label: p.label.toUpperCase(), color: p.color, tasks: [] }));
    const none: Group = { key: '0', label: 'NO PRIORITY', color: '#8E8C99', tasks: [] };
    for (const t of tasks) (gs.find((g) => g.key === String(t.priority)) || none).tasks.push(t);
    return [...gs, none];
  }
  if (by === 'dueDate') {
    const buckets: Group[] = [
      { key: 'overdue', label: 'Overdue', color: '#E5484D', tasks: [] },
      { key: 'today', label: 'Today', color: '#FFB224', tasks: [] },
      { key: 'tomorrow', label: 'Tomorrow', color: '#3E63DD', tasks: [] },
      { key: 'week', label: 'Next 7 days', color: '#6E56CF', tasks: [] },
      { key: 'later', label: 'Later', color: '#12A594', tasks: [] },
      { key: 'none', label: 'No due date', color: '#8E8C99', tasks: [] },
    ];
    for (const t of tasks) {
      const d = toDate(t.dueDate);
      const diff = d ? differenceInCalendarDays(d, new Date()) : null;
      const k = diff == null ? 'none' : diff < 0 ? 'overdue' : diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : diff <= 7 ? 'week' : 'later';
      buckets.find((b) => b.key === k)!.tasks.push(t);
    }
    return buckets;
  }
  if (by === 'tags') {
    const map = new Map<string, Group>();
    const none: Group = { key: '__none', label: 'No tags', color: '#8E8C99', tasks: [] };
    const tagColor = (n: string) => Object.values(s.data.tag).find((x) => x.name === n)?.color || '#8E8C99';
    for (const t of tasks) {
      if (!t.tags?.length) none.tasks.push(t);
      for (const tag of t.tags || []) {
        if (!map.has(tag)) map.set(tag, { key: tag, label: tag, color: tagColor(tag), tasks: [] });
        map.get(tag)!.tasks.push(t);
      }
    }
    return [...map.values(), none];
  }
  if (by === 'list') {
    const map = new Map<string, Group>();
    for (const t of tasks) {
      const l = s.data.list[t.listId];
      if (!map.has(t.listId)) map.set(t.listId, { key: t.listId, label: l?.name || 'List', color: l?.color || s.data.space[l?.spaceId || '']?.color || '#8E8C99', tasks: [] });
      map.get(t.listId)!.tasks.push(t);
    }
    return [...map.values()];
  }
  if (by === 'type') {
    const types = ['task', 'milestone', 'bug', 'feature', 'request'];
    return types.map((ty) => ({ key: ty, label: ty[0].toUpperCase() + ty.slice(1), color: '#8E8C99', tasks: tasks.filter((t) => (t.type || 'task') === ty) })).filter((g) => g.tasks.length || g.key === 'task');
  }
  // custom field (dropdown / labels / people / checkbox)
  const f = s.data.field[by];
  if (f) {
    if (f.type === 'dropdown' || f.type === 'labels') {
      const gs: Group[] = (f.options || []).map((o) => ({ key: o.id, label: o.label, color: o.color, tasks: [] }));
      const none: Group = { key: '__none', label: 'Empty', color: '#8E8C99', tasks: [] };
      for (const t of tasks) {
        const v = t.fields?.[f.id];
        const ids: string[] = Array.isArray(v) ? v : v ? [v] : [];
        if (!ids.length) none.tasks.push(t);
        for (const id of ids) gs.find((g) => g.key === id)?.tasks.push(t);
      }
      return [...gs, none];
    }
    if (f.type === 'checkbox') {
      return [
        { key: 'yes', label: 'Checked', color: '#30A46C', tasks: tasks.filter((t) => !!t.fields?.[f.id]) },
        { key: 'no', label: 'Unchecked', color: '#8E8C99', tasks: tasks.filter((t) => !t.fields?.[f.id]) },
      ];
    }
  }
  return [{ key: 'all', label: 'All tasks', color: '#8E8C99', tasks }];
}

/** Fields applicable at a location: workspace-wide + those defined on the location's ancestors/descendants. */
export function fieldsForLists(listIds: string[]): FieldDef[] {
  const s = getState();
  const set = new Set(listIds);
  const spaces = new Set<string>(), folders = new Set<string>();
  for (const id of listIds) {
    const l = s.data.list[id];
    if (!l) continue;
    spaces.add(l.spaceId);
    if (l.folderId) folders.add(l.folderId);
  }
  return Object.values(s.data.field).filter((f) =>
    f.scope.type === 'everything' ||
    (f.scope.type === 'space' && spaces.has(f.scope.id)) ||
    (f.scope.type === 'folder' && folders.has(f.scope.id)) ||
    (f.scope.type === 'list' && set.has(f.scope.id)));
}

/** Evaluate a simple formula like "field('Budget') - field('Cost')" or "{Budget} * 2". */
export function evalFormula(expr: string, t: Task): number | string {
  const s = getState();
  const byName = (n: string) => {
    const f = Object.values(s.data.field).find((x) => x.name.toLowerCase() === n.toLowerCase());
    if (!f) {
      if (n.toLowerCase() === 'estimate') return (t.estimate || 0) / 60;
      if (n.toLowerCase() === 'points') return t.points || 0;
      return 0;
    }
    const v = t.fields?.[f.id];
    if (f.type === 'date') return v ? Math.floor(new Date(v).getTime() / 86400000) : 0;
    return Number(v) || 0;
  };
  try {
    const js = expr
      .replace(/\{([^}]+)\}/g, (_, n) => String(byName(n)))
      .replace(/field\(\s*['"]([^'"]+)['"]\s*\)/g, (_, n) => String(byName(n)))
      .replace(/DAYS_UNTIL_DUE/g, String(t.dueDate ? differenceInCalendarDays(new Date(t.dueDate), new Date()) : 0));
    if (!/^[\d\s+\-*/().,%<>=!?:&|]*$/.test(js)) return '—';
    // eslint-disable-next-line no-new-func
    const r = Function(`"use strict"; return (${js || 0});`)();
    return typeof r === 'number' ? Math.round(r * 100) / 100 : String(r);
  } catch {
    return '—';
  }
}
