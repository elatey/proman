import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, List as ListIcon, FileText, LayoutDashboard, PenTool, Folder, Layers, CircleDot, Plus, Bell, Check, X, Settings2, Star, UserCheck, Calendar } from 'lucide-react';
import { addDays, format, isSameDay, isToday, startOfDay, differenceInCalendarDays, formatDistanceToNow } from 'date-fns';
import { useStore, getState, getRecents, statusOf, isClosed, memberName, statusesForList } from '../lib/store';
import { StatusIcon, StatusPill, Checkbox, PriorityFlag, Avatar, DatePicker, Popover, Toggle, useLocal, Tabs } from '../components/ui';
import { Html } from '../components/RichEditor';
import { cn, greeting, fmtDue, dueTone, toDate, stripHtml } from '../lib/utils';
import type { Task } from '../lib/types';

const CARDS = [
  { key: 'recents', label: 'Recents' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'mywork', label: 'My Work' },
  { key: 'assigned', label: 'Assigned to me' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'comments', label: 'Assigned comments' },
  { key: 'lineup', label: 'LineUp (priorities)' },
];

export function Home() {
  const user = useStore((s) => s.user)!;
  const [cards, setCards] = useLocal<string[]>('proman.homecards', ['recents', 'agenda', 'mywork', 'assigned', 'reminders', 'comments', 'lineup']);
  return (
    <div className="h-full overflow-y-auto bg-[var(--subtle)]">
      <div className="h-12 flex items-center px-6 border-b bg-[var(--panel)]">
        <span className="font-semibold">Home</span>
        <div className="flex-1" />
        <Popover align="end" width={240} trigger={<button className="btn btn-outline !py-1"><Settings2 size={14} /> Manage cards</button>}>
          <div className="p-3 space-y-2">
            {CARDS.map((c) => <div key={c.key}><Toggle on={cards.includes(c.key)} onChange={(v) => setCards(v ? [...cards, c.key] : cards.filter((x) => x !== c.key))} label={c.label} /></div>)}
          </div>
        </Popover>
      </div>
      <div className="max-w-[1400px] mx-auto p-6">
        <h1 className="text-2xl font-bold mb-5">{greeting()}, {user.name.split(' ')[0]}</h1>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {cards.includes('lineup') && <LineUp />}
          {cards.includes('recents') && <Recents />}
          {cards.includes('agenda') && <Agenda />}
          {cards.includes('mywork') && <MyWork />}
          {cards.includes('assigned') && <AssignedToMe />}
          {cards.includes('reminders') && <Reminders />}
          {cards.includes('comments') && <AssignedComments />}
        </div>
      </div>
    </div>
  );
}

export function Card({ title, children, action, className }: { title: React.ReactNode; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('card flex flex-col min-h-[300px] max-h-[460px]', className)}>
      <div className="flex items-center gap-2 px-5 pt-4 pb-2"><div className="font-semibold text-[15px] flex-1">{title}</div>{action}</div>
      <div className="flex-1 overflow-y-auto px-3 pb-3">{children}</div>
    </div>
  );
}

export function TaskLine({ t, extra, showLoc = true }: { t: Task; extra?: React.ReactNode; showLoc?: boolean }) {
  const data = useStore((s) => s.data);
  const l = data.list[t.listId];
  return (
    <button onClick={() => getState().openTask(t.id)} className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-[var(--hover)] text-[13.5px]">
      <StatusIcon status={statusOf(t)} size={15} />
      <span className={cn('truncate', isClosed(t) && 'line-through text-[var(--muted)]')}>{t.name}</span>
      {showLoc && l && <span className="text-xs text-[var(--faint)] truncate shrink-0 max-w-[30%]">{data.space[l.spaceId]?.name} / {l.name}</span>}
      <span className="flex-1" />
      {extra}
    </button>
  );
}

