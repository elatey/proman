import { useState } from 'react';
import { Archive, Copy, Trash2, X, ArrowRightLeft, Link2, ExternalLink, CornerDownRight, Calendar, Flag, Users, CircleDot, Tag as TagIcon, MessageSquare, Paperclip, ListChecks } from 'lucide-react';
import { addDays, formatISO, startOfDay, format } from 'date-fns';
import { useStore, getState, statusesForList, statusOf, isClosed, memberName } from '../../lib/store';
import { StatusPicker, StatusPill, AssigneePicker, DatePicker, PriorityPicker, PriorityFlag, TagChip, TagPicker, Popover, type MenuItem, ProgressBar, Avatar } from '../ui';
import { FieldValue, autoProgress } from '../task/FieldValue';
import { cn, fmtDue, dueTone, fmtMinutes, fmtDuration, shortId, PRIORITIES } from '../../lib/utils';
import type { Task } from '../../lib/types';

export function applyGroupChange(t: Task, groupBy: string | undefined, key: string): Partial<Task> | null {
  const by = groupBy || 'status';
  switch (by) {
    case 'status': {
      const st = statusesForList(t.listId).find((s) => s.name === key);
      return st && st.id !== t.status ? { status: st.id } : null;
    }
    case 'assignee': return { assignees: key === '__none' ? [] : [key] };
    case 'priority': return { priority: (Number(key) || null) as any };
    case 'dueDate': {
      const map: Record<string, string | null> = { today: formatISO(startOfDay(new Date())), tomorrow: formatISO(addDays(startOfDay(new Date()), 1)), week: formatISO(addDays(startOfDay(new Date()), 7)), later: formatISO(addDays(startOfDay(new Date()), 30)), none: null };
      return key in map ? { dueDate: map[key] } : null;
    }
    case 'tags': return key === '__none' ? { tags: [] } : { tags: Array.from(new Set([...(t.tags || []), key])) };
    case 'list': return key !== t.listId ? { listId: key } : null;
    case 'type': return { type: key as any };
    case 'none': return null;
    default: {
      const f = getState().data.field[by];
      if (!f) return null;
      const val = key === '__none' ? null : f.type === 'labels' ? [key] : f.type === 'checkbox' ? key === 'yes' : key;
      return { fields: { ...(t.fields || {}), [by]: val } };
    }
  }
}

export function taskMenu(t: Task): MenuItem[] {
  const s = getState();
  return [
    { label: 'Open', icon: <ExternalLink size={14} />, onClick: () => s.openTask(t.id) },
    { label: 'Copy link', icon: <Link2 size={14} />, onClick: () => { navigator.clipboard.writeText(location.href.split('#')[0] + '#/task/' + t.id); s.toast('Link copied'); } },
    { label: 'Add subtask', icon: <CornerDownRight size={14} />, onClick: () => { const n = prompt('Subtask name'); if (n) s.createTask({ name: n, listId: t.listId, parentId: t.id }); } },
    { label: 'Status', icon: <CircleDot size={14} />, submenu: statusesForList(t.listId).map((st) => ({ label: st.name, icon: <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.color }} />, onClick: () => s.updateTask(t.id, { status: st.id }) })) },
    { label: 'Priority', icon: <Flag size={14} />, submenu: [...PRIORITIES.map((p) => ({ label: p.label, icon: <Flag size={13} color={p.color} fill={p.color} />, onClick: () => s.updateTask(t.id, { priority: p.value }) })), { label: 'Clear', onClick: () => s.updateTask(t.id, { priority: null }) }] },
    { label: 'Assign to', icon: <Users size={14} />, submenu: s.members.map((m) => ({ label: m.profile.name, icon: <Avatar user={m.profile} size={16} />, onClick: () => s.updateTask(t.id, { assignees: t.assignees.includes(m.user_id) ? t.assignees.filter((x) => x !== m.user_id) : [...t.assignees, m.user_id] }) })) },
    { label: 'Move to', icon: <ArrowRightLeft size={14} />, submenu: Object.values(s.data.list).filter((l) => !l.archived).map((l) => ({ label: l.name, onClick: () => s.updateTask(t.id, { listId: l.id }) })) },
    { label: 'Duplicate', icon: <Copy size={14} />, onClick: () => s.duplicateTask(t.id) },
    { divider: true, label: '' },
    { label: t.archived ? 'Unarchive' : 'Archive', icon: <Archive size={14} />, onClick: () => s.updateTask(t.id, { archived: !t.archived }) },
    { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => s.deleteTask(t.id) },
  ];
}

