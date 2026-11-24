import { useMemo, useState } from 'react';
import { Plus, ChevronsLeft, ChevronsRight, MoreHorizontal, Calendar } from 'lucide-react';
import { useStore, getState, statusesForList, statusOf, isClosed } from '../../lib/store';
import { groupTasks } from '../../lib/filters';
import { StatusIcon, AvatarStack, PriorityFlag, TagChip, useContextMenu, Popover, MenuList, AssigneePicker, DatePicker, PriorityPicker, StatusPicker } from '../ui';
import { applyGroupChange, taskMenu, TaskBadges } from './shared';
import { cn, between, fmtDue, dueTone, alpha } from '../../lib/utils';
import type { Task } from '../../lib/types';
import type { ViewProps } from '../../pages/LocationPage';

export function BoardView({ view, tasks, listIds }: ViewProps) {
  const cfg = view.config;
  const mode = cfg.showSubtasks || 'collapsed';
  const visible = mode === 'separate' ? tasks : tasks.filter((t) => !t.parentId);
  const groups = useMemo(() => groupTasks(visible, cfg.groupBy, listIds), [visible, cfg.groupBy, listIds]);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const ctx = useContextMenu();

  const drop = (e: React.DragEvent, groupKey: string, before?: Task, prev?: Task) => {
    e.preventDefault(); e.stopPropagation();
    setDragOver(null);
    const id = e.dataTransfer.getData('application/x-task');
    const t = getState().data.task[id];
    if (!t || t.id === before?.id) return;
    const p = applyGroupChange(t, cfg.groupBy, groupKey) || {};
    const g = groups.find((x) => x.key === groupKey);
    const order = before ? between(prev?.order, before.order) : Math.max(0, ...(g?.tasks || []).map((x) => x.order || 0)) + 1000;
    getState().updateTask(id, { ...p, order });
  };

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden">
      <div className="h-full flex gap-3 p-4 min-w-fit items-start">
        {groups.map((g) => {
          const isCol = collapsed.includes(g.key);
          const over = g.status?.wip && g.tasks.length > g.status.wip;
          if (isCol)
            return (
              <div key={g.key} className="w-10 shrink-0 h-full rounded-lg bg-[var(--subtle)] flex flex-col items-center py-2 gap-2 cursor-pointer" onClick={() => setCollapsed(collapsed.filter((x) => x !== g.key))}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, g.key)}>
                <ChevronsRight size={14} className="text-[var(--muted)]" />
                <span className="text-xs font-semibold [writing-mode:vertical-rl] rotate-180" style={{ color: g.color }}>{g.label} · {g.tasks.length}</span>
              </div>
            );
          return (
            <div key={g.key} className={cn('w-[280px] shrink-0 max-h-full flex flex-col rounded-xl', dragOver === g.key && 'ring-2 ring-[var(--accent)]')}
              style={{ background: alpha(g.color, 0.07) }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(g.key); }} onDragLeave={() => setDragOver(null)} onDrop={(e) => drop(e, g.key)}>
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-2" style={{ borderTop: `3px solid ${g.color}`, borderRadius: '12px 12px 0 0' }}>
                <span className="text-[12px] font-semibold uppercase tracking-wide truncate" style={{ color: g.color }}>{g.label}</span>
                <span className={cn('text-xs', over ? 'text-red-600 font-semibold' : 'text-[var(--muted)]')}>{g.tasks.length}{g.status?.wip ? ` / ${g.status.wip}` : ''}</span>
                <div className="flex-1" />
                <button className="icon-btn !w-6 !h-6" title="Collapse" onClick={() => setCollapsed([...collapsed, g.key])}><ChevronsLeft size={14} /></button>
                <AddCardButton groupKey={g.key} groupBy={cfg.groupBy} listId={listIds.length === 1 ? listIds[0] : g.tasks[0]?.listId || listIds[0]} top />
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[40px]">
                {g.tasks.map((t, i) => <Card key={t.id} t={t} onDrop={(e) => drop(e, g.key, t, g.tasks[i - 1])} ctx={ctx} />)}
                <AddCardButton groupKey={g.key} groupBy={cfg.groupBy} listId={listIds.length === 1 ? listIds[0] : g.tasks[0]?.listId || listIds[0]} />
              </div>
            </div>
          );
        })}
      </div>
      {ctx.node}
    </div>
  );
}