function Recents() {
  const nav = useNavigate();
  const data = useStore((s) => s.data);
  const recents = getRecents().slice(0, 12);
  const icon: Record<string, any> = { task: CircleDot, list: ListIcon, doc: FileText, dashboard: LayoutDashboard, whiteboard: PenTool, folder: Folder, space: Layers };
  return (
    <Card title="Recents">
      {recents.map((r) => {
        const e: any = (data as any)[r.type]?.[r.id];
        if (!e) return null;
        const I = icon[r.type] || CircleDot;
        const where = r.type === 'task' ? data.list[e.listId]?.name : r.type === 'list' ? data.space[e.spaceId]?.name : '';
        return (
          <button key={r.type + r.id} className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-[var(--hover)] text-[13.5px]"
            onClick={() => (r.type === 'task' ? getState().openTask(r.id) : nav(`/${r.type}/${r.id}`))}>
            <I size={15} className="text-[var(--muted)] shrink-0" />
            <span className="truncate">{e.name || e.title || 'Untitled'}</span>
            {where && <span className="text-xs text-[var(--faint)] truncate">· in {where}</span>}
          </button>
        );
      })}
      {!recents.length && <div className="text-sm text-[var(--muted)] p-3">Items you open will appear here.</div>}
    </Card>
  );
}

function Agenda() {
  const [day, setDay] = useState(startOfDay(new Date()));
  const tasks = useStore((s) => s.data.task);
  const reminders = useStore((s) => s.data.reminder);
  const me = useStore((s) => s.user!.id);
  const items = Object.values(tasks).filter((t) => !t.archived && t.assignees?.includes(me) && t.dueDate && isSameDay(new Date(t.dueDate), day));
  const rems = Object.values(reminders).filter((r) => r.user === me && r.due && isSameDay(new Date(r.due), day));
  return (
    <Card title="Agenda" action={
      <div className="flex items-center gap-1 text-[13px]">
        <span className="text-[var(--muted)] mr-1">{format(day, 'MMM d, EEE')}</span>
        <button className="icon-btn !w-6 !h-6" onClick={() => setDay(addDays(day, -1))}><ChevronLeft size={14} /></button>
        <button className="icon-btn !w-6 !h-6" onClick={() => setDay(addDays(day, 1))}><ChevronRight size={14} /></button>
        <button className="btn btn-ghost !py-0.5 !px-2 !text-xs" onClick={() => setDay(startOfDay(new Date()))}>Today</button>
      </div>
    }>
      {rems.map((r) => (
        <div key={r.id} className="flex items-center gap-2.5 px-2 py-1.5 text-[13.5px]">
          <Bell size={14} className="text-amber-500" /><span className={cn('flex-1', r.done && 'line-through text-[var(--muted)]')}>{r.text}</span>
          <span className="text-xs text-[var(--muted)]">{r.due && format(new Date(r.due), 'h:mm a')}</span>
        </div>
      ))}
      {items.map((t) => <TaskLine key={t.id} t={t} extra={<span className="text-xs text-[var(--muted)]">{t.dueTime ? format(new Date(t.dueDate!), 'h:mm a') : 'All day'}</span>} />)}
      {!items.length && !rems.length && <div className="text-sm text-[var(--muted)] p-3">Nothing scheduled{isToday(day) ? ' today' : ''}. 🎉</div>}
    </Card>
  );
}

