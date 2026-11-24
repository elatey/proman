import { useMemo, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Inbox, CalendarDays, MessagesSquare, FileText, LayoutDashboard, PenTool, Target, Clock, Video, Zap, LayoutTemplate, ChevronDown, ChevronRight,
  Plus, MoreHorizontal, Folder as FolderIcon, List as ListIcon, Star, Settings, UserPlus, LogOut, Pencil, Trash2, Palette, Copy, Archive, Lock, Layers, Link2,
  Check, PanelLeftClose, Sliders, Sun, Moon, Monitor, Building2, Eye, EyeOff,
} from 'lucide-react';
import { useStore, getState, canAdmin, statusesForList, isClosed } from '../../lib/store';
import { Popover, MenuList, type MenuItem, useContextMenu, Modal, ColorDots, Avatar, Logo, Confirm } from '../ui';
import { cn, uid, readableText, COLORS } from '../../lib/utils';
import { SpaceSettingsModal } from '../SpaceSettings';
import { NewSpaceModal } from '../NewSpaceModal';
import type { Space, Folder, List, Kind } from '../../lib/types';
import { defaultViews } from '../../lib/seed';
import { setTheme, getTheme } from '../../lib/theme';

export interface Fav { type: string; id: string }
export const useFavs = () => {
  const user = useStore((s) => s.user?.id);
  const key = 'proman.fav.' + user;
  const [favs, setFavs] = useState<Fav[]>(() => JSON.parse(localStorage.getItem(key) || '[]'));
  const toggle = (f: Fav) => {
    const cur: Fav[] = JSON.parse(localStorage.getItem(key) || '[]');
    const next = cur.some((x) => x.id === f.id) ? cur.filter((x) => x.id !== f.id) : [...cur, f];
    localStorage.setItem(key, JSON.stringify(next));
    setFavs(next);
    window.dispatchEvent(new Event('proman-favs'));
  };
  useMemo(() => {
    const h = () => setFavs(JSON.parse(localStorage.getItem(key) || '[]'));
    window.addEventListener('proman-favs', h);
    return () => window.removeEventListener('proman-favs', h);
  }, [key]);
  return { favs, toggle, isFav: (id: string) => favs.some((f) => f.id === id) };
};

