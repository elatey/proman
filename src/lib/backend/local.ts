// Demo backend: everything lives in this browser's localStorage. Tabs stay in sync
// through BroadcastChannel, so you can open two tabs signed in as different demo users
// and watch realtime collaboration. No server needed.
import type { Backend, Handlers } from './types';
import type { Invite, Member, Profile, RawItem, Role, Workspace } from '../types';
import { uid } from '../utils';

interface DB {
  users: (Profile & { password: string })[];
  workspaces: Workspace[];
  members: { workspace_id: string; user_id: string; role: Role }[];
  invites: (Invite & { workspace_id: string })[];
  items: Record<string, RawItem>;
}

const KEY = 'proman.localdb.v1';
const SESSION = 'proman.localsession';
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('proman-local') : null;

const load = (): DB => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { users: [], workspaces: [], members: [], invites: [], items: {} };
};
// Several tabs share one localStorage DB. To avoid tabs overwriting each other, every
// operation re-reads the DB from storage first (fresh()) and writes back immediately (save()).
let db = load();
const fresh = () => { db = load(); return db; };
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('localStorage full', e); }
};

type Msg = { t: 'upsert'; item: RawItem } | { t: 'remove'; id: string } | { t: 'members' } | { t: 'reload' };
const listeners = new Set<(m: Msg) => void>();
const emit = (m: Msg, local = true) => {
  if (local) listeners.forEach((l) => l(m));
  bc?.postMessage(m);
};
bc?.addEventListener('message', (e) => {
  const m = e.data as Msg;
  // Another tab changed data: refresh our copy of the db from storage, then notify.
  db = load();
  listeners.forEach((l) => l(m));
});

const me = (): string | null => sessionStorage.getItem(SESSION) || localStorage.getItem(SESSION);
const pub = (u: DB['users'][number]): Profile => ({ id: u.id, email: u.email, name: u.name, color: u.color, avatar_url: u.avatar_url });
const now = () => new Date().toISOString();

export class LocalBackend implements Backend {
  mode = 'local' as const;