function Card({ t, onDrop, ctx }: { t: Task; onDrop: (e: React.DragEvent) => void; ctx: ReturnType<typeof useContextMenu> }) {
  const [over, setOver] = useState(false);
  const data = useStore((s) => s.data);
  const subs = Object.values(data.task).filter((x) => x.parentId === t.id && !x.archived);
  const closed = isClosed(t);
  const up = (p: Partial<Task>) => getState().updateTask(t.id, p);
  return (
    <div draggable onDragStart={(e) => { e.dataTransfer.setData('application/x-task', t.id); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { setOver(false); onDrop(e); }}
      onClick={() => getState().openTask(t.id)} onContextMenu={(e) => ctx.open(e, taskMenu(t))}
      className={cn('group rounded-lg border bg-[var(--panel)] shadow-[0_1px_2px_rgba(0,0,0,.04)] hover:border-[var(--border-strong)] cursor-pointer overflow-hidden', over && 'shadow-[0_-3px_0_var(--accent)]')}>
      {t.cover && <img src={t.cover} className="h-32 w-full object-cover" alt="" />}
      <div className="p-2.5">
        <div className="flex items-start gap-1.5">
          <span className="text-[11px] text-[var(--faint)] truncate flex-1">{data.list[t.listId]?.name}</span>
          <span onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100">
            <Popover align="end" trigger={<button className="icon-btn !w-5 !h-5"><MoreHorizontal size={13} /></button>}>{(close) => <MenuList items={taskMenu(t)} close={close} />}</Popover>
          </span>
        </div>
        {(t.tags || []).length > 0 && <div className="flex flex-wrap gap-1 mb-1.5">{t.tags.map((x) => <TagChip key={x} name={x} small />)}</div>}
        <div className={cn('text-[13.5px] font-medium leading-snug', closed && 'line-through text-[var(--muted)]')}>{t.name}</div>
        {subs.length > 0 && <div className="mt-1.5 text-[11px] text-[var(--muted)]">↳ {subs.filter(isClosed).length}/{subs.length} subtasks</div>}
        <div className="mt-2.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <AssigneePicker value={t.assignees || []} onChange={(a) => up({ assignees: a })} size={22} />
          <DatePicker value={t.dueDate} onChange={(d) => up({ dueDate: d })} trigger={<button className={cn('inline-flex items-center gap-1 text-xs rounded px-1 hover:bg-[var(--hover)]', dueTone(t.dueDate, closed), !t.dueDate && 'opacity-0 group-hover:opacity-100')}><Calendar size={12} />{t.dueDate ? fmtDue(t.dueDate) : ''}</button>} />
          <PriorityPicker value={t.priority} onChange={(p) => up({ priority: p })} trigger={<button className={cn(!t.priority && 'opacity-0 group-hover:opacity-100')}><PriorityFlag p={t.priority} size={13} /></button>} />
          <div className="flex-1" />
          <TaskBadges t={t} />
        </div>
      </div>
    </div>
  );
}

function AddCardButton({ groupKey, groupBy, listId, top }: { groupKey: string; groupBy?: string; listId: string; top?: boolean }) {
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState('');
  if (!listId) return null;
  const create = () => {
    if (!v.trim()) return;
    const stub = { listId, status: statusesForList(listId)[0]?.id, assignees: [], tags: [], fields: {} } as any;
    getState().createTask({ name: v.trim(), listId, ...(applyGroupChange(stub, groupBy, groupKey) || {}), order: top ? -Date.now() : Date.now() });
    setV('');
  };
  if (top) return <button className="icon-btn !w-6 !h-6" onClick={() => setAdding(true)} title="Add task">{adding ? null : <Plus size={14} />}{adding && <TopInput v={v} setV={setV} create={create} close={() => setAdding(false)} />}</button>;
  if (!adding) return <button className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-[var(--muted)] hover:bg-[var(--hover)]" onClick={() => setAdding(true)}><Plus size={14} /> Add Task</button>;
  return (
    <div className="rounded-lg border bg-[var(--panel)] p-2">
      <textarea autoFocus rows={2} className="w-full bg-transparent outline-none text-[13px] resize-none" placeholder="Task name…" value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); create(); } if (e.key === 'Escape') setAdding(false); }} />
      <div className="flex justify-end gap-1"><button className="btn btn-ghost !py-0.5 !text-xs" onClick={() => setAdding(false)}>Cancel</button><button className="btn btn-primary !py-0.5 !text-xs" onClick={create}>Save</button></div>
    </div>
  );
}

function TopInput({ v, setV, create, close }: { v: string; setV: (s: string) => void; create: () => void; close: () => void }) {
  return (
    <span className="fixed inset-0 z-50 flex items-start justify-center pt-40 bg-black/20" onClick={(e) => { e.stopPropagation(); close(); }}>
      <span className="pop p-3 w-80" onClick={(e) => e.stopPropagation()}>
        <input autoFocus className="input" placeholder="Task name, Enter to add" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { create(); } if (e.key === 'Escape') close(); }} />
      </span>
    </span>
  );
}