export function Sidebar() {
  const nav = useNavigate();
  const loc = useLocation();
  const ws = useStore((s) => s.workspace)!;
  const workspaces = useStore((s) => s.workspaces);
  const spaces = useStore((s) => s.data.space);
  const notifications = useStore((s) => s.data.notification);
  const me = useStore((s) => s.user)!;
  const set = useStore((s) => s.set);
  const unread = Object.values(notifications).filter((n) => n.user === me.id && !n.read && !n.cleared).length;
  const [newSpace, setNewSpace] = useState(false);
  const { favs } = useFavs();
  const [showArchived, setShowArchived] = useState(false);
  const spaceList = Object.values(spaces).filter((s) => (showArchived || !s.archived) && (!s.private || !s.members?.length || s.members.includes(me.id) || s.created_by === me.id)).sort((a, b) => a.order - b.order);

  const navItems = [
    { to: '/', icon: Home, label: 'Home', end: true },
    { to: '/inbox', icon: Inbox, label: 'Inbox', badge: unread },
    { to: '/planner', icon: CalendarDays, label: 'Planner' },
    { to: '/chat', icon: MessagesSquare, label: 'Chat' },
    { to: '/docs', icon: FileText, label: 'Docs' },
    { to: '/dashboards', icon: LayoutDashboard, label: 'Dashboards' },
    { to: '/whiteboards', icon: PenTool, label: 'Whiteboards' },
    { to: '/goals', icon: Target, label: 'Goals' },
    { to: '/timesheets', icon: Clock, label: 'Timesheets' },
    { to: '/automations', icon: Zap, label: 'Automations' },
    { to: '/clips', icon: Video, label: 'Clips' },
    { to: '/templates', icon: LayoutTemplate, label: 'Templates' },
  ];

  return (
    <aside className="w-[260px] shrink-0 h-full flex flex-col bg-[var(--sidebar)] border-r select-none">
      <div className="h-12 flex items-center gap-1 px-2.5 border-b">
        <Popover width={280} trigger={
          <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[var(--hover)] min-w-0">
            <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: ws.color, color: readableText(ws.color) }}>{ws.name[0]?.toUpperCase()}</span>
            <span className="font-semibold truncate text-[13.5px]">{ws.name}</span>
            <ChevronDown size={14} className="text-[var(--muted)] shrink-0" />
          </button>
        }>
          {(close) => (
            <div>
              <div className="p-3 border-b flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center font-bold" style={{ background: ws.color, color: readableText(ws.color) }}>{ws.name[0]?.toUpperCase()}</span>
                <div className="min-w-0"><div className="font-semibold truncate">{ws.name}</div><div className="text-xs text-[var(--muted)]">{useStore.getState().members.length} members</div></div>
              </div>
              <MenuList close={close} items={[
                { label: 'Settings', icon: <Settings size={14} />, onClick: () => nav('/settings/workspace') },
                { label: 'People', icon: <UserPlus size={14} />, onClick: () => nav('/settings/people') },
                { label: 'ClickApps', icon: <Sliders size={14} />, onClick: () => nav('/settings/clickapps') },
                { divider: true, label: '' },
                ...workspaces.map((w) => ({
                  label: <span className="flex items-center gap-2">{w.name}{w.id === ws.id && <Check size={13} className="text-accent" />}</span>,
                  icon: <span className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center" style={{ background: w.color, color: readableText(w.color) }}>{w.name[0]}</span>,
                  onClick: () => { getState().selectWorkspace(w.id); nav('/'); },
                })),
                { label: 'New Workspace', icon: <Plus size={14} />, onClick: () => nav('/new-workspace') },
              ]} />
            </div>
          )}
        </Popover>
        <div className="flex-1" />
        <button className="icon-btn" title="Collapse sidebar (Ctrl+\)" onClick={() => { set({ sidebarOpen: false }); localStorage.setItem('proman.sidebar', '0'); }}><PanelLeftClose size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {navItems.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex items-center gap-2.5 rounded-md px-2 py-[5px] text-[13.5px]', isActive ? 'bg-[var(--hover)] font-medium' : 'text-[var(--text)]/90 hover:bg-[var(--hover)]')}>
            <n.icon size={16} className="text-[var(--muted)]" />
            <span className="flex-1">{n.label}</span>
            {!!n.badge && <span className="rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-[10px] font-semibold px-1.5 min-w-[18px] text-center">{n.badge > 99 ? '99+' : n.badge}</span>}
          </NavLink>
        ))}

        {favs.length > 0 && (
          <Section title="Favorites">
            {favs.map((f) => <FavRow key={f.id} fav={f} />)}
          </Section>
        )}

        <Section title="Spaces" action={
          <Popover align="end" trigger={<button className="icon-btn !w-6 !h-6"><MoreHorizontal size={14} /></button>}>
            {(close) => <MenuList close={close} items={[
              { label: 'New Space', icon: <Plus size={14} />, onClick: () => setNewSpace(true) },
              { label: showArchived ? 'Hide archived' : 'Show archived', icon: showArchived ? <EyeOff size={14} /> : <Eye size={14} />, onClick: () => setShowArchived(!showArchived) },
            ]} />}
          </Popover>
        } onAdd={() => setNewSpace(true)}>
          <NavLink to="/everything" className={({ isActive }) => cn('flex items-center gap-2.5 rounded-md px-2 py-[5px] text-[13.5px] hover:bg-[var(--hover)]', isActive && 'bg-[var(--hover)] font-medium')}>
            <Layers size={16} className="text-[var(--muted)]" /> Everything
          </NavLink>
          {spaceList.map((s) => <SpaceRow key={s.id} space={s} />)}
          <button onClick={() => setNewSpace(true)} className="w-full flex items-center gap-2.5 rounded-md px-2 py-[5px] text-[13.5px] text-[var(--muted)] hover:bg-[var(--hover)]"><Plus size={16} /> New Space</button>
        </Section>
      </div>

      <div className="border-t p-2 flex items-center gap-1">
        <Popover side="top" width={240} trigger={
          <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[var(--hover)] min-w-0">
            <Avatar user={me} size={26} />
            <span className="text-[13px] font-medium truncate">{me.name}</span>
          </button>
        }>
          {(close) => (
            <div>
              <div className="p-3 border-b"><div className="font-medium">{me.name}</div><div className="text-xs text-[var(--muted)] truncate">{me.email}</div></div>
              <ThemeRow />
              <MenuList close={close} items={[
                { label: 'Profile & preferences', icon: <Settings size={14} />, onClick: () => nav('/settings/profile') },
                { label: 'Keyboard shortcuts', icon: <span className="text-[10px] font-mono">?</span>, onClick: () => window.dispatchEvent(new Event('proman-shortcuts')) },
                { divider: true, label: '' },
                { label: 'Sign out', icon: <LogOut size={14} />, onClick: () => getState().signOut() },
              ]} />
            </div>
          )}
        </Popover>
        <div className="flex-1" />
        <button className="btn btn-outline !py-1 !px-2 !text-xs" onClick={() => nav('/settings/people')}><UserPlus size={13} /> Invite</button>
      </div>
      <NewSpaceModal open={newSpace} onClose={() => setNewSpace(false)} />
    </aside>
  );
}

