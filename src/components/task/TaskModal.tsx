import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, ChevronRight, MoreHorizontal, Link2, Copy, Trash2, Archive, Calendar, Flag, Users, Hourglass, Timer, Tag as TagIcon, CircleDot, Plus, ChevronDown, Check,
  Repeat, Play, Square, GripVertical, Paperclip, Download, Maximize2, Minimize2, Star, Share2, ArrowRightLeft, LayoutTemplate, Minus, ListChecks, Eye, Globe, Target, Ban, AlertTriangle, Link as LinkIcon, Diamond, Bug, Lightbulb, MessageSquareQuote, CheckCircle2, Hash,
} from 'lucide-react';
import { useStore, getState, statusesForList, breadcrumb, isClosed, statusOf, clickApp, nextDate } from '../../lib/store';
import {
  StatusPicker, StatusIcon, AssigneePicker, DatePicker, PriorityPicker, PriorityFlag, TagPicker, TagChip, Popover, MenuList, InlineEdit, Checkbox, ProgressBar, Avatar, AvatarStack, Modal, Confirm, useNow, DatePanel,
} from '../ui';
import { RichEditor } from '../RichEditor';
import { FieldValue } from './FieldValue';
import { ActivityPanel } from './ActivityPanel';
import { fieldsForLists } from '../../lib/filters';
import { cn, fmtDue, fmtDuration, fmtMinutes, parseDuration, uid, shortId, toDate, between, debounce } from '../../lib/utils';
import { startTimer, stopTimer, useRunningTimer } from '../layout/Shell';
import { useFavs } from '../layout/Sidebar';
import { backend } from '../../lib/backend';
import type { Task, Checklist, ChecklistItem, Recurrence } from '../../lib/types';
import { format, formatDistanceToNow } from 'date-fns';

export const TASK_TYPES = [
  { value: 'task', label: 'Task', icon: CircleDot },
  { value: 'milestone', label: 'Milestone', icon: Diamond },
  { value: 'bug', label: 'Bug', icon: Bug },
  { value: 'feature', label: 'Feature', icon: Lightbulb },
  { value: 'request', label: 'Request', icon: MessageSquareQuote },
] as const;

export function TaskModal({ id, onClose, page }: { id: string; onClose: () => void; page?: boolean }) {
  const task = useStore((s) => s.data.task[id]);
  const [full, setFull] = useState(!!page);
  if (!task) return null;
  const body = <TaskBody task={task} onClose={onClose} full={full} setFull={page ? undefined : setFull} />;
  if (page) return <div className="h-full">{body}</div>;
  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/40 animate-fade" onMouseDown={onClose}>
      <div className={cn('pop flex flex-col overflow-hidden animate-pop', full ? 'w-screen h-screen rounded-none' : 'w-[min(1240px,96vw)] h-[92vh]')} onMouseDown={(e) => e.stopPropagation()}>
        {body}
      </div>
    </div>
  );
}

