import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LayoutDashboard, Plus, MoreHorizontal, Trash2, Pencil, GripVertical, PieChart as PieIcon, BarChart3, LineChart as LineIcon, Hash, ListChecks, Clock, Target, Type, Globe, AlertTriangle, Calculator, TrendingDown, Users } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { addDays, format, startOfDay, isBefore, isSameDay, startOfWeek, differenceInCalendarDays } from 'date-fns';
import { useStore, getState, listsIn, statusOf, isClosed, memberName, pushRecent, locationName } from '../lib/store';
import { applyFilters } from '../lib/filters';
import { Popover, MenuList, Modal, Empty, ProgressBar, StatusIcon, Avatar, useIsMobile } from '../components/ui';
import { RichEditor } from '../components/RichEditor';
import { toEmbedUrl } from '../components/views/EmbedView';
import { TaskLine } from './Home';
import { cn, uid, PRIORITIES, fmtDuration, isOverdue, debounce, fmtDue, dueTone } from '../lib/utils';
import type { Dashboard, Widget, WidgetType, LocationRef, Task } from '../lib/types';
import { goalProgress } from './Goals';

const WIDGETS: { type: WidgetType; label: string; icon: any; w: number; h: number; desc: string }[] = [
  { type: 'statusPie', label: 'Tasks by status', icon: PieIcon, w: 6, h: 2, desc: 'Pie chart of status distribution' },
  { type: 'assigneeBar', label: 'Tasks by assignee', icon: Users, w: 6, h: 2, desc: 'Open tasks per person' },
  { type: 'priorityBar', label: 'Tasks by priority', icon: BarChart3, w: 6, h: 2, desc: 'Bar chart of priorities' },
  { type: 'completedLine', label: 'Completed over time', icon: LineIcon, w: 6, h: 2, desc: 'Tasks closed per day (14 days)' },
  { type: 'burndown', label: 'Burndown', icon: TrendingDown, w: 6, h: 2, desc: 'Remaining tasks over a sprint/list' },
  { type: 'count', label: 'Task count', icon: Hash, w: 3, h: 1, desc: 'Number of open tasks' },
  { type: 'overdue', label: 'Overdue tasks', icon: AlertTriangle, w: 3, h: 1, desc: 'How many tasks are late' },
  { type: 'calc', label: 'Calculation', icon: Calculator, w: 3, h: 1, desc: 'Sum/average a number field' },
  { type: 'taskList', label: 'Task list', icon: ListChecks, w: 6, h: 2, desc: 'Filtered list of tasks' },
  { type: 'timeTracked', label: 'Time tracked', icon: Clock, w: 3, h: 1, desc: 'Time logged this week' },
  { type: 'workload', label: 'Workload (points)', icon: BarChart3, w: 6, h: 2, desc: 'Sprint points / estimates per person' },
  { type: 'goals', label: 'Goals', icon: Target, w: 6, h: 2, desc: 'Progress of your goals' },
  { type: 'text', label: 'Text block', icon: Type, w: 6, h: 2, desc: 'Notes, links, announcements' },
  { type: 'embed', label: 'Embed', icon: Globe, w: 6, h: 2, desc: 'Website, sheet, videoâ€¦' },
];

export default function Dashboards() {
  const { id } = useParams();
  const nav = useNavigate();
  const dashes = useStore((s) => s.data.dashboard);
  const d = id ? dashes[id] : undefined;
  if (d) { pushRecent({ type: 'dashboard', id: d.id }); return <div className="h-full overflow-y-auto bg-[var(--subtle)]"><DashboardBoard dash={d} header /></div>; }
  const list = Object.values(dashes).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 sm:p-8">
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold flex-1">Dashboards</h1>
          <button className="btn btn-primary" onClick={() => { const x = getState().create('dashboard', { name: 'New Dashboard', widgets: [], location: null }); nav('/dashboard/' + x.id); }}><Plus size={15} /> New Dashboard</button></div>
        <p className="text-[var(--muted)] mt-1">Real-time charts and reports across your Workspace.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
          {list.map((x) => (
            <button key={x.id} onClick={() => nav('/dashboard/' + x.id)} className="card p-4 text-left hover:shadow-md">
              <div className="flex items-center gap-2 font-medium"><LayoutDashboard size={16} className="text-accent" />{x.name}</div>
              <div className="text-xs text-[var(--muted)] mt-2">{x.widgets.length} widgets{x.location ? ' Â· ' + locationName(x.location) : ''}</div>
            </button>
          ))}
        </div>
        {!list.length && <Empty icon={<LayoutDashboard size={36} />} title="No dashboards yet" />}
      </div>
    </div>
  );
}