function ThemeRow() {
  const [t, setT] = useState(getTheme());
  const opts: [string, any][] = [['light', Sun], ['dark', Moon], ['system', Monitor]];
  return (
    <div className="px-3 py-2 border-b flex items-center gap-2 text-xs">
      <span className="text-[var(--muted)] flex-1">Theme</span>
      <div className="flex rounded-md border p-0.5">
        {opts.map(([k, I]) => <button key={k} onClick={() => { setTheme(k as any); setT(k as any); }} className={cn('p-1 rounded', t === k && 'bg-[var(--hover)]')} title={k}><I size={13} /></button>)}
      </div>
    </div>
  );
}

function Section({ title, children, action, onAdd }: { title: string; children: React.ReactNode; action?: React.ReactNode; onAdd?: () => void }) {
  const [open, setOpen] = useState(localStorage.getItem('proman.sec.' + title) !== '0');
  return (
    <div className="mt-4">
      <div className="group flex items-center px-2 h-7">
        <button className="flex items-center gap-1 text-[11.5px] font-semibold text-[var(--muted)] hover:text-[var(--text)]" onClick={() => { setOpen(!open); localStorage.setItem('proman.sec.' + title, open ? '0' : '1'); }}>
          {title}{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <div className="flex-1" />
        <div className="opacity-0 group-hover:opacity-100 flex">{action}{onAdd && <button className="icon-btn !w-6 !h-6" onClick={onAdd}><Plus size={14} /></button>}</div>
      </div>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  );
}

function FavRow({ fav }: { fav: Fav }) {
  const data = useStore((s) => s.data);
  const nav = useNavigate();
  const e: any = (data as any)[fav.type]?.[fav.id];
  if (!e) return null;
  const to = fav.type === 'task' ? undefined : fav.type === 'doc' ? `/doc/${fav.id}` : fav.type === 'dashboard' ? `/dashboard/${fav.id}` : fav.type === 'whiteboard' ? `/whiteboard/${fav.id}` : `/${fav.type}/${fav.id}`;
  return (
    <button onClick={() => (to ? nav(to) : getState().openTask(fav.id))} className="w-full flex items-center gap-2.5 rounded-md px-2 py-[5px] text-[13.5px] hover:bg-[var(--hover)] text-left">
      <Star size={14} className="text-amber-500 shrink-0" fill="currentColor" />
      <span className="truncate">{e.name || e.title}</span>
    </button>
  );
}

// ------------------------------------------------------------------ tree
const rowCls = (active: boolean) => cn('group flex items-center gap-1.5 rounded-md pr-1 h-[30px] text-[13.5px] cursor-pointer', active ? 'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--text)] font-medium' : 'hover:bg-[var(--hover)]');

function useOpen(id: string, def = false): [boolean, (v: boolean) => void] {
  const [o, setO] = useState(() => { const v = localStorage.getItem('proman.open.' + id); return v == null ? def : v === '1'; });
  return [o, (v) => { setO(v); localStorage.setItem('proman.open.' + id, v ? '1' : '0'); }];
}

function onDropTask(e: React.DragEvent, listId: string) {
  const taskId = e.dataTransfer.getData('application/x-task');
  if (taskId) {
    e.preventDefault();
    getState().updateTask(taskId, { listId });
    getState().toast('Task moved to ' + getState().data.list[listId]?.name, 'success');
  }
  const draggedList = e.dataTransfer.getData('application/x-list');
  if (draggedList) e.preventDefault();
}

function SpaceRow({ space }: { space: Space }) {
  const nav = useNavigate();
  const loc = useLocation();
  const data = useStore((s) => s.data);
  const [open, setOpen] = useOpen(space.id, true);
  const [settings, setSettings] = useState<null | 'general' | 'statuses' | 'fields'>(null);
  const [del, setDel] = useState(false);
  const ctx = useContextMenu();
  const { isFav, toggle } = useFavs();
  const active = loc.pathname.startsWith('/space/' + space.id);
  const folders = Object.values(data.folder).filter((f) => f.spaceId === space.id && !f.parentFolderId && !f.archived).sort((a, b) => a.order - b.order);
  const lists = Object.values(data.list).filter((l) => l.spaceId === space.id && !l.folderId && !l.archived && !l.personalOf).sort((a, b) => a.order - b.order);
  const docs = Object.values(data.doc).filter((d) => d.location?.type === 'space' && d.location.id === space.id && !d.parentId && !d.archived);
  const boards = Object.values(data.whiteboard).filter((d) => d.location?.type === 'space' && d.location.id === space.id);
  const dashes = Object.values(data.dashboard).filter((d) => d.location?.type === 'space' && d.location.id === space.id);

  const createMenu = createItems(space.id, null, nav);
  const menu: MenuItem[] = [
    { label: 'Create new', icon: <Plus size={14} />, submenu: createMenu },
    { divider: true, label: '' },
    { label: 'Rename', icon: <Pencil size={14} />, onClick: () => setSettings('general') },
    { label: 'Color & settings', icon: <Palette size={14} />, onClick: () => setSettings('general') },
    { label: 'Statuses', icon: <Check size={14} />, onClick: () => setSettings('statuses') },
    { label: 'Custom Fields', icon: <Sliders size={14} />, onClick: () => setSettings('fields') },
    { label: isFav(space.id) ? 'Remove from Favorites' : 'Add to Favorites', icon: <Star size={14} />, onClick: () => toggle({ type: 'space', id: space.id }) },
    { label: 'Copy link', icon: <Link2 size={14} />, onClick: () => { navigator.clipboard.writeText(location.href.split('#')[0] + '#/space/' + space.id); getState().toast('Link copied'); } },
    { label: 'Duplicate', icon: <Copy size={14} />, onClick: () => duplicateSpace(space.id) },
    { label: space.archived ? 'Unarchive' : 'Archive', icon: <Archive size={14} />, onClick: () => getState().update('space', space.id, { archived: !space.archived }) },
    ...(canAdmin() ? [{ label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => setDel(true) }] : []),
  ];

  return (
    <div>
      <div className={rowCls(active)} onClick={() => nav('/space/' + space.id)} onContextMenu={(e) => ctx.open(e, menu)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const listId = e.dataTransfer.getData('application/x-list');
          if (listId) { getState().update('list', listId, { spaceId: space.id, folderId: null }); }
        }}>
        <button className="w-6 h-6 flex items-center justify-center shrink-0 ml-0.5 relative" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
          <span className="w-5 h-5 rounded-[5px] text-[10px] font-bold flex items-center justify-center group-hover:opacity-0" style={{ background: space.color, color: readableText(space.color) }}>{space.icon || space.name[0]?.toUpperCase()}</span>
          <span className="absolute inset-0 hidden group-hover:flex items-center justify-center text-[var(--muted)]">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        </button>
        <span className="flex-1 truncate">{space.name}</span>
        {space.private && <Lock size={12} className="text-[var(--faint)]" />}
        {space.archived && <Archive size={12} className="text-[var(--faint)]" />}
        <span className="hidden group-hover:flex">
          <Popover align="end" trigger={<button className="icon-btn !w-6 !h-6"><MoreHorizontal size={14} /></button>}>{(close) => <MenuList items={menu} close={close} />}</Popover>
          <Popover align="end" trigger={<button className="icon-btn !w-6 !h-6"><Plus size={14} /></button>}>{(close) => <MenuList items={createMenu} close={close} />}</Popover>
        </span>
      </div>
      {open && (
        <div className="ml-[13px] pl-2 border-l border-[var(--border)]">
          {folders.map((f) => <FolderRow key={f.id} folder={f} />)}
          {lists.map((l) => <ListRow key={l.id} list={l} />)}
          {docs.map((d) => <LeafRow key={d.id} icon={<FileText size={14} />} label={d.title || 'Untitled'} to={'/doc/' + d.id} kind="doc" id={d.id} />)}
          {boards.map((d) => <LeafRow key={d.id} icon={<PenTool size={14} />} label={d.name} to={'/whiteboard/' + d.id} kind="whiteboard" id={d.id} />)}
          {dashes.map((d) => <LeafRow key={d.id} icon={<LayoutDashboard size={14} />} label={d.name} to={'/dashboard/' + d.id} kind="dashboard" id={d.id} />)}
          {!folders.length && !lists.length && <button className="w-full text-left px-2 py-1 text-xs text-[var(--faint)] hover:text-[var(--text)]" onClick={() => createMenu[0].onClick?.()}>+ Create a List</button>}
        </div>
      )}
      {settings && <SpaceSettingsModal space={space} tab={settings} onClose={() => setSettings(null)} />}
      <Confirm open={del} onClose={() => setDel(false)} title={`Delete "${space.name}"?`} body="This permanently deletes the Space with all of its Folders, Lists and tasks." onConfirm={() => { deleteLocation('space', space.id); nav('/'); }} />
      {ctx.node}
    </div>
  );
}

