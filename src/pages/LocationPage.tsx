import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  List as ListIcon, Kanban, Calendar, GanttChart, Table2, Users, Activity, Network, Map as MapIcon, LayoutGrid, FileInput, Globe, FileText, PenTool, MessagesSquare,
  LayoutDashboard, Plus, MoreHorizontal, Pin, Star, Pencil, Trash2, Copy, Lock, Shield, Layers, Folder as FolderIcon, Zap, Settings2, ChevronRight, BarChart3, Check, Hourglass,
} from 'lucide-react';
import { useStore, getState, listsIn, pushRecent, canEdit } from '../lib/store';
import { Popover, MenuList, type MenuItem, InlineEdit, Empty, useContextMenu, Modal } from '../components/ui';
import { FieldManager } from '../components/SpaceSettings';
import { ViewToolbar } from '../components/views/Toolbar';
import { applyFilters, sortTasks } from '../lib/filters';
import { cn, readableText, uid } from '../lib/utils';
import type { View, ViewType, LocationRef, Task } from '../lib/types';
import { useFavs } from '../components/layout/Sidebar';
import { SpaceSettingsModal } from '../components/SpaceSettings';
import { Spinner } from '../App';
import { ListView } from '../components/views/ListView';
import { BoardView } from '../components/views/BoardView';

const CalendarView = lazy(() => import('../components/views/CalendarView'));
const GanttView = lazy(() => import('../components/views/GanttView'));
const TableView = lazy(() => import('../components/views/TableView'));
const WorkloadView = lazy(() => import('../components/views/WorkloadView'));
const TeamView = lazy(() => import('../components/views/TeamView'));
const ActivityView = lazy(() => import('../components/views/ActivityView'));
const MindMapView = lazy(() => import('../components/views/MindMapView'));
const MapView = lazy(() => import('../components/views/MapView'));
const GalleryView = lazy(() => import('../components/views/GalleryView'));
const FormView = lazy(() => import('../components/views/FormView'));
const EmbedView = lazy(() => import('../components/views/EmbedView'));
const RefView = lazy(() => import('../components/views/RefView'));

export const VIEW_TYPES: { type: ViewType; label: string; icon: any; desc: string; tasks: boolean }[] = [
  { type: 'list', label: 'List', icon: ListIcon, desc: 'Track tasks, bugs, people & more', tasks: true },
  { type: 'board', label: 'Board', icon: Kanban, desc: 'Move tasks between columns', tasks: true },
  { type: 'calendar', label: 'Calendar', icon: Calendar, desc: 'Plan, schedule & delegate', tasks: true },
  { type: 'gantt', label: 'Gantt', icon: GanttChart, desc: 'Plan dependencies & time', tasks: true },
  { type: 'timeline', label: 'Timeline', icon: BarChart3, desc: 'See tasks by start & due date per person', tasks: true },
  { type: 'table', label: 'Table', icon: Table2, desc: 'Structured, spreadsheet-like table', tasks: true },
  { type: 'workload', label: 'Workload', icon: Hourglass, desc: 'Visualize team capacity', tasks: true },
  { type: 'team', label: 'Team', icon: Users, desc: 'Monitor what people are working on', tasks: true },
  { type: 'activity', label: 'Activity', icon: Activity, desc: 'Real-time activity feed', tasks: false },
  { type: 'mindmap', label: 'Mind Map', icon: Network, desc: 'Visual brainstorming of tasks & ideas', tasks: true },
  { type: 'map', label: 'Map', icon: MapIcon, desc: 'Tasks with a Location field on a map', tasks: true },
  { type: 'gallery', label: 'Gallery', icon: LayoutGrid, desc: 'Image-first task cards', tasks: true },
  { type: 'form', label: 'Form', icon: FileInput, desc: 'Collect responses as tasks', tasks: false },
  { type: 'doc', label: 'Doc', icon: FileText, desc: 'Docs, wikis & notes', tasks: false },
  { type: 'whiteboard', label: 'Whiteboard', icon: PenTool, desc: 'Visual collaboration canvas', tasks: false },
  { type: 'chat', label: 'Chat', icon: MessagesSquare, desc: 'Talk with your team here', tasks: false },
  { type: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Charts & reporting', tasks: false },
  { type: 'embed', label: 'Embed', icon: Globe, desc: 'Websites, Figma, Sheets, videos…', tasks: false },
];

const seededViews = new Set<string>();

export function LocationPage({ type }: { type: LocationRef['type'] }) {
  const params = useParams();
  const [search] = useSearchParams();
  const nav = useNavigate();
  const id = type === 'everything' ? 'all' : params.id!;
  const loc: LocationRef = { type, id };
  const data = useStore((s) => s.data);
  const entity: any = type === 'everything' ? { name: 'Everything' } : (data as any)[type]?.[id];
  const views = useMemo(() => Object.values(data.view).filter((v) => v.location.type === type && v.location.id === id).sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || a.order - b.order), [data.view, type, id]);

  // ensure default views exist
  useEffect(() => {
    if (!entity || views.length || !canEdit()) return;
    const key = type + ':' + id;
    if (seededViews.has(key)) return; // StrictMode / re-render guard: create defaults once
    seededViews.add(key);
    const s = getState();
    s.createMany([
      { kind: 'view', data: { name: 'List', type: 'list', location: loc, config: { groupBy: 'status', showSubtasks: 'collapsed' }, order: 0 } },
      { kind: 'view', data: { name: 'Board', type: 'board', location: loc, config: { groupBy: 'status' }, order: 1 } },
    ]);
  }, [type, id, !!entity, views.length]);

  useEffect(() => { if (entity && type !== 'everything') pushRecent({ type: type as any, id }); }, [type, id]);

  const current = views.find((v) => v.id === params.viewId) || views.find((v) => v.isDefault) || views[0];
  const listIds = useMemo(() => listsIn(loc), [data.list, data.folder, type, id]);

  if (!entity) return <Empty title="Not found" body="This location was deleted or you don't have access." />;
  const base = type === 'everything' ? '/everything' : `/${type}/${id}`;

  return (
    <div className="h-full flex flex-col">
      <LocationHeader type={type} id={id} entity={entity} />
      <ViewsBar views={views} current={current} base={base} loc={loc} />
      {current ? <ViewHost key={current.id} view={current} listIds={listIds} loc={loc} assigneeParam={search.get('assignee')} /> : <Spinner />}
    </div>
  );
}

