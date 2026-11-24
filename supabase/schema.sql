-- ProMan database schema for Supabase (free tier).
-- Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- It is idempotent: re-running it is safe.
--
-- Design: users, workspaces and memberships are real tables (security depends on them).
-- Everything inside a workspace (spaces, folders, lists, tasks, docs, comments, chat,
-- goals, dashboards, automations, ...) lives in one "items" table with a "kind" column
-- and a jsonb "data" payload. Row Level Security limits every row to workspace members.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  color text default '#6E56CF',
  avatar_url text,
  updated_at timestamptz default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text default '#6E56CF',
  owner_id uuid references auth.users(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.members (
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','guest')),
  created_at timestamptz default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (workspace_id, email)
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists items_ws_kind on public.items (workspace_id, kind);

-- Realtime DELETE events need the old row identity.
alter table public.items replica identity full;
alter table public.members replica identity full;

-- ---------------------------------------------------------------- helper functions
create or replace function public.is_member(ws uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where workspace_id = ws and user_id = auth.uid());
$$;

create or replace function public.is_admin(ws uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where workspace_id = ws and user_id = auth.uid() and role in ('owner','admin'));
$$;

create or replace function public.shares_workspace(other uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select other = auth.uid() or exists (
    select 1 from members a join members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = other);
$$;

-- New auth user -> profile row
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name, color)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          coalesce(new.raw_user_meta_data->>'color', '#6E56CF'))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Create a workspace and make the caller its owner (avoids RLS chicken-and-egg).
create or replace function public.create_workspace(p_name text, p_color text default '#6E56CF')
returns public.workspaces language plpgsql security definer set search_path = public as $$
declare w workspaces;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into workspaces (name, color, owner_id) values (p_name, p_color, auth.uid()) returning * into w;
  insert into members (workspace_id, user_id, role) values (w.id, auth.uid(), 'owner');
  return w;
end $$;

-- Join every workspace that invited the caller's email address.
create or replace function public.accept_invites() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; my_email text;
begin
  select email into my_email from auth.users where id = auth.uid();
  if my_email is null then return 0; end if;
  insert into members (workspace_id, user_id, role)
    select workspace_id, auth.uid(), role from invites where lower(email) = lower(my_email)
  on conflict do nothing;
  get diagnostics n = row_count;
  delete from invites where lower(email) = lower(my_email);
  return n;
end $$;

-- Merge a partial jsonb patch into an item (field-level last-write-wins, so two
-- people editing different fields of the same task never overwrite each other).
create or replace function public.patch_item(p_id uuid, p_patch jsonb)
returns public.items language plpgsql security invoker set search_path = public as $$
declare r items;
begin
  update items set data = data || p_patch, updated_at = now() where id = p_id returning * into r;
  return r;
end $$;

-- Public, no-login access for items explicitly marked public (shared docs, forms, tasks).
create or replace function public.get_public_item(p_id uuid)
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object('id', id, 'kind', kind, 'data', data, 'workspace_id', workspace_id)
  from items where id = p_id and coalesce((data->>'public')::boolean, false);
$$;

-- Public form submission -> creates a task in the form's List.
create or replace function public.submit_form(p_form uuid, p_task jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare f items; new_id uuid;
begin
  select * into f from items where id = p_form and kind = 'view' and coalesce((data->>'public')::boolean, false);
  if f.id is null then raise exception 'form not found or not public'; end if;
  insert into items (workspace_id, kind, data, created_by)
    values (f.workspace_id, 'task', p_task || jsonb_build_object('listId', f.data->'location'->>'id', 'fromForm', p_form), null)
    returning id into new_id;
  return new_id;
end $$;

-- ---------------------------------------------------------------- API grants
-- Explicit grants, so the app works even when the project was created with
-- "Grant API access to new tables automatically" switched OFF (Supabase's recommended default).
-- Row Level Security below still decides which rows each user can see or change.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.workspaces, public.members, public.invites, public.items to authenticated;
grant execute on function public.is_member(uuid), public.is_admin(uuid), public.shares_workspace(uuid),
  public.create_workspace(text, text), public.accept_invites(), public.patch_item(uuid, jsonb) to authenticated;
grant execute on function public.get_public_item(uuid) to anon, authenticated;
grant execute on function public.submit_form(uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.items enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (public.shares_workspace(id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());

drop policy if exists ws_select on public.workspaces;
create policy ws_select on public.workspaces for select using (public.is_member(id));
drop policy if exists ws_update on public.workspaces;
create policy ws_update on public.workspaces for update using (public.is_admin(id));
drop policy if exists ws_delete on public.workspaces;
create policy ws_delete on public.workspaces for delete using (owner_id = auth.uid());

drop policy if exists members_select on public.members;
create policy members_select on public.members for select using (public.is_member(workspace_id));
drop policy if exists members_admin on public.members;
create policy members_admin on public.members for all using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id));
drop policy if exists members_leave on public.members;
create policy members_leave on public.members for delete using (user_id = auth.uid());

drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites for select using (public.is_member(workspace_id));
drop policy if exists invites_admin on public.invites;
create policy invites_admin on public.invites for all using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id));

-- Members can read everything in their workspace, except other people's
-- notifications and other people's private items (private views, reminders, ...).
drop policy if exists items_select on public.items;
create policy items_select on public.items for select using (
  public.is_member(workspace_id) and (
    (kind <> 'notification' or data->>'user' = auth.uid()::text)
    and (coalesce((data->>'private')::boolean, false) = false or created_by = auth.uid()
         or data->>'user' = auth.uid()::text or (data->'members') ? auth.uid()::text)
  ));
drop policy if exists items_insert on public.items;
create policy items_insert on public.items for insert with check (public.is_member(workspace_id));
drop policy if exists items_update on public.items;
create policy items_update on public.items for update using (public.is_member(workspace_id));
drop policy if exists items_delete on public.items;
create policy items_delete on public.items for delete using (public.is_member(workspace_id));

-- ---------------------------------------------------------------- realtime
do $$ begin
  begin alter publication supabase_realtime add table public.items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.workspaces; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------- file storage
insert into storage.buckets (id, name, public) values ('files', 'files', true)
  on conflict (id) do nothing;

drop policy if exists files_insert on storage.objects;
create policy files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and public.is_member(((storage.foldername(name))[1])::uuid));
-- Storage's delete API also needs SELECT on the object, so members can remove their workspace's files.
drop policy if exists files_select on storage.objects;
create policy files_select on storage.objects for select to authenticated
  using (bucket_id = 'files' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists files_delete on storage.objects;
create policy files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'files' and public.is_member(((storage.foldername(name))[1])::uuid));