function TaskBody({ task, onClose, full, setFull }: { task: Task; onClose: () => void; full: boolean; setFull?: (v: boolean) => void }) {
  const nav = useNavigate();
  const s = getState();
  const data = useStore((st) => st.data);
  const crumbs = breadcrumb(task.listId);
  const parent = task.parentId ? data.task[task.parentId] : null;
  const [del, setDel] = useState(false);
  const [move, setMove] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const { isFav, toggle } = useFavs();
  const up = (p: Partial<Task>) => s.updateTask(task.id, p);
  const tray = useStore((st) => st.tray);
  const copyLink = () => { navigator.clipboard.writeText(location.href.split('#')[0] + '#/task/' + task.id); s.toast('Link copied'); };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* header */}
      <div className="h-12 shrink-0 flex items-center gap-1.5 px-4 border-b text-[13px]">
        <div className="flex items-center gap-1 min-w-0 text-[var(--muted)]">
          {crumbs.space && <button className="hover:text-[var(--text)] truncate" onClick={() => { onClose(); nav('/space/' + crumbs.space!.id); }}>{crumbs.space.name}</button>}
          {crumbs.folder && <><ChevronRight size={13} /><button className="hover:text-[var(--text)] truncate" onClick={() => { onClose(); nav('/folder/' + crumbs.folder!.id); }}>{crumbs.folder.name}</button></>}
          {crumbs.list && <><ChevronRight size={13} /><button className="hover:text-[var(--text)] truncate font-medium text-[var(--text)]" onClick={() => { onClose(); nav('/list/' + crumbs.list!.id); }}>{crumbs.list.name}</button></>}
          {parent && <><ChevronRight size={13} /><button className="hover:text-[var(--text)] truncate" onClick={() => s.openTask(parent.id)}>{parent.name}</button></>}
        </div>
        <button className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-[var(--faint)] hover:bg-[var(--hover)] font-mono" title="Copy task ID" onClick={() => { navigator.clipboard.writeText(shortId(task.id)); s.toast('Task ID copied'); }}><Hash size={11} />{shortId(task.id)}</button>
        <div className="flex-1" />
        <span className="text-xs text-[var(--faint)] hidden md:inline">Created {task.created_at ? format(new Date(task.created_at), 'MMM d, yyyy') : ''}</span>
        <Popover align="end" width={320} trigger={<button className="btn btn-ghost !py-1"><Share2 size={14} /> Share</button>}>
          <div className="p-4 space-y-3">
            <div className="font-semibold">Share this task</div>
            <button className="btn btn-outline w-full justify-center" onClick={copyLink}><Link2 size={14} /> Copy private link</button>
            <div className="border-t pt-3">
              <label className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><Globe size={14} /> Public link (read-only)</span>
                <input type="checkbox" className="accent-[var(--accent)]" checked={!!task.public} onChange={(e) => s.update('task', task.id, { public: e.target.checked })} /></label>
              {task.public && <div className="mt-2 flex gap-1"><input readOnly className="input !py-1 !text-xs" value={location.href.split('#')[0] + '#/share/' + task.id} /><button className="btn btn-outline !py-1" onClick={() => { navigator.clipboard.writeText(location.href.split('#')[0] + '#/share/' + task.id); s.toast('Public link copied'); }}><Copy size={13} /></button></div>}
            </div>
          </div>
        </Popover>
        <button className="icon-btn" title={isFav(task.id) ? 'Unfavorite' : 'Favorite'} onClick={() => toggle({ type: 'task', id: task.id })}><Star size={15} className={isFav(task.id) ? 'text-amber-500' : ''} fill={isFav(task.id) ? 'currentColor' : 'none'} /></button>
        <Popover align="end" trigger={<button className="icon-btn"><MoreHorizontal size={16} /></button>}>
          {(close) => <MenuList close={close} items={[
            { label: 'Copy link', icon: <Link2 size={14} />, onClick: copyLink },
            { label: 'Copy ID', icon: <Hash size={14} />, onClick: () => navigator.clipboard.writeText(shortId(task.id)) },
            { label: tray.includes(task.id) ? 'Remove from tray' : 'Minimize to tray', icon: <Minus size={14} />, onClick: () => {
              const t = tray.includes(task.id) ? tray.filter((x) => x !== task.id) : [...tray, task.id];
              s.set({ tray: t }); localStorage.setItem('proman.tray', JSON.stringify(t)); if (!tray.includes(task.id)) onClose();
            } },
            { label: 'Duplicate', icon: <Copy size={14} />, onClick: () => { const c = s.duplicateTask(task.id); if (c) s.openTask(c.id); } },
            { label: 'Move to…', icon: <ArrowRightLeft size={14} />, onClick: () => setMove(true) },
            { label: 'Save as template', icon: <LayoutTemplate size={14} />, onClick: () => {
              const name = prompt('Template name', task.name);
              if (!name) return;
              const subs = Object.values(data.task).filter((x) => x.parentId === task.id).map((x) => ({ name: x.name }));
              s.create('template', { name, type: 'task', description: 'From task ' + task.name, payload: { description: task.description, checklists: task.checklists, tags: task.tags, subtasks: subs, priority: task.priority, type: task.type } });
              s.toast('Template saved', 'success');
            } },
            { label: 'Convert to subtask of…', icon: <CornerIcon />, onClick: () => setMove(true) },
            ...(task.parentId ? [{ label: 'Convert to task', icon: <CircleDot size={14} />, onClick: () => up({ parentId: null }) }] : []),
            { divider: true, label: '' },
            { label: task.archived ? 'Unarchive' : 'Archive', icon: <Archive size={14} />, onClick: () => up({ archived: !task.archived }) },
            { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => setDel(true) },
          ]} />}
        </Popover>
        {setFull && <button className="icon-btn" onClick={() => setFull(!full)} title={full ? 'Exit full screen' : 'Full screen'}>{full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>}
        <button className="icon-btn" onClick={() => setShowPanel(!showPanel)} title="Toggle activity"><MessageIcon /></button>
        <button className="icon-btn" onClick={onClose}><X size={17} /></button>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-[880px] mx-auto px-8 py-6">
            {task.archived && <div className="mb-3 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-sm px-3 py-2 flex items-center gap-2"><Archive size={14} /> This task is archived. <button className="underline" onClick={() => up({ archived: false })}>Restore</button></div>}
            <div className="flex items-center gap-2 mb-3">
              <TypePicker task={task} />
              <SummaryChips task={task} />
            </div>
            <InlineEdit multiline value={task.name} onSave={(v) => up({ name: v })} className="text-[26px] font-bold leading-tight" />

            <Properties task={task} />
            <Relationships task={task} />
            <CustomFields task={task} />

            <div className="mt-6">
              <DescriptionEditor task={task} />
            </div>

            <Subtasks task={task} />
            <Checklists task={task} />
            <Attachments task={task} />
          </div>
        </div>
        {showPanel && <div className="w-[400px] shrink-0 border-l flex flex-col min-h-0 bg-[var(--subtle)]"><ActivityPanel task={task} /></div>}
      </div>
      <Confirm open={del} onClose={() => setDel(false)} title="Delete task?" body={`“${task.name}” and its subtasks will be deleted.`} onConfirm={() => { s.deleteTask(task.id); onClose(); }} />
      {move && <MoveTaskModal task={task} onClose={() => setMove(false)} />}
    </div>
  );
}

