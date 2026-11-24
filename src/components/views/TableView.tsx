import { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore, getState, statusesForList, statusOf, isClosed } from '../../lib/store';
import { groupTasks } from '../../lib/filters';
import { StatusIcon, StatusPicker, Checkbox, useContextMenu } from '../ui';
import { Cell, colLabel, colWidth, taskMenu, BulkBar } from './shared';
import { cn, alpha } from '../../lib/utils';
import type { ViewProps } from '../../pages/LocationPage';

const TABLE_DEFAULT = ['status', 'assignee', 'dueDate', 'priority', 'tags', 'list'];

export default function TableView({ view, tasks, listIds }: ViewProps) {
  const cfg = view.config;
  const cols = cfg.columns || TABLE_DEFAULT;
  const widths = cfg.colWidths || {};
  const rows = cfg.showSubtasks === 'separate' || cfg.showSubtasks === 'expanded' ? tasks : tasks.filter((t) => !t.parentId);
  const grouped = cfg.groupBy && cfg.groupBy !== 'none' && cfg.groupBy !== 'status' ? groupTasks(rows, cfg.groupBy, listIds, false) : [{ key: 'all', label: '', color: '', tasks: rows }];
  const [sel, setSel] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const ctx = useContextMenu();
  const fields = useStore((s) => s.data.field);
  const w = (c: string) => widths[c] || colWidth(c) + 20;
  const nameW = widths.__name || 340;

  const resize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = col === '__name' ? nameW : w(col);
    let latest = w0;
    const move = (ev: MouseEvent) => {
      latest = Math.max(60, w0 + ev.clientX - x0);
      const th = document.querySelector(`[data-col="${view.id}-${col}"]`) as HTMLElement | null;
      if (th) th.style.width = latest + 'px';
    };
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      getState().update('view', view.id, { config: { ...cfg, colWidths: { ...widths, [col]: latest } } });
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };

  const footer = (c: string) => {
    const f = fields[c];
    if (f && ['number', 'money'].includes(f.type)) {
      const sum = rows.reduce((a, t) => a + (Number(t.fields?.[c]) || 0), 0);
      return f.type === 'money' ? new Intl.NumberFormat(undefined, { style: 'currency', currency: f.currency || 'USD' }).format(sum) : sum.toLocaleString();
    }
    if (c === 'points') return rows.reduce((a, t) => a + (t.points || 0), 0) || '';
    if (c === 'estimate') { const m = rows.reduce((a, t) => a + (t.estimate || 0), 0); return m ? `${Math.floor(m / 60)}h ${m % 60}m` : ''; }
    return '';
  };

  return (
    <div className="relative h-full overflow-auto">
      <table className="border-collapse text-[13px] min-w-full" style={{ tableLayout: 'fixed' }}>
        <thead className="sticky top-0 z-20 bg-[var(--subtle)]">
          <tr>
            <th className="w-10 border-b border-r sticky left-0 z-30 bg-[var(--subtle)]"><div className="flex justify-center"><Checkbox checked={sel.length > 0 && sel.length === rows.length} onChange={(v) => setSel(v ? rows.map((t) => t.id) : [])} /></div></th>
            <th data-col={`${view.id}-__name`} className="relative border-b border-r text-left font-medium text-[var(--muted)] px-3 py-2 sticky left-10 z-30 bg-[var(--subtle)]" style={{ width: nameW }}>
              Name<span className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent)]" onMouseDown={(e) => resize('__name', e)} />
            </th>
            {cols.map((c) => (
              <th key={c} data-col={`${view.id}-${c}`} className="relative border-b border-r text-left font-medium text-[var(--muted)] px-2 py-2 truncate" style={{ width: w(c) }}>
                {colLabel(c)}<span className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent)]" onMouseDown={(e) => resize(c, e)} />
              </th>
            ))}
            <th className="border-b" />
          </tr>
        </thead>
        <tbody>
          {grouped.map((g) => (
            <GroupRows key={g.key} g={g} cols={cols} sel={sel} setSel={setSel} ctx={ctx} />
          ))}
          <tr>
            <td className="border-b border-r sticky left-0 bg-[var(--panel)]" />
            <td className="border-b border-r sticky left-10 bg-[var(--panel)] px-3" colSpan={1}>
              <div className="flex items-center gap-2 py-1.5"><Plus size={13} className="text-[var(--faint)]" />
                <input className="flex-1 bg-transparent outline-none" placeholder="New task" value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim() && listIds[0]) { getState().createTask({ name: newName.trim(), listId: listIds[0] }); setNewName(''); } }} />
              </div>
            </td>
            <td colSpan={cols.length + 1} className="border-b" />
          </tr>
          <tr className="text-[var(--muted)] text-xs">
            <td className="sticky left-0 bg-[var(--panel)]" />
            <td className="px-3 py-2 sticky left-10 bg-[var(--panel)]">{rows.length} tasks</td>
            {cols.map((c) => <td key={c} className="px-2 py-2 font-medium">{footer(c)}</td>)}
            <td />
          </tr>
        </tbody>
      </table>
      <BulkBar ids={sel.filter((id) => getState().data.task[id])} clear={() => setSel([])} />
      {ctx.node}
    </div>
  );
}

function GroupRows({ g, cols, sel, setSel, ctx }: { g: any; cols: string[]; sel: string[]; setSel: (s: string[]) => void; ctx: ReturnType<typeof useContextMenu> }) {
  return (
    <>
      {g.label && (
        <tr><td colSpan={cols.length + 3} className="border-b px-3 py-1.5 text-xs font-semibold uppercase tracking-wide" style={{ background: alpha(g.color || '#888', 0.1), color: g.color }}>{g.label} · {g.tasks.length}</td></tr>
      )}
      {g.tasks.map((t: any, i: number) => {
        const on = sel.includes(t.id);
        return (
          <tr key={t.id} className={cn('group hover-row', on && '!bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]')} onContextMenu={(e) => ctx.open(e, taskMenu(t))}>
            <td className="border-b border-r sticky left-0 bg-[var(--panel)] group-hover:bg-[var(--subtle)] text-center text-[11px] text-[var(--faint)]">
              <span className={cn(on ? 'hidden' : 'group-hover:hidden')}>{i + 1}</span>
              <span className={cn('justify-center', on ? 'flex' : 'hidden group-hover:flex')}><Checkbox checked={on} onChange={() => setSel(on ? sel.filter((x) => x !== t.id) : [...sel, t.id])} /></span>
            </td>
            <td className="border-b border-r sticky left-10 bg-[var(--panel)] group-hover:bg-[var(--subtle)] px-3 py-1">
              <div className="flex items-center gap-2 min-w-0">
                <StatusPicker listId={t.listId} value={t.status} onChange={(id) => getState().updateTask(t.id, { status: id })} trigger={<button className="flex"><StatusIcon status={statusOf(t)} /></button>} />
                {t.parentId && <span className="text-[var(--faint)] text-xs">↳</span>}
                <input className={cn('flex-1 min-w-0 bg-transparent outline-none truncate', isClosed(t) && 'line-through text-[var(--muted)]')} defaultValue={t.name} key={t.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && getState().updateTask(t.id, { name: e.target.value.trim() })}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
                <button className="opacity-0 group-hover:opacity-100 text-xs text-accent shrink-0" onClick={() => getState().openTask(t.id)}>Open</button>
              </div>
            </td>
            {cols.map((c) => <td key={c} className="border-b border-r px-1.5 py-1 overflow-hidden"><Cell col={c} t={t} /></td>)}
            <td className="border-b" />
          </tr>
        );
      })}
    </>
  );
}
