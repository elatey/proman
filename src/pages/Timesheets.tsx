import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Plus, Clock, Trash2 } from 'lucide-react';
import { addDays, format, isSameDay, startOfWeek, endOfWeek, startOfDay, setHours } from 'date-fns';
import { useStore, getState, memberName } from '../lib/store';
import { Avatar, Modal, StatusIcon } from '../components/ui';
import { cn, fmtDuration, parseDuration, toCSV, downloadFile } from '../lib/utils';
import { statusOf } from '../lib/store';

export default function Timesheets() {
  const times = useStore((s) => s.data.time);
  const tasks = useStore((s) => s.data.task);
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.user!.id);
  const [who, setWho] = useState<string>(me);
  const [start, setStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [adding, setAdding] = useState(false);
  const [billableOnly, setBillableOnly] = useState(false);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = endOfWeek(start, { weekStartsOn: 1 });
  const entries = Object.values(times).filter((t) => (who === 'all' || t.user === who) && new Date(t.start) >= start && new Date(t.start) <= end && t.end && (!billableOnly || t.billable));
  const rows = useMemo(() => {
    const m = new Map<string, { taskId: string; user: string; perDay: number[]; total: number }>();
    for (const e of entries) {
      const k = e.taskId + (who === 'all' ? ':' + e.user : '');
      if (!m.has(k)) m.set(k, { taskId: e.taskId, user: e.user, perDay: Array(7).fill(0), total: 0 });
      const r = m.get(k)!;
      const i = days.findIndex((d) => isSameDay(d, new Date(e.start)));
      if (i >= 0) { r.perDay[i] += e.duration || 0; r.total += e.duration || 0; }
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [entries]);
  const dayTotals = days.map((_, i) => rows.reduce((a, r) => a + r.perDay[i], 0));
  const total = dayTotals.reduce((a, b) => a + b, 0);
  const billable = entries.filter((e) => e.billable).reduce((a, e) => a + (e.duration || 0), 0);
  const exportCsv = () => downloadFile(`timesheet_${format(start, 'yyyy-MM-dd')}.csv`, toCSV([
    ['Date', 'Person', 'Task', 'Duration (h)', 'Billable', 'Note'],
    ...entries.map((e) => [format(new Date(e.start), 'yyyy-MM-dd HH:mm'), memberName(e.user), tasks[e.taskId]?.name || '', ((e.duration || 0) / 3600).toFixed(2), e.billable ? 'yes' : 'no', e.note || '']),
  ]), 'text/csv');
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 sm:p-8">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold flex-1 flex items-center gap-2"><Clock /> Timesheets</h1>
          <button className="btn btn-outline" onClick={exportCsv}><Download size={14} /> Export</button>
          <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={14} /> Add time</button>
        </div>
        <div className="flex items-center gap-2 mt-5">
          <button className="icon-btn" onClick={() => setStart(addDays(start, -7))}><ChevronLeft size={16} /></button>
          <button className="icon-btn" onClick={() => setStart(addDays(start, 7))}><ChevronRight size={16} /></button>
          <span className="font-semibold">{format(start, 'MMM d')} – {format(end, 'MMM d, yyyy')}</span>
          <button className="btn btn-ghost !py-1 !text-xs" onClick={() => setStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>This week</button>
          <div className="flex-1" />
          <label className="text-xs flex items-center gap-1.5 mr-2"><input type="checkbox" checked={billableOnly} onChange={(e) => setBillableOnly(e.target.checked)} className="accent-[var(--accent)]" /> Billable only</label>
          <select className="input !w-auto !py-1" value={who} onChange={(e) => setWho(e.target.value)}><option value="all">Everyone</option>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile.name}</option>)}</select>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="card p-4"><div className="text-xs text-[var(--muted)]">Total tracked</div><div className="text-2xl font-bold mt-1">{fmtDuration(total)}</div></div>
          <div className="card p-4"><div className="text-xs text-[var(--muted)]">Billable</div><div className="text-2xl font-bold mt-1 text-green-600">{fmtDuration(billable)}</div></div>
          <div className="card p-4"><div className="text-xs text-[var(--muted)]">Tasks worked on</div><div className="text-2xl font-bold mt-1">{new Set(entries.map((e) => e.taskId)).size}</div></div>
        </div>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b text-[var(--muted)] text-xs">
              <th className="text-left px-4 py-2.5 font-medium">Task</th>
              {days.map((d) => <th key={d.toISOString()} className="px-2 py-2.5 font-medium w-20 text-right">{format(d, 'EEE d')}</th>)}
              <th className="px-4 py-2.5 font-medium w-24 text-right">Total</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.taskId + r.user} className="border-b hover-row">
                  <td className="px-4 py-2"><button className="flex items-center gap-2 hover:underline text-left" onClick={() => tasks[r.taskId] && getState().openTask(r.taskId)}>
                    {who === 'all' && <Avatar id={r.user} size={20} />}{tasks[r.taskId] && <StatusIcon status={statusOf(tasks[r.taskId])} />}<span className="truncate">{tasks[r.taskId]?.name || 'Deleted task'}</span></button></td>
                  {r.perDay.map((s, i) => <td key={i} className={cn('px-2 py-2 text-right tabular-nums', !s && 'text-[var(--faint)]')}>{s ? fmtDuration(s) : '–'}</td>)}
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{fmtDuration(r.total)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} className="px-4 py-10 text-center text-[var(--muted)]">No time tracked this week. Start a timer from any task, or add time manually.</td></tr>}
            </tbody>
            {rows.length > 0 && <tfoot><tr className="font-semibold"><td className="px-4 py-2.5">Total</td>{dayTotals.map((s, i) => <td key={i} className="px-2 py-2.5 text-right tabular-nums">{s ? fmtDuration(s) : '–'}</td>)}<td className="px-4 py-2.5 text-right tabular-nums">{fmtDuration(total)}</td></tr></tfoot>}
          </table>
        </div>
        <h2 className="font-semibold mt-8 mb-2">Entries</h2>
        <div className="card divide-y">
          {entries.sort((a, b) => b.start.localeCompare(a.start)).map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2 text-[13px] group">
              <Avatar id={e.user} size={22} />
              <span className="w-36 text-[var(--muted)]">{format(new Date(e.start), 'EEE MMM d, h:mm a')}</span>
              <span className="flex-1 truncate">{tasks[e.taskId]?.name}</span>
              <input className="w-48 bg-transparent outline-none text-xs text-[var(--muted)] hover:bg-[var(--hover)] rounded px-1" placeholder="Add note" defaultValue={e.note} onBlur={(x) => getState().update('time', e.id, { note: x.target.value })} />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!e.billable} onChange={(x) => getState().update('time', e.id, { billable: x.target.checked })} className="accent-green-600" />$</label>
              <span className="w-20 text-right font-medium tabular-nums">{fmtDuration(e.duration || 0)}</span>
              <button className="opacity-0 group-hover:opacity-100 text-[var(--faint)] hover:text-red-600" onClick={() => getState().remove('time', e.id)}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </div>
      {adding && <AddTime onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddTime({ onClose }: { onClose: () => void }) {
  const tasks = useStore((s) => s.data.task);
  const me = useStore((s) => s.user!.id);
  const [taskId, setTaskId] = useState('');
  const [dur, setDur] = useState('1h');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [billable, setBillable] = useState(false);
  const [q, setQ] = useState('');
  return (
    <Modal open onClose={onClose} title="Add time entry" width={460}>
      <div className="p-5 space-y-3">
        <input className="input" placeholder="Search task…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" size={6} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          {Object.values(tasks).filter((t) => t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 100).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="flex gap-2"><input className="input" value={dur} onChange={(e) => setDur(e.target.value)} placeholder="1h 30m" /><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="accent-[var(--accent)]" /> Billable</label>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-4"><button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!taskId || !parseDuration(dur)} onClick={() => {
          const m = parseDuration(dur)!;
          const s = setHours(startOfDay(new Date(date + 'T00:00')), 9);
          getState().create('time', { taskId, user: me, start: s.toISOString(), end: new Date(s.getTime() + m * 60000).toISOString(), duration: m * 60, note, billable });
          onClose();
        }}>Add</button></div>
    </Modal>
  );
}