const CornerIcon = () => <span className="text-xs">↳</span>;
const MessageIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" /></svg>;

function TypePicker({ task }: { task: Task }) {
  const cur = TASK_TYPES.find((t) => t.value === (task.type || 'task'))!;
  return (
    <Popover trigger={<button className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[13px] hover:bg-[var(--hover)]"><cur.icon size={14} />{cur.label}<ChevronDown size={12} className="text-[var(--muted)]" /></button>}>
      {(close) => <div className="p-1">{TASK_TYPES.map((t) => <button key={t.value} className="menu-item" onClick={() => { getState().updateTask(task.id, { type: t.value }); close(); }}><t.icon size={14} />{t.label}{t.value === cur.value && <Check size={13} className="ml-auto" />}</button>)}</div>}
    </Popover>
  );
}

function SummaryChips({ task }: { task: Task }) {
  const data = useStore((s) => s.data);
  const subs = Object.values(data.task).filter((t) => t.parentId === task.id);
  const items = (task.checklists || []).flatMap((c) => c.items);
  const comments = Object.values(data.comment).filter((c) => c.taskId === task.id).length;
  const files = Object.values(data.attachment).filter((a) => a.taskId === task.id).length;
  const chip = 'inline-flex items-center gap-1 text-xs text-[var(--muted)]';
  return (
    <div className="flex items-center gap-3 ml-1">
      {subs.length > 0 && <span className={chip} title="Subtasks"><CornerIcon /> {subs.filter(isClosed).length}/{subs.length}</span>}
      {items.length > 0 && <span className={chip} title="Checklist items"><ListChecks size={13} /> {items.filter((i) => i.done).length}/{items.length}</span>}
      {comments > 0 && <span className={chip}>💬 {comments}</span>}
      {files > 0 && <span className={chip}><Paperclip size={12} /> {files}</span>}
    </div>
  );
}

function Prop({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center min-h-[34px]">
      <div className="w-36 shrink-0 flex items-center gap-2 text-[13px] text-[var(--muted)]">{icon}{label}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Properties({ task }: { task: Task }) {
  const s = getState();
  const up = (p: Partial<Task>) => s.updateTask(task.id, p);
  const statuses = statusesForList(task.listId);
  const st = statusOf(task);
  const closedStatus = statuses.find((x) => x.type === 'closed') || statuses.find((x) => x.type === 'done') || statuses[statuses.length - 1];
  const nextStatus = statuses[statuses.findIndex((x) => x.id === task.status) + 1];
  const list = useStore((x) => x.data.list[task.listId]);
  const times = useStore((x) => x.data.time);
  const tracked = Object.values(times).filter((t) => t.taskId === task.id).reduce((a, t) => a + (t.duration || (t.end ? 0 : (Date.now() - new Date(t.start).getTime()) / 1000)), 0);
  const running = useRunningTimer();
  const isRunning = running?.taskId === task.id;
  const now = useNow(isRunning ? 1000 : 60000);
  const liveTracked = Object.values(times).filter((t) => t.taskId === task.id).reduce((a, t) => a + (t.end ? t.duration || 0 : (now - new Date(t.start).getTime()) / 1000), 0);
  const [estEdit, setEstEdit] = useState(false);

  return (
    <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-x-8">
      <Prop icon={<CircleDot size={15} />} label="Status">
        <div className="flex items-center gap-1">
          <StatusPicker listId={task.listId} value={task.status} onChange={(id) => up({ status: id })} />
          {nextStatus && !isClosed(task) && <button className="icon-btn !w-7 !h-7" title={`Move to ${nextStatus.name}`} onClick={() => up({ status: nextStatus.id })}><ChevronRight size={14} /></button>}
          <button className={cn('icon-btn !w-7 !h-7 border', isClosed(task) && '!bg-green-600 !text-white !border-green-600')} title={isClosed(task) ? 'Reopen' : 'Mark complete'}
            onClick={() => up({ status: isClosed(task) ? statuses[0].id : closedStatus.id })}><Check size={14} /></button>
        </div>
      </Prop>
      <Prop icon={<Users size={15} />} label="Assignees">
        <AssigneePicker value={task.assignees || []} onChange={(a) => up({ assignees: a })} size={26} />
      </Prop>
      <Prop icon={<Calendar size={15} />} label="Dates">
        <div className="flex items-center gap-1 text-[13px]">
          <DatePicker value={task.startDate} onChange={(d) => up({ startDate: d })} placeholder="Start" />
          <span className="text-[var(--faint)]">→</span>
          <DatePicker value={task.dueDate} hasTime={task.dueTime} onChange={(d, ht) => up({ dueDate: d, dueTime: !!ht })} placeholder="Due" className={cn(task.dueDate && !isClosed(task) && new Date(task.dueDate) < new Date() && '!text-red-600')} />
          <RecurrencePicker task={task} />
        </div>
      </Prop>
      {clickApp('priorities') && (
        <Prop icon={<Flag size={15} />} label="Priority">
          <PriorityPicker value={task.priority} onChange={(p) => up({ priority: p })} trigger={<button className="rounded px-1.5 py-0.5 hover:bg-[var(--hover)]"><PriorityFlag p={task.priority} showLabel /></button>} />
        </Prop>
      )}
      {clickApp('timeEstimates') && (
        <Prop icon={<Hourglass size={15} />} label="Time estimate">
          {estEdit ? (
            <input autoFocus className="input !py-0.5 !w-32 !text-[13px]" placeholder="e.g. 2h 30m" defaultValue={fmtMinutes(task.estimate)}
              onBlur={(e) => { up({ estimate: parseDuration(e.target.value) }); setEstEdit(false); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEstEdit(false); }} />
          ) : <button className={cn('rounded px-1.5 py-0.5 text-[13px] hover:bg-[var(--hover)]', !task.estimate && 'text-[var(--faint)]')} onClick={() => setEstEdit(true)}>{fmtMinutes(task.estimate) || 'Empty'}</button>}
        </Prop>
      )}
      {clickApp('points') && (
        <Prop icon={<Target size={15} />} label="Sprint points">
          <input type="number" min={0} className="w-24 rounded px-1.5 py-0.5 text-[13px] bg-transparent hover:bg-[var(--hover)] outline-none focus:bg-[var(--hover)]" placeholder="Empty" value={task.points ?? ''} onChange={(e) => up({ points: e.target.value === '' ? null : Number(e.target.value) })} />
        </Prop>
      )}
      {clickApp('timeTracking') && (
        <Prop icon={<Timer size={15} />} label="Track time">
          <div className="flex items-center gap-2">
            <button className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] border', isRunning ? 'bg-red-600 text-white border-red-600' : 'hover:bg-[var(--hover)]')}
              onClick={() => (isRunning ? stopTimer(running!.id) : startTimer(task.id))}>
              {isRunning ? <Square size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}{isRunning ? 'Stop' : 'Start'}
            </button>
            <TimeEntries task={task} total={liveTracked} />
          </div>
        </Prop>
      )}
      {clickApp('tags') && (
        <Prop icon={<TagIcon size={15} />} label="Tags">
          <div className="flex flex-wrap items-center gap-1">
            {(task.tags || []).map((t) => <TagChip key={t} name={t} onRemove={() => up({ tags: task.tags.filter((x) => x !== t) })} />)}
            <TagPicker value={task.tags || []} onChange={(tags) => up({ tags })} spaceId={list?.spaceId} trigger={<button className="text-[13px] text-[var(--faint)] hover:text-[var(--text)] px-1">{task.tags?.length ? <Plus size={14} /> : 'Empty'}</button>} />
          </div>
        </Prop>
      )}
      <Prop icon={<Eye size={15} />} label="Followers">
        <AssigneePicker value={task.watchers || []} onChange={(w) => s.update('task', task.id, { watchers: w })} size={22} multi />
      </Prop>
    </div>
  );
}

function RecurrencePicker({ task }: { task: Task }) {
  const r = task.recurrence;
  const set = (rec: Recurrence | null) => getState().update('task', task.id, { recurrence: rec });
  return (
    <Popover width={280} trigger={<button className={cn('icon-btn !w-7 !h-7', r && '!text-accent')} title="Recurring"><Repeat size={14} /></button>}>
      {(close) => (
        <div className="p-4 space-y-3 text-sm">
          <div className="font-semibold">Recurring task</div>
          <div className="flex gap-2 items-center">
            <span>Every</span>
            <input type="number" min={1} className="input !w-16 !py-1" value={r?.interval || 1} onChange={(e) => set({ freq: r?.freq || 'weekly', on: r?.on || 'complete', ...r, interval: Number(e.target.value) || 1 })} />
            <select className="input !py-1" value={r?.freq || 'weekly'} onChange={(e) => set({ interval: 1, on: 'complete', ...r, freq: e.target.value as any })}>
              <option value="daily">day(s)</option><option value="weekly">week(s)</option><option value="monthly">month(s)</option><option value="yearly">year(s)</option>
            </select>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--accent)]" checked={!!r?.createNew} onChange={(e) => set({ freq: 'weekly', interval: 1, on: 'complete', ...r, createNew: e.target.checked })} /> Create a new task each time</label>
          <div className="text-xs text-[var(--muted)]">When the task is completed, {r?.createNew ? 'a copy is created' : 'it reopens'} with dates moved forward{task.dueDate && r ? ` (next due ${format(new Date(nextDate(task.dueDate, r)!), 'MMM d')})` : ''}.</div>
          <div className="flex justify-between">
            {r ? <button className="btn btn-ghost text-red-600 !px-2" onClick={() => { set(null); close(); }}>Remove</button> : <span />}
            <button className="btn btn-primary" onClick={() => { if (!r) set({ freq: 'weekly', interval: 1, on: 'complete' }); close(); }}>{r ? 'Done' : 'Make recurring'}</button>
          </div>
        </div>
      )}
    </Popover>
  );
}