function LocationHeader({ type, id, entity }: { type: string; id: string; entity: any }) {
  const nav = useNavigate();
  const data = useStore((s) => s.data);
  const { isFav, toggle } = useFavs();
  const [settings, setSettings] = useState<null | 'general' | 'statuses' | 'fields'>(null);
  const space = type === 'space' ? entity : type === 'folder' ? data.space[entity.spaceId] : type === 'list' ? data.space[entity.spaceId] : null;
  const folder = type === 'list' && entity.folderId ? data.folder[entity.folderId] : null;
  return (
    <div className="h-12 shrink-0 flex items-center gap-2 px-4 border-b bg-[var(--panel)]">
      {type === 'everything' ? <Layers size={18} className="text-[var(--muted)]" /> : type === 'space' ? (
        <span className="w-6 h-6 rounded-md text-[11px] font-bold flex items-center justify-center" style={{ background: entity.color, color: readableText(entity.color) }}>{entity.icon || entity.name[0]}</span>
      ) : type === 'folder' ? <FolderIcon size={18} className="text-[var(--muted)]" /> : <span className="w-3 h-3 rounded-full" style={{ background: entity.color || space?.color }} />}
      {space && type !== 'space' && <span className="hidden md:contents"><button className="text-[13px] text-[var(--muted)] hover:text-[var(--text)]" onClick={() => nav('/space/' + space.id)}>{space.name}</button><ChevronRight size={13} className="text-[var(--faint)]" /></span>}
      {folder && <span className="hidden md:contents"><button className="text-[13px] text-[var(--muted)] hover:text-[var(--text)]" onClick={() => nav('/folder/' + folder.id)}>{folder.name}</button><ChevronRight size={13} className="text-[var(--faint)]" /></span>}
      {type === 'everything' ? <span className="font-semibold">Everything</span> : (
        <div className="min-w-[60px] max-w-[360px]"><InlineEdit value={entity.name} onSave={(v) => getState().update(type as any, id, { name: v })} className="font-semibold text-[15px]" /></div>
      )}
      {type !== 'everything' && <button className="icon-btn" onClick={() => toggle({ type, id })}><Star size={15} className={isFav(id) ? 'text-amber-500' : ''} fill={isFav(id) ? 'currentColor' : 'none'} /></button>}
      {type === 'list' && entity.sprint && (
        <span className="hidden md:inline text-xs rounded-full bg-[var(--subtle)] border px-2 py-0.5 text-[var(--muted)]">Sprint · {new Date(entity.sprint.start).toLocaleDateString()} – {new Date(entity.sprint.end).toLocaleDateString()}</span>
      )}
      <div className="flex-1" />
      <button className="btn btn-ghost !py-1 !px-2 sm:!px-3" aria-label="Automate" onClick={() => nav('/automations?loc=' + type + ':' + id)}><Zap size={14} /> <span className="hidden sm:inline">Automate</span></button>
      {type !== 'everything' && space && (
        <Popover align="end" trigger={<button className="icon-btn"><Settings2 size={16} /></button>}>
          {(close) => <MenuList close={close} items={[
            ...(type === 'space' ? [{ label: 'Space settings', icon: <Settings2 size={14} />, onClick: () => setSettings('general') }] : []),
            { label: 'Statuses', icon: <Check size={14} />, onClick: () => setSettings('statuses') },
            { label: 'Custom Fields', icon: <Settings2 size={14} />, onClick: () => setSettings('fields') },
            ...(type === 'list' ? [{ label: entity.sprint ? 'Remove sprint dates' : 'Make this a Sprint (2 weeks)', icon: <Zap size={14} />, onClick: () => getState().update('list', id, { sprint: entity.sprint ? null : { start: new Date().toISOString(), end: new Date(Date.now() + 13 * 864e5).toISOString() } }) }] : []),
          ]} />}
        </Popover>
      )}
      {settings && space && (settings === 'fields'
        ? <FieldsModal type={type} id={id} onClose={() => setSettings(null)} />
        : <SpaceSettingsModal space={space} folder={type === 'folder' ? entity : undefined} list={type === 'list' ? entity : undefined} tab={settings} onClose={() => setSettings(null)} />)}
    </div>
  );
}