function MyWork() {
  const tasks = useStore((s) => s.data.task);
  const me = useStore((s) => s.user!.id);
  const [tab, setTab] = useState<'todo' | 'done' | 'delegated'>('todo');
  const [open, setOpen] = useState<string[]>(['Today', 'Overdue', 'Next']);
  const mine = Object.values(tasks).filter((t) => !t.archived && t.assignees?.includes(me));
  const todo = mine.filter((t) => !isClosed(t));
  const buckets: [string, Task[]][] = [
    ['Today', todo.filter((t) => t.dueDate && isToday(new Date(t.dueDate)))],
    ['Overdue', todo.filter((t) => t.dueDate && differenceInCalendarDays(new Date(t.dueDate), new Date()) < 0)],
    ['Next', todo.filter((t) => t.dueDate && differenceInCalendarDays(new Date(t.dueDate), new Date()) > 0)],
    ['Unscheduled', todo.filter((t) => !t.dueDate)],
  ];
  const done = mine.filter(isClosed).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')).slice(0, 30);
  const delegated = Object.values(tasks).filter((t) => !t.archived && t.created_by === me && t.assignees?.length && !t.assignees.includes(me) && !isClosed(t));
  return (
    <Card title="My Work">
      <Tabs className="mx-2 mb-2" value={tab} onChange={setTab} tabs={[{ value: 'todo', label: 'To Do', count: todo.length }, { value: 'done', label: 'Done' }, { value: 'delegated', label: 'Delegated', count: delegated.length }]} />
      {tab === 'todo' && buckets.map(([k, list]) => (
        <div key={k}>
          <button className="flex items-center gap-1.5 px-2 py-1.5 text-[13px] font-medium" onClick={() => setOpen(open.includes(k) ? open.filter((x) => x !== k) : [...open, k])}>
            {open.includes(k) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{k}<span className="text-[var(--faint)] font-normal">{list.length}</span>
          </button>
          {open.includes(k) && list.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).map((t) => <TaskLine key={t.id} t={t} extra={<span className={cn('text-xs', dueTone(t.dueDate))}>{fmtDue(t.dueDate)}</span>} />)}
        </div>
      ))}
      {tab === 'done' && done.map((t) => <TaskLine key={t.id} t={t} extra={<span className="text-xs text-[var(--muted)]">{t.completedAt && formatDistanceToNow(new Date(t.completedAt), { addSuffix: true })}</span>} />)}
      {tab === 'delegated' && delegated.map((t) => <TaskLine key={t.id} t={t} extra={<span className="flex -space-x-1">{t.assignees.map((a) => <Avatar key={a} id={a} size={20} ring />)}</span>} />)}
    </Card>
  );
}

function AssignedToMe() {
  const tasks = useStore((s) => s.data.task);
  const me = useStore((s) => s.user!.id);
  const mine = Object.values(tasks).filter((t) => !t.archived && t.assignees?.includes(me) && !isClosed(t));
  const groups = new Map<string, { status: any; tasks: Task[] }>();
  for (const t of mine) {
    const st = statusOf(t);
    const k = st?.name || '?';
    if (!groups.has(k)) groups.set(k, { status: st, tasks: [] });
    groups.get(k)!.tasks.push(t);
  }
  return (
    <Card title="Assigned to me" action={<span className="text-xs text-[var(--muted)]">{mine.length} open</span>}>
      {[...groups.entries()].map(([k, g]) => (
        <div key={k} className="mb-2">
          <div className="px-2 py-1.5 flex items-center gap-2"><StatusPill status={g.status} small /><span className="text-xs text-[var(--muted)]">{g.tasks.length}</span></div>
          {g.tasks.map((t) => <TaskLine key={t.id} t={t} extra={<><PriorityFlag p={t.priority} size={12} /><span className={cn('text-xs w-16 text-right', dueTone(t.dueDate))}>{fmtDue(t.dueDate)}</span></>} />)}
        </div>
      ))}
      {!mine.length && <div className="text-sm text-[var(--muted)] p-3">No open tasks assigned to you.</div>}
    </Card>
  );
}

