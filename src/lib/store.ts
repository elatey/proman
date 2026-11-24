import { create } from 'zustand';
import { backend } from './backend';
import type {
  Entity, EntityOf, Kind, Member, Invite, Profile, RawItem, Role, Status, Task, Workspace, List, Folder, Space,
  Notification, ClickApp, Recurrence,
} from './types';
import { uid, defaultStatuses, stripHtml } from './utils';
import { addDays, addMonths, addWeeks, addYears, formatISO } from 'date-fns';
import { runAutomations, registerHelpers, type TaskEvent } from './automations';

type ByKind = { [K in Kind]: Record<string, EntityOf<K>> };
const emptyByKind = (): ByKind => ({
  space: {}, folder: {}, list: {}, task: {}, link: {}, comment: {}, activity: {}, time: {}, field: {}, view: {},
  doc: {}, whiteboard: {}, dashboard: {}, goal: {}, goalFolder: {}, automation: {}, notification: {}, channel: {},
  message: {}, reminder: {}, template: {}, tag: {}, attachment: {}, clip: {}, block: {},
});

const BASE = ['id', 'kind', 'created_by', 'created_at', 'updated_at'];
const toEntity = (r: RawItem): Entity => ({ ...(r.data || {}), id: r.id, kind: r.kind, created_by: r.created_by, created_at: r.created_at, updated_at: r.updated_at }) as Entity;
const dataOf = (e: Record<string, any>) => {
  const d: Record<string, any> = {};
  for (const k of Object.keys(e)) if (!BASE.includes(k) && e[k] !== undefined) d[k] = e[k];
  return d;
};

// Local edits that have not yet been confirmed by the server. When a realtime echo of an
// older write arrives, we re-apply these so fast typing never "jumps back".
const pending = new Map<string, { patch: Record<string, any>; until: number }>();

export interface Toast { id: string; text: string; tone?: 'info' | 'error' | 'success'; action?: { label: string; run: () => void } }

interface State {
  authReady: boolean;
  user: Profile | null;
  workspaces: Workspace[];
  workspace: Workspace | null;
  members: Member[];
  invites: Invite[];
  online: string[];
  loading: boolean;
  data: ByKind;
  openTaskId: string | null;
  sidebarOpen: boolean;
  toasts: Toast[];
  paletteOpen: boolean;
  createOpen: null | 'task' | 'doc' | 'reminder' | 'whiteboard' | 'dashboard' | 'channel';
  createDefaults: Partial<Task>;
  tray: string[];

  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (p: Partial<Profile>) => Promise<void>;
  loadWorkspaces: () => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string, color: string, seed?: boolean) => Promise<Workspace>;
  updateWorkspace: (patch: Partial<Workspace>) => Promise<void>;
  refreshMembers: () => Promise<void>;
  inviteMember: (email: string, role: Role) => Promise<{ joined: boolean }>;

  create: <K extends Kind>(kind: K, data: Partial<EntityOf<K>>, opts?: { id?: string }) => EntityOf<K>;
  createMany: (items: { kind: Kind; data: any; id?: string }[]) => Entity[];
  update: <K extends Kind>(kind: K, id: string, patch: Partial<EntityOf<K>>) => void;
  remove: (kind: Kind, id: string) => void;
  removeMany: (refs: { kind: Kind; id: string }[]) => void;

  createTask: (t: Partial<Task> & { listId: string; name: string }, opts?: { silent?: boolean; fromAutomation?: boolean }) => Task;
  updateTask: (id: string, patch: Partial<Task>, opts?: { fromAutomation?: boolean; silent?: boolean }) => void;
  deleteTask: (id: string) => void;
  duplicateTask: (id: string, listId?: string) => Task | null;
  addComment: (c: { taskId?: string; docId?: string; body: string; parentId?: string | null; assignee?: string | null }) => void;
  notify: (n: Omit<Notification, 'id' | 'kind'>) => void;
  logActivity: (taskId: string, text: string, field?: string) => void;

  openTask: (id: string | null) => void;
  toast: (text: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  dismissToast: (id: string) => void;
  set: (p: Partial<State>) => void;
}