function TimeEntries({ task, total }: { task: Task; total: number }) {
  const times = useStore((s) => s.data.time);
  const entries = Object.values(times).filter((t) => t.taskId === task.id).sort((a, b) => b.start.localeCompare(a.start));
  const [manual, setManual] = useState('');
  return (
    <Popover width={340} trigger={<button className="text-[13px] text-[var(--muted)] hover:text-[var(--text)] tabular-nums">{total ? fmtDuration(total) : '0s'}{task.estimate ? ` / ${fmtMinutes(task.estimate)}` : ''}</button>}>
      <div className="p-3">
        <div className="font-semibold text-sm mb-2">Time entries</div>
        <div className="flex gap-1 mb-3">
          <input className="input !py-1 !text-xs" placeholder="Add time, e.g. 1h 15m" value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter') { const m = parseDuration(manual); if (m) { const end = new Date(); getState().create('time', { taskId: task.id, user: getState().user!.id, start: new Date(end.getTime() - m * 60000).toISOString(), end: end.toISOString(), duration: m * 60, note: '' }); setManual(''); } }
          }} />
        </div>
        <div className="max-h-60 overflow-auto space-y-1">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-xs py-1 group">
              <Avatar id={e.user} size={18} />
              <span className="flex-1 text-[var(--muted)]">{format(new Date(e.start), 'MMM d, h:mm a')}</span>
              <label className="flex items-center gap-1 text-[10px] text-[var(--faint)]"><input type="checkbox" checked={!!e.billable} onChange={(x) => getState().update('time', e.id, { billable: x.target.checked })} />$</label>
              <span className="font-medium tabular-nums">{e.end ? fmtDuration(e.duration || 0) : 'running'}</span>
              <button className="opacity-0 group-hover:opacity-100 text-[var(--faint)] hover:text-red-600" onClick={() => getState().remove('time', e.id)}><X size={12} /></button>
            </div>
          ))}
          {!entries.length && <div className="text-xs text-[var(--muted)]">No time tracked yet.</div>}
        </div>
      </div>
    </Popover>
  );
}