function FolderRow({ folder, depth = 0 }: { folder: Folder; depth?: number }) {
  const nav = useNavigate();
  const loc = useLocation();
  const data = useStore((s) => s.data);
  const [open, setOpen] = useOpen(folder.id, true);
  const [rename, setRename] = useState(false);
  const [statuses, setStatuses] = useState(false);
  const [del, setDel] = useState(false);
  const ctx = useContextMenu();
  const { isFav, toggle } = useFavs();
  const lists = Object.values(data.list).filter((l) => l.folderId === folder.id && !l.archived).sort((a, b) => a.order - b.order);
  const subfolders = Object.values(data.folder).filter((f) => f.parentFolderId === folder.id && !f.archived).sort((a, b) => a.order - b.order);
  const docs = Object.values(data.doc).filter((d) => d.location?.type === 'folder' && d.location.id === folder.id && !d.parentId && !d.archived);
  const active = loc.pathname.startsWith('/folder/' + folder.id);
  const createMenu = createItems(folder.spaceId, folder.id, nav);
  const menu: MenuItem[] = [
    { label: 'Create new', icon: <Plus size={14} />, submenu: createMenu },
    { divider: true, label: '' },
    { label: 'Rename', icon: <Pencil size={14} />, onClick: () => setRename(true) },
    { label: 'Folder statuses', icon: <Check size={14} />, onClick: () => setStatuses(true) },
    { label: isFav(folder.id) ? 'Remove from Favorites' : 'Add to Favorites', icon: <Star size={14} />, onClick: () => toggle({ type: 'folder', id: folder.id }) },
    { label: 'Duplicate', icon: <Copy size={14} />, onClick: () => duplicateFolder(folder.id) },
    { label: 'Archive', icon: <Archive size={14} />, onClick: () => getState().update('folder', folder.id, { archived: true }) },
    { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => setDel(true) },
  ];
  return (
    <div>
      <div className={rowCls(active)} onClick={() => nav('/folder/' + folder.id)} onContextMenu={(e) => ctx.open(e, menu)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { const listId = e.dataTransfer.getData('application/x-list'); if (listId) getState().update('list', listId, { folderId: folder.id, spaceId: folder.spaceId }); }}>
        <button className="w-6 h-6 flex items-center justify-center shrink-0 text-[var(--muted)]" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
          <span className="group-hover:hidden"><FolderIcon size={15} style={{ color: folder.color }} /></span>
          <span className="hidden group-hover:inline">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        </button>
        {rename ? <RenameInput value={folder.name} onDone={(v) => { if (v) getState().update('folder', folder.id, { name: v }); setRename(false); }} /> : <span className="flex-1 truncate">{folder.name}</span>}
        <span className="hidden group-hover:flex">
          <Popover align="end" trigger={<button className="icon-btn !w-6 !h-6"><MoreHorizontal size={14} /></button>}>{(close) => <MenuList items={menu} close={close} />}</Popover>
          <Popover align="end" trigger={<button className="icon-btn !w-6 !h-6"><Plus size={14} /></button>}>{(close) => <MenuList items={createMenu} close={close} />}</Popover>
        </span>
      </div>
      {open && (
        <div className="ml-[13px] pl-2 border-l border-[var(--border)]">
          {subfolders.map((f) => <FolderRow key={f.id} folder={f} depth={depth + 1} />)}
          {lists.map((l) => <ListRow key={l.id} list={l} />)}
          {docs.map((d) => <LeafRow key={d.id} icon={<FileText size={14} />} label={d.title || 'Untitled'} to={'/doc/' + d.id} kind="doc" id={d.id} />)}
          {!lists.length && !subfolders.length && <button className="w-full text-left px-2 py-1 text-xs text-[var(--faint)] hover:text-[var(--text)]" onClick={() => createMenu[0].onClick?.()}>+ Create a List</button>}
        </div>
      )}
      {statuses && <SpaceSettingsModal folder={folder} space={data.space[folder.spaceId]} tab="statuses" onClose={() => setStatuses(false)} />}
      <Confirm open={del} onClose={() => setDel(false)} title={`Delete "${folder.name}"?`} body="All Lists and tasks inside will be deleted." onConfirm={() => deleteLocation('folder', folder.id)} />
      {ctx.node}
    </div>
  );
}