let unsub: (() => void) | null = null;

export const useStore = create<State>((set, get) => {
  const applyUpsert = (raw: RawItem) => {
    let e = toEntity(raw);
    const p = pending.get(raw.id);
    if (p) {
      if (p.until && p.until < Date.now()) pending.delete(raw.id);
      else e = { ...e, ...p.patch } as Entity;
    }
    set((s) => ({ data: { ...s.data, [e.kind]: { ...s.data[e.kind], [e.id]: e } } }));
  };
  const applyRemove = (id: string) => {
    set((s) => {
      for (const k of Object.keys(s.data) as Kind[]) {
        if (s.data[k][id]) {
          const next = { ...s.data[k] };
          delete next[id];
          return { data: { ...s.data, [k]: next } };
        }
      }
      return {};
    });
  };
  // Attachments and clips point at uploaded files: free the storage when the item goes.
  const deleteFilesOf = (refs: { kind: Kind; id: string }[]) => {
    const d = get().data;
    for (const r of refs) {
      const e: any = r.kind === 'attachment' ? d.attachment[r.id] : r.kind === 'clip' ? d.clip[r.id] : null;
      // a clip attached to a task shares its URL; keep the file while any other item still uses it
      if (e?.url && ![...Object.values(d.attachment), ...Object.values(d.clip)].some((x: any) => x.id !== e.id && x.url === e.url && !refs.some((q) => q.id === x.id)))
        backend.deleteFile(e.url).catch(() => {});
    }
  };
  const wsId = () => get().workspace!.id;
  const me = () => get().user!.id;
  const fail = (e: any) => get().toast(e?.message || 'Something went wrong while saving', 'error');

  const automationApi = () => ({
    get: () => get(),
    updateTask: (id: string, patch: Partial<Task>) => get().updateTask(id, patch, { fromAutomation: true }),
    createTask: (t: any) => get().createTask(t, { fromAutomation: true }),
    deleteTask: (id: string) => get().deleteTask(id),
    duplicateTask: (id: string, listId?: string) => get().duplicateTask(id, listId),
    addComment: (c: any) => get().addComment(c),
    create: get().create,
    update: get().update,
  });

  const fire = (ev: TaskEvent) => {
    try { runAutomations(ev, automationApi()); } catch (e) { console.error('automation error', e); }
  };

  return {
    authReady: false,
    user: null,
    workspaces: [],
    workspace: null,
    members: [],
    invites: [],
    online: [],
    loading: false,
    data: emptyByKind(),
    openTaskId: null,
    sidebarOpen: localStorage.getItem('proman.sidebar') !== '0',
    toasts: [],
    paletteOpen: false,
    createOpen: null,
    createDefaults: {},
    tray: JSON.parse(localStorage.getItem('proman.tray') || '[]'),

    set: (p) => set(p),

    init: async () => {
      try {
        const user = await backend.getUser();
        set({ user });
        if (user) {
          await backend.acceptInvites().catch(() => 0);
          await get().loadWorkspaces();
        }
      } catch (e) {
        console.error(e);
      } finally {
        set({ authReady: true });
      }
    },
    signIn: async (email, password) => {
      const user = await backend.signIn(email, password);
      set({ user });
      await backend.acceptInvites().catch(() => 0);
      await get().loadWorkspaces();
    },
    signUp: async (email, password, name) => {
      const user = await backend.signUp(email, password, name);
      set({ user });
      await backend.acceptInvites().catch(() => 0);
      await get().loadWorkspaces();
    },
    signOut: async () => {
      unsub?.();
      unsub = null;
      await backend.signOut();
      set({ user: null, workspace: null, workspaces: [], data: emptyByKind(), members: [] });
    },
    updateProfile: async (p) => {
      await backend.updateProfile(p);
      set((s) => ({ user: s.user ? { ...s.user, ...p } : s.user }));
      await get().refreshMembers();
    },
    loadWorkspaces: async () => {
      const workspaces = await backend.listWorkspaces();
      set({ workspaces });
      const saved = localStorage.getItem('proman.ws');
      const pick = workspaces.find((w) => w.id === saved) || workspaces[0];
      if (pick) await get().selectWorkspace(pick.id);
    },
    selectWorkspace: async (id) => {
      const ws = get().workspaces.find((w) => w.id === id);
      if (!ws) return;
      unsub?.();
      set({ loading: true, workspace: ws });
      localStorage.setItem('proman.ws', id);
      const [items, members] = await Promise.all([backend.loadItems(id), backend.listMembers(id)]);
      const data = emptyByKind();
      for (const r of items) (data as any)[r.kind] && ((data as any)[r.kind][r.id] = toEntity(r));
      set({ data, members, loading: false });
      backend.listInvites(id).then((invites) => set({ invites })).catch(() => {});
      unsub = backend.subscribe(id, me(), {
        upsert: applyUpsert,
        remove: applyRemove,
        members: () => get().refreshMembers(),
        presence: (online) => set({ online }),
      });
    },
    createWorkspace: async (name, color, seed = true) => {
      const ws = await backend.createWorkspace(name, color);
      set((s) => ({ workspaces: [...s.workspaces, ws] }));
      await get().selectWorkspace(ws.id);
      if (seed) {
        const { seedWorkspace } = await import('./seed');
        await seedWorkspace();
      }
      return ws;
    },
    updateWorkspace: async (patch) => {
      const ws = get().workspace!;
      await backend.updateWorkspace(ws.id, patch);
      const next = { ...ws, ...patch };
      set((s) => ({ workspace: next, workspaces: s.workspaces.map((w) => (w.id === ws.id ? next : w)) }));
    },
    refreshMembers: async () => {
      const ws = get().workspace;
      if (!ws) return;
      const [members, invites, workspaces] = await Promise.all([
        backend.listMembers(ws.id),
        backend.listInvites(ws.id).catch(() => [] as Invite[]),
        backend.listWorkspaces(),
      ]);
      const cur = workspaces.find((w) => w.id === ws.id);
      set({ members, invites, workspaces, workspace: cur || ws });
      const mine = members.find((m) => m.user_id === me());
      if (mine) set((s) => ({ user: s.user ? { ...s.user, ...mine.profile } : s.user }));
    },
    inviteMember: async (email, role) => {
      const r = await backend.invite(wsId(), email, role);
      await get().refreshMembers();
      return r;
    },

    create: (kind, data, opts) => {
      const id = opts?.id || uid();
      const now = new Date().toISOString();
      const e = { ...data, id, kind, created_by: me(), created_at: now, updated_at: now } as any;
      set((s) => ({ data: { ...s.data, [kind]: { ...s.data[kind], [id]: e } } }));
      backend.insertItem({ id, workspace_id: wsId(), kind, data: dataOf(e), created_by: me() }).catch(fail);
      return e;
    },
    createMany: (items) => {
      const now = new Date().toISOString();
      const ents = items.map((i) => ({ ...i.data, id: i.id || uid(), kind: i.kind, created_by: me(), created_at: now, updated_at: now }));
      set((s) => {
        const d = { ...s.data } as any;
        for (const e of ents) d[e.kind] = { ...d[e.kind], [e.id]: e };
        return { data: d };
      });
      backend.insertMany(ents.map((e) => ({ id: e.id, workspace_id: wsId(), kind: e.kind, data: dataOf(e), created_by: me() }))).catch(fail);
      return ents as Entity[];
    },
    update: (kind, id, patch) => {
      const cur = get().data[kind][id];
      if (!cur) return;
      const clean: Record<string, any> = {};
      for (const k of Object.keys(patch)) if (!BASE.includes(k)) clean[k] = (patch as any)[k] === undefined ? null : (patch as any)[k];
      const prevPending = pending.get(id);
      pending.set(id, { patch: { ...(prevPending?.patch || {}), ...clean }, until: 0 });
      set((s) => ({ data: { ...s.data, [kind]: { ...s.data[kind], [id]: { ...cur, ...clean, updated_at: new Date().toISOString() } } } }));
      backend
        .patchItem(id, clean)
        .catch(fail)
        .finally(() => {
          const p = pending.get(id);
          if (p) p.until = Date.now() + 2500;
        });
    },
    remove: (kind, id) => {
      deleteFilesOf([{ kind, id }]);
      applyRemove(id);
      backend.deleteItem(id).catch(fail);
    },
    removeMany: (refs) => {
      deleteFilesOf(refs);
      refs.forEach((r) => applyRemove(r.id));
      backend.deleteMany(refs.map((r) => r.id)).catch(fail);
    },

    createTask: (t, opts) => {
      const s = get();
      const statuses = statusesForList(t.listId);
      const siblings = Object.values(s.data.task).filter((x) => x.listId === t.listId && (x.parentId || null) === (t.parentId || null));
      const order = t.order ?? (siblings.length ? Math.max(...siblings.map((x) => x.order || 0)) + 1000 : 1000);
      const assignees = t.assignees || [];
      const task = s.create('task', {
        status: statuses[0]?.id,
        priority: null,
        assignees,
        watchers: Array.from(new Set([me(), ...assignees, ...(t.watchers || [])])),
        tags: [],
        order,
        type: 'task',
        ...t,
      } as Partial<Task>);
      if (!opts?.silent) {
        s.logActivity(task.id, 'created this task');
        for (const a of assignees) if (a !== me()) s.notify({ user: a, actor: me(), type: 'assigned', text: `assigned you to ${task.name}`, taskId: task.id, primary: true });
      }
      if (!opts?.fromAutomation) fire({ type: 'created', task, prev: null });
      else fire({ type: 'created', task, prev: null, depth: 1 });
      return task;
    },

    updateTask: (id, patch, opts) => {
      const s = get();
      const prev = s.data.task[id];
      if (!prev) return;
      const p: Partial<Task> = { ...patch };
      const statuses = statusesForList(p.listId || prev.listId);
      // moving between lists: map status by name or fall back to first status
      if (p.listId && p.listId !== prev.listId && !p.status) {
        const old = statusesForList(prev.listId).find((x) => x.id === prev.status);
        p.status = (statuses.find((x) => x.name === old?.name) || statuses[0])?.id;
      }
      if (p.status && p.status !== prev.status) {
        const st = statuses.find((x) => x.id === p.status);
        const closed = st && (st.type === 'closed' || st.type === 'done');
        p.completedAt = closed ? new Date().toISOString() : null;
      }
      if (p.assignees) p.watchers = Array.from(new Set([...(p.watchers || prev.watchers || []), ...p.assignees]));
      s.update('task', id, p);
      const next = { ...prev, ...p } as Task;
      if (opts?.silent) return;

      // activity + notifications
      const name = (uid: string) => s.members.find((m) => m.user_id === uid)?.profile.name || 'someone';
      const stName = (sid?: string) => statusesForList(next.listId).find((x) => x.id === sid)?.name || '—';
      const watchers = (next.watchers || []).filter((w) => w !== me());
      if (p.status !== undefined && p.status !== prev.status) {
        s.logActivity(id, `changed status from ${stName(prev.status)} to ${stName(p.status)}`, 'status');
        for (const w of watchers) s.notify({ user: w, actor: me(), type: 'status', text: `changed status of ${next.name} to ${stName(p.status)}`, taskId: id });
      }
      if (p.assignees) {
        const added = p.assignees.filter((a) => !(prev.assignees || []).includes(a));
        const removed = (prev.assignees || []).filter((a) => !p.assignees!.includes(a));
        for (const a of added) {
          s.logActivity(id, `assigned to ${name(a)}`, 'assignees');
          if (a !== me()) s.notify({ user: a, actor: me(), type: 'assigned', text: `assigned you to ${next.name}`, taskId: id, primary: true });
        }
        for (const a of removed) s.logActivity(id, `removed assignee ${name(a)}`, 'assignees');
      }
      if (p.priority !== undefined && p.priority !== prev.priority) s.logActivity(id, `set priority to ${['', 'Urgent', 'High', 'Normal', 'Low'][p.priority || 0] || 'none'}`, 'priority');
      if (p.dueDate !== undefined && p.dueDate !== prev.dueDate) s.logActivity(id, p.dueDate ? `changed due date to ${new Date(p.dueDate).toLocaleDateString()}` : 'removed due date', 'dueDate');
      if (p.startDate !== undefined && p.startDate !== prev.startDate) s.logActivity(id, p.startDate ? `changed start date to ${new Date(p.startDate).toLocaleDateString()}` : 'removed start date', 'startDate');
      if (p.name !== undefined && p.name !== prev.name) s.logActivity(id, `renamed task to "${p.name}"`, 'name');
      if (p.listId && p.listId !== prev.listId) s.logActivity(id, `moved task to ${s.data.list[p.listId]?.name || 'another list'}`, 'list');
      if (p.estimate !== undefined && p.estimate !== prev.estimate) s.logActivity(id, `changed time estimate`, 'estimate');
      if (p.tags) {
        for (const t of p.tags.filter((t) => !(prev.tags || []).includes(t))) s.logActivity(id, `added tag ${t}`, 'tags');
        for (const t of (prev.tags || []).filter((t) => !p.tags!.includes(t))) s.logActivity(id, `removed tag ${t}`, 'tags');
      }
      if (p.archived !== undefined && p.archived !== prev.archived) s.logActivity(id, p.archived ? 'archived this task' : 'restored this task');

      // recurrence on completion
      if (p.status && p.status !== prev.status && next.recurrence) {
        const st = statuses.find((x) => x.id === p.status);
        if (st && (st.type === 'closed' || st.type === 'done')) handleRecurrence(next);
      }

      fire({ type: 'updated', task: next, prev, depth: opts?.fromAutomation ? 1 : 0 });
    },

    deleteTask: (id) => {
      const s = get();
      const ids = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const t of Object.values(s.data.task)) if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) { ids.add(t.id); grew = true; }
      }
      const refs: { kind: Kind; id: string }[] = [...ids].map((i) => ({ kind: 'task' as Kind, id: i }));
      for (const l of Object.values(s.data.link)) if (ids.has(l.from) || ids.has(l.to)) refs.push({ kind: 'link', id: l.id });
      for (const c of Object.values(s.data.comment)) if (c.taskId && ids.has(c.taskId)) refs.push({ kind: 'comment', id: c.id });
      for (const a of Object.values(s.data.activity)) if (ids.has(a.taskId)) refs.push({ kind: 'activity', id: a.id });
      const files = Object.values(s.data.attachment).filter((a) => a.taskId && ids.has(a.taskId));
      const snapshot = refs.map((r) => (s.data as any)[r.kind][r.id]).filter(Boolean);
      s.removeMany(refs);
      // Attachments are removed only after the Undo window closes, because deleting them frees the files.
      if (files.length) setTimeout(() => {
        if (!get().data.task[id]) get().removeMany(files.map((f) => ({ kind: 'attachment' as Kind, id: f.id })));
      }, 8000);
      if (s.openTaskId && ids.has(s.openTaskId)) set({ openTaskId: null });
      s.toast(`Deleted ${ids.size > 1 ? ids.size + ' tasks' : 'task'}`, 'info', {
        label: 'Undo',
        run: () => get().createMany(snapshot.map((e: any) => ({ kind: e.kind, id: e.id, data: dataOf(e) }))),
      });
    },

    duplicateTask: (id, listId) => {
      const s = get();
      const t = s.data.task[id];
      if (!t) return null;
      const copy = s.createTask({ ...dataOf(t), name: t.name + ' (copy)', listId: listId || t.listId, order: (t.order || 0) + 1, completedAt: null } as any, { silent: true });
      s.logActivity(copy.id, 'duplicated from ' + t.name);
      for (const sub of Object.values(s.data.task).filter((x) => x.parentId === id))
        s.createTask({ ...dataOf(sub), parentId: copy.id, listId: copy.listId } as any, { silent: true });
      return copy;
    },

    addComment: (c) => {
      const s = get();
      const comment = s.create('comment', { ...c, author: me(), resolved: false, reactions: {} });
      const text = stripHtml(c.body).slice(0, 120);
      const mentioned = Array.from(c.body.matchAll(/data-id="([0-9a-f-]{36})"/g)).map((m) => m[1]);
      if (c.taskId) {
        const t = s.data.task[c.taskId];
        s.logActivity(c.taskId, 'commented');
        const recipients = new Set<string>([...(t?.watchers || []), ...(t?.assignees || [])]);
        for (const m of mentioned) recipients.delete(m);
        recipients.delete(me());
        for (const r of recipients) s.notify({ user: r, actor: me(), type: 'comment', text: `commented on ${t?.name}: ${text}`, taskId: c.taskId });
        if (t) fire({ type: 'comment', task: t, prev: t });
      }
      for (const m of mentioned) if (m !== me()) s.notify({ user: m, actor: me(), type: 'mention', text: `mentioned you: ${text}`, taskId: c.taskId || null, docId: c.docId || null, primary: true });
      if (c.assignee && c.assignee !== me()) s.notify({ user: c.assignee, actor: me(), type: 'assignedComment', text: `assigned you a comment: ${text}`, taskId: c.taskId || null, primary: true });
      return comment as any;
    },

    notify: (n) => {
      get().create('notification', { read: false, cleared: false, later: false, ...n } as any);
    },

    logActivity: (taskId, text, field) => {
      get().create('activity', { taskId, user: me(), text, field });
    },

    openTask: (id) => {
      set({ openTaskId: id });
      if (id) pushRecent({ type: 'task', id });
    },
    toast: (text, tone = 'info', action) => {
      const id = uid();
      set((s) => ({ toasts: [...s.toasts, { id, text, tone, action }] }));
      setTimeout(() => get().dismissToast(id), action ? 7000 : 3500);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  };
});