export function DashboardBoard({ dash, header }: { dash: Dashboard; header?: boolean }) {
  const nav = useNavigate();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Widget | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const mobile = useIsMobile(); // phones: number cards two per row, charts full width
  const save = (widgets: Widget[]) => getState().update('dashboard', dash.id, { widgets });
  const add = (type: WidgetType) => {
    const meta = WIDGETS.find((w) => w.type === type)!;
    const w: Widget = { id: uid(), type, title: meta.label, w: meta.w, h: meta.h, config: { location: dash.location || { type: 'everything', id: 'all' } } };
    save([...dash.widgets, w]);
    setAdding(false);
    if (['calc', 'embed', 'burndown'].includes(type)) setEditing(w);
  };
  return (
    <div className="p-3 sm:p-6">
      <div className="flex items-center gap-2 mb-5">
        {header ? <input className="text-xl sm:text-2xl font-bold bg-transparent outline-none flex-1 min-w-0" defaultValue={dash.name} onBlur={(e) => getState().update('dashboard', dash.id, { name: e.target.value || 'Dashboard' })} /> : <div className="flex-1" />}
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Add widget</button>
        {header && <Popover align="end" trigger={<button className="icon-btn"><MoreHorizontal size={16} /></button>}>
          {(close) => <MenuList close={close} items={[{ label: 'Delete dashboard', icon: <Trash2 size={14} />, danger: true, onClick: () => { if (confirm('Delete dashboard?')) { getState().remove('dashboard', dash.id); nav('/dashboards'); } } }]} />}
        </Popover>}
      </div>
      <div className="grid grid-cols-12 gap-4" style={{ gridAutoRows: '150px' }}>
        {dash.widgets.map((w) => (
          <div key={w.id} draggable onDragStart={() => setDrag(w.id)} onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (!drag || drag === w.id) return; const list = [...dash.widgets]; const from = list.findIndex((x) => x.id === drag); const [m] = list.splice(from, 1); list.splice(list.findIndex((x) => x.id === w.id), 0, m); save(list); setDrag(null); }}
            className="card flex flex-col overflow-hidden group" style={{ gridColumn: `span ${mobile ? (w.w <= 3 ? 6 : 12) : Math.min(12, w.w)}`, gridRow: `span ${w.h}` }}>
            <div className="flex items-center gap-1 px-4 pt-3 pb-1">
              <GripVertical size={13} className="text-[var(--faint)] opacity-0 group-hover:opacity-100 cursor-grab -ml-2" />
              <span className="font-semibold text-[13.5px] flex-1 truncate">{w.title}</span>
              <span className="text-[11px] text-[var(--faint)] truncate max-w-[40%]">{w.config.location && w.config.location.type !== 'everything' ? locationName(w.config.location) : ''}</span>
              <Popover align="end" trigger={<button className="icon-btn !w-6 !h-6 opacity-0 group-hover:opacity-100"><MoreHorizontal size={14} /></button>}>
                {(close) => <MenuList close={close} items={[
                  { label: 'Edit', icon: <Pencil size={14} />, onClick: () => setEditing(w) },
                  { label: 'Width', submenu: [3, 4, 6, 8, 12].map((n) => ({ label: `${n}/12`, onClick: () => save(dash.widgets.map((x) => (x.id === w.id ? { ...x, w: n } : x))) })) },
                  { label: 'Height', submenu: [1, 2, 3, 4].map((n) => ({ label: `${n} rows`, onClick: () => save(dash.widgets.map((x) => (x.id === w.id ? { ...x, h: n } : x))) })) },
                  { label: 'Remove', icon: <Trash2 size={14} />, danger: true, onClick: () => save(dash.widgets.filter((x) => x.id !== w.id)) },
                ]} />}
              </Popover>
            </div>
            <div className="flex-1 min-h-0 px-3 pb-3"><WidgetBody w={w} onText={(text) => save(dash.widgets.map((x) => (x.id === w.id ? { ...x, config: { ...x.config, text } } : x)))} /></div>
          </div>
        ))}
      </div>
      {!dash.widgets.length && <Empty icon={<LayoutDashboard size={36} />} title="Add your first widget" body="Charts, task lists, time tracking, goals and more update in real time." action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={14} /> Add widget</button>} />}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add widget" width={640}>
        <div className="p-4 grid grid-cols-2 gap-2">
          {WIDGETS.map((w) => (
            <button key={w.type} onClick={() => add(w.type)} className="flex items-start gap-3 rounded-lg border p-3 text-left hover:bg-[var(--subtle)]">
              <span className="w-8 h-8 rounded-md bg-[var(--subtle)] border flex items-center justify-center text-accent shrink-0"><w.icon size={16} /></span>
              <span><span className="block font-medium text-sm">{w.label}</span><span className="block text-xs text-[var(--muted)]">{w.desc}</span></span>
            </button>
          ))}
        </div>
      </Modal>
      {editing && <WidgetEditor w={editing} onClose={() => setEditing(null)} onSave={(nw) => { save(dash.widgets.map((x) => (x.id === nw.id ? nw : x))); setEditing(null); }} />}
    </div>
  );
}

