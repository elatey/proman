import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react';
import { addDays, format, isSameDay, isToday, startOfWeek, startOfDay, setHours, getHours, getMinutes, differenceInMinutes, addMinutes } from 'date-fns';
import { useStore, getState, statusOf, isClosed } from '../lib/store';
import { StatusIcon, SearchInput, useIsMobile } from '../components/ui';
import { cn, alpha } from '../lib/utils';
import type { Task } from '../lib/types';

const HOUR = 48;
const START_H = 6, END_H = 22;

export default function Planner() {
  const tasks = useStore((s) => s.data.task);
  const blocks = useStore((s) => s.data.block);
  const me = useStore((s) => s.user!.id);
  const mobile = useIsMobile();
  const span = mobile ? 3 : 7; // phones: 3 readable day columns instead of 7 cramped ones
  const home = () => (mobile ? startOfDay(new Date()) : startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weekStart, setWeekStart] = useState(home);
  const [q, setQ] = useState('');
  const days = Array.from({ length: span }, (_, i) => addDays(weekStart, i));
  const mine = Object.values(tasks).filter((t) => !t.archived && !isClosed(t) && t.assignees?.includes(me));
  const myBlocks = Object.values(blocks).filter((b) => b.user === me);
  const scheduled = new Set(myBlocks.map((b) => b.taskId));
  const backlog = mine.filter((t) => !scheduled.has(t.id) && t.name.toLowerCase().includes(q.toLowerCase()));
  const lineup: string[] = JSON.parse(localStorage.getItem('proman.lineup.' + me) || '[]');
  const prio = lineup.map((id) => tasks[id]).filter(Boolean);
  const timed = mine.filter((t) => t.dueDate && t.dueTime);
  const drop = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mins = Math.round(((e.clientY - rect.top) / HOUR) * 60 / 15) * 15 + START_H * 60;
    const start = addMinutes(startOfDay(day), mins);
    const blockId = e.dataTransfer.getData('application/x-block');
    if (blockId) {
      const b = blocks[blockId];
      const len = differenceInMinutes(new Date(b.end), new Date(b.start));
      getState().update('block', blockId, { start: start.toISOString(), end: addMinutes(start, len).toISOString() });
      return;
    }
    const id = e.dataTransfer.getData('application/x-task');
    const t = tasks[id];
    if (!t) return;
    const len = Math.max(30, Math.min(240, t.estimate || 60));
    getState().create('block', { user: me, taskId: id, title: t.name, start: start.toISOString(), end: addMinutes(start, len).toISOString(), private: true });
  };
  const Item = ({ t }: { t: Task }) => (
    <div draggable onDragStart={(e) => e.dataTransfer.setData('application/x-task', t.id)} onClick={() => getState().openTask(t.id)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-[var(--hover)] cursor-grab">
      <StatusIcon status={statusOf(t)} size={13} /><span className="truncate">{t.name}</span>
    </div>
  );
  return (
    <div className="h-full flex">
      <div className="hidden md:flex w-64 shrink-0 border-r bg-[var(--sidebar)] flex-col">
        <div className="h-12 flex items-center px-4 border-b font-semibold gap-2"><CalendarDays size={16} /> Planner</div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-[11.5px] font-semibold text-[var(--muted)] px-2 py-1">Priorities</div>
          {prio.map((t) => <Item key={t.id} t={t} />)}
          {!prio.length && <div className="text-xs text-[var(--faint)] px-2 pb-2">Add tasks to your LineUp on Home.</div>}
          <div className="text-[11.5px] font-semibold text-[var(--muted)] px-2 py-1 mt-3">Assigned to me (not scheduled)</div>
          <div className="px-1 pb-1"><SearchInput value={q} onChange={setQ} placeholder="Filter…" /></div>
          {backlog.map((t) => <Item key={t.id} t={t} />)}
          <div className="text-[11px] text-[var(--faint)] px-2 pt-3">Drag tasks onto the calendar to block time for them.</div>
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-12 flex items-center gap-2 px-4 border-b">
          <button className="btn btn-outline !py-1" onClick={() => setWeekStart(home())}>Today</button>
          <button className="icon-btn coarse:!w-10 coarse:!h-10" aria-label="Previous" onClick={() => setWeekStart(addDays(weekStart, -span))}><ChevronLeft size={16} /></button>
          <button className="icon-btn coarse:!w-10 coarse:!h-10" aria-label="Next" onClick={() => setWeekStart(addDays(weekStart, span))}><ChevronRight size={16} /></button>
          <span className="font-semibold">{format(weekStart, 'MMMM yyyy')}</span>
        </div>
        <div className="flex border-b">
          <div className="w-14 shrink-0" />
          {days.map((d) => <div key={d.toISOString()} className={cn('flex-1 text-center py-2 text-[13px]', isToday(d) ? 'text-accent font-semibold' : 'text-[var(--muted)]')}>{format(d, 'EEE d')}</div>)}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="flex relative" style={{ height: (END_H - START_H) * HOUR }}>
            <div className="w-14 shrink-0 relative">{Array.from({ length: END_H - START_H }, (_, i) => <div key={i} className="absolute right-2 text-[10.5px] text-[var(--faint)]" style={{ top: i * HOUR - 6 }}>{format(setHours(new Date(), START_H + i), 'h a')}</div>)}</div>
            {days.map((d) => (
              <div key={d.toISOString()} className={cn('flex-1 relative border-l', isToday(d) && 'bg-[color-mix(in_srgb,var(--accent)_4%,transparent)]')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, d)}>
                {Array.from({ length: END_H - START_H }, (_, i) => <div key={i} className="absolute left-0 right-0 border-t border-[var(--border)]/60" style={{ top: i * HOUR }} />)}
                {isToday(d) && <div className="absolute left-0 right-0 h-0.5 bg-red-500 z-10" style={{ top: ((getHours(new Date()) - START_H) * 60 + getMinutes(new Date())) / 60 * HOUR }} />}
                {myBlocks.filter((b) => isSameDay(new Date(b.start), d)).map((b) => {
                  const s = new Date(b.start), e = new Date(b.end);
                  const top = ((getHours(s) - START_H) * 60 + getMinutes(s)) / 60 * HOUR;
                  const h = Math.max(20, differenceInMinutes(e, s) / 60 * HOUR);
                  const t = b.taskId ? tasks[b.taskId] : undefined;
                  const c = t ? statusOf(t)?.color || '#6E56CF' : '#6E56CF';
                  return (
                    <div key={b.id} draggable onDragStart={(ev) => ev.dataTransfer.setData('application/x-block', b.id)} onClick={() => t && getState().openTask(t.id)}
                      className="group absolute left-1 right-1 rounded-md px-1.5 py-1 text-[11.5px] overflow-hidden cursor-pointer z-[5]" style={{ top, height: h, background: alpha(c, 0.18), borderLeft: `3px solid ${c}` }}>
                      <div className="font-medium truncate">{t?.name || b.title}</div>
                      <div className="text-[10px] text-[var(--muted)]">{format(s, 'h:mm')} – {format(e, 'h:mm a')}</div>
                      <button aria-label="Remove time block" data-no-touch-drag className="absolute top-0.5 right-0.5 hidden group-hover:block coarse:block coarse:p-1" onClick={(ev) => { ev.stopPropagation(); getState().remove('block', b.id); }}><X size={11} /></button>
                      {/* resize: pointer events so it works with a finger too; taller grab area on touch */}
                      <span data-no-touch-drag className="absolute bottom-0 left-0 right-0 h-1.5 coarse:h-4 cursor-ns-resize" style={{ touchAction: 'none' }} onPointerDown={(ev) => {
                        ev.stopPropagation(); ev.preventDefault();
                        const y0 = ev.clientY, h0 = differenceInMinutes(e, s);
                        const mv = (m: PointerEvent) => { const mins = Math.max(15, Math.round((h0 + ((m.clientY - y0) / HOUR) * 60) / 15) * 15); getState().update('block', b.id, { end: addMinutes(s, mins).toISOString() }); };
                        const upf = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upf); };
                        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upf);
                      }} />
                    </div>
                  );
                })}
                {timed.filter((t) => isSameDay(new Date(t.dueDate!), d)).map((t) => {
                  const s = new Date(t.dueDate!);
                  const top = ((getHours(s) - START_H) * 60 + getMinutes(s)) / 60 * HOUR;
                  return <div key={'due' + t.id} onClick={() => getState().openTask(t.id)} className="absolute left-1 right-1 rounded px-1.5 text-[10.5px] bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 truncate cursor-pointer" style={{ top, height: 18 }}>Due: {t.name}</div>;
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
