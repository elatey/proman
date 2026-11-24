import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, GripVertical, MoreHorizontal } from 'lucide-react';
import { useStore, getState, statusesForList, statusOf, isClosed } from '../../lib/store';
import { groupTasks, applyFilters, sortTasks } from '../../lib/filters';
import { StatusPicker, StatusIcon, StatusPill, TagChip, Checkbox, useContextMenu, Popover, MenuList, Empty } from '../ui';
import { Cell, colLabel, colWidth, applyGroupChange, taskMenu, TaskBadges, BulkBar } from './shared';
import { DEFAULT_COLUMNS } from './Toolbar';
import { cn, between, alpha, readableText } from '../../lib/utils';
import type { Task } from '../../lib/types';
import type { ViewProps } from '../../pages/LocationPage';

export function ListView({ view, tasks, allTasks, listIds }: ViewProps) {
  const cfg = view.config;
  const cols = cfg.columns || DEFAULT_COLUMNS;
  const mode = cfg.showSubtasks || 'collapsed';
  const [selected, setSelected] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<string[]>(cfg.collapsed || []);
  const ctx = useContextMenu();
  const tops = mode === 'separate' ? tasks : tasks.filter((t) => !t.parentId || !tasks.some((p) => p.id === t.parentId));
  const groups = useMemo(() => groupTasks(tops, cfg.groupBy, listIds), [tops, cfg.groupBy, listIds]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) if (t.parentId) { if (!m.has(t.parentId)) m.set(t.parentId, []); m.get(t.parentId)!.push(t); }
    return m;
  }, [tasks]);
  const toggleSel = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const gridCols = `minmax(320px,1fr) ${cols.map((c) => colWidth(c) + 'px').join(' ')} 36px`;
  const defaultList = listIds.length === 1 ? listIds[0] : undefined;

  if (!listIds.length) return <Empty title="No Lists here yet" body="Create a List from the sidebar to start adding tasks." />;

  return (
    <div className="relative h-full overflow-auto">
      <div className="min-w-fit px-4 pb-24 pt-2">
        {groups.map((g) => {
          const isCol = collapsed.includes(g.key);
          return (
            <div key={g.key} className="mt-4">
              <div className="sticky top-0 z-10 bg-[var(--bg)] flex items-center gap-2 py-1.5 group/h"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('application/x-task');
                  const t = getState().data.task[id];
                  if (!t) return;
                  const p = applyGroupChange(t, cfg.groupBy, g.key);
                  getState().updateTask(id, { ...(p || {}), order: (Math.max(0, ...g.tasks.map((x) => x.order || 0)) + 1000) });
                }}>
                <button className="icon-btn !w-5 !h-5" onClick={() => setCollapsed(isCol ? collapsed.filter((x) => x !== g.key) : [...collapsed, g.key])}>{isCol ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
                {(cfg.groupBy || 'status') === 'status' ? <StatusPill status={g.status} /> : (
                  <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ background: alpha(g.color, 0.16), color: g.color }}>{g.label}</span>
                )}
                <span className="text-xs text-[var(--muted)]">{g.tasks.length}</span>
                {g.status?.wip && g.tasks.length > g.status.wip && <span className="text-[11px] text-red-600">over WIP limit ({g.status.wip})</span>}
                <button className="opacity-0 group-hover/h:opacity-100 text-xs text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1 ml-1" onClick={() => document.getElementById('add-' + view.id + g.key)?.focus()}><Plus size={13} /> Add Task</button>
              </div>
              {!isCol && (
                <div className="rounded-lg border bg-[var(--panel)] overflow-hidden">
                  <div className="grid items-center border-b text-[11.5px] font-medium text-[var(--muted)] bg-[var(--subtle)]" style={{ gridTemplateColumns: gridCols }}>
                    <div className="px-3 py-1.5 pl-12">Name</div>
                    {cols.map((c) => <div key={c} className="px-2 py-1.5 truncate">{colLabel(c)}</div>)}
                    <div />
                  </div>
                  {g.tasks.map((t, i) => (
                    <Row key={t.id + g.key} t={t} depth={0} cols={cols} gridCols={gridCols} mode={mode} childrenOf={childrenOf} groupKey={g.key} groupBy={cfg.groupBy}
                      selected={selected} toggleSel={toggleSel} ctx={ctx} prevOrder={g.tasks[i - 1]?.order} />
                  ))}
                  <AddRow id={'add-' + view.id + g.key} listId={defaultList || g.tasks[0]?.listId || listIds[0]} onCreate={(name, listId) => {
                    const base: Partial<Task> = {};
                    const stub = { listId, status: statusesForList(listId)[0]?.id, assignees: [], tags: [], fields: {} } as any;
                    Object.assign(base, applyGroupChange(stub, cfg.groupBy, g.key) || {});
                    getState().createTask({ name, listId, ...base, order: Math.max(0, ...g.tasks.map((x) => x.order || 0)) + 1000 });
                  }} />
                </div>
              )}
            </div>
          );
        })}
        {!tasks.length && !allTasks.length && <div className="mt-6 text-center text-sm text-[var(--muted)]">No tasks yet. Add one above or press <span className="kbd">T</span>.</div>}
      </div>
      <BulkBar ids={selected.filter((id) => getState().data.task[id])} clear={() => setSelected([])} />
      {ctx.node}
    </div>
  );
}

