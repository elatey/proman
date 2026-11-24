import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Diamond, Crosshair } from 'lucide-react';
import { addDays, differenceInCalendarDays, format, startOfDay, formatISO, isWeekend, startOfMonth, isSameDay } from 'date-fns';
import { useStore, getState, statusOf, isClosed } from '../../lib/store';
import { groupTasks } from '../../lib/filters';
import { StatusIcon, Avatar, useContextMenu } from '../ui';
import { taskMenu } from './shared';
import { autoProgress } from '../task/FieldValue';
import { cn, toDate, alpha } from '../../lib/utils';
import type { Task } from '../../lib/types';
import type { ViewProps } from '../../pages/LocationPage';

const ROW = 34;
const LEFT = 300;

type Row = { kind: 'group'; key: string; label: string; color: string; count: number } | { kind: 'task'; t: Task; depth: number };

export default function GanttView({ view, tasks, listIds, timeline }: ViewProps & { timeline?: boolean }) {
  const cfg = view.config;
  const scale = cfg.ganttScale || 'day';
  const dayW = scale === 'day' ? 36 : scale === 'week' ? 14 : 5;
  const links = useStore((s) => s.data.link);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [drag, setDrag] = useState<{ id: string; mode: 'move' | 'left' | 'right'; x0: number; dx: number } | null>(null);
  const [linkDrag, setLinkDrag] = useState<{ from: string; x: number; y: number; x2: number; y2: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const ctx = useContextMenu();
  const groupBy = timeline ? (cfg.groupBy && cfg.groupBy !== 'status' ? cfg.groupBy : 'assignee') : cfg.groupBy || 'list';
  const showSubs = cfg.showSubtasks !== 'collapsed' || timeline;

  const tops = tasks.filter((t) => !t.parentId || !tasks.some((p) => p.id === t.parentId));
  const groups = useMemo(() => groupTasks(tops, groupBy, listIds, false), [tops, groupBy, listIds]);
  const rows: Row[] = [];
  for (const g of groups) {
    if (!g.tasks.length) continue;
    rows.push({ kind: 'group', key: g.key, label: g.label, color: g.color, count: g.tasks.length });
    if (collapsed.includes(g.key)) continue;
    const add = (t: Task, depth: number) => {
      rows.push({ kind: 'task', t, depth });
      if (showSubs && !timeline) tasks.filter((x) => x.parentId === t.id).forEach((x) => add(x, depth + 1));
    };
    g.tasks.forEach((t) => add(t, 0));
  }

  // range
  const dated = tasks.flatMap((t) => [toDate(t.startDate), toDate(t.dueDate)]).filter(Boolean) as Date[];
  const today = startOfDay(new Date());
  const min = dated.length ? new Date(Math.min(today.getTime(), ...dated.map((d) => d.getTime()))) : today;
  const max = dated.length ? new Date(Math.max(today.getTime(), ...dated.map((d) => d.getTime()))) : today;
  const start = addDays(startOfMonth(addDays(min, -7)), 0);
  const end = addDays(max, scale === 'day' ? 45 : 120);
  const nDays = differenceInCalendarDays(end, start) + 1;
  const xOf = (d: Date) => differenceInCalendarDays(d, start) * dayW;

  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = Math.max(0, xOf(today) - 200); }, [scale]);

  // drag handling
  useEffect(() => {
    if (!drag) return;
    const move = (e: MouseEvent) => setDrag((d) => (d ? { ...d, dx: e.clientX - d.x0 } : d));
    const up = () => {
      setDrag((d) => {
        if (d) {
          const days = Math.round(d.dx / dayW);
          const t = getState().data.task[d.id];
          if (t && days) {
            const s0 = toDate(t.startDate) || toDate(t.dueDate)!;
            const e0 = toDate(t.dueDate) || s0;
            let s1 = s0, e1 = e0;
            if (d.mode === 'move') { s1 = addDays(s0, days); e1 = addDays(e0, days); }
            if (d.mode === 'left') s1 = addDays(s0, Math.min(days, differenceInCalendarDays(e0, s0)));
            if (d.mode === 'right') e1 = addDays(e0, Math.max(days, -differenceInCalendarDays(e0, s0)));
            getState().updateTask(d.id, { startDate: formatISO(s1), dueDate: formatISO(e1) });
            if (d.mode !== 'left') rescheduleDependents(d.id, differenceInCalendarDays(e1, e0));
          }
        }
        return null;
      });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [!!drag, dayW]);

  useEffect(() => {
    if (!linkDrag) return;
    const rect = () => scroller.current!.getBoundingClientRect();
    const move = (e: MouseEvent) => setLinkDrag((l) => (l ? { ...l, x2: e.clientX - rect().left + scroller.current!.scrollLeft, y2: e.clientY - rect().top + scroller.current!.scrollTop } : l));
    const up = (e: MouseEvent) => {
      const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement)?.closest('[data-bar]') as HTMLElement | null;
      setLinkDrag((l) => {
        if (l && el && el.dataset.bar && el.dataset.bar !== l.from) {
          const exists = Object.values(getState().data.link).some((x) => x.from === l.from && x.to === el.dataset.bar);
          if (!exists) { getState().create('link', { from: l.from, to: el.dataset.bar, type: 'blocks' }); getState().toast('Dependency added', 'success'); }
        }
        return null;
      });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [!!linkDrag]);

  const barGeom = (t: Task) => {
    let s = toDate(t.startDate), e = toDate(t.dueDate);
    if (!s && !e) return null;
    s = startOfDay(s || e!); e = startOfDay(e || s);
    let x = xOf(s), w = (differenceInCalendarDays(e, s) + 1) * dayW;
    if (drag?.id === t.id) {
      const dd = Math.round(drag.dx / dayW) * dayW;
      if (drag.mode === 'move') x += dd;
      if (drag.mode === 'left') { x += Math.min(dd, w - dayW); w -= Math.min(dd, w - dayW); }
      if (drag.mode === 'right') w = Math.max(dayW, w + dd);
    }
    return { x, w };
  };
  const rowIndex = new Map<string, number>();
  rows.forEach((r, i) => r.kind === 'task' && rowIndex.set(r.t.id, i));
  const headerH = 48;

  const setScale = (s: 'day' | 'week' | 'month') => getState().update('view', view.id, { config: { ...cfg, ganttScale: s } });

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-1.5 border-b text-[13px]">
        <button className="btn btn-outline !py-1" onClick={() => scroller.current && (scroller.current.scrollLeft = Math.max(0, xOf(today) - 200))}><Crosshair size={13} /> Today</button>
        <span className="text-xs text-[var(--muted)]">Drag bars to reschedule · drag edges to resize · drag the dot at a bar's end onto another bar to add a dependency</span>
        <div className="flex-1" />
        <div className="flex rounded-lg border p-0.5">
          {(['day', 'week', 'month'] as const).map((m) => <button key={m} onClick={() => setScale(m)} className={cn('px-2.5 py-0.5 rounded-md capitalize', scale === m ? 'bg-[var(--hover)] font-medium' : 'text-[var(--muted)]')}>{m}</button>)}
        </div>
      </div>
      <div ref={scroller} className="flex-1 overflow-auto relative select-none">
        <div style={{ width: LEFT + nDays * dayW, height: headerH + rows.length * ROW + 40 }} className="relative">
          {/* header */}
          <div className="sticky top-0 z-20 flex bg-[var(--panel)] border-b" style={{ height: headerH }}>
            <div className="sticky left-0 z-30 bg-[var(--panel)] border-r flex items-end px-3 pb-1.5 text-[11.5px] font-medium text-[var(--muted)]" style={{ width: LEFT, minWidth: LEFT }}>Task</div>
            <div className="relative" style={{ width: nDays * dayW }}>
              {Array.from({ length: nDays }, (_, i) => {
                const d = addDays(start, i);
                const showMonth = d.getDate() === 1 || i === 0;
                const showDay = scale === 'day' || (scale === 'week' && d.getDay() === 1);
                return (
                  <div key={i} className="absolute top-0 bottom-0" style={{ left: i * dayW, width: dayW }}>
                    {showMonth && <div className="absolute top-1 left-1 text-[11px] font-semibold whitespace-nowrap">{format(d, 'MMMM yyyy')}</div>}
                    {showDay && <div className={cn('absolute bottom-1 left-0 text-[10.5px] whitespace-nowrap', scale === 'day' ? 'w-full text-center' : 'pl-0.5', isSameDay(d, today) ? 'text-accent font-bold' : 'text-[var(--faint)]')}>{scale === 'day' ? format(d, 'EEEEE d') : format(d, 'MMM d')}</div>}
                  </div>
                );
              })}
            </div>
          </div>
          {/* grid background */}
          <div className="absolute left-0 right-0" style={{ top: headerH, height: rows.length * ROW }}>
            <div className="absolute top-0 bottom-0" style={{ left: LEFT, width: nDays * dayW }}>
              {scale === 'day' && Array.from({ length: nDays }, (_, i) => isWeekend(addDays(start, i)) && <div key={i} className="absolute top-0 bottom-0 bg-[var(--subtle)]" style={{ left: i * dayW, width: dayW }} />)}
              <div className="absolute top-0 bottom-0 w-0.5 bg-[var(--accent)] z-10" style={{ left: xOf(today) + dayW / 2 }} />
            </div>
          </div>
          {/* rows */}
          <div className="absolute left-0" style={{ top: headerH }}>
            {rows.map((r, i) => r.kind === 'group' ? (
              <div key={'g' + r.key} className="flex border-b bg-[var(--subtle)]" style={{ height: ROW, width: LEFT + nDays * dayW }}>
                <button className="sticky left-0 z-10 bg-[var(--subtle)] border-r flex items-center gap-2 px-2 text-[12px] font-semibold" style={{ width: LEFT, minWidth: LEFT }} onClick={() => setCollapsed(collapsed.includes(r.key) ? collapsed.filter((x) => x !== r.key) : [...collapsed, r.key])}>
                  {collapsed.includes(r.key) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  {groupBy === 'assignee' && r.key !== '__none' ? <Avatar id={r.key} size={18} /> : <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />}
                  <span className="truncate">{r.label}</span><span className="text-[var(--faint)] font-normal">{r.count}</span>
                </button>
              </div>
            ) : (
              <TaskRow key={r.t.id} t={r.t} depth={r.depth} geom={barGeom(r.t)} dayW={dayW} nDays={nDays} ctx={ctx}
                onBarDown={(mode, e) => { e.stopPropagation(); setDrag({ id: r.t.id, mode, x0: e.clientX, dx: 0 }); }}
                onLinkDown={(e, x, y) => { e.stopPropagation(); setLinkDrag({ from: r.t.id, x, y: headerH + i * ROW + ROW / 2, x2: x, y2: headerH + i * ROW + ROW / 2 }); }}
                onSchedule={(dayIdx) => getState().updateTask(r.t.id, { startDate: formatISO(addDays(start, dayIdx)), dueDate: formatISO(addDays(start, dayIdx + 2)) })}
                rowTop={headerH + i * ROW} />
            ))}
          </div>
          {/* dependency arrows */}
          <svg className="absolute left-0 top-0 pointer-events-none z-[15]" width={LEFT + nDays * dayW} height={headerH + rows.length * ROW + 40}>
            <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--muted)" /></marker>
              <marker id="arr-bad" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#E5484D" /></marker></defs>
            {Object.values(links).filter((l) => l.type === 'blocks').map((l) => {
              const a = getState().data.task[l.from], b = getState().data.task[l.to];
              const ia = rowIndex.get(l.from), ib = rowIndex.get(l.to);
              if (!a || !b || ia == null || ib == null) return null;
              const ga = barGeom(a), gb = barGeom(b);
              if (!ga || !gb) return null;
              const x1 = LEFT + ga.x + ga.w, y1 = headerH + ia * ROW + ROW / 2;
              const x2 = LEFT + gb.x, y2 = headerH + ib * ROW + ROW / 2;
              const bad = x2 < x1 - 1;
              const mid = Math.max(x1 + 10, Math.min(x2 - 10, x1 + 10));
              const d = x2 > x1 + 20 ? `M${x1},${y1} H${mid} V${y2} H${x2 - 2}` : `M${x1},${y1} h10 V${(y1 + y2) / 2} H${x2 - 12} V${y2} H${x2 - 2}`;
              return <path key={l.id} d={d} fill="none" stroke={bad ? '#E5484D' : 'var(--muted)'} strokeWidth={1.4} markerEnd={`url(#${bad ? 'arr-bad' : 'arr'})`} opacity={0.85} />;
            })}
            {linkDrag && <line x1={LEFT + linkDrag.x} y1={linkDrag.y} x2={linkDrag.x2} y2={linkDrag.y2} stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" />}
          </svg>
        </div>
      </div>
      {ctx.node}
    </div>
  );
}

function TaskRow({ t, depth, geom, dayW, nDays, ctx, onBarDown, onLinkDown, onSchedule, rowTop }: {
  t: Task; depth: number; geom: { x: number; w: number } | null; dayW: number; nDays: number; ctx: ReturnType<typeof useContextMenu>;
  onBarDown: (m: 'move' | 'left' | 'right', e: React.MouseEvent) => void; onLinkDown: (e: React.MouseEvent, x: number, y: number) => void; onSchedule: (dayIdx: number) => void; rowTop: number;
}) {
  const st = statusOf(t);
  const color = st?.color || '#8E8C99';
  const milestone = t.type === 'milestone';
  const progress = isClosed(t) ? 100 : autoProgress(t);
  return (
    <div className="group flex border-b hover:bg-[var(--subtle)]/60" style={{ height: ROW, width: LEFT + nDays * dayW }} onContextMenu={(e) => ctx.open(e, taskMenu(t))}>
      <div className="sticky left-0 z-10 bg-[var(--panel)] group-hover:bg-[var(--subtle)] border-r flex items-center gap-1.5 pr-2 text-[13px] cursor-pointer" style={{ width: LEFT, minWidth: LEFT, paddingLeft: 10 + depth * 18 }} onClick={() => getState().openTask(t.id)}>
        <StatusIcon status={st} size={13} />
        {milestone && <Diamond size={12} className="text-[var(--muted)]" />}
        <span className={cn('truncate flex-1', isClosed(t) && 'line-through text-[var(--muted)]')}>{t.name}</span>
        <span className="flex -space-x-1">{(t.assignees || []).slice(0, 2).map((a) => <Avatar key={a} id={a} size={18} ring />)}</span>
      </div>
      <div className="relative flex-1" onDoubleClick={(e) => { if (geom) return; const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); onSchedule(Math.floor((e.clientX - r.left) / dayW)); }}>
        {!geom && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[var(--faint)] opacity-0 group-hover:opacity-100 sticky">Double-click the timeline to schedule</span>}
        {geom && (milestone ? (
          <div data-bar={t.id} className="absolute top-1/2 cursor-grab" style={{ left: geom.x + geom.w - dayW / 2 - 9, marginTop: -9 }} onMouseDown={(e) => onBarDown('move', e)} onClick={() => getState().openTask(t.id)}>
            <div className="w-[18px] h-[18px] rotate-45 rounded-[3px] shadow" style={{ background: color }} />
            <span className="absolute left-7 top-0 text-[11px] whitespace-nowrap font-medium">{t.name}</span>
          </div>
        ) : (
          <div data-bar={t.id} className="absolute top-[6px] h-[22px] rounded-md shadow-sm cursor-grab active:cursor-grabbing flex items-center overflow-visible"
            style={{ left: geom.x, width: geom.w, background: alpha(color, 0.25), border: `1px solid ${alpha(color, 0.7)}` }}
            onMouseDown={(e) => onBarDown('move', e)} onDoubleClick={() => getState().openTask(t.id)}>
            <div className="absolute left-0 top-0 bottom-0 rounded-l-md" style={{ width: `${progress}%`, background: alpha(color, 0.55) }} />
            <span className="relative px-2 text-[11.5px] font-medium truncate">{geom.w > 60 ? t.name : ''}</span>
            <span className="absolute -left-0.5 top-0 bottom-0 w-2 cursor-ew-resize" onMouseDown={(e) => onBarDown('left', e)} />
            <span className="absolute -right-0.5 top-0 bottom-0 w-2 cursor-ew-resize" onMouseDown={(e) => onBarDown('right', e)} />
            <span className="absolute -right-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 bg-[var(--panel)] opacity-0 group-hover:opacity-100 cursor-crosshair" style={{ borderColor: color }}
              onMouseDown={(e) => onLinkDown(e, geom.x + geom.w + 12, rowTop)} title="Drag to another task to create a dependency" />
            {geom.w <= 60 && <span className="absolute left-full ml-5 text-[11px] whitespace-nowrap text-[var(--muted)]">{t.name}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Reschedule dependencies": shift tasks that wait on this one by the same delta. */
function rescheduleDependents(id: string, delta: number, seen = new Set<string>()) {
  if (!delta || seen.has(id)) return;
  seen.add(id);
  const s = getState();
  if (s.workspace?.settings?.clickApps?.dependencies === false) return;
  for (const l of Object.values(s.data.link)) {
    if (l.type !== 'blocks' || l.from !== id) continue;
    const t = s.data.task[l.to];
    if (!t || (!t.startDate && !t.dueDate)) continue;
    s.updateTask(t.id, {
      startDate: t.startDate ? formatISO(addDays(new Date(t.startDate), delta)) : t.startDate,
      dueDate: t.dueDate ? formatISO(addDays(new Date(t.dueDate), delta)) : t.dueDate,
    }, { silent: true });
    rescheduleDependents(t.id, delta, seen);
  }
}