function WidgetEditor({ w, onClose, onSave }: { w: Widget; onClose: () => void; onSave: (w: Widget) => void }) {
  const data = useStore((s) => s.data);
  const [x, setX] = useState<Widget>(w);
  const loc = x.config.location || { type: 'everything', id: 'all' };
  const locs: { label: string; v: LocationRef }[] = [
    { label: 'Everything', v: { type: 'everything', id: 'all' } },
    ...Object.values(data.space).map((s) => ({ label: 'Space: ' + s.name, v: { type: 'space' as const, id: s.id } })),
    ...Object.values(data.folder).map((s) => ({ label: 'Folder: ' + s.name, v: { type: 'folder' as const, id: s.id } })),
    ...Object.values(data.list).map((s) => ({ label: 'List: ' + s.name, v: { type: 'list' as const, id: s.id } })),
  ];
  const numFields = Object.values(data.field).filter((f) => ['number', 'money', 'rating', 'progress'].includes(f.type));
  return (
    <Modal open onClose={onClose} title="Edit widget" width={460}>
      <div className="p-5 space-y-3">
        <div><div className="label mb-1">Title</div><input className="input" value={x.title} onChange={(e) => setX({ ...x, title: e.target.value })} /></div>
        {!['text', 'embed', 'goals', 'timeTracked'].includes(x.type) && (
          <div><div className="label mb-1">Location</div>
            <select className="input" value={loc.type + ':' + loc.id} onChange={(e) => { const [t, i] = e.target.value.split(':'); setX({ ...x, config: { ...x.config, location: { type: t as any, id: i } } }); }}>
              {locs.map((l) => <option key={l.v.type + l.v.id} value={l.v.type + ':' + l.v.id}>{l.label}</option>)}
            </select>
            {x.type === 'burndown' && <div className="text-xs text-[var(--muted)] mt-1">Pick a sprint List for a sprint burndown; otherwise the last 14 days are used.</div>}
          </div>
        )}
        {x.type === 'calc' && (
          <div className="flex gap-2">
            <select className="input" value={x.config.op || 'sum'} onChange={(e) => setX({ ...x, config: { ...x.config, op: e.target.value as any } })}><option value="sum">Sum</option><option value="avg">Average</option><option value="count">Count (non-empty)</option></select>
            <select className="input" value={x.config.field || ''} onChange={(e) => setX({ ...x, config: { ...x.config, field: e.target.value } })}><option value="">Pick a fieldâ€¦</option><option value="__points">Sprint points</option><option value="__estimate">Time estimate (h)</option>{numFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          </div>
        )}
        {x.type === 'taskList' && (
          <div><div className="label mb-1">Show</div>
            <select className="input" value={x.config.filters?.[0]?.op || 'all'} onChange={(e) => setX({ ...x, config: { ...x.config, filters: e.target.value === 'all' ? [] : e.target.value === 'mine' ? [{ id: uid(), field: 'assignee', op: 'is', value: ['__me'] }] : [{ id: uid(), field: 'dueDate', op: e.target.value }] } })}>
              <option value="all">All open tasks</option><option value="mine">Assigned to me</option><option value="next7">Due in next 7 days</option><option value="today">Due today</option><option value="overdue">Overdue</option><option value="notset">No due date</option>
            </select></div>
        )}
        {x.type === 'embed' && <div><div className="label mb-1">URL</div><input className="input" value={x.config.url || ''} onChange={(e) => setX({ ...x, config: { ...x.config, url: e.target.value } })} placeholder="https://" /></div>}
      </div>
      <div className="flex justify-end gap-2 px-5 pb-4"><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onSave(x)}>Save</button></div>
    </Modal>
  );
}