// ---------------------------------------------------------------- selectors / helpers
export const getState = () => useStore.getState();

export function statusesForList(listId?: string | null): Status[] {
  const d = getState().data;
  const list = listId ? d.list[listId] : undefined;
  if (!list) return defaultStatusCache;
  if (list.statuses?.length) return list.statuses;
  const folder = list.folderId ? d.folder[list.folderId] : undefined;
  if (folder?.statuses?.length) return folder.statuses;
  const space = d.space[list.spaceId];
  return space?.statuses?.length ? space.statuses : defaultStatusCache;
}
const defaultStatusCache = defaultStatuses();

export const statusOf = (t: Task): Status | undefined => statusesForList(t.listId).find((s) => s.id === t.status) || statusesForList(t.listId)[0];
export const isClosed = (t: Task) => {
  const s = statusOf(t);
  return !!s && (s.type === 'closed' || s.type === 'done');
};
export const isDone = isClosed;

export const clickApp = (k: ClickApp): boolean => {
  const v = getState().workspace?.settings?.clickApps?.[k];
  return v === undefined ? true : v;
};

export const memberName = (id?: string | null) => getState().members.find((m) => m.user_id === id)?.profile.name || (id ? 'Former member' : 'Automation');
export const myRole = (): Role => getState().members.find((m) => m.user_id === getState().user?.id)?.role || 'member';
export const canAdmin = () => ['owner', 'admin'].includes(myRole());
export const canEdit = () => myRole() !== 'guest';

