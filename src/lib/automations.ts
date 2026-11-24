// Automation engine: Trigger -> optional Conditions -> Actions (run in order).
// Runs in the browser of whoever made the change, so it works on any free host.
// Date-based triggers are evaluated by a 1-minute ticker in every open client and
// de-duplicated with a `fired` map stored on the automation.
import type { Automation, AutomationAction, Task } from './types';
import { addDays, formatISO, startOfDay, isBefore } from 'date-fns';

export interface TaskEvent { type: 'created' | 'updated' | 'comment' | 'time' | 'button'; task: Task; prev: Task | null; depth?: number; fieldId?: string }

export const TRIGGERS: { type: string; label: string; needs?: 'status' | 'priority' | 'member' | 'tag' | 'field' | 'days' | 'list' }[] = [
  { type: 'task_created', label: 'Task or subtask created' },
  { type: 'status_changed', label: 'Status changes', needs: 'status' },
  { type: 'assignee_added', label: 'Assignee added', needs: 'member' },
  { type: 'assignee_removed', label: 'Assignee removed', needs: 'member' },
  { type: 'priority_changed', label: 'Priority changes', needs: 'priority' },
  { type: 'due_date_changed', label: 'Due date changes' },
  { type: 'start_date_changed', label: 'Start date changes' },
  { type: 'due_date_arrives', label: 'Due date arrives' },
  { type: 'start_date_arrives', label: 'Start date arrives' },
  { type: 'date_before_after', label: 'Date is before/after due date', needs: 'days' },
  { type: 'tag_added', label: 'Tag added', needs: 'tag' },
  { type: 'tag_removed', label: 'Tag removed', needs: 'tag' },
  { type: 'comment_added', label: 'Comment is added' },
  { type: 'field_changed', label: 'Custom Field changes', needs: 'field' },
  { type: 'name_changed', label: 'Task name changes' },
  { type: 'moved_to_list', label: 'Task moved to this location' },
  { type: 'checklists_resolved', label: 'Checklists resolved' },
  { type: 'subtasks_resolved', label: 'Subtasks resolved' },
  { type: 'time_tracked', label: 'Time tracked' },
  { type: 'task_unblocked', label: 'Task unblocked' },
  { type: 'button_clicked', label: 'Button Custom Field clicked', needs: 'field' },
];

export const ACTIONS: { type: string; label: string; needs?: 'status' | 'priority' | 'member' | 'tag' | 'text' | 'days' | 'list' | 'field' | 'url' | 'minutes' | 'channel' | 'template' }[] = [
  { type: 'change_status', label: 'Change status', needs: 'status' },
  { type: 'change_priority', label: 'Change priority', needs: 'priority' },
  { type: 'add_assignee', label: 'Add assignee', needs: 'member' },
  { type: 'remove_assignee', label: 'Remove assignee', needs: 'member' },
  { type: 'assign_creator', label: 'Assign the task creator' },
  { type: 'add_watcher', label: 'Add follower', needs: 'member' },
  { type: 'add_tag', label: 'Add tag', needs: 'tag' },
  { type: 'remove_tag', label: 'Remove tag', needs: 'tag' },
  { type: 'set_due', label: 'Change due date (days after trigger)', needs: 'days' },
  { type: 'set_start', label: 'Change start date (days after trigger)', needs: 'days' },
  { type: 'add_comment', label: 'Add a comment', needs: 'text' },
  { type: 'create_subtask', label: 'Create a subtask', needs: 'text' },
  { type: 'create_task', label: 'Create a task', needs: 'list' },
  { type: 'move_to_list', label: 'Move to List', needs: 'list' },
  { type: 'duplicate', label: 'Duplicate task', needs: 'list' },
  { type: 'archive', label: 'Archive task' },
  { type: 'delete', label: 'Delete task' },
  { type: 'apply_template', label: 'Apply a task template', needs: 'template' },
  { type: 'set_field', label: 'Update Custom Field', needs: 'field' },
  { type: 'estimate', label: 'Estimate time (minutes)', needs: 'minutes' },
  { type: 'rename', label: 'Change task name ({name} = current)', needs: 'text' },
  { type: 'send_message', label: 'Send a channel message', needs: 'channel' },
  { type: 'webhook', label: 'Call webhook (POST JSON)', needs: 'url' },
];