function ListRow({ list }: { list: List }) {
  const nav = useNavigate();
  const loc = useLocation();
  const tasks = useStore((s) => s.data.task);
  const [rename, setRename] = useState(false);
  const [statuses, setStatuses] = useState(false);
  const [del, setDel] = useState(false);
  const [over, setOver] = useState(false);
  const ctx = useContextMenu();
  const { isFav, toggle } = useFavs();
  const data = useStore((s) => s.data);
  const count = useMemo(() => Object.values(tasks).filter((t) => t.listId === list.id && !t.parentId && !t.archived && !isClosed(t)).length, [tasks, list.id]);
  const active = loc.pathname.startsWith('/list/' + list.id);
  const menu: MenuItem[] = [
    { label: 'Rename', icon: <Pencil size={14} />, onClick: () => setRename(true) },
    { label: 'Color', icon: <Palette size={14} />, submenu: COLORS.slice(0, 10).map((c) => ({ label: <span className="inline-block w-4 h-4 rounded-full" style={{ background: c }} />, onClick: () => getState().update('list', list.id, { color: c }) })) },
    { label: 'List statuses', icon: <Check size={14} />, onClick: () => setStatuses(true) },
    { label: isFav(list.id) ? 'Remove from Favorites' : 'Add to Favorites', icon: <Star size={14} />, onClick: () => toggle({ type: 'list', id: list.id }) },
    { label: 'Copy link', icon: <Link2 size={14} />, onClick: () => { navigator.clipboard.writeText(location.href.split('#')[0] + '#/list/' + list.id); getState().toast('Link copied'); } },
    { label: 'Duplicate', icon: <Copy size={14} />, onClick: () => duplicateList(list.id) },
    { label: 'Save as template', icon: <LayoutTemplate size={14} />, onClick: () => saveListTemplate(list.id) },
    { label: 'Archive', icon: <Archive size={14} />, onClick: () => getState().update('list', list.id, { archived: true }) },
    { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => setDel(true) },
  ];
  return (
    <>
      <div className={cn(rowCls(active), over && 'ring-2 ring-[var(--accent)]')} onClick={() => nav('/list/' + list.id)} onContextMenu={(e) => ctx.open(e, menu)}
        draggable onDragStart={(e) => e.dataTransfer.setData('application/x-list', list.id)}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-task')) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { setOver(false); onDropTask(e, list.id); }}>
        <span className="w-6 h-6 flex items-center justify-center shrink-0"><span className="w-2 h-2 rounded-full" style={{ background: list.color || 'var(--faint)' }} /></span>
        {rename ? <RenameInput value={list.name} onDone={(v) => { if (v) getState().update('list', list.id, { name: v }); setRename(false); }} /> : <span className="flex-1 truncate">{list.name}</span>}
        {list.sprint && <span className="text-[10px] text-[var(--faint)]">sprint</span>}
        <span className="text-[11px] text-[var(--faint)] group-hover:hidden pr-1">{count || ''}</span>
        <span className="hidden group-hover:flex">
          <Popover align="end" trigger={<button className="icon-btn !w-6 !h-6"><MoreHorizontal size={14} /></button>}>{(close) => <MenuList items={menu} close={close} />}</Popover>
          <button className="icon-btn !w-6 !h-6" title="New task" onClick={(e) => { e.stopPropagation(); getState().set({ createOpen: 'task', createDefaults: { listId: list.id } }); }}><Plus size={14} /></button>
        </span>
      </div>
      {statuses && <SpaceSettingsModal list={list} space={data.space[list.spaceId]} tab="statuses" onClose={() => setStatuses(false)} />}
      <Confirm open={del} onClose={() => setDel(false)} title={`Delete "${list.name}"?`} body="All tasks in this List will be deleted." onConfirm={() => deleteLocation('list', list.id)} />
      {ctx.node}
    </>
  );
}

