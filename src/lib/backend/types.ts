import type { Invite, Member, Profile, RawItem, Role, Workspace } from '../types';

export interface Handlers {
  upsert: (item: RawItem) => void;
  remove: (id: string) => void;
  members: () => void;
  presence?: (userIds: string[]) => void;
}

/** Everything the app needs from a backend. Implemented by LocalBackend (demo, in-browser)
 *  and SupabaseBackend (hosted, multi-user, realtime). */
export interface Backend {
  mode: 'local' | 'supabase';
  // auth
  getUser(): Promise<Profile | null>;
  signUp(email: string, password: string, name: string): Promise<Profile>;
  signIn(email: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  resetPassword?(email: string): Promise<void>;
  updateProfile(patch: Partial<Profile>): Promise<void>;
  // workspaces
  listWorkspaces(): Promise<Workspace[]>;
  createWorkspace(name: string, color: string): Promise<Workspace>;
  updateWorkspace(id: string, patch: Partial<Workspace>): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;
  listMembers(wsId: string): Promise<Member[]>;
  listInvites(wsId: string): Promise<Invite[]>;
  invite(wsId: string, email: string, role: Role): Promise<{ joined: boolean }>;
  revokeInvite(id: string): Promise<void>;
  setRole(wsId: string, userId: string, role: Role): Promise<void>;
  removeMember(wsId: string, userId: string): Promise<void>;
  acceptInvites(): Promise<number>;
  // items
  loadItems(wsId: string): Promise<RawItem[]>;
  insertItem(item: RawItem): Promise<void>;
  insertMany(items: RawItem[]): Promise<void>;
  patchItem(id: string, patch: Record<string, any>): Promise<void>;
  deleteItem(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
  subscribe(wsId: string, userId: string, h: Handlers): () => void;
  // files
  uploadFile(wsId: string, file: Blob, name: string): Promise<string>;
  /** Remove an uploaded file by the URL uploadFile returned (no-op for data: URLs / foreign links). */
  deleteFile(url: string): Promise<void>;
  // public (no login)
  getPublicItem(id: string): Promise<RawItem | null>;
  submitForm(formViewId: string, task: Record<string, any>): Promise<void>;
}