function Relationships({ task }: { task: Task }) {
  const links = useStore((s) => s.data.link);
  const tasks = useStore((s) => s.data.task);
  const mine = Object.values(links).filter((l) => l.from === task.id || l.to === task.id);
  const blocking = mine.filter((l) => l.type === 'blocks' && l.from === task.id);
  const waiting = mine.filter((l) => l.type === 'blocks' && l.to === task.id);
  const related = mine.filter((l) => l.type === 'relates');
  if (!clickApp('dependencies') && !mine.length) return null;
  const Row = ({ icon, label, items, other }: { icon: React.ReactNode; label: string; items: typeof mine; other: (l: any) => string }) => items.length ? (
    <div className="flex items-start py-1">
      <div className="w-36 shrink-0 flex items-center gap-2 text-[13px] pt-0.5">{icon}{label}</div>
      <div className="flex-1 space-y-1">
        {items.map((l) => {
          const t = tasks[other(l)];
          if (!t) return null;
          return (
            <div key={l.id} className="group flex items-center gap-2 text-[13px]">
              <StatusIcon status={statusOf(t)} />
              <button className={cn('hover:underline truncate', isClosed(t) && 'line-through text-[var(--muted)]')} onClick={() => getState().openTask(t.id)}>{t.name}</button>
              <button className="opacity-0 group-hover:opacity-100 text-[var(--faint)] hover:text-red-600" onClick={() => getState().remove('link', l.id)}><X size={12} /></button>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;
  return (
    <div className="mt-4 border-t pt-3">
      <Row icon={<Ban size={14} className="text-red-500" />} label="Blocking" items={blocking} other={(l) => l.to} />
      <Row icon={<AlertTriangle size={14} className="text-amber-500" />} label="Waiting on" items={waiting} other={(l) => l.from} />
      <Row icon={<LinkIcon size={14} className="text-[var(--muted)]" />} label="Linked" items={related} other={(l) => (l.from === task.id ? l.to : l.from)} />
      <AddRelationship task={task} />
    </div>
  );
}

function AddRelationship({ task }: { task: Task }) {
  const tasks = useStore((s) => s.data.task);
  const [type, setType] = useState<'waiting' | 'blocking' | 'relates'>('waiting');
  const [q, setQ] = useState('');
  const candidates = Object.values(tasks).filter((t) => t.id !== task.id && !t.archived && t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 20);
  return (
    <Popover width={340} trigger={<button className="text-xs text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1 mt-1"><Plus size={13} /> Add relationship</button>}>
      {(close) => (
        <div className="p-3">
          <div className="flex gap-1 mb-2">
            {([['waiting', 'Waiting on'], ['blocking', 'Blocking'], ['relates', 'Link task']] as const).map(([k, l]) => <button key={k} className={cn('btn !py-1 !px-2 !text-xs flex-1 justify-center', type === k ? 'btn-primary' : 'btn-outline')} onClick={() => setType(k)}>{l}</button>)}
          </div>
          <input autoFocus className="input !py-1.5" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-60 overflow-auto mt-1">
            {candidates.map((t) => (
              <button key={t.id} className="menu-item" onClick={() => {
                const s = getState();
                if (type === 'relates') s.create('link', { from: task.id, to: t.id, type: 'relates' });
                else if (type === 'blocking') s.create('link', { from: task.id, to: t.id, type: 'blocks' });
                else s.create('link', { from: t.id, to: task.id, type: 'blocks' });
                s.logActivity(task.id, `added ${type === 'relates' ? 'a linked task' : type === 'blocking' ? 'a blocked task' : 'a dependency'}: ${t.name}`);
                close();
              }}><StatusIcon status={statusOf(t)} /><span className="flex-1 truncate">{t.name}</span><span className="text-[10px] text-[var(--faint)]">{getState().data.list[t.listId]?.name}</span></button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

function CustomFields({ task }: { task: Task }) {
  const fields = useStore((s) => s.data.field);
  const list = useMemo(() => fieldsForLists([task.listId]), [fields, task.listId]);
  const [open, setOpen] = useState(localStorage.getItem('proman.fieldsOpen') !== '0');
  const [hideEmpty, setHideEmpty] = useState(false);
  if (!list.length) return null;
  const shown = hideEmpty ? list.filter((f) => { const v = task.fields?.[f.id]; return v != null && v !== '' && !(Array.isArray(v) && !v.length); }) : list;
  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex items-center">
        <button className="flex items-center gap-1 font-semibold text-[14px]" onClick={() => { setOpen(!open); localStorage.setItem('proman.fieldsOpen', open ? '0' : '1'); }}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}Fields</button>
        <div className="flex-1" />
        {open && <button className="text-xs text-[var(--muted)] hover:text-[var(--text)]" onClick={() => setHideEmpty(!hideEmpty)}>{hideEmpty ? 'Show empty' : 'Hide empty'}</button>}
      </div>
      {open && (
        <div className="mt-2 rounded-lg border divide-y">
          {shown.map((f) => (
            <div key={f.id} className="flex items-center">
              <div className="w-48 shrink-0 px-3 py-1.5 text-[13px] text-[var(--muted)] truncate border-r">{f.name}{f.required && <span className="text-red-500"> *</span>}</div>
              <div className="flex-1 min-w-0 px-1.5 py-1"><FieldValue f={f} task={task} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DescriptionEditor({ task }: { task: Task }) {
  const save = useMemo(() => debounce((html: string) => getState().update('task', task.id, { description: html }), 600), [task.id]);
  return (
    <div className="rounded-lg -mx-2 px-2 py-1 hover:bg-[var(--subtle)] focus-within:bg-transparent min-h-[60px]">
      <RichEditor value={task.description || ''} onChange={save} placeholder="Add a description, or type / for commands…" />
    </div>
  );
}

// ------------------------------------------------------------------ subtasks
function Subtasks({ task }: { task: Task }) {
  const tasks = useStore((s) => s.data.task);
  const subs = Object.values(tasks).filter((t) => t.parentId === task.id && !t.archived).sort((a, b) => (a.order || 0) - (b.order || 0));
  const [open, setOpen] = useState(true);
  const [name, setName] = useState('');
  const [drag, setDrag] = useState<string | null>(null);
  const done = subs.filter(isClosed).length;
  const add = () => {
    if (!name.trim()) return;
    getState().createTask({ name: name.trim(), listId: task.listId, parentId: task.id });
    setName('');
  };
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1 font-semibold text-[14px]" onClick={() => setOpen(!open)}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}Subtasks</button>
        {subs.length > 0 && <><span className="text-xs text-[var(--muted)]">{done}/{subs.length}</span><ProgressBar value={(done / subs.length) * 100} className="w-24" color="#30A46C" /></>}
      </div>
      {open && (
        <div className="mt-2 rounded-lg border overflow-hidden">
          {subs.map((t) => (
            <div key={t.id} draggable onDragStart={() => setDrag(t.id)} onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!drag || drag === t.id) return;
                const idx = subs.findIndex((x) => x.id === t.id);
                getState().update('task', drag, { order: between(subs[idx - 1]?.order, t.order) });
                setDrag(null);
              }}
              className="group flex items-center gap-2 px-2 py-1.5 border-b last:border-b-0 hover-row text-[13px]">
              <GripVertical size={13} className="text-[var(--faint)] opacity-0 group-hover:opacity-100 cursor-grab" />
              <StatusPicker listId={t.listId} value={t.status} onChange={(id) => getState().updateTask(t.id, { status: id })} trigger={<button><StatusIcon status={statusOf(t)} size={15} /></button>} />
              <button className={cn('flex-1 text-left truncate', isClosed(t) && 'line-through text-[var(--muted)]')} onClick={() => getState().openTask(t.id)}>{t.name}</button>
              {Object.values(tasks).some((x) => x.parentId === t.id) && <span className="text-[11px] text-[var(--faint)]">↳ {Object.values(tasks).filter((x) => x.parentId === t.id).length}</span>}
              <AssigneePicker value={t.assignees} onChange={(a) => getState().updateTask(t.id, { assignees: a })} size={20} />
              <DatePicker value={t.dueDate} onChange={(d) => getState().updateTask(t.id, { dueDate: d })} trigger={<button className={cn('text-xs w-16 text-left', t.dueDate ? '' : 'text-[var(--faint)] opacity-0 group-hover:opacity-100')}>{t.dueDate ? fmtDue(t.dueDate) : <Calendar size={13} />}</button>} />
              <PriorityPicker value={t.priority} onChange={(p) => getState().updateTask(t.id, { priority: p })} trigger={<button className={cn(!t.priority && 'opacity-0 group-hover:opacity-100')}><PriorityFlag p={t.priority} /></button>} />
            </div>
          ))}
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Plus size={14} className="text-[var(--faint)] ml-5" />
            <input className="flex-1 bg-transparent outline-none text-[13px]" placeholder="Add subtask" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            {name && <button className="btn btn-primary !py-0.5 !text-xs" onClick={add}>Save</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ checklists
function Checklists({ task }: { task: Task }) {
  const lists = task.checklists || [];
  const save = (c: Checklist[]) => getState().updateTask(task.id, { checklists: c });
  const updList = (id: string, p: Partial<Checklist>) => save(lists.map((l) => (l.id === id ? { ...l, ...p } : l)));
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[14px]">Checklists</span>
        <button className="icon-btn !w-6 !h-6" title="Add checklist" onClick={() => save([...lists, { id: uid(), name: 'Checklist', items: [] }])}><Plus size={14} /></button>
      </div>
      {lists.map((cl) => {
        const done = cl.items.filter((i) => i.done).length;
        return (
          <div key={cl.id} className="mt-3 rounded-lg border">
            <div className="flex items-center gap-2 px-3 py-2 border-b">
              <InlineEdit value={cl.name} onSave={(v) => updList(cl.id, { name: v })} className="font-medium text-[13px] flex-1" />
              <span className="text-xs text-[var(--muted)]">{done}/{cl.items.length}</span>
              <ProgressBar value={cl.items.length ? (done / cl.items.length) * 100 : 0} className="w-20" color="#30A46C" />
              <Popover align="end" trigger={<button className="icon-btn !w-6 !h-6"><MoreHorizontal size={14} /></button>}>
                {(close) => <MenuList close={close} items={[
                  { label: 'Check all', icon: <Check size={14} />, onClick: () => updList(cl.id, { items: cl.items.map((i) => ({ ...i, done: true })) }) },
                  { label: 'Uncheck all', icon: <Square size={14} />, onClick: () => updList(cl.id, { items: cl.items.map((i) => ({ ...i, done: false })) }) },
                  { label: 'Convert items to subtasks', icon: <CornerIcon />, onClick: () => { cl.items.forEach((i) => getState().createTask({ name: i.text, listId: task.listId, parentId: task.id, assignees: i.assignee ? [i.assignee] : [] })); save(lists.filter((l) => l.id !== cl.id)); } },
                  { label: 'Delete checklist', icon: <Trash2 size={14} />, danger: true, onClick: () => save(lists.filter((l) => l.id !== cl.id)) },
                ]} />}
              </Popover>
            </div>
            <ChecklistItems items={cl.items} onChange={(items) => updList(cl.id, { items })} depth={0} />
          </div>
        );
      })}
    </div>
  );
}

function ChecklistItems({ items, onChange, depth }: { items: ChecklistItem[]; onChange: (i: ChecklistItem[]) => void; depth: number }) {
  const [text, setText] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const upd = (id: string, p: Partial<ChecklistItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...p } : i)));
  return (
    <div style={{ paddingLeft: depth ? 22 : 0 }}>
      {items.map((it, idx) => (
        <div key={it.id}>
          <div draggable onDragStart={() => setDrag(idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag == null) return; const n = [...items]; const [m] = n.splice(drag, 1); n.splice(idx, 0, m); onChange(n); setDrag(null); }}
            className="group flex items-center gap-2 px-3 py-1 hover-row">
            <GripVertical size={12} className="text-[var(--faint)] opacity-0 group-hover:opacity-100 cursor-grab" />
            <Checkbox checked={it.done} onChange={(v) => upd(it.id, { done: v })} round />
            <InlineEdit value={it.text} onSave={(v) => upd(it.id, { text: v })} className={cn('flex-1 text-[13px]', it.done && 'line-through text-[var(--muted)]')} />
            <AssigneePicker value={it.assignee ? [it.assignee] : []} onChange={(a) => upd(it.id, { assignee: a[a.length - 1] || null })} size={18} multi={false} />
            {depth < 2 && <button title="Add nested item" className="opacity-0 group-hover:opacity-100 icon-btn !w-5 !h-5" onClick={() => upd(it.id, { children: [...(it.children || []), { id: uid(), text: 'New item', done: false }] })}><Plus size={11} /></button>}
            <button className="opacity-0 group-hover:opacity-100 text-[var(--faint)] hover:text-red-600" onClick={() => onChange(items.filter((i) => i.id !== it.id))}><X size={12} /></button>
          </div>
          {!!it.children?.length && <ChecklistItems items={it.children} onChange={(c) => upd(it.id, { children: c })} depth={depth + 1} />}
        </div>
      ))}
      {depth === 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Plus size={13} className="text-[var(--faint)] ml-5" />
          <input className="flex-1 bg-transparent outline-none text-[13px]" placeholder="Add item" value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) { onChange([...items, { id: uid(), text: text.trim(), done: false }]); setText(''); } }} />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ attachments
function Attachments({ task }: { task: Task }) {
  const atts = useStore((s) => s.data.attachment);
  const files = Object.values(atts).filter((a) => a.taskId === task.id);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const upload = async (list: FileList | File[]) => {
    setBusy(true);
    const s = getState();
    for (const f of Array.from(list)) {
      try {
        const url = await backend.uploadFile(s.workspace!.id, f, f.name);
        s.create('attachment', { taskId: task.id, name: f.name, url, size: f.size, mime: f.type, user: s.user!.id });
        s.logActivity(task.id, `attached ${f.name}`);
      } catch (e: any) { s.toast(e.message, 'error'); }
    }
    setBusy(false);
  };
  return (
    <div className="mt-8 mb-10">
      <div className="font-semibold text-[14px] mb-2">Attachments</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {files.map((f) => (
          <div key={f.id} className="group relative rounded-lg border overflow-hidden bg-[var(--panel)]">
            {f.mime.startsWith('image/') ? <img src={f.url} className="h-28 w-full object-cover" alt="" /> : <div className="h-28 flex items-center justify-center bg-[var(--subtle)] text-[var(--muted)]"><Paperclip size={22} /></div>}
            <div className="px-2 py-1.5 text-xs flex items-center gap-1">
              <span className="truncate flex-1">{f.name}</span>
              <a href={f.url} download={f.name} target="_blank" rel="noreferrer" className="icon-btn !w-6 !h-6"><Download size={12} /></a>
              {f.mime.startsWith('image/') && <button className="icon-btn !w-6 !h-6" title="Set as cover" onClick={() => getState().update('task', task.id, { cover: task.cover === f.url ? null : f.url })}><Star size={12} fill={task.cover === f.url ? 'currentColor' : 'none'} /></button>}
              <button className="icon-btn !w-6 !h-6 hover:!text-red-600" onClick={() => getState().remove('attachment', f.id)}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
      <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        className={cn('mt-2 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed py-5 text-sm text-[var(--muted)] cursor-pointer hover:border-[var(--accent)]', drag && 'border-[var(--accent)] bg-[var(--subtle)]')}>
        <Paperclip size={15} /> {busy ? 'Uploading…' : <>Drop files here or <span className="text-accent">browse</span></>}
        <input type="file" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
      </label>
    </div>
  );
}

// ------------------------------------------------------------------ move
function MoveTaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const [q, setQ] = useState('');
  const lists = Object.values(data.list).filter((l) => !l.archived && l.name.toLowerCase().includes(q.toLowerCase()));
  const parents = Object.values(data.task).filter((t) => t.id !== task.id && !t.parentId && t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 15);
  return (
    <Modal open onClose={onClose} title="Move task" width={460}>
      <div className="p-4">
        <input autoFocus className="input" placeholder="Search Lists or tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-3 label">Lists</div>
        <div className="max-h-48 overflow-auto">
          {lists.map((l) => <button key={l.id} className="menu-item" onClick={() => { getState().updateTask(task.id, { listId: l.id, parentId: null }); onClose(); }}><span className="w-2 h-2 rounded-full" style={{ background: l.color || data.space[l.spaceId]?.color }} />{l.name}<span className="ml-auto text-xs text-[var(--faint)]">{data.space[l.spaceId]?.name}</span></button>)}
        </div>
        <div className="mt-3 label">Make subtask of</div>
        <div className="max-h-48 overflow-auto">
          {parents.map((t) => <button key={t.id} className="menu-item" onClick={() => { getState().updateTask(task.id, { parentId: t.id, listId: t.listId }); onClose(); }}><CornerIcon /><span className="truncate">{t.name}</span></button>)}
        </div>
      </div>
    </Modal>
  );
}