function LeafRow({ icon, label, to, kind, id }: { icon: React.ReactNode; label: string; to: string; kind: Kind; id: string }) {
  const nav = useNavigate();
  const loc = useLocation();
  const active = loc.pathname === to;
  const ctx = useContextMenu();
  return (
    <div className={rowCls(active)} onClick={() => nav(to)} onContextMenu={(e) => ctx.open(e, [
      { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => getState().remove(kind, id) },
    ])}>
      <span className="w-6 h-6 flex items-center justify-center shrink-0 text-[var(--muted)]">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {ctx.node}
    </div>
  );
}

function RenameInput({ value, onDone }: { value: string; onDone: (v: string | null) => void }) {
  return <input autoFocus defaultValue={value} className="flex-1 min-w-0 bg-[var(--panel)] border border-[var(--accent)] rounded px-1 outline-none text-[13px]"
    onClick={(e) => e.stopPropagation()} onBlur={(e) => onDone(e.target.value.trim() || null)}
    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') onDone(null); }} />;
}

// ------------------------------------------------------------------ actions
export function createItems(spaceId: string, folderId: string | null, nav: (p: string) => void): MenuItem[] {
  const s = () => getState();
  return [
    { label: 'List', icon: <ListIcon size={14} />, onClick: () => {
      const name = prompt('List name', 'New List');
      if (!name) return;
      const l = s().create('list', { name, spaceId, folderId, order: Date.now() });
      nav('/list/' + l.id);
    } },
    { label: 'Folder', icon: <FolderIcon size={14} />, onClick: () => {
      const name = prompt('Folder name', 'New Folder');
      if (!name) return;
      const f = s().create('folder', folderId ? { name, spaceId, parentFolderId: folderId, order: Date.now() } : { name, spaceId, order: Date.now() });
      s().create('list', { name: 'List', spaceId, folderId: f.id, order: 0 });
    } },
    { label: 'Sprint List', icon: <Zap size={14} />, onClick: () => {
      const start = new Date(); const end = new Date(Date.now() + 13 * 86400000);
      const n = Object.values(s().data.list).filter((l) => l.spaceId === spaceId && l.sprint).length + 1;
      const l = s().create('list', { name: `Sprint ${n}`, spaceId, folderId, order: Date.now(), sprint: { start: start.toISOString(), end: end.toISOString() } });
      nav('/list/' + l.id);
    } },
    { divider: true, label: '' },
    { label: 'Doc', icon: <FileText size={14} />, onClick: () => {
      const d = s().create('doc', { title: 'Untitled', content: '', location: { type: folderId ? 'folder' : 'space', id: folderId || spaceId }, parentId: null, order: Date.now() });
      nav('/doc/' + d.id);
    } },
    { label: 'Whiteboard', icon: <PenTool size={14} />, onClick: () => {
      const w = s().create('whiteboard', { name: 'Whiteboard', elements: [], location: { type: 'space', id: spaceId } });
      nav('/whiteboard/' + w.id);
    } },
    { label: 'Dashboard', icon: <LayoutDashboard size={14} />, onClick: () => {
      const d = s().create('dashboard', { name: 'Dashboard', widgets: [], location: { type: 'space', id: spaceId } });
      nav('/dashboard/' + d.id);
    } },
  ];
}