function Reminders() {
  const reminders = useStore((s) => s.data.reminder);
  const me = useStore((s) => s.user!.id);
  const [text, setText] = useState('');
  const list = Object.values(reminders).filter((r) => r.user === me).sort((a, b) => Number(!!a.done) - Number(!!b.done) || (a.due || '9').localeCompare(b.due || '9'));
  const s = getState();
  return (
    <Card title="Reminders">
      <div className="flex items-center gap-2 px-2 mb-2">
        <Plus size={14} className="text-[var(--faint)]" />
        <input className="flex-1 bg-transparent outline-none text-[13.5px] py-1" placeholder="Add a reminder, press Enter" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) { s.create('reminder', { user: me, text: text.trim(), due: null, done: false, private: true }); setText(''); } }} />
      </div>
      {list.map((r) => (
        <div key={r.id} className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-[var(--hover)] text-[13.5px]">
          <Checkbox round checked={!!r.done} onChange={(v) => s.update('reminder', r.id, { done: v })} />
          <span className={cn('flex-1 truncate', r.done && 'line-through text-[var(--muted)]')}>{r.text}</span>
          {r.assignedBy && <span className="text-[11px] text-[var(--faint)]">from {memberName(r.assignedBy)}</span>}
          <DatePicker value={r.due} hasTime onChange={(d) => s.update('reminder', r.id, { due: d, notified: false })} trigger={<button className={cn('text-xs', r.due ? dueTone(r.due, r.done) : 'text-[var(--faint)] opacity-0 group-hover:opacity-100')}>{r.due ? fmtDue(r.due, true) : <Calendar size={13} />}</button>} />
          <button className="opacity-0 group-hover:opacity-100 text-[var(--faint)] hover:text-red-600" onClick={() => s.remove('reminder', r.id)}><X size={13} /></button>
        </div>
      ))}
    </Card>
  );
}

function AssignedComments() {
  const comments = useStore((s) => s.data.comment);
  const tasks = useStore((s) => s.data.task);
  const me = useStore((s) => s.user!.id);
  const list = Object.values(comments).filter((c) => c.assignee === me && !c.resolved);
  return (
    <Card title="Assigned comments">
      {list.map((c) => (
        <div key={c.id} className="rounded-md px-2 py-2 hover:bg-[var(--hover)] cursor-pointer" onClick={() => c.taskId && getState().openTask(c.taskId)}>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><Avatar id={c.author} size={18} /><b className="text-[var(--text)]">{memberName(c.author)}</b> on {tasks[c.taskId || '']?.name || 'a doc'}
            <span className="flex-1" />
            <button className="btn btn-outline !py-0 !px-1.5 !text-[11px]" onClick={(e) => { e.stopPropagation(); getState().update('comment', c.id, { resolved: true }); }}><Check size={11} /> Resolve</button>
          </div>
          <div className="mt-1 text-[13px] line-clamp-2">{stripHtml(c.body)}</div>
        </div>
      ))}
      {!list.length && <div className="text-sm text-[var(--muted)] p-3 flex items-center gap-2"><UserCheck size={15} /> No comments assigned to you.</div>}
    </Card>
  );
}

function LineUp() {
  const me = useStore((s) => s.user!.id);
  const tasks = useStore((s) => s.data.task);
  const [ids, setIds] = useLocal<string[]>('proman.lineup.' + me, []);
  const [q, setQ] = useState('');
  const list = ids.map((id) => tasks[id]).filter(Boolean);
  const candidates = Object.values(tasks).filter((t) => !t.archived && !isClosed(t) && !ids.includes(t.id) && t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  return (
    <Card title={<span className="flex items-center gap-2"><Star size={15} className="text-amber-500" /> LineUp</span>} className="!min-h-0" action={
      <Popover align="end" width={320} trigger={<button className="btn btn-ghost !py-0.5 !text-xs"><Plus size={13} /> Add</button>}>
        <div className="p-2"><input autoFocus className="input !py-1.5 mb-1" placeholder="Find a task to prioritize…" value={q} onChange={(e) => setQ(e.target.value)} />
          {candidates.map((t) => <button key={t.id} className="menu-item" onClick={() => setIds([...ids, t.id])}><StatusIcon status={statusOf(t)} />{t.name}</button>)}</div>
      </Popover>
    }>
      {list.map((t, i) => <TaskLine key={t.id} t={t} extra={<button className="text-[var(--faint)] hover:text-red-600" onClick={(e) => { e.stopPropagation(); setIds(ids.filter((x) => x !== t.id)); }}><X size={13} /></button>} />)}
      {!list.length && <div className="text-sm text-[var(--muted)] px-3 pb-2">Pin your most important tasks here so you always know what to do next.</div>}
    </Card>
  );
}