export function locationName(loc?: { type: string; id: string } | null): string {
  if (!loc) return '';
  const d = getState().data;
  if (loc.type === 'everything') return 'Everything';
  return (d as any)[loc.type]?.[loc.id]?.name || '';
}

/** All list ids under a location. */
export function listsIn(loc: { type: string; id: string }): string[] {
  const d = getState().data;
  const lists = Object.values(d.list).filter((l) => !l.archived);
  if (loc.type === 'everything') return lists.map((l) => l.id);
  if (loc.type === 'space') return lists.filter((l) => l.spaceId === loc.id).map((l) => l.id);
  if (loc.type === 'folder') {
    const folders = new Set([loc.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of Object.values(d.folder)) if (f.parentFolderId && folders.has(f.parentFolderId) && !folders.has(f.id)) { folders.add(f.id); grew = true; }
    }
    return lists.filter((l) => l.folderId && folders.has(l.folderId)).map((l) => l.id);
  }
  return [loc.id];
}

export function breadcrumb(listId: string): { space?: Space; folder?: Folder; list?: List } {
  const d = getState().data;
  const list = d.list[listId];
  if (!list) return {};
  return { list, folder: list.folderId ? d.folder[list.folderId] : undefined, space: d.space[list.spaceId] };
}

// ---------------------------------------------------------------- recents
export interface Recent { type: 'task' | 'list' | 'doc' | 'dashboard' | 'whiteboard' | 'folder' | 'space'; id: string; at?: number }
export const getRecents = (): Recent[] => JSON.parse(localStorage.getItem('proman.recents') || '[]');
export const pushRecent = (r: Recent) => {
  const list = getRecents().filter((x) => !(x.type === r.type && x.id === r.id));
  list.unshift({ ...r, at: Date.now() });
  localStorage.setItem('proman.recents', JSON.stringify(list.slice(0, 30)));
};