export const CONDITION_FIELDS = [
  { field: 'status', label: 'Status' },
  { field: 'priority', label: 'Priority' },
  { field: 'assignee', label: 'Assignee' },
  { field: 'tag', label: 'Tag' },
  { field: 'type', label: 'Task type' },
  { field: 'subtask', label: 'Is subtask' },
];

type Api = {
  get: () => any;
  updateTask: (id: string, patch: Partial<Task>) => void;
  createTask: (t: any) => Task;
  deleteTask: (id: string) => void;
  duplicateTask: (id: string, listId?: string) => Task | null;
  addComment: (c: any) => void;
  create: (kind: any, data: any) => any;
  update: (kind: any, id: string, patch: any) => void;
};

const statusName = (api: Api, t: Task, id?: string) => {
  const { statusesForList } = storeHelpers();
  return statusesForList(t.listId).find((s: any) => s.id === id)?.name;
};

// late import avoids a circular module init between store.ts and automations.ts
let helpers: any = null;
const storeHelpers = () => helpers;
export const registerHelpers = (h: any) => { helpers = h; };

const allChecklistsDone = (t: Task) => {
  const items = (t.checklists || []).flatMap((c) => c.items);
  return items.length > 0 && items.every((i) => i.done);
};

function matches(a: Automation, ev: TaskEvent, api: Api): Task[] {
  const { task: t, prev } = ev;
  const tr = a.trigger;
  const changed = (k: keyof Task) => ev.type === 'updated' && prev && JSON.stringify(prev[k] ?? null) !== JSON.stringify(t[k] ?? null);
  switch (tr.type) {
    case 'task_created': return ev.type === 'created' ? [t] : [];
    case 'status_changed': {
      if (!changed('status')) return [];
      const fromN = statusName(api, prev!, prev!.status), toN = statusName(api, t, t.status);
      if (tr.from && tr.from !== fromN) return [];
      if (tr.to && tr.to !== toN) return [];
      return [t];
    }
    case 'assignee_added': {
      if (!changed('assignees')) return [];
      const added = (t.assignees || []).filter((x) => !(prev!.assignees || []).includes(x));
      return added.length && (!tr.value || added.includes(tr.value)) ? [t] : [];
    }
    case 'assignee_removed': {
      if (!changed('assignees')) return [];
      const removed = (prev!.assignees || []).filter((x) => !(t.assignees || []).includes(x));
      return removed.length && (!tr.value || removed.includes(tr.value)) ? [t] : [];
    }
    case 'priority_changed':
      if (!changed('priority')) return [];
      if (tr.from != null && tr.from !== '' && Number(tr.from) !== (prev!.priority || 0)) return [];
      if (tr.to != null && tr.to !== '' && Number(tr.to) !== (t.priority || 0)) return [];
      return [t];
    case 'due_date_changed': return changed('dueDate') ? [t] : [];
    case 'start_date_changed': return changed('startDate') ? [t] : [];
    case 'tag_added': {
      if (!changed('tags')) return [];
      const added = (t.tags || []).filter((x) => !(prev!.tags || []).includes(x));
      return added.length && (!tr.value || added.includes(tr.value)) ? [t] : [];
    }
    case 'tag_removed': {
      if (!changed('tags')) return [];
      const removed = (prev!.tags || []).filter((x) => !(t.tags || []).includes(x));
      return removed.length && (!tr.value || removed.includes(tr.value)) ? [t] : [];
    }
    case 'comment_added': return ev.type === 'comment' ? [t] : [];
    case 'field_changed':
      if (ev.type !== 'updated' || !prev || !tr.field) return [];
      if (JSON.stringify(prev.fields?.[tr.field] ?? null) === JSON.stringify(t.fields?.[tr.field] ?? null)) return [];
      if (tr.to != null && tr.to !== '' && String(t.fields?.[tr.field]) !== String(tr.to)) return [];
      return [t];
    case 'name_changed': return changed('name') ? [t] : [];
    case 'moved_to_list': return changed('listId') ? [t] : [];
    case 'checklists_resolved': return ev.type === 'updated' && prev && allChecklistsDone(t) && !allChecklistsDone(prev) ? [t] : [];
    case 'subtasks_resolved': {
      if (!changed('status') || !t.parentId) return [];
      const s = api.get();
      const parent = s.data.task[t.parentId];
      if (!parent) return [];
      const subs = Object.values(s.data.task as Record<string, Task>).filter((x) => x.parentId === parent.id);
      const closed = (x: Task) => { const st = helpers.statusesForList(x.listId).find((y: any) => y.id === x.status); return st && (st.type === 'closed' || st.type === 'done'); };
      return subs.length && subs.every(closed) ? [parent] : [];
    }
    case 'time_tracked': return ev.type === 'time' ? [t] : [];
    case 'task_unblocked': {
      if (!changed('status')) return [];
      const st = helpers.statusesForList(t.listId).find((y: any) => y.id === t.status);
      if (!st || (st.type !== 'closed' && st.type !== 'done')) return [];
      const s = api.get();
      // tasks that t was blocking and that are now fully unblocked
      return Object.values(s.data.link as Record<string, any>)
        .filter((l) => l.type === 'blocks' && l.from === t.id)
        .map((l) => s.data.task[l.to])
        .filter(Boolean)
        .filter((blocked: Task) => Object.values(s.data.link as Record<string, any>).filter((l) => l.type === 'blocks' && l.to === blocked.id).every((l) => {
          const b = s.data.task[l.from];
          if (!b) return true;
          const bs = helpers.statusesForList(b.listId).find((y: any) => y.id === b.status);
          return bs && (bs.type === 'closed' || bs.type === 'done');
        }));
    }
    case 'button_clicked': return ev.type === 'button' && ev.fieldId === tr.field ? [t] : [];
    default: return [];
  }
}

