import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Bell, PanelLeftOpen, Square, CheckSquare, FileText, Bell as BellIcon, PenTool, LayoutDashboard, MessagesSquare, X, Clock, Keyboard, Hash, User, Folder, List as ListIcon, Layers } from 'lucide-react';
import { useStore, getState, statusesForList, breadcrumb, isClosed } from '../../lib/store';
import { Sidebar } from './Sidebar';
import { Modal, Popover, MenuList, StatusPicker, StatusIcon, AssigneePicker, DatePicker, PriorityPicker, Avatar, useNow, TagPicker, TagChip } from '../ui';
import { TaskModal } from '../task/TaskModal';
import { cn, fmtDuration, stripHtml, PRIORITIES } from '../../lib/utils';
import { RichEditor } from '../RichEditor';
import type { Task } from '../../lib/types';

export function Shell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const openTaskId = useStore((s) => s.openTaskId);
  const set = useStore((s) => s.set);
  const nav = useNavigate();
  const [shortcuts, setShortcuts] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); set({ paletteOpen: true }); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') { e.preventDefault(); const v = !getState().sidebarOpen; set({ sidebarOpen: v }); localStorage.setItem('proman.sidebar', v ? '1' : '0'); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('[data-floating]') || document.querySelector('.fixed.inset-0')) return;
      if (e.key === 't') { e.preventDefault(); set({ createOpen: 'task', createDefaults: {} }); }
      else if (e.key === '/') { e.preventDefault(); set({ paletteOpen: true }); }
      else if (e.key === '?') setShortcuts(true);
      else if (e.key === 'r') { e.preventDefault(); set({ createOpen: 'reminder' }); }
      else if (e.key === 'd') { e.preventDefault(); const d = getState().create('doc', { title: 'Untitled', content: '', parentId: null, location: null }); nav('/doc/' + d.id); }
      else if (e.key === 'i') nav('/inbox');
      else if (e.key === 'h') nav('/');
    };
    const sc = () => setShortcuts(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('proman-shortcuts', sc);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('proman-shortcuts', sc); };
  }, []);

  return (
    <div className="h-full flex overflow-hidden">
      {sidebarOpen && <Sidebar />}
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="flex-1 min-h-0 overflow-hidden bg-[var(--bg)]">{children}</main>
        <TaskTray />
      </div>
      {openTaskId && <TaskModal id={openTaskId} onClose={() => set({ openTaskId: null })} />}
      <CommandPalette />
      <CreateModal />
      <Modal open={shortcuts} onClose={() => setShortcuts(false)} title="Keyboard shortcuts" width={460}>
        <div className="p-5 grid grid-cols-2 gap-y-2.5 text-sm">
          {[['Ctrl/⌘ K', 'Search & commands'], ['/', 'Search'], ['T', 'New task'], ['R', 'New reminder'], ['D', 'New doc'], ['H', 'Home'], ['I', 'Inbox'], ['Ctrl/⌘ \\', 'Toggle sidebar'], ['Esc', 'Close task / dialog'], ['Ctrl/⌘ Enter', 'Send comment'], ['@', 'Mention someone'], ['/ (in editor)', 'Formatting commands'], ['?', 'This help']].map(([k, d]) => (
            <div key={k} className="contents"><span><span className="kbd">{k}</span></span><span className="text-[var(--muted)]">{d}</span></div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function Topbar() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const set = useStore((s) => s.set);
  const nav = useNavigate();
  const notifications = useStore((s) => s.data.notification);
  const me = useStore((s) => s.user!.id);
  const unread = Object.values(notifications).filter((n) => n.user === me && !n.read && !n.cleared).length;
  return (
    <header className="h-12 shrink-0 flex items-center gap-2 px-3 border-b bg-[var(--panel)]">
      {!sidebarOpen && <button className="icon-btn" onClick={() => { set({ sidebarOpen: true }); localStorage.setItem('proman.sidebar', '1'); }}><PanelLeftOpen size={16} /></button>}
      <div className="flex-1 flex justify-center">
        <button onClick={() => set({ paletteOpen: true })} className="w-full max-w-md flex items-center gap-2 rounded-lg border bg-[var(--subtle)] px-3 py-1.5 text-[13px] text-[var(--faint)] hover:border-[var(--border-strong)]">
          <Search size={14} /> <span className="flex-1 text-left">Search tasks, docs, people…</span><span className="kbd">Ctrl K</span>
        </button>
      </div>
      <TimerChip />
      <Popover align="end" trigger={<button className="btn btn-primary !py-1.5"><Plus size={15} /> New</button>}>
        {(close) => <MenuList close={close} items={[
          { label: 'Task', icon: <CheckSquare size={14} />, hint: 'T', onClick: () => set({ createOpen: 'task', createDefaults: {} }) },
          { label: 'Doc', icon: <FileText size={14} />, hint: 'D', onClick: () => { const d = getState().create('doc', { title: 'Untitled', content: '', parentId: null, location: null }); nav('/doc/' + d.id); } },
          { label: 'Reminder', icon: <BellIcon size={14} />, hint: 'R', onClick: () => set({ createOpen: 'reminder' }) },
          { label: 'Chat message', icon: <MessagesSquare size={14} />, onClick: () => nav('/chat') },
          { label: 'Whiteboard', icon: <PenTool size={14} />, onClick: () => { const w = getState().create('whiteboard', { name: 'Whiteboard', elements: [] }); nav('/whiteboard/' + w.id); } },
          { label: 'Dashboard', icon: <LayoutDashboard size={14} />, onClick: () => { const d = getState().create('dashboard', { name: 'Dashboard', widgets: [] }); nav('/dashboard/' + d.id); } },
        ]} />}
      </Popover>
      <button className="icon-btn relative" onClick={() => nav('/inbox')} title="Inbox">
        <Bell size={17} />
        {unread > 0 && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500" />}
      </button>
      <button className="icon-btn" title="Keyboard shortcuts (?)" onClick={() => window.dispatchEvent(new Event('proman-shortcuts'))}><Keyboard size={16} /></button>
    </header>
  );
}

export function useRunningTimer() {
  const times = useStore((s) => s.data.time);
  const me = useStore((s) => s.user?.id);
  return Object.values(times).find((t) => t.user === me && !t.end) || null;
}

export function startTimer(taskId: string) {
  const s = getState();
  const running = Object.values(s.data.time).find((t) => t.user === s.user!.id && !t.end);
  if (running) stopTimer(running.id);
  s.create('time', { taskId, user: s.user!.id, start: new Date().toISOString(), end: null, billable: false, note: '' });
}
export function stopTimer(id: string) {
  const s = getState();
  const t = s.data.time[id];
  if (!t) return;
  const end = new Date();
  const duration = Math.round((end.getTime() - new Date(t.start).getTime()) / 1000);
  s.update('time', id, { end: end.toISOString(), duration });
  const task = s.data.task[t.taskId];
  if (task) {
    s.logActivity(task.id, `tracked ${fmtDuration(duration)}`);
    import('../../lib/automations').then(({ runAutomations }) => {
      /* time_tracked trigger */
      runAutomations({ type: 'time', task, prev: task }, {
        get: getState, updateTask: (i, p) => s.updateTask(i, p, { fromAutomation: true }), createTask: (x) => s.createTask(x, { fromAutomation: true }),
        deleteTask: s.deleteTask, duplicateTask: s.duplicateTask, addComment: s.addComment, create: s.create, update: s.update,
      });
    });
  }
}

function TimerChip() {
  const running = useRunningTimer();
  const task = useStore((s) => (running ? s.data.task[running.taskId] : undefined));
  const now = useNow(1000);
  if (!running) return null;
  return (
    <div className="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-900 pl-2 pr-1 py-0.5 text-[13px]">
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      <button className="font-mono tabular-nums px-1" onClick={() => task && getState().openTask(task.id)} title={task?.name}>{fmtDuration((now - new Date(running.start).getTime()) / 1000)}</button>
      <span className="max-w-[140px] truncate text-[var(--muted)] text-xs hidden md:inline">{task?.name}</span>
      <button className="icon-btn !w-6 !h-6 !text-red-600" onClick={() => stopTimer(running.id)} title="Stop timer"><Square size={12} fill="currentColor" /></button>
    </div>
  );
}

// ------------------------------------------------------------------ Command palette
function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const set = useStore((s) => s.set);
  const data = useStore((s) => s.data);
  const members = useStore((s) => s.members);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (open) { setQ(''); setIdx(0); } }, [open]);
  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const out: { key: string; icon: React.ReactNode; label: string; sub?: string; run: () => void; group: string }[] = [];
    const close = () => set({ paletteOpen: false });
    const cmds = [
      { label: 'Create task', run: () => set({ createOpen: 'task', createDefaults: {} }) },
      { label: 'Create doc', run: () => { const d = getState().create('doc', { title: 'Untitled', content: '', parentId: null, location: null }); nav('/doc/' + d.id); } },
      { label: 'Create reminder', run: () => set({ createOpen: 'reminder' }) },
      { label: 'Go to Inbox', run: () => nav('/inbox') },
      { label: 'Go to Home', run: () => nav('/') },
      { label: 'Go to Everything', run: () => nav('/everything') },
      { label: 'Open Settings', run: () => nav('/settings/workspace') },
      { label: 'Invite people', run: () => nav('/settings/people') },
      { label: 'Toggle dark mode', run: () => import('../../lib/theme').then((m) => m.setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')) },
    ];
    for (const c of cmds) if (!ql || c.label.toLowerCase().includes(ql)) out.push({ key: 'c' + c.label, icon: <span className="text-xs">⌘</span>, label: c.label, group: 'Commands', run: () => { close(); c.run(); } });
    if (ql) {
      const tasks = Object.values(data.task).filter((t) => !t.archived && (t.name.toLowerCase().includes(ql) || t.id.startsWith(ql) || stripHtml(t.description).toLowerCase().includes(ql))).slice(0, 12);
      for (const t of tasks) {
        const b = breadcrumb(t.listId);
        out.push({ key: t.id, icon: <StatusIcon status={statusesForList(t.listId).find((x) => x.id === t.status)} />, label: t.name, sub: [b.space?.name, b.list?.name].filter(Boolean).join(' / '), group: 'Tasks', run: () => { close(); getState().openTask(t.id); } });
      }
      for (const l of Object.values(data.list).filter((l) => l.name.toLowerCase().includes(ql)).slice(0, 6)) out.push({ key: l.id, icon: <ListIcon size={14} />, label: l.name, sub: data.space[l.spaceId]?.name, group: 'Locations', run: () => { close(); nav('/list/' + l.id); } });
      for (const f of Object.values(data.folder).filter((l) => l.name.toLowerCase().includes(ql)).slice(0, 4)) out.push({ key: f.id, icon: <Folder size={14} />, label: f.name, sub: data.space[f.spaceId]?.name, group: 'Locations', run: () => { close(); nav('/folder/' + f.id); } });
      for (const s of Object.values(data.space).filter((l) => l.name.toLowerCase().includes(ql)).slice(0, 4)) out.push({ key: s.id, icon: <Layers size={14} />, label: s.name, group: 'Locations', run: () => { close(); nav('/space/' + s.id); } });
      for (const d of Object.values(data.doc).filter((d) => (d.title || '').toLowerCase().includes(ql) || stripHtml(d.content).toLowerCase().includes(ql)).slice(0, 6)) out.push({ key: d.id, icon: <FileText size={14} />, label: d.title || 'Untitled', sub: 'Doc', group: 'Docs', run: () => { close(); nav('/doc/' + d.id); } });
      for (const c of Object.values(data.channel).filter((c) => !c.dm && c.name.toLowerCase().includes(ql)).slice(0, 4)) out.push({ key: c.id, icon: <Hash size={14} />, label: c.name, group: 'Chat', run: () => { close(); nav('/chat/' + c.id); } });
      for (const d of Object.values(data.dashboard).filter((d) => d.name.toLowerCase().includes(ql)).slice(0, 4)) out.push({ key: d.id, icon: <LayoutDashboard size={14} />, label: d.name, group: 'Dashboards', run: () => { close(); nav('/dashboard/' + d.id); } });
      for (const m of members.filter((m) => m.profile.name.toLowerCase().includes(ql)).slice(0, 4)) out.push({ key: m.user_id, icon: <User size={14} />, label: m.profile.name, sub: m.profile.email, group: 'People', run: () => { close(); nav('/everything?assignee=' + m.user_id); } });
      for (const c of Object.values(data.comment).filter((c) => stripHtml(c.body).toLowerCase().includes(ql)).slice(0, 4)) out.push({ key: c.id, icon: <MessagesSquare size={14} />, label: stripHtml(c.body).slice(0, 80), sub: 'Comment', group: 'Comments', run: () => { close(); if (c.taskId) getState().openTask(c.taskId); } });
    }
    return out;
  }, [q, data, members]);
  if (!open) return null;
  let lastGroup = '';
  return (
    <Modal open onClose={() => set({ paletteOpen: false })} width={640} bare>
      <div className="flex items-center gap-2 px-4 border-b">
        <Search size={16} className="text-[var(--faint)]" />
        <input autoFocus className="flex-1 py-3.5 bg-transparent outline-none text-[15px]" placeholder="Search or type a command…" value={q}
          onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(Math.min(idx + 1, results.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(Math.max(idx - 1, 0)); }
            if (e.key === 'Enter') results[idx]?.run();
          }} />
        <span className="kbd">Esc</span>
      </div>
      <div className="max-h-[60vh] overflow-auto p-2">
        {results.map((r, i) => {
          const header = r.group !== lastGroup ? (lastGroup = r.group) : null;
          return (
            <div key={r.key}>
              {header && <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-[var(--faint)]">{header}</div>}
              <button className="menu-item !py-2" data-active={i === idx} onMouseEnter={() => setIdx(i)} onClick={r.run}>
                <span className="w-5 flex justify-center text-[var(--muted)]">{r.icon}</span>
                <span className="flex-1 truncate">{r.label}</span>
                {r.sub && <span className="text-xs text-[var(--faint)] truncate max-w-[40%]">{r.sub}</span>}
              </button>
            </div>
          );
        })}
        {!results.length && <div className="p-8 text-center text-sm text-[var(--muted)]">No results for “{q}”</div>}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Quick create
function CreateModal() {
  const open = useStore((s) => s.createOpen);
  const defaults = useStore((s) => s.createDefaults);
  const set = useStore((s) => s.set);
  const close = () => set({ createOpen: null, createDefaults: {} });
  if (open === 'task') return <CreateTask defaults={defaults} onClose={close} />;
  if (open === 'reminder') return <CreateReminder onClose={close} />;
  return null;
}

function CreateTask({ defaults, onClose }: { defaults: Partial<Task>; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const me = useStore((s) => s.user!.id);
  const lists = Object.values(data.list).filter((l) => !l.archived);
  const lastList = localStorage.getItem('proman.lastList');
  const [listId, setListId] = useState(defaults.listId || (lastList && data.list[lastList] ? lastList : lists[0]?.id) || '');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [status, setStatus] = useState<string | undefined>(defaults.status);
  const [assignees, setAssignees] = useState<string[]>(defaults.assignees || []);
  const [dueDate, setDue] = useState<string | null>(defaults.dueDate || null);
  const [priority, setPriority] = useState<any>(defaults.priority || null);
  const [tags, setTags] = useState<string[]>([]);
  const [tpl, setTpl] = useState('');
  const [another, setAnother] = useState(false);
  const templates = Object.values(data.template).filter((t) => t.type === 'task');
  const submit = () => {
    if (!name.trim() || !listId) return;
    localStorage.setItem('proman.lastList', listId);
    const p = tpl ? data.template[tpl]?.payload : null;
    const t = getState().createTask({
      ...defaults, name: name.trim(), listId, description: desc || p?.description || '', status: status || statusesForList(listId)[0]?.id, assignees, dueDate, priority: priority || p?.priority || null,
      tags: Array.from(new Set([...tags, ...(p?.tags || [])])), checklists: p?.checklists || [], type: p?.type || 'task',
    });
    for (const sub of p?.subtasks || []) getState().createTask({ name: sub.name, listId, parentId: t.id }, { silent: true });
    getState().toast('Task created', 'success', { label: 'Open', run: () => getState().openTask(t.id) });
    if (another) { setName(''); setDesc(''); } else onClose();
  };
  const grouped = lists.map((l) => ({ l, path: [data.space[l.spaceId]?.name, l.folderId ? data.folder[l.folderId]?.name : null].filter(Boolean).join(' / ') }));
  return (
    <Modal open onClose={onClose} width={680} bare>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <select className="input !w-auto !py-1 !text-xs" value={listId} onChange={(e) => { setListId(e.target.value); setStatus(undefined); }}>
            {grouped.map(({ l, path }) => <option key={l.id} value={l.id}>{path ? path + ' / ' : ''}{l.name}</option>)}
          </select>
          {templates.length > 0 && <select className="input !w-auto !py-1 !text-xs" value={tpl} onChange={(e) => setTpl(e.target.value)}><option value="">No template</option>{templates.map((t) => <option key={t.id} value={t.id}>Template: {t.name}</option>)}</select>}
          <div className="flex-1" />
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        {!lists.length && <div className="text-sm text-amber-600 mb-2">Create a List first (Sidebar → Space → + → List).</div>}
        <input autoFocus className="w-full text-xl font-semibold bg-transparent outline-none py-1" placeholder="Task name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        <div className="mt-2 min-h-[80px] text-[var(--text)]"><RichEditor value={desc} onChange={setDesc} placeholder="Add description, or type / for commands" compact /></div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {listId && <StatusPicker listId={listId} value={status} onChange={setStatus} />}
          <AssigneePicker value={assignees} onChange={setAssignees} />
          <DatePicker value={dueDate} onChange={(d) => setDue(d)} placeholder="Due date" className="border" />
          <PriorityPicker value={priority} onChange={setPriority} trigger={<button className="inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[13px] hover:bg-[var(--hover)]"><span style={{ color: PRIORITIES.find((p) => p.value === priority)?.color }}>⚑</span>{PRIORITIES.find((p) => p.value === priority)?.label || 'Priority'}</button>} />
          <TagPicker value={tags} onChange={setTags} spaceId={data.list[listId]?.spaceId} trigger={<button className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[13px] hover:bg-[var(--hover)]">{tags.length ? tags.map((t) => <TagChip key={t} name={t} small />) : 'Tags'}</button>} />
        </div>
      </div>
      <div className="flex items-center justify-between border-t px-5 py-3">
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]"><input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} className="accent-[var(--accent)]" /> Create another</label>
        <button className="btn btn-primary" onClick={submit} disabled={!name.trim() || !listId}>Create Task</button>
      </div>
    </Modal>
  );
}

function CreateReminder({ onClose }: { onClose: () => void }) {
  const me = useStore((s) => s.user!.id);
  const [text, setText] = useState('');
  const [due, setDue] = useState<string | null>(new Date(Date.now() + 3600000).toISOString());
  const [user, setUser] = useState<string[]>([me]);
  return (
    <Modal open onClose={onClose} title="New reminder" width={460}>
      <div className="p-5 space-y-3">
        <input autoFocus className="input" placeholder="Remind me to…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex items-center gap-3">
          <DatePicker value={due} onChange={(d) => setDue(d)} hasTime className="border" />
          <span className="text-xs text-[var(--muted)]">For</span>
          <AssigneePicker value={user} onChange={(v) => setUser(v.slice(-1))} multi={false} />
        </div>
        {'Notification' in window && Notification.permission === 'default' && <button className="text-xs text-accent" onClick={() => Notification.requestPermission()}>Enable desktop notifications</button>}
      </div>
      <div className="flex justify-end gap-2 px-5 pb-4">
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!text.trim()} onClick={() => {
          const u = user[0] || me;
          getState().create('reminder', { user: u, text: text.trim(), due, done: false, assignedBy: u !== me ? me : null, private: u === me });
          if (u !== me) getState().notify({ user: u, actor: me, type: 'reminder', text: `delegated a reminder to you: ${text.trim()}`, primary: true });
          getState().toast('Reminder set', 'success');
          onClose();
        }}>Create</button>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Task tray (minimised tasks)
function TaskTray() {
  const tray = useStore((s) => s.tray);
  const tasks = useStore((s) => s.data.task);
  const set = useStore((s) => s.set);
  const items = tray.map((id) => tasks[id]).filter(Boolean);
  if (!items.length) return null;
  const remove = (id: string) => { const t = tray.filter((x) => x !== id); set({ tray: t }); localStorage.setItem('proman.tray', JSON.stringify(t)); };
  return (
    <div className="h-9 shrink-0 border-t bg-[var(--panel)] flex items-center gap-1.5 px-2 overflow-x-auto">
      <span className="text-[11px] text-[var(--faint)] mr-1">Tray</span>
      {items.map((t) => (
        <div key={t.id} className="flex items-center gap-1 rounded-md border pl-2 pr-0.5 py-0.5 text-xs max-w-[220px] hover:bg-[var(--hover)]">
          <StatusIcon status={statusesForList(t.listId).find((s) => s.id === t.status)} size={12} />
          <button className="truncate" onClick={() => getState().openTask(t.id)}>{t.name}</button>
          <button className="icon-btn !w-5 !h-5" onClick={() => remove(t.id)}><X size={11} /></button>
        </div>
      ))}
    </div>
  );
}