  async getUser() {
    fresh();
    const id = me();
    const u = db.users.find((x) => x.id === id);
    return u ? pub(u) : null;
  }
  async signUp(email: string, password: string, name: string) {
    fresh();
    email = email.trim().toLowerCase();
    if (db.users.some((u) => u.email === email)) throw new Error('An account with this email already exists.');
    const colors = ['#6E56CF', '#3E63DD', '#12A594', '#F76B15', '#D6409F', '#E5484D', '#0090FF'];
    const u = { id: uid(), email, name: name || email.split('@')[0], color: colors[db.users.length % colors.length], password };
    db.users.push(u);
    save();
    this.setSession(u.id);
    return pub(u);
  }
  private setSession(id: string) {
    sessionStorage.setItem(SESSION, id);
    localStorage.setItem(SESSION, id);
  }
  async signIn(email: string, password: string) {
    fresh();
    const u = db.users.find((x) => x.email === email.trim().toLowerCase());
    if (!u || u.password !== password) throw new Error('Invalid email or password.');
    this.setSession(u.id);
    return pub(u);
  }
  async signOut() {
    fresh();
    sessionStorage.removeItem(SESSION);
    localStorage.removeItem(SESSION);
  }
  async updateProfile(patch: Partial<Profile>) {
    fresh();
    const u = db.users.find((x) => x.id === me());
    if (u) Object.assign(u, patch);
    save();
    emit({ t: 'members' });
  }
  async listWorkspaces() {
    fresh();
    const id = me();
    const ids = db.members.filter((m) => m.user_id === id).map((m) => m.workspace_id);
    return db.workspaces.filter((w) => ids.includes(w.id));
  }
  async createWorkspace(name: string, color: string) {
    fresh();
    const w: Workspace = { id: uid(), name, color, owner_id: me()!, settings: {} };
    db.workspaces.push(w);
    db.members.push({ workspace_id: w.id, user_id: me()!, role: 'owner' });
    save();
    return w;
  }
  async updateWorkspace(id: string, patch: Partial<Workspace>) {
    fresh();
    const w = db.workspaces.find((x) => x.id === id);
    if (w) Object.assign(w, patch);
    save();
    emit({ t: 'members' });
  }
  async deleteWorkspace(id: string) {
    fresh();
    db.workspaces = db.workspaces.filter((w) => w.id !== id);
    db.members = db.members.filter((m) => m.workspace_id !== id);
    for (const k of Object.keys(db.items)) if (db.items[k].workspace_id === id) delete db.items[k];
    save();
    emit({ t: 'reload' });
  }
  async listMembers(wsId: string): Promise<Member[]> {
    fresh();
    return db.members
      .filter((m) => m.workspace_id === wsId)
      .map((m) => {
        const u = db.users.find((x) => x.id === m.user_id);
        return u ? { user_id: m.user_id, role: m.role, profile: pub(u) } : null;
      })
      .filter(Boolean) as Member[];
  }
  async listInvites(wsId: string) {
    fresh();
    return db.invites.filter((i) => i.workspace_id === wsId);
  }
  async invite(wsId: string, email: string, role: Role) {
    fresh();
    email = email.trim().toLowerCase();
    const u = db.users.find((x) => x.email === email);
    if (u) {
      if (!db.members.some((m) => m.workspace_id === wsId && m.user_id === u.id)) db.members.push({ workspace_id: wsId, user_id: u.id, role });
      save();
      emit({ t: 'members' });
      return { joined: true };
    }
    db.invites = db.invites.filter((i) => !(i.workspace_id === wsId && i.email === email));
    db.invites.push({ id: uid(), workspace_id: wsId, email, role, created_at: now() });
    save();
    return { joined: false };
  }
  async revokeInvite(id: string) {
    fresh();
    db.invites = db.invites.filter((i) => i.id !== id);
    save();
  }
  async setRole(wsId: string, userId: string, role: Role) {
    fresh();
    const m = db.members.find((x) => x.workspace_id === wsId && x.user_id === userId);
    if (m) m.role = role;
    save();
    emit({ t: 'members' });
  }
  async removeMember(wsId: string, userId: string) {
    fresh();
    db.members = db.members.filter((x) => !(x.workspace_id === wsId && x.user_id === userId));
    save();
    emit({ t: 'members' });
  }
  async acceptInvites() {
    fresh();
    const u = db.users.find((x) => x.id === me());
    if (!u) return 0;
    const mine = db.invites.filter((i) => i.email === u.email);
    for (const i of mine)
      if (!db.members.some((m) => m.workspace_id === i.workspace_id && m.user_id === u.id))
        db.members.push({ workspace_id: i.workspace_id, user_id: u.id, role: i.role });
    db.invites = db.invites.filter((i) => i.email !== u.email);
    save();
    return mine.length;
  }
  private visible(i: RawItem, userId: string | null) {
    if (i.kind === 'notification' && i.data?.user !== userId) return false;
    if (i.data?.private && i.created_by !== userId && i.data?.user !== userId && !(i.data?.members || []).includes(userId)) return false;
    return true;
  }
  async loadItems(wsId: string) {
    fresh();
    const u = me();
    return Object.values(db.items).filter((i) => i.workspace_id === wsId && this.visible(i, u));
  }
  async insertItem(item: RawItem) {
    fresh();
    const it = { ...item, created_by: item.created_by === undefined ? me() : item.created_by, created_at: item.created_at || now(), updated_at: now() };
    db.items[it.id] = it;
    save();
    emit({ t: 'upsert', item: it }, false);
  }
  async insertMany(items: RawItem[]) {
    fresh();
    for (const i of items) await this.insertItem(i);
  }
  async patchItem(id: string, patch: Record<string, any>) {
    fresh();
    const it = db.items[id];
    if (!it) return;
    it.data = { ...it.data, ...patch };
    it.updated_at = now();
    save();
    emit({ t: 'upsert', item: it }, false);
  }
  async deleteItem(id: string) {
    fresh();
    delete db.items[id];
    save();
    emit({ t: 'remove', id }, false);
  }
  async deleteMany(ids: string[]) {
    fresh();
    for (const id of ids) await this.deleteItem(id);
  }
  subscribe(wsId: string, userId: string, h: Handlers) {
    const l = (m: Msg) => {
      if (m.t === 'upsert') { if (m.item.workspace_id === wsId && this.visible(m.item, userId)) h.upsert(m.item); }
      else if (m.t === 'remove') h.remove(m.id);
      else h.members();
    };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }
  async uploadFile(_ws: string, file: Blob) {
    fresh();
    // Demo mode: inline the file as a data URL (keep files small, localStorage is ~5MB).
    if (file.size > 1.5 * 1024 * 1024) throw new Error('Demo mode stores files in the browser: max 1.5 MB. Connect Supabase for real file storage.');
    return await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  async deleteFile(_url: string) {
    // Demo mode stores files inline as data URLs inside the item itself: nothing else to remove.
  }
  async getPublicItem(id: string) {
    fresh();
    const i = db.items[id];
    return i && i.data?.public ? i : null;
  }
  async submitForm(formViewId: string, task: Record<string, any>) {
    fresh();
    const f = db.items[formViewId];
    if (!f || !f.data?.public) throw new Error('Form not found');
    await this.insertItem({ id: uid(), workspace_id: f.workspace_id, kind: 'task', data: { ...task, listId: f.data.location.id, fromForm: formViewId }, created_by: null });
  }
}