const CHART_COLORS = ['#6E56CF', '#0090FF', '#12A594', '#FFB224', '#E5484D', '#D6409F', '#30A46C', '#F76B15'];

function useWidgetTasks(w: Widget): Task[] {
  const tasks = useStore((s) => s.data.task);
  const lists = useStore((s) => s.data.list);
  return useMemo(() => {
    const loc = w.config.location || { type: 'everything', id: 'all' };
    const ids = new Set(listsIn(loc));
    const base = Object.values(tasks).filter((t) => ids.has(t.listId) && !t.archived);
    return w.config.filters?.length ? applyFilters(base, { filters: w.config.filters, showClosed: true }) : base;
  }, [tasks, lists, w.config.location, w.config.filters]);
}

function Big({ n, label, color }: { n: React.ReactNode; label: string; color?: string }) {
  return <div className="h-full flex flex-col items-center justify-center text-center"><div className="text-2xl sm:text-4xl font-bold tabular-nums" style={{ color }}>{n}</div><div className="text-xs text-[var(--muted)] mt-1">{label}</div></div>;
}

function WidgetBody({ w, onText }: { w: Widget; onText: (t: string) => void }) {
  const tasks = useWidgetTasks(w);
  const data = useStore((s) => s.data);
  const members = useStore((s) => s.members);
  const textSave = useMemo(() => debounce(onText, 600), [w.id]);
  const open = tasks.filter((t) => !isClosed(t));
  switch (w.type) {
    case 'count': return <Big n={open.length} label={`open of ${tasks.length} tasks`} color="var(--accent)" />;
    case 'overdue': { const n = open.filter((t) => isOverdue(t.dueDate)).length; return <Big n={n} label="overdue tasks" color={n ? '#E5484D' : '#30A46C'} />; }
    case 'calc': {
      const f = w.config.field;
      const vals = tasks.map((t) => (f === '__points' ? t.points : f === '__estimate' ? (t.estimate || 0) / 60 : f ? Number(t.fields?.[f]) : NaN)).filter((v) => v != null && !isNaN(v as number)) as number[];
      const sum = vals.reduce((a, b) => a + b, 0);
      const val = w.config.op === 'avg' ? (vals.length ? sum / vals.length : 0) : w.config.op === 'count' ? vals.length : sum;
      const fd = f ? data.field[f] : undefined;
      const disp = fd?.type === 'money' ? new Intl.NumberFormat(undefined, { style: 'currency', currency: fd.currency || 'USD', maximumFractionDigits: 0 }).format(val) : Math.round(val * 100) / 100;
      return <Big n={disp} label={`${w.config.op || 'sum'} of ${fd?.name || (f === '__points' ? 'points' : f === '__estimate' ? 'estimate (h)' : 'â€”')}`} />;
    }
    case 'timeTracked': {
      const since = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();
      const sec = Object.values(data.time).filter((t) => new Date(t.start).getTime() >= since).reduce((a, t) => a + (t.duration || 0), 0);
      return <Big n={fmtDuration(sec)} label="tracked this week" color="#12A594" />;
    }
    case 'statusPie': {
      const m = new Map<string, { name: string; value: number; color: string }>();
      for (const t of tasks) { const st = statusOf(t); const k = st?.name || '?'; if (!m.has(k)) m.set(k, { name: k, value: 0, color: st?.color || '#888' }); m.get(k)!.value++; }
      const d = [...m.values()];
      if (!d.length) return <Big n="â€”" label="No tasks" />;
      return <ResponsiveContainer><PieChart><Pie isAnimationActive={false} data={d} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="80%" paddingAngle={2}>{d.map((x) => <Cell key={x.name} fill={x.color} />)}</Pie><Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} layout="vertical" align="right" verticalAlign="middle" /></PieChart></ResponsiveContainer>;
    }
    case 'assigneeBar': case 'workload': {
      const d = [...members.map((m) => ({ name: m.profile.name.split(' ')[0], id: m.user_id })), { name: 'Unassigned', id: '__none' }].map((m) => {
        const mine = open.filter((t) => (m.id === '__none' ? !t.assignees?.length : t.assignees?.includes(m.id)));
        return { name: m.name, value: w.type === 'workload' ? mine.reduce((a, t) => a + (t.points || (t.estimate ? t.estimate / 60 : 1)), 0) : mine.length };
      }).filter((x) => x.value);
      return <ResponsiveContainer><BarChart data={d}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={28} /><Tooltip cursor={{ fill: 'var(--hover)' }} /><Bar isAnimationActive={false} dataKey="value" name={w.type === 'workload' ? 'Points / hours' : 'Open tasks'} radius={[4, 4, 0, 0]}>{d.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer>;
    }
    case 'priorityBar': {
      const d = [...PRIORITIES.map((p) => ({ name: p.label, value: open.filter((t) => t.priority === p.value).length, color: p.color })), { name: 'None', value: open.filter((t) => !t.priority).length, color: '#C4C4CC' }];
      return <ResponsiveContainer><BarChart data={d}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={28} /><Tooltip cursor={{ fill: 'var(--hover)' }} /><Bar isAnimationActive={false} dataKey="value" radius={[4, 4, 0, 0]}>{d.map((x) => <Cell key={x.name} fill={x.color} />)}</Bar></BarChart></ResponsiveContainer>;
    }
    case 'completedLine': {
      const d = Array.from({ length: 14 }, (_, i) => { const day = addDays(startOfDay(new Date()), i - 13); return { name: format(day, 'MMM d'), completed: tasks.filter((t) => t.completedAt && isSameDay(new Date(t.completedAt), day)).length, created: tasks.filter((t) => t.created_at && isSameDay(new Date(t.created_at), day)).length }; });
      return <ResponsiveContainer><LineChart data={d}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval={2} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={28} /><Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} /><Line isAnimationActive={false} type="monotone" dataKey="completed" stroke="#30A46C" strokeWidth={2} dot={false} /><Line isAnimationActive={false} type="monotone" dataKey="created" stroke="#6E56CF" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>;
    }
    case 'burndown': {
      const loc = w.config.location;
      const list = loc?.type === 'list' ? data.list[loc.id] : undefined;
      const start = list?.sprint ? startOfDay(new Date(list.sprint.start)) : addDays(startOfDay(new Date()), -13);
      const end = list?.sprint ? startOfDay(new Date(list.sprint.end)) : startOfDay(new Date());
      const n = Math.max(1, differenceInCalendarDays(end, start));
      const total = tasks.length;
      const d = Array.from({ length: n + 1 }, (_, i) => {
        const day = addDays(start, i);
        const remaining = isBefore(startOfDay(new Date()), day) ? null : tasks.filter((t) => !(t.completedAt && new Date(t.completedAt) <= addDays(day, 1))).length;
        return { name: format(day, 'MMM d'), remaining, ideal: Math.round((total - (total * i) / n) * 10) / 10 };
      });
      return <ResponsiveContainer><LineChart data={d}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted)' }} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={28} /><Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} /><Line isAnimationActive={false} dataKey="ideal" stroke="var(--faint)" strokeDasharray="5 4" dot={false} /><Line isAnimationActive={false} dataKey="remaining" stroke="#E5484D" strokeWidth={2} dot={false} connectNulls={false} /></LineChart></ResponsiveContainer>;
    }
    case 'taskList': {
      const list = open.sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9')).slice(0, 50);
      return <div className="h-full overflow-y-auto -mx-1">{list.map((t) => <TaskLine key={t.id} t={t} showLoc={false} extra={<span className={cn('text-xs', dueTone(t.dueDate))}>{fmtDue(t.dueDate)}</span>} />)}{!list.length && <div className="text-sm text-[var(--muted)] p-2">No matching tasks ðŸŽ‰</div>}</div>;
    }
    case 'goals': {
      const goals = Object.values(data.goal);
      return <div className="h-full overflow-y-auto space-y-3 pt-1">{goals.map((g) => { const p = goalProgress(g); return <div key={g.id}><div className="flex text-[13px] mb-1"><span className="flex-1 truncate font-medium">{g.name}</span><span className="text-[var(--muted)]">{p}%</span></div><ProgressBar value={p} color={g.color} /></div>; })}{!goals.length && <div className="text-sm text-[var(--muted)]">No goals yet.</div>}</div>;
    }
    case 'text': return <div className="h-full overflow-y-auto"><RichEditor value={w.config.text || ''} onChange={textSave} placeholder="Write notes, links, announcementsâ€¦" compact /></div>;
    case 'embed': return w.config.url ? <iframe src={toEmbedUrl(w.config.url)} className="w-full h-full rounded-md border-0" title={w.title} /> : <div className="text-sm text-[var(--muted)] p-2">Edit this widget to set a URL.</div>;
  }
  return null;
}