function conditionsOk(a: Automation, t: Task, api: Api) {
  return (a.conditions || []).every((c) => {
    let v: any;
    let has: boolean;
    switch (c.field) {
      case 'status': v = statusName(api, t, t.status); has = v === c.value; break;
      case 'priority': v = t.priority || 0; has = Number(c.value) === v; break;
      case 'assignee': has = (t.assignees || []).includes(c.value); v = t.assignees?.length; break;
      case 'tag': has = (t.tags || []).includes(c.value); v = t.tags?.length; break;
      case 'type': has = (t.type || 'task') === c.value; v = t.type; break;
      case 'subtask': has = !!t.parentId === (c.value === 'yes' || c.value === true); v = t.parentId; break;
      default: has = false;
    }
    if (c.op === 'is') return has;
    if (c.op === 'isnot') return !has;
    if (c.op === 'set') return !!v;
    if (c.op === 'notset') return !v;
    return true;
  });
}

const interpolate = (s: string, t: Task) => (s || '').replace(/\{name\}/g, t.name).replace(/\{id\}/g, t.id.slice(0, 7));

function runActions(a: Automation, t: Task, api: Api) {
  const s = api.get();
  for (const act of a.actions || []) {
    const cur: Task = api.get().data.task[t.id] || t;
    if (!api.get().data.task[t.id] && act.type !== 'webhook') break;
    try { runAction(act, cur, api, s); } catch (e) { console.error('Automation action failed', act, e); }
  }
  api.update('automation', a.id, { runs: (a.runs || 0) + 1 });
}