export function deleteLocation(type: 'space' | 'folder' | 'list', id: string) {
  const s = getState();
  const refs: { kind: Kind; id: string }[] = [];
  let lists: string[] = [];
  if (type === 'list') lists = [id];
  if (type === 'folder') {
    const folders = new Set([id]);
    let grew = true;
    while (grew) { grew = false; for (const f of Object.values(s.data.folder)) if (f.parentFolderId && folders.has(f.parentFolderId) && !folders.has(f.id)) { folders.add(f.id); grew = true; } }
    folders.forEach((f) => refs.push({ kind: 'folder', id: f }));
    lists = Object.values(s.data.list).filter((l) => l.folderId && folders.has(l.folderId)).map((l) => l.id);
  }
  if (type === 'space') {
    refs.push({ kind: 'space', id });
    Object.values(s.data.folder).filter((f) => f.spaceId === id).forEach((f) => refs.push({ kind: 'folder', id: f.id }));
    lists = Object.values(s.data.list).filter((l) => l.spaceId === id).map((l) => l.id);
  }
  lists.forEach((l) => refs.push({ kind: 'list', id: l }));
  const ls = new Set(lists);
  const taskIds = new Set(Object.values(s.data.task).filter((t) => ls.has(t.listId)).map((t) => t.id));
  taskIds.forEach((t) => refs.push({ kind: 'task', id: t }));
  for (const c of Object.values(s.data.comment)) if (c.taskId && taskIds.has(c.taskId)) refs.push({ kind: 'comment', id: c.id });
  for (const a of Object.values(s.data.activity)) if (taskIds.has(a.taskId)) refs.push({ kind: 'activity', id: a.id });
  for (const l of Object.values(s.data.link)) if (taskIds.has(l.from) || taskIds.has(l.to)) refs.push({ kind: 'link', id: l.id });
  for (const v of Object.values(s.data.view)) if (v.location.id === id || ls.has(v.location.id)) refs.push({ kind: 'view', id: v.id });
  if (type !== 'list') refs.push({ kind: type, id });
  s.removeMany(refs.filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i));
}

