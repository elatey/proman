// Hosted backend: Supabase (Postgres + Auth + Realtime + Storage). See supabase/schema.sql.
import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Backend, Handlers } from './types';
import type { Member, Profile, RawItem, Role, Workspace } from '../types';

const must = <T>(r: { data: T; error: any }): T => {
  if (r.error) throw new Error(r.error.message || String(r.error));
  return r.data;
};

export class SupabaseBackend implements Backend {
  mode = 'supabase' as const;
  sb: SupabaseClient;
  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  }

  private async profile(id: string, email?: string): Promise<Profile> {
    const { data } = await this.sb.from('profiles').select('*').eq('id', id).maybeSingle();
    if (data) return data as Profile;
    // Profile trigger may lag a moment after sign-up: create it ourselves.
    const p = { id, email: email || '', name: (email || 'user').split('@')[0], color: '#6E56CF' };
    await this.sb.from('profiles').upsert(p);
    return p;
  }

  async getUser() {
    const { data } = await this.sb.auth.getSession();
    const u = data.session?.user;
    return u ? this.profile(u.id, u.email) : null;
  }
  async signUp(email: string, password: string, name: string) {
    const r = await this.sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } });
    if (r.error) throw new Error(r.error.message);
    if (!r.data.session) throw new Error('CONFIRM_EMAIL');
    const p = await this.profile(r.data.user!.id, email);
    if (name && p.name !== name) await this.sb.from('profiles').update({ name }).eq('id', p.id);
    return { ...p, name: name || p.name };
  }
  async signIn(email: string, password: string) {
    const r = await this.sb.auth.signInWithPassword({ email, password });
    if (r.error) throw new Error(r.error.message);
    return this.profile(r.data.user.id, email);
  }
  async signOut() { await this.sb.auth.signOut(); }
  async resetPassword(email: string) {
    const r = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (r.error) throw new Error(r.error.message);
  }
  async updateProfile(patch: Partial<Profile>) {
    const { data } = await this.sb.auth.getUser();
    must(await this.sb.from('profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', data.user!.id));
  }
  async listWorkspaces() {
    return must(await this.sb.from('workspaces').select('*').order('created_at')) as Workspace[];
  }
  async createWorkspace(name: string, color: string) {
    return must(await this.sb.rpc('create_workspace', { p_name: name, p_color: color })) as Workspace;
  }
  async updateWorkspace(id: string, patch: Partial<Workspace>) {
    must(await this.sb.from('workspaces').update(patch).eq('id', id));
  }
  async deleteWorkspace(id: string) {
    must(await this.sb.from('workspaces').delete().eq('id', id));
  }
  async listMembers(wsId: string): Promise<Member[]> {
    const rows = must(await this.sb.from('members').select('user_id, role').eq('workspace_id', wsId)) as { user_id: string; role: Role }[];
    const ids = rows.map((r) => r.user_id);
    const profiles = ids.length ? (must(await this.sb.from('profiles').select('*').in('id', ids)) as Profile[]) : [];
    return rows.map((r) => ({
      user_id: r.user_id,
      role: r.role,
      profile: profiles.find((p) => p.id === r.user_id) || { id: r.user_id, email: '', name: 'Member', color: '#8E8C99' },
    }));
  }
  async listInvites(wsId: string) {
    return must(await this.sb.from('invites').select('id, email, role, created_at').eq('workspace_id', wsId)) as any[];
  }
  async invite(wsId: string, email: string, role: Role) {
    const { data: u } = await this.sb.auth.getUser();
    must(await this.sb.from('invites').upsert({ workspace_id: wsId, email: email.trim().toLowerCase(), role, invited_by: u.user?.id }, { onConflict: 'workspace_id,email' }));
    return { joined: false };
  }
  async revokeInvite(id: string) { must(await this.sb.from('invites').delete().eq('id', id)); }
  async setRole(wsId: string, userId: string, role: Role) {
    must(await this.sb.from('members').update({ role }).eq('workspace_id', wsId).eq('user_id', userId));
  }
  async removeMember(wsId: string, userId: string) {
    must(await this.sb.from('members').delete().eq('workspace_id', wsId).eq('user_id', userId));
  }
  async acceptInvites() {
    const r = await this.sb.rpc('accept_invites');
    return (r.data as number) || 0;
  }
  async loadItems(wsId: string) {
    // Page through results (PostgREST caps each response at 1000 rows by default).
    const out: RawItem[] = [];
    for (let from = 0; ; from += 1000) {
      const rows = must(await this.sb.from('items').select('*').eq('workspace_id', wsId).range(from, from + 999)) as RawItem[];
      out.push(...rows);
      if (rows.length < 1000) break;
    }
    return out;
  }
  async insertItem(item: RawItem) {
    const { created_at, updated_at, ...row } = item;
    must(await this.sb.from('items').insert(row));
  }
  async insertMany(items: RawItem[]) {
    for (let i = 0; i < items.length; i += 500) {
      must(await this.sb.from('items').insert(items.slice(i, i + 500).map(({ created_at, updated_at, ...r }) => r)));
    }
  }
  async patchItem(id: string, patch: Record<string, any>) {
    must(await this.sb.rpc('patch_item', { p_id: id, p_patch: patch }));
  }
  async deleteItem(id: string) { must(await this.sb.from('items').delete().eq('id', id)); }
  async deleteMany(ids: string[]) {
    for (let i = 0; i < ids.length; i += 200) must(await this.sb.from('items').delete().in('id', ids.slice(i, i + 200)));
  }
  subscribe(wsId: string, userId: string, h: Handlers) {
    const ch: RealtimeChannel = this.sb
      .channel('ws-' + wsId, { config: { presence: { key: userId } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'items', filter: `workspace_id=eq.${wsId}` }, (p) => h.upsert(p.new as RawItem))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items', filter: `workspace_id=eq.${wsId}` }, (p) => h.upsert(p.new as RawItem))
      // DELETE events cannot be filtered server-side; we just drop the id if we have it.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'items' }, (p) => (p.old as any)?.id && h.remove((p.old as any).id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `workspace_id=eq.${wsId}` }, () => h.members())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => h.members())
      .on('presence', { event: 'sync' }, () => h.presence?.(Object.keys(ch.presenceState())))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await ch.track({ at: Date.now() });
      });
    return () => { this.sb.removeChannel(ch); };
  }
  async uploadFile(wsId: string, file: Blob, name: string) {
    const path = `${wsId}/${crypto.randomUUID()}/${name.replace(/[^\w.\-]+/g, '_')}`;
    must(await this.sb.storage.from('files').upload(path, file, { contentType: (file as File).type || undefined }));
    return this.sb.storage.from('files').getPublicUrl(path).data.publicUrl;
  }
  async deleteFile(url: string) {
    const marker = '/storage/v1/object/public/files/';
    const i = url.indexOf(marker);
    if (i < 0) return; // not one of our uploads
    const path = decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
    const r = await this.sb.storage.from('files').remove([path]);
    if (r.error) console.warn('[ProMan] could not delete file', path, r.error.message);
  }
  async getPublicItem(id: string) {
    const r = await this.sb.rpc('get_public_item', { p_id: id });
    return (r.data as RawItem) || null;
  }
  async submitForm(formViewId: string, task: Record<string, any>) {
    must(await this.sb.rpc('submit_form', { p_form: formViewId, p_task: task }));
  }
}