function FieldsModal({ type, id, onClose }: { type: string; id: string; onClose: () => void }) {
  return <Modal open onClose={onClose} title="Custom Fields" width={520}><div className="p-5"><FieldManager scope={{ type: type as any, id }} /></div></Modal>;
}

function ViewsBar({ views, current, base, loc }: { views: View[]; current?: View; base: string; loc: LocationRef }) {
  const nav = useNavigate();
  const ctx = useContextMenu();
  const s = getState();
  const add = (type: ViewType) => {
    const meta = VIEW_TYPES.find((v) => v.type === type)!;
    let config: any = { groupBy: 'status', showSubtasks: 'collapsed' };
    if (type === 'doc') config.refId = s.create('doc', { title: 'Untitled', content: '', location: loc.type === 'everything' ? null : loc, parentId: null }).id;
    if (type === 'whiteboard') config.refId = s.create('whiteboard', { name: 'Whiteboard', elements: [], location: loc.type === 'everything' ? null : loc }).id;
    if (type === 'chat') config.refId = s.create('channel', { name: (loc.type === 'everything' ? 'everything' : (s.data as any)[loc.type][loc.id]?.name || 'chat').toLowerCase().replace(/\s+/g, '-'), location: loc, members: [] }).id;
    if (type === 'dashboard') config.refId = s.create('dashboard', { name: 'Dashboard', widgets: [], location: loc.type === 'everything' ? null : loc }).id;
    if (type === 'form') config.form = { title: 'New form', description: '', fields: [{ id: uid(), key: 'name', label: 'Task name', required: true }] };
    if (type === 'embed') config.url = prompt('URL to embed (website, Figma, Google Sheets, YouTube…)', 'https://') || '';
    if (type === 'timeline') config.groupBy = 'assignee';
    const v = s.create('view', { name: meta.label, type, location: loc, config, order: Date.now() });
    nav(`${base}/${v.id}`);
  };
  const menuFor = (v: View): MenuItem[] => [
    { label: 'Rename', icon: <Pencil size={14} />, onClick: () => { const n = prompt('View name', v.name); if (n) s.update('view', v.id, { name: n }); } },
    { label: v.pinned ? 'Unpin' : 'Pin view', icon: <Pin size={14} />, onClick: () => s.update('view', v.id, { pinned: !v.pinned }) },
    { label: 'Set as default view', icon: <Star size={14} />, onClick: () => { for (const x of Object.values(s.data.view)) if (x.location.id === loc.id && x.isDefault) s.update('view', x.id, { isDefault: false }); s.update('view', v.id, { isDefault: true }); } },
    { label: v.private ? 'Make shared' : 'Make private', icon: <Lock size={14} />, onClick: () => s.update('view', v.id, { private: !v.private }) },
    { label: v.protected ? 'Unprotect' : 'Protect view', icon: <Shield size={14} />, onClick: () => s.update('view', v.id, { protected: !v.protected }) },
    { label: 'Duplicate', icon: <Copy size={14} />, onClick: () => { const { id, kind, created_at, updated_at, created_by, ...rest } = v as any; const n = s.create('view', { ...rest, name: v.name + ' copy', order: v.order + 0.5 }); nav(`${base}/${n.id}`); } },
    { divider: true, label: '' },
    { label: 'Delete view', icon: <Trash2 size={14} />, danger: true, disabled: v.protected, onClick: () => { s.remove('view', v.id); nav(base); } },
  ];
  return (
    <div className="h-10 shrink-0 flex items-center gap-0.5 px-3 border-b bg-[var(--panel)] overflow-x-auto">
      {views.map((v) => {
        const meta = VIEW_TYPES.find((x) => x.type === v.type);
        const I = meta?.icon || ListIcon;
        const active = current?.id === v.id;
        return (
          <button key={v.id} onClick={() => nav(`${base}/${v.id}`)} onContextMenu={(e) => ctx.open(e, menuFor(v))} onDoubleClick={() => { const n = prompt('View name', v.name); if (n) s.update('view', v.id, { name: n }); }}
            className={cn('group relative h-10 flex items-center gap-1.5 px-2.5 text-[13px] whitespace-nowrap', active ? 'text-[var(--text)] font-medium' : 'text-[var(--muted)] hover:text-[var(--text)]')}>
            <I size={14} />{v.name}
            {v.pinned && <Pin size={10} className="text-[var(--faint)]" />}
            {v.private && <Lock size={10} className="text-[var(--faint)]" />}
            {active && (
              <Popover align="start" trigger={<span className="icon-btn !w-5 !h-5"><MoreHorizontal size={13} /></span>}>
                {(close) => <MenuList close={close} items={menuFor(v)} />}
              </Popover>
            )}
            {active && <span className="absolute left-2 right-2 bottom-0 h-0.5 rounded bg-[var(--accent)]" />}
          </button>
        );
      })}
      <Popover width={520} trigger={<button className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"><Plus size={14} /> View</button>}>
        {(close) => (
          <div className="p-3">
            <div className="label mb-2">Add a view</div>
            <div className="grid grid-cols-2 gap-1">
              {VIEW_TYPES.map((v) => (
                <button key={v.type} className="flex items-start gap-2.5 rounded-lg p-2 text-left hover:bg-[var(--hover)]" onClick={() => { close(); add(v.type); }}>
                  <span className="mt-0.5 w-7 h-7 rounded-md bg-[var(--subtle)] border flex items-center justify-center text-[var(--muted)] shrink-0"><v.icon size={15} /></span>
                  <span><span className="block text-[13px] font-medium">{v.label}</span><span className="block text-[11px] text-[var(--muted)] leading-tight">{v.desc}</span></span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Popover>
      {ctx.node}
    </div>
  );
}

export interface ViewProps { view: View; tasks: Task[]; allTasks: Task[]; listIds: string[]; loc: LocationRef }

function ViewHost({ view, listIds, loc, assigneeParam }: { view: View; listIds: string[]; loc: LocationRef; assigneeParam: string | null }) {
  const allTaskMap = useStore((s) => s.data.task);
  const meta = VIEW_TYPES.find((v) => v.type === view.type);
  const cfg = useMemo(() => (assigneeParam ? { ...view.config, assigneeFilter: [assigneeParam] } : view.config || {}), [view.config, assigneeParam]);
  const set = useMemo(() => new Set(listIds), [listIds]);
  const allTasks = useMemo(() => Object.values(allTaskMap).filter((t) => set.has(t.listId) || (t.extraLists || []).some((l) => set.has(l))), [allTaskMap, set]);
  const tasks = useMemo(() => sortTasks(applyFilters(allTasks, cfg), cfg), [allTasks, cfg]);
  const props: ViewProps = { view: { ...view, config: cfg }, tasks, allTasks, listIds, loc };
  const isTaskView = meta?.tasks;
  const features = {
    group: ['list', 'board', 'table', 'gallery', 'timeline', 'gantt'].includes(view.type),
    subtasks: ['list', 'board', 'table', 'calendar', 'gantt', 'gallery'].includes(view.type),
    columns: ['list', 'table'].includes(view.type),
    sort: ['list', 'board', 'table', 'gallery', 'gantt'].includes(view.type),
  };
  let body: React.ReactNode;
  switch (view.type) {
    case 'list': body = <ListView {...props} />; break;
    case 'board': body = <BoardView {...props} />; break;
    case 'calendar': body = <CalendarView {...props} />; break;
    case 'gantt': body = <GanttView {...props} />; break;
    case 'timeline': body = <GanttView {...props} timeline />; break;
    case 'table': body = <TableView {...props} />; break;
    case 'workload': body = <WorkloadView {...props} />; break;
    case 'team': body = <TeamView {...props} />; break;
    case 'activity': body = <ActivityView {...props} />; break;
    case 'mindmap': body = <MindMapView {...props} />; break;
    case 'map': body = <MapView {...props} />; break;
    case 'gallery': body = <GalleryView {...props} />; break;
    case 'form': body = <FormView {...props} />; break;
    case 'embed': body = <EmbedView {...props} />; break;
    default: body = <RefView {...props} />;
  }
  return (
    <>
      {isTaskView && <ViewToolbar view={view} listIds={listIds} tasks={tasks} features={features} />}
      <div className="flex-1 min-h-0 overflow-hidden"><Suspense fallback={<Spinner />}>{body}</Suspense></div>
    </>
  );
}