function copyTasks(fromList: string, toList: string, statusMap?: (sid: string) => string) {
  const s = getState();
  const tasks = Object.values(s.data.task).filter((t) => t.listId === fromList);
  const idMap = new Map<string, string>();
  tasks.forEach((t) => idMap.set(t.id, uid()));
  s.createMany(tasks.map((t) => {
    const { id, kind, created_at, updated_at, created_by, ...rest } = t as any;
    return { kind: 'task', id: idMap.get(t.id), data: { ...rest, listId: toList, parentId: t.parentId ? idMap.get(t.parentId) || null : null, status: statusMap ? statusMap(t.status) : t.status } };
  }));
}

export function duplicateList(listId: string, into?: { spaceId: string; folderId: string | null }) {
  const s = getState();
  const l = s.data.list[listId];
  if (!l) return;
  const { id, kind, created_at, updated_at, created_by, ...rest } = l as any;
  const nl = s.create('list', { ...rest, name: into ? l.name : l.name + ' (copy)', spaceId: into?.spaceId || l.spaceId, folderId: into ? into.folderId : l.folderId, order: l.order + 1 });
  copyTasks(listId, nl.id);
  return nl;
}

export function duplicateFolder(folderId: string, spaceId?: string) {
  const s = getState();
  const f = s.data.folder[folderId];
  const { id, kind, created_at, updated_at, created_by, ...rest } = f as any;
  const nf = s.create('folder', { ...rest, name: spaceId ? f.name : f.name + ' (copy)', spaceId: spaceId || f.spaceId, order: f.order + 1 });
  Object.values(s.data.list).filter((l) => l.folderId === folderId).forEach((l) => duplicateList(l.id, { spaceId: spaceId || f.spaceId, folderId: nf.id }));
}

export function duplicateSpace(spaceId: string) {
  const s = getState();
  const sp = s.data.space[spaceId];
  const { id, kind, created_at, updated_at, created_by, ...rest } = sp as any;
  const ns = s.create('space', { ...rest, name: sp.name + ' (copy)', order: sp.order + 1 });
  Object.values(s.data.folder).filter((f) => f.spaceId === spaceId && !f.parentFolderId).forEach((f) => duplicateFolder(f.id, ns.id));
  Object.values(s.data.list).filter((l) => l.spaceId === spaceId && !l.folderId).forEach((l) => duplicateList(l.id, { spaceId: ns.id, folderId: null }));
  defaultViews({ type: 'space', id: ns.id }).forEach((v) => s.create('view', v.data));
}

export function saveListTemplate(listId: string) {
  const s = getState();
  const l = s.data.list[listId];
  const name = prompt('Template name', l.name + ' template');
  if (!name) return;
  const tasks = Object.values(s.data.task).filter((t) => t.listId === listId).map((t) => {
    const { kind, created_at, updated_at, created_by, ...rest } = t as any;
    return { ...rest, assignees: [], completedAt: null };
  });
  s.create('template', { name, type: 'list', description: `${tasks.length} tasks from ${l.name}`, payload: { list: { name: l.name, statuses: l.statuses || null }, tasks } });
  s.toast('Saved as template', 'success');
}