function Row({ t, depth, cols, gridCols, mode, childrenOf, groupKey, groupBy, selected, toggleSel, ctx, prevOrder }: {
  t: Task; depth: number; cols: string[]; gridCols: string; mode: string; childrenOf: Map<string, Task[]>; groupKey: string; groupBy?: string;
  selected: string[]; toggleSel: (id: string) => void; ctx: ReturnType<typeof useContextMenu>; prevOrder?: number;
}) {
  const kids = mode === 'separate' ? [] : (childrenOf.get(t.id) || []).sort((a, b) => (a.order || 0) - (b.order || 0));
  const [open, setOpen] = useState(mode === 'expanded');
  const [over, setOver] = useState<'top' | null>(null);
  const [adding, setAdding] = useState(false);
  const sel = selected.includes(t.id);
  const st = statusOf(t);
  const closed = isClosed(t);
  return (
    <>
      <div
        className={cn('group grid items-center border-b last:border-b-0 min-h-[38px] hover-row', sel && '!bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]', over && 'shadow-[inset_0_2px_0_var(--accent)]')}
        style={{ gridTemplateColumns: gridCols }}
        draggable
        onDragStart={(e) => { e.dataTransfer.setData('application/x-task', t.id); e.dataTransfer.effectAllowed = 'move'; }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-task')) { e.preventDefault(); setOver('top'); } }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          e.preventDefault(); e.stopPropagation(); setOver(null);
          const id = e.dataTransfer.getData('application/x-task');
          if (!id || id === t.id) return;
          const dragged = getState().data.task[id];
          if (!dragged) return;
          const p = applyGroupChange(dragged, groupBy, groupKey) || {};
          getState().updateTask(id, { ...p, order: between(prevOrder, t.order), parentId: t.parentId || null, ...(dragged.listId !== t.listId && !(p as any).listId ? { listId: t.listId } : {}) });
        }}
        onContextMenu={(e) => ctx.open(e, taskMenu(t))}
        onClick={() => getState().openTask(t.id)}
      >
        <div className="flex items-center gap-1.5 min-w-0 pr-2" style={{ paddingLeft: 6 + depth * 22 }}>
          <span className="w-4 flex justify-center opacity-0 group-hover:opacity-100 cursor-grab text-[var(--faint)]" onClick={(e) => e.stopPropagation()}><GripVertical size={13} /></span>
          <span className={cn('w-4 flex', !sel && 'opacity-0 group-hover:opacity-100')} onClick={(e) => e.stopPropagation()}><Checkbox checked={sel} onChange={() => toggleSel(t.id)} /></span>
          <button className={cn('w-4 flex justify-center text-[var(--muted)]', !kids.length && 'invisible')} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
          <span onClick={(e) => e.stopPropagation()} className="flex">
            <StatusPicker listId={t.listId} value={t.status} onChange={(id) => getState().updateTask(t.id, { status: id })} trigger={<button className="flex"><StatusIcon status={st} size={15} /></button>} />
          </span>
          <span className={cn('truncate text-[13.5px]', closed && 'line-through text-[var(--muted)]')}>{t.name}</span>
          {t.type && t.type !== 'task' && <span className="text-[10px] uppercase rounded bg-[var(--subtle)] border px-1 text-[var(--muted)]">{t.type}</span>}
          {kids.length > 0 && <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="text-[11px] text-[var(--muted)] rounded border px-1 hover:bg-[var(--hover)]">↳ {kids.length}</button>}
          {!cols.includes('tags') && (t.tags || []).slice(0, 3).map((x) => <TagChip key={x} name={x} small />)}
          <TaskBadges t={t} />
          <button className="opacity-0 group-hover:opacity-100 icon-btn !w-5 !h-5 shrink-0" title="Add subtask" onClick={(e) => { e.stopPropagation(); setAdding(true); setOpen(true); }}><Plus size={12} /></button>
        </div>
        {cols.map((c) => <div key={c} className="px-2 min-w-0 flex items-center" onClick={(e) => e.stopPropagation()}><Cell col={c} t={t} /></div>)}
        <div onClick={(e) => e.stopPropagation()} className="flex justify-center">
          <Popover align="end" trigger={<button className="icon-btn !w-6 !h-6 opacity-0 group-hover:opacity-100"><MoreHorizontal size={14} /></button>}>{(close) => <MenuList items={taskMenu(t)} close={close} />}</Popover>
        </div>
      </div>
      {open && kids.map((k, i) => <Row key={k.id} t={k} depth={depth + 1} cols={cols} gridCols={gridCols} mode={mode} childrenOf={childrenOf} groupKey={groupKey} groupBy={undefined} selected={selected} toggleSel={toggleSel} ctx={ctx} prevOrder={kids[i - 1]?.order} />)}
      {adding && (
        <div className="border-b" style={{ paddingLeft: 60 + (depth + 1) * 22 }}>
          <input autoFocus className="w-full bg-transparent outline-none text-[13px] py-2" placeholder="Subtask name, Enter to save" onBlur={() => setAdding(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setAdding(false);
              if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) { getState().createTask({ name: (e.target as HTMLInputElement).value.trim(), listId: t.listId, parentId: t.id }); (e.target as HTMLInputElement).value = ''; }
            }} />
        </div>
      )}
    </>
  );
}

function AddRow({ id, listId, onCreate }: { id: string; listId: string; onCreate: (name: string, listId: string) => void }) {
  const [v, setV] = useState('');
  const lists = useStore((s) => s.data.list);
  const [lid, setLid] = useState(listId);
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-[13px]">
      <Plus size={14} className="text-[var(--faint)] ml-9" />
      <input id={id} className="flex-1 bg-transparent outline-none py-1" placeholder="Add Task" value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) { onCreate(v.trim(), lid || listId); setV(''); } if (e.key === 'Escape') { setV(''); (e.target as HTMLInputElement).blur(); } }} />
      {v && (
        <>
          <select className="text-xs bg-transparent text-[var(--muted)] outline-none max-w-[160px]" value={lid || listId} onChange={(e) => setLid(e.target.value)}>
            {Object.values(lists).filter((l) => !l.archived).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button className="btn btn-primary !py-0.5 !text-xs" onClick={() => { onCreate(v.trim(), lid || listId); setV(''); }}>Save</button>
        </>
      )}
    </div>
  );
}