export function Cell({ col, t }: { col: string; t: Task }) {
  const s = getState();
  const up = (p: Partial<Task>) => s.updateTask(t.id, p);
  const data = useStore((x) => x.data);
  switch (col) {
    case 'assignee': return <AssigneePicker value={t.assignees || []} onChange={(a) => up({ assignees: a })} size={22} />;
    case 'dueDate': return <DatePicker value={t.dueDate} hasTime={t.dueTime} onChange={(d, ht) => up({ dueDate: d, dueTime: !!ht })} trigger={<button className={cn('text-[13px] rounded px-1 hover:bg-[var(--hover)] whitespace-nowrap', dueTone(t.dueDate, isClosed(t)))}>{t.dueDate ? fmtDue(t.dueDate, t.dueTime) : <Calendar size={14} className="text-[var(--faint)]" />}</button>} />;
    case 'startDate': return <DatePicker value={t.startDate} onChange={(d) => up({ startDate: d })} trigger={<button className="text-[13px] rounded px-1 hover:bg-[var(--hover)] text-[var(--muted)] whitespace-nowrap">{t.startDate ? fmtDue(t.startDate) : <Calendar size={14} className="text-[var(--faint)]" />}</button>} />;
    case 'priority': return <PriorityPicker value={t.priority} onChange={(p) => up({ priority: p })} trigger={<button className="rounded px-1 py-0.5 hover:bg-[var(--hover)]"><PriorityFlag p={t.priority} showLabel={!!t.priority} /></button>} />;
    case 'status': return <StatusPicker listId={t.listId} value={t.status} onChange={(id) => up({ status: id })} trigger={<button><StatusPill status={statusOf(t)} small /></button>} />;
    case 'tags': return <div className="flex gap-1 items-center overflow-hidden">{(t.tags || []).map((x) => <TagChip key={x} name={x} small />)}<TagPicker value={t.tags || []} onChange={(tags) => up({ tags })} spaceId={data.list[t.listId]?.spaceId} trigger={<button className="text-[var(--faint)] hover:text-[var(--text)]"><TagIcon size={13} /></button>} /></div>;
    case 'estimate': return <span className="text-[13px] text-[var(--muted)]">{fmtMinutes(t.estimate) || '–'}</span>;
    case 'tracked': {
      const sec = Object.values(data.time).filter((x) => x.taskId === t.id).reduce((a, x) => a + (x.duration || 0), 0);
      return <span className="text-[13px] text-[var(--muted)]">{sec ? fmtDuration(sec) : '–'}</span>;
    }
    case 'points': return <input type="number" className="w-14 bg-transparent text-[13px] outline-none rounded px-1 hover:bg-[var(--hover)]" placeholder="–" value={t.points ?? ''} onChange={(e) => up({ points: e.target.value === '' ? null : Number(e.target.value) })} onClick={(e) => e.stopPropagation()} />;
    case 'list': return <span className="text-[13px] text-[var(--muted)] truncate">{data.list[t.listId]?.name}</span>;
    case 'created': return <span className="text-[13px] text-[var(--muted)] whitespace-nowrap">{t.created_at ? format(new Date(t.created_at), 'MMM d, yyyy') : ''}</span>;
    case 'updated': return <span className="text-[13px] text-[var(--muted)] whitespace-nowrap">{t.updated_at ? format(new Date(t.updated_at), 'MMM d, h:mm a') : ''}</span>;
    case 'createdBy': return t.created_by ? <span className="flex items-center gap-1.5 text-[13px]"><Avatar id={t.created_by} size={18} />{memberName(t.created_by)}</span> : <span className="text-[var(--faint)] text-xs">Form</span>;
    case 'id': return <span className="text-xs font-mono text-[var(--muted)]">{shortId(t.id)}</span>;
    case 'comments': {
      const n = Object.values(data.comment).filter((c) => c.taskId === t.id).length;
      return <span className="text-[13px] text-[var(--muted)] inline-flex items-center gap-1">{n ? <><MessageSquare size={13} />{n}</> : '–'}</span>;
    }
    case 'progress': { const p = autoProgress(t); return <div className="flex items-center gap-2 w-full"><ProgressBar value={p} className="flex-1" color="#30A46C" /><span className="text-[11px] text-[var(--muted)]">{p}%</span></div>; }
    default: {
      const f = data.field[col];
      return f ? <FieldValue f={f} task={t} compact /> : null;
    }
  }
}

export function colLabel(col: string): string {
  const b: Record<string, string> = { assignee: 'Assignee', dueDate: 'Due date', startDate: 'Start date', priority: 'Priority', status: 'Status', tags: 'Tags', estimate: 'Estimate', tracked: 'Tracked', points: 'Points', list: 'List', created: 'Created', updated: 'Updated', createdBy: 'Created by', id: 'ID', comments: 'Comments', progress: 'Progress' };
  return b[col] || getState().data.field[col]?.name || col;
}
export function colWidth(col: string): number {
  const b: Record<string, number> = { assignee: 96, dueDate: 110, startDate: 110, priority: 100, status: 130, tags: 160, estimate: 90, tracked: 90, points: 70, list: 130, created: 110, updated: 130, createdBy: 140, id: 90, comments: 90, progress: 130 };
  return b[col] || 150;
}