function runAction(act: AutomationAction, t: Task, api: Api, s: any) {
  const v = act.value;
  switch (act.type) {
    case 'change_status': {
      const st = helpers.statusesForList(t.listId).find((x: any) => x.name === v || x.id === v);
      if (st && st.id !== t.status) api.updateTask(t.id, { status: st.id });
      break;
    }
    case 'change_priority': api.updateTask(t.id, { priority: v ? Number(v) as any : null }); break;
    case 'add_assignee': if (v && !t.assignees.includes(v)) api.updateTask(t.id, { assignees: [...t.assignees, v] }); break;
    case 'remove_assignee': api.updateTask(t.id, { assignees: v ? t.assignees.filter((x) => x !== v) : [] }); break;
    case 'assign_creator': if (t.created_by && !t.assignees.includes(t.created_by)) api.updateTask(t.id, { assignees: [...t.assignees, t.created_by] }); break;
    case 'add_watcher': if (v && !t.watchers.includes(v)) api.updateTask(t.id, { watchers: [...t.watchers, v] }); break;
    case 'add_tag': if (v && !t.tags.includes(v)) api.updateTask(t.id, { tags: [...t.tags, v] }); break;
    case 'remove_tag': api.updateTask(t.id, { tags: t.tags.filter((x) => x !== v) }); break;
    case 'set_due': api.updateTask(t.id, { dueDate: formatISO(addDays(startOfDay(new Date()), Number(act.days || 0))) }); break;
    case 'set_start': api.updateTask(t.id, { startDate: formatISO(addDays(startOfDay(new Date()), Number(act.days || 0))) }); break;
    case 'add_comment': api.addComment({ taskId: t.id, body: `<p>${escapeHtml(interpolate(act.text || '', t))}</p>` }); break;
    case 'create_subtask': api.createTask({ name: interpolate(act.text || 'New subtask', t), listId: t.listId, parentId: t.id }); break;
    case 'create_task': api.createTask({ name: interpolate(act.text || 'Task (created from Automation)', t), listId: act.listId || t.listId }); break;
    case 'move_to_list': if (act.listId && act.listId !== t.listId) api.updateTask(t.id, { listId: act.listId }); break;
    case 'duplicate': api.duplicateTask(t.id, act.listId || undefined); break;
    case 'archive': api.updateTask(t.id, { archived: true }); break;
    case 'delete': api.deleteTask(t.id); break;
    case 'apply_template': {
      const tpl = s.data.template[v];
      if (tpl?.payload) {
        const p = tpl.payload;
        api.updateTask(t.id, {
          description: t.description || p.description,
          checklists: [...(t.checklists || []), ...(p.checklists || [])],
          tags: Array.from(new Set([...(t.tags || []), ...(p.tags || [])])),
        });
        for (const sub of p.subtasks || []) api.createTask({ name: sub.name, listId: t.listId, parentId: t.id });
      }
      break;
    }
    case 'set_field': if (act.field) api.updateTask(t.id, { fields: { ...(t.fields || {}), [act.field]: v } }); break;
    case 'estimate': api.updateTask(t.id, { estimate: Number(v) || null }); break;
    case 'rename': api.updateTask(t.id, { name: interpolate(act.text || t.name, t) }); break;
    case 'send_message':
      if (v) api.create('message', { channelId: v, author: s.user.id, body: `<p>${escapeHtml(interpolate(act.text || 'Update on {name}', t))}</p>`, taskId: t.id, reactions: {} });
      break;
    case 'webhook':
      if (act.url) fetch(act.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'automation', task: t }) }).catch(() => {});
      break;
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function automationsFor(t: Task, api: Api): Automation[] {
  const s = api.get();
  return (Object.values(s.data.automation) as Automation[]).filter((a) => a.enabled && helpers.listsIn(a.location).includes(t.listId));
}

export function runAutomations(ev: TaskEvent, api: Api) {
  if (!helpers) return;
  if ((ev.depth || 0) >= 2) return; // stop automation loops
  if (helpers.clickApp && !helpers.clickApp('automations')) return;
  for (const a of automationsFor(ev.task, api)) {
    const targets = matches(a, ev, api);
    for (const t of targets) if (conditionsOk(a, t, api)) runActions(a, t, api);
  }
}

/** Fires date-based triggers. Called once a minute by every open client. */
export function tickAutomations(api: Api) {
  if (!helpers) return;
  const s = api.get();
  const now = new Date();
  for (const a of Object.values(s.data.automation) as Automation[]) {
    if (!a.enabled || !['due_date_arrives', 'start_date_arrives', 'date_before_after'].includes(a.trigger.type)) continue;
    const lists = new Set(helpers.listsIn(a.location));
    const fired = { ...(a.fired || {}) };
    let dirty = false;
    for (const t of Object.values(s.data.task) as Task[]) {
      if (!lists.has(t.listId) || t.archived) continue;
      const base = a.trigger.type === 'start_date_arrives' ? t.startDate : t.dueDate;
      if (!base) continue;
      let at = new Date(base);
      if (a.trigger.type === 'date_before_after') at = addDays(at, (a.trigger.when === 'after' ? 1 : -1) * Number(a.trigger.days || 1));
      if (!t.dueTime || a.trigger.type === 'date_before_after') at = startOfDay(at);
      const key = `${t.id}:${base}`;
      if (fired[key] || isBefore(now, at)) continue;
      // only fire for dates within the last 2 days (don't flood on first enable)
      if (now.getTime() - at.getTime() > 2 * 86400000) { fired[key] = 'skipped'; dirty = true; continue; }
      fired[key] = now.toISOString();
      dirty = true;
      if (conditionsOk(a, t, api)) runActions(a, t, api);
    }
    if (dirty) api.update('automation', a.id, { fired });
  }
}