// ---------------------------------------------------------------- recurrence
export const nextDate = (iso: string | null | undefined, r: Recurrence): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  const n = Math.max(1, r.interval || 1);
  const x = r.freq === 'daily' || r.freq === 'days' ? addDays(d, n) : r.freq === 'weekly' ? addWeeks(d, n) : r.freq === 'monthly' ? addMonths(d, n) : addYears(d, n);
  return formatISO(x);
};

function handleRecurrence(t: Task) {
  const s = getState();
  const r = t.recurrence!;
  const base = t.dueDate || new Date().toISOString();
  const due = nextDate(base, r);
  const start = t.startDate ? nextDate(t.startDate, r) : null;
  const first = statusesForList(t.listId)[0]?.id;
  const resetChecklists = (t.checklists || []).map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, done: false })) }));
  if (r.createNew) {
    const copy = s.createTask({ ...dataOf(t), status: first, dueDate: due, startDate: start, completedAt: null, checklists: resetChecklists } as any, { silent: true });
    s.update('task', t.id, { recurrence: null });
    s.logActivity(copy.id, 'created as the next recurrence');
  } else {
    setTimeout(() => {
      s.update('task', t.id, { status: first, dueDate: due, startDate: start, completedAt: null, checklists: resetChecklists });
      s.logActivity(t.id, `recurring task reset; next due ${due ? new Date(due).toLocaleDateString() : ''}`);
    }, 400);
  }
}

export { dataOf };

registerHelpers({ statusesForList, listsIn, clickApp });

if (import.meta.env.DEV) (window as any).__store = useStore;
