import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, PanelRight, Plus } from 'lucide-react';
import { addDays, addMonths, addWeeks, differenceInCalendarDays, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfDay, startOfMonth, startOfWeek, formatISO, setHours, getHours } from 'date-fns';
import { getState, statusOf, isClosed } from '../../lib/store';
import { StatusIcon, useContextMenu } from '../ui';
import { taskMenu } from './shared';
import { cn, alpha, toDate } from '../../lib/utils';
import type { Task } from '../../lib/types';
import type { ViewProps } from '../../pages/LocationPage';

export default function CalendarView({ view, tasks, listIds }: ViewProps) {
  const cfg = view.config;
  const mode = cfg.calendarMode || 'month';
  const setMode = (m: 'month' | 'week' | 'day') => getState().update('view', view.id, { config: { ...cfg, calendarMode: m } });
  const [cursor, setCursor] = useState(startOfDay(new Date()));
  const [side, setSide] = useState(false);
  const ctx = useContextMenu();
  const visible = cfg.showSubtasks === 'separate' ? tasks : tasks.filter((t) => !t.parentId);
  const unscheduled = visible.filter((t) => !t.dueDate && !t.startDate);

  const days: Date[] = [];
  if (mode === 'month') for (let d = startOfWeek(startOfMonth(cursor)); d <= endOfWeek(endOfMonth(cursor)); d = addDays(d, 1)) days.push(d);
  else if (mode === 'week') for (let d = startOfWeek(cursor); d <= endOfWeek(cursor); d = addDays(d, 1)) days.push(d);
  else days.push(cursor);

  const onDay = (d: Date) => visible.filter((t) => {
    const s = toDate(t.startDate), e = toDate(t.dueDate);
    if (s && e) return d >= startOfDay(s) && d <= startOfDay(e);
    return (e && isSameDay(e, d)) || (s && isSameDay(s, d));
  });

  const dropOn = (e: React.DragEvent, d: Date, hour?: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('application/x-task');
    const t = getState().data.task[id];
    if (!t) return;
    const target = hour != null ? setHours(startOfDay(d), hour) : startOfDay(d);
    const due = toDate(t.dueDate);
    if (!due) { getState().updateTask(id, { dueDate: formatISO(target), dueTime: hour != null }); return; }
    const delta = differenceInCalendarDays(target, due);
    const start = toDate(t.startDate);
    getState().updateTask(id, { dueDate: formatISO(hour != null ? target : addDays(due, delta)), startDate: start ? formatISO(addDays(start, delta)) : t.startDate, dueTime: hour != null ? true : t.dueTime });
  };
  const quickAdd = (d: Date) => {
    const name = prompt(`New task on ${format(d, 'MMM d')}`);
    if (name) getState().createTask({ name, listId: listIds[0], dueDate: formatISO(startOfDay(d)) });
  };
  const nav = (n: number) => setCursor(mode === 'month' ? addMonths(cursor, n) : mode === 'week' ? addWeeks(cursor, n) : addDays(cursor, n));

  return (
    <div className="relative h-full flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 border-b">
          <button className="btn btn-outline !py-1" onClick={() => setCursor(startOfDay(new Date()))}>Today</button>
          <button className="icon-btn" onClick={() => nav(-1)}><ChevronLeft size={16} /></button>
          <button className="icon-btn" onClick={() => nav(1)}><ChevronRight size={16} /></button>
          <span className="font-semibold text-[15px]">{mode === 'day' ? format(cursor, 'EEEE, MMMM d, yyyy') : mode === 'week' ? `${format(days[0], 'MMM d')} – ${format(days[6], 'MMM d, yyyy')}` : format(cursor, 'MMMM yyyy')}</span>
          <div className="flex-1" />
          <div className="flex rounded-lg border p-0.5">
            {(['day', 'week', 'month'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={cn('px-2.5 py-0.5 rounded-md text-[13px] capitalize', mode === m ? 'bg-[var(--hover)] font-medium' : 'text-[var(--muted)]')}>{m}</button>)}
          </div>
          <button className={cn('btn !py-1', side ? 'btn-primary' : 'btn-outline')} onClick={() => setSide(!side)} aria-label="Unscheduled tasks"><PanelRight size={14} /> <span className="hidden sm:inline">Unscheduled</span> ({unscheduled.length})</button>
        </div>
        {mode === 'day' ? (
          <div className="flex-1 overflow-y-auto">
            <div className="border-b px-4 py-2 flex flex-wrap gap-1" onDragOver={(e) => e.preventDefault()} onDrop={(e) => dropOn(e, cursor)}>
              <span className="text-xs text-[var(--muted)] w-14">All day</span>
              {onDay(cursor).filter((t) => !t.dueTime).map((t) => <Chip key={t.id} t={t} ctx={ctx} />)}
            </div>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="flex border-b min-h-[44px]" onDragOver={(e) => e.preventDefault()} onDrop={(e) => dropOn(e, cursor, h)} onDoubleClick={() => quickAdd(setHours(cursor, h))}>
                <div className="w-16 shrink-0 text-right pr-2 pt-1 text-[11px] text-[var(--faint)]">{format(setHours(cursor, h), 'h a')}</div>
                <div className="flex-1 p-1 flex flex-wrap gap-1 border-l">{onDay(cursor).filter((t) => t.dueTime && getHours(new Date(t.dueDate!)) === h).map((t) => <Chip key={t.id} t={t} ctx={ctx} wide />)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="grid grid-cols-7 border-b text-[12px] text-[var(--muted)]">{days.slice(0, 7).map((d) => <div key={d.toISOString()} className="px-2 py-1.5">{format(d, 'EEE')}</div>)}</div>
            <div className={cn('flex-1 grid grid-cols-7 min-h-0', mode === 'month' ? 'auto-rows-fr' : '')}>
              {days.map((d) => {
                const items = onDay(d);
                return (
                  <div key={d.toISOString()} className={cn('group border-r border-b p-1 min-h-0 overflow-hidden flex flex-col', mode === 'month' && !isSameMonth(d, cursor) && 'bg-[var(--subtle)]')}
                    onDragOver={(e) => e.preventDefault()} onDrop={(e) => dropOn(e, d)} onDoubleClick={() => quickAdd(d)}>
                    <div className="flex items-center justify-between px-1">
                      <span className={cn('text-[12px] w-6 h-6 flex items-center justify-center rounded-full', isToday(d) ? 'bg-accent font-semibold' : 'text-[var(--muted)]')}>{format(d, 'd')}</span>
                      <button className="opacity-0 group-hover:opacity-100 icon-btn !w-5 !h-5" onClick={() => quickAdd(d)}><Plus size={12} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-0.5 mt-0.5">
                      {items.slice(0, mode === 'month' ? 4 : 50).map((t) => <Chip key={t.id} t={t} ctx={ctx} />)}
                      {mode === 'month' && items.length > 4 && <button className="text-[11px] text-[var(--muted)] px-1 hover:underline" onClick={() => { setCursor(d); setMode('day'); }}>+{items.length - 4} more</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {side && (
        <div className="absolute md:static inset-y-0 right-0 z-30 w-[80%] max-w-xs md:w-64 shrink-0 border-l flex flex-col bg-[var(--subtle)] shadow-xl md:shadow-none">
          <div className="px-3 py-2.5 text-[13px] font-semibold border-b">Unscheduled tasks</div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="text-[11px] text-[var(--muted)] px-1 pb-1">Drag a task onto the calendar to schedule it.</div>
            {unscheduled.map((t) => <Chip key={t.id} t={t} ctx={ctx} wide />)}
          </div>
        </div>
      )}
      {ctx.node}
    </div>
  );
}

function Chip({ t, ctx, wide }: { t: Task; ctx: ReturnType<typeof useContextMenu>; wide?: boolean }) {
  const st = statusOf(t);
  const color = st?.color || '#8E8C99';
  return (
    <div draggable onDragStart={(e) => e.dataTransfer.setData('application/x-task', t.id)} onClick={(e) => { e.stopPropagation(); getState().openTask(t.id); }}
      onContextMenu={(e) => ctx.open(e, taskMenu(t))} onDoubleClick={(e) => e.stopPropagation()}
      className={cn('flex items-center gap-1 rounded px-1.5 py-[3px] text-[12px] cursor-pointer truncate hover:brightness-95', wide && 'w-full', isClosed(t) && 'opacity-60 line-through')}
      style={{ background: alpha(color, 0.15), borderLeft: `3px solid ${color}` }} title={t.name}>
      <StatusIcon status={st} size={11} />
      {t.dueTime && t.dueDate && <span className="text-[10px] text-[var(--muted)]">{format(new Date(t.dueDate), 'h:mma').toLowerCase()}</span>}
      <span className="truncate">{t.name}</span>
    </div>
  );
}