export function TaskBadges({ t }: { t: Task }) {
  const data = useStore((x) => x.data);
  const subs = Object.values(data.task).filter((x) => x.parentId === t.id && !x.archived);
  const items = (t.checklists || []).flatMap((c) => c.items);
  const comments = Object.values(data.comment).filter((c) => c.taskId === t.id).length;
  const files = Object.values(data.attachment).filter((a) => a.taskId === t.id).length;
  const blocked = Object.values(data.link).some((l) => l.type === 'blocks' && l.to === t.id && data.task[l.from] && !isClosed(data.task[l.from]));
  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-[var(--faint)] shrink-0">
      {blocked && <span className="text-red-500" title="Waiting on another task">⛔</span>}
      {subs.length > 0 && <span className="inline-flex items-center gap-0.5" title="Subtasks"><CornerDownRight size={11} />{subs.length}</span>}
      {items.length > 0 && <span className="inline-flex items-center gap-0.5" title="Checklist"><ListChecks size={11} />{items.filter((i) => i.done).length}/{items.length}</span>}
      {comments > 0 && <span className="inline-flex items-center gap-0.5"><MessageSquare size={11} />{comments}</span>}
      {files > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip size={11} />{files}</span>}
    </span>
  );
}

export function BulkBar({ ids, clear }: { ids: string[]; clear: () => void }) {
  const tasks = useStore((s) => s.data.task);
  const lists = useStore((s) => s.data.list);
  if (!ids.length) return null;
  const s = getState();
  const first = tasks[ids[0]];
  const each = (p: (t: Task) => Partial<Task>) => ids.forEach((id) => tasks[id] && s.updateTask(id, p(tasks[id])));
  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-xl bg-[#1c1c22] text-white px-3 py-2 shadow-2xl text-[13px] animate-pop">
      <span className="font-medium px-1">{ids.length} selected</span>
      <span className="w-px h-5 bg-white/20 mx-1" />
      {first && <StatusPicker listId={first.listId} value={undefined} onChange={(sid) => { const name = statusesForList(first.listId).find((x) => x.id === sid)?.name; each((t) => ({ status: statusesForList(t.listId).find((x) => x.name === name)?.id || t.status })); }} trigger={<button className="px-2 py-1 rounded hover:bg-white/10">Status</button>} />}
      <AssigneePicker value={[]} onChange={(a) => each(() => ({ assignees: a }))} trigger={<button className="px-2 py-1 rounded hover:bg-white/10">Assignees</button>} />
      <DatePicker value={null} onChange={(d) => each(() => ({ dueDate: d }))} trigger={<button className="px-2 py-1 rounded hover:bg-white/10">Due date</button>} />
      <PriorityPicker value={null} onChange={(p) => each(() => ({ priority: p }))} trigger={<button className="px-2 py-1 rounded hover:bg-white/10">Priority</button>} />
      <TagPicker value={[]} onChange={(tg) => each((t) => ({ tags: Array.from(new Set([...(t.tags || []), ...tg])) }))} trigger={<button className="px-2 py-1 rounded hover:bg-white/10">Tags</button>} />
      <Popover side="top" trigger={<button className="px-2 py-1 rounded hover:bg-white/10">Move</button>}>
        {(close) => <div className="p-1 max-h-64 overflow-auto w-56">{Object.values(lists).filter((l) => !l.archived).map((l) => <button key={l.id} className="menu-item" onClick={() => { each(() => ({ listId: l.id })); close(); }}>{l.name}</button>)}</div>}
      </Popover>
      <button className="px-2 py-1 rounded hover:bg-white/10" onClick={() => { ids.forEach((id) => s.duplicateTask(id)); clear(); }}><Copy size={14} /></button>
      <button className="px-2 py-1 rounded hover:bg-white/10" onClick={() => { each(() => ({ archived: true })); clear(); }}><Archive size={14} /></button>
      <button className="px-2 py-1 rounded hover:bg-white/10 text-red-400" onClick={() => { if (confirm(`Delete ${ids.length} tasks?`)) { ids.forEach((id) => s.deleteTask(id)); clear(); } }}><Trash2 size={14} /></button>
      <span className="w-px h-5 bg-white/20 mx-1" />
      <button className="p-1 rounded hover:bg-white/10" onClick={clear}><X size={15} /></button>
    </div>
  );
}
