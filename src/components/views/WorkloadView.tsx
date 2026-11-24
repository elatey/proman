import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, format, isSameDay, isToday, startOfWeek, startOfDay, formatISO, isWeekend, differenceInCalendarDays } from 'date-fns';
import { useStore, getState, statusOf, isClosed } from '../../lib/store';
import { Avatar, StatusIcon } from '../ui';
import { cn, alpha, toDate } from '../../lib/utils';
import type { Task } from '../../lib/types';
import type { ViewProps } from '../../pages/LocationPage';

export default function WorkloadView({ tasks }: ViewProps) {
  const members = useStore((s) => s.members);
  const [start, setStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [span, setSpan] = useState<7 | 14>(14);
  const [metric, setMetric] = useState<'count' | 'hours'>('count');
  const [cap, setCap] = useState(metric === 'count' ? 3 : 8);
  const days = Array.from({ length: span }, (_, i) => addDays(start, i));
  const open = tasks.filter((t) => !isClosed(t));
  const onDay = (t: Task, d: Date) => {
    const s = toDate(t.startDate), e = toDate(t.dueDate);
    if (s && e) return d >= startOfDay(s) && d <= startOfDay(e);
    return !!e && isSameDay(e, d);
  };
  const weight = (t: Task) => {
    if (metric === 'count') return 1;
    const s = toDate(t.startDate), e = toDate(t.dueDate);
    const n = s && e ? Math.max(1, differenceInCalendarDays(e, s) + 1) : 1;
    return (t.estimate || 60) / 60 / n;
  };
  const rows = [...members.map((m) => ({ id: m.user_id, name: m.profile.name })), { id: '__none', name: 'Unassigned' }];
  const drop = (e: React.DragEvent, uid: string, d: Date) => {
    const id = e.dataTransfer.getData('application/x-task');
    const t = getState().data.task[id];
    if (!t) return;
    const due = toDate(t.dueDate);
    const delta = due ? differenceInCalendarDays(d, due) : 0;
    getState().updateTask(id, {
      assignees: uid === '__none' ? [] : [uid],
      dueDate: formatISO(startOfDay(d)),
      startDate: t.startDate ? formatISO(addDays(new Date(t.startDate), delta)) : null,
    });
  };
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b text-[13px]">
        <button className="btn btn-outline !py-1" onClick={() => setStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</button>
        <button className="icon-btn" onClick={() => setStart(addDays(start, -7))}><ChevronLeft size={16} /></button>
        <button className="icon-btn" onClick={() => setStart(addDays(start, 7))}><ChevronRight size={16} /></button>
        <span className="font-semibold">{format(days[0], 'MMM d')} – {format(days[days.length - 1], 'MMM d, yyyy')}</span>
        <div className="flex-1" />
        <span className="text-[var(--muted)]">Measure</span>
        <select className="input !w-auto !py-1" value={metric} onChange={(e) => { const m = e.target.value as any; setMetric(m); setCap(m === 'count' ? 3 : 8); }}><option value="count">Task count</option><option value="hours">Time estimates (h)</option></select>
        <span className="text-[var(--muted)]">Capacity/day</span>
        <input type="number" min={1} className="input !w-16 !py-1" value={cap} onChange={(e) => setCap(Number(e.target.value) || 1)} />
        <select className="input !w-auto !py-1" value={span} onChange={(e) => setSpan(Number(e.target.value) as any)}><option value={7}>1 week</option><option value={14}>2 weeks</option></select>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-[12px] min-w-full">
          <thead className="sticky top-0 z-10 bg-[var(--panel)]">
            <tr>
              <th className="sticky left-0 z-20 bg-[var(--panel)] border-b border-r w-52 text-left px-3 py-2 font-medium text-[var(--muted)]">Assignee</th>
              {days.map((d) => <th key={d.toISOString()} className={cn('border-b border-r px-1 py-2 font-medium min-w-[110px]', isToday(d) ? 'text-accent' : 'text-[var(--muted)]', isWeekend(d) && 'bg-[var(--subtle)]')}>{format(d, 'EEE d')}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const mine = open.filter((t) => (r.id === '__none' ? !t.assignees?.length : t.assignees?.includes(r.id)));
              return (
                <tr key={r.id}>
                  <td className="sticky left-0 z-10 bg-[var(--panel)] border-b border-r px-3 py-2">
                    <div className="flex items-center gap-2">{r.id !== '__none' ? <Avatar id={r.id} size={24} /> : <span className="w-6" />}<span className="font-medium text-[13px] truncate">{r.name}</span></div>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5 ml-8">{mine.length} open</div>
                  </td>
                  {days.map((d) => {
                    const list = mine.filter((t) => onDay(t, d));
                    const load = list.reduce((a, t) => a + weight(t), 0);
                    const ratio = load / cap;
                    const color = !load ? 'transparent' : ratio > 1 ? '#E5484D' : ratio > 0.75 ? '#FFB224' : '#30A46C';
                    return (
                      <td key={d.toISOString()} className={cn('border-b border-r align-top p-1', isWeekend(d) && 'bg-[var(--subtle)]')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, r.id, d)}>
                        {load > 0 && <div className="flex items-center gap-1 mb-1"><div className="flex-1 h-1.5 rounded-full bg-[var(--hover)] overflow-hidden"><div className="h-full" style={{ width: Math.min(100, ratio * 100) + '%', background: color }} /></div><span className="text-[10px] font-medium" style={{ color }}>{metric === 'count' ? load : load.toFixed(1) + 'h'}</span></div>}
                        <div className="space-y-0.5">
                          {list.slice(0, 4).map((t) => (
                            <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData('application/x-task', t.id)} onClick={() => getState().openTask(t.id)}
                              className="flex items-center gap-1 rounded px-1 py-0.5 truncate cursor-pointer hover:brightness-95" style={{ background: alpha(statusOf(t)?.color || '#888', 0.15) }} title={t.name}>
                              <StatusIcon status={statusOf(t)} size={10} /><span className="truncate">{t.name}</span>
                            </div>
                          ))}
                          {list.length > 4 && <div className="text-[10px] text-[var(--muted)] px-1">+{list.length - 4} more</div>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
