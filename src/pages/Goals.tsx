import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Target, Plus, Folder, Trash2, ChevronLeft, MoreHorizontal, Check, Hash, DollarSign, ToggleLeft, ListChecks, X } from 'lucide-react';
import { format } from 'date-fns';
import { useStore, getState, isClosed } from '../lib/store';
import { Popover, MenuList, Empty, ProgressBar, AvatarStack, AssigneePicker, DatePicker, ColorDots, Modal, InlineEdit } from '../components/ui';
import { cn, uid, fmtDue, COLORS } from '../lib/utils';
import type { Goal, GoalTarget } from '../lib/types';

export function targetProgress(t: GoalTarget): number {
  const s = getState();
  if (t.type === 'boolean') return t.current ? 100 : 0;
  if (t.type === 'tasks') {
    const tasks = Object.values(s.data.task).filter((x) => !x.archived && !x.parentId && (t.listId ? x.listId === t.listId : (t.taskIds || []).includes(x.id)));
    return tasks.length ? Math.round((tasks.filter(isClosed).length / tasks.length) * 100) : 0;
  }
  const span = t.target - t.start;
  return span ? Math.max(0, Math.min(100, Math.round(((t.current - t.start) / span) * 100))) : 0;
}
export const goalProgress = (g: Goal) => (g.targets.length ? Math.round(g.targets.reduce((a, t) => a + targetProgress(t), 0) / g.targets.length) : 0);

export default function Goals() {
  const { id } = useParams();
  const nav = useNavigate();
  const goals = useStore((s) => s.data.goal);
  const folders = useStore((s) => s.data.goalFolder);
  useStore((s) => s.data.task);
  const [folder, setFolder] = useState<string | null>(null);
  const g = id ? goals[id] : undefined;
  if (g) return <GoalDetail goal={g} />;
  const list = Object.values(goals).filter((x) => (folder ? x.folderId === folder : true));
  const me = getState().user!.id;
  const create = () => { const x = getState().create('goal', { name: 'New goal', color: COLORS[Math.floor(Math.random() * 8)], owners: [me], targets: [], folderId: folder, dueDate: null }); nav('/goals/' + x.id); };
  return (
    <div className="h-full flex">
      <div className="w-56 shrink-0 border-r bg-[var(--sidebar)] p-2">
        <div className="h-10 flex items-center px-2 font-semibold">Goals</div>
        <button className={cn('menu-item', !folder && 'bg-[var(--hover)]')} onClick={() => setFolder(null)}><Target size={14} /> All goals</button>
        <div className="flex items-center px-2.5 pt-4 pb-1 text-[11.5px] font-semibold text-[var(--muted)]">Folders<button className="ml-auto icon-btn !w-5 !h-5" onClick={() => { const n = prompt('Folder name (e.g. Q1 2027)'); if (n) getState().create('goalFolder', { name: n }); }}><Plus size={13} /></button></div>
        {Object.values(folders).map((f) => (
          <div key={f.id} className="group flex items-center"><button className={cn('menu-item flex-1', folder === f.id && 'bg-[var(--hover)]')} onClick={() => setFolder(f.id)}><Folder size={14} />{f.name}</button>
            <button className="hidden group-hover:flex icon-btn !w-6 !h-6" onClick={() => getState().remove('goalFolder', f.id)}><Trash2 size={12} /></button></div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <div className="flex items-center"><h1 className="text-2xl font-bold flex-1">{folder ? folders[folder]?.name : 'Goals'}</h1><button className="btn btn-primary" onClick={create}><Plus size={15} /> New Goal</button></div>
          <p className="text-[var(--muted)] mt-1">Set measurable targets. Progress updates automatically as tasks get done.</p>
          <div className="card mt-6 divide-y">
            {list.map((x) => {
              const p = goalProgress(x);
              return (
                <button key={x.id} onClick={() => nav('/goals/' + x.id)} className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[var(--subtle)]">
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: x.color + '22', color: x.color }}><Target size={18} /></span>
                  <div className="flex-1 min-w-0"><div className="font-medium truncate">{x.name}</div><div className="text-xs text-[var(--muted)]">{x.targets.length} targets{x.dueDate ? ' · due ' + fmtDue(x.dueDate) : ''}</div></div>
                  <AvatarStack ids={x.owners} size={22} />
                  <div className="w-40 flex items-center gap-2"><ProgressBar value={p} color={x.color} className="flex-1" /><span className="text-xs w-9 text-right">{p}%</span></div>
                </button>
              );
            })}
          </div>
          {!list.length && <Empty icon={<Target size={36} />} title="No goals yet" body="Create a goal and add targets: numbers, money, true/false, or task completion." />}
        </div>
      </div>
    </div>
  );
}

function GoalDetail({ goal }: { goal: Goal }) {
  const nav = useNavigate();
  const lists = useStore((s) => s.data.list);
  const folders = useStore((s) => s.data.goalFolder);
  const [adding, setAdding] = useState(false);
  const up = (p: Partial<Goal>) => getState().update('goal', goal.id, p);
  const upT = (id: string, p: Partial<GoalTarget>) => up({ targets: goal.targets.map((t) => (t.id === id ? { ...t, ...p } : t)) });
  const p = goalProgress(goal);
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        <button className="btn btn-ghost !px-1 mb-3" onClick={() => nav('/goals')}><ChevronLeft size={15} /> Goals</button>
        <div className="flex items-start gap-4">
          <Popover trigger={<span className="w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer" style={{ background: goal.color + '22', color: goal.color }}><Target size={24} /></span>}>
            {(close) => <div className="p-3 w-64"><ColorDots value={goal.color} onChange={(c) => { up({ color: c }); close(); }} /></div>}
          </Popover>
          <div className="flex-1">
            <InlineEdit value={goal.name} onSave={(v) => up({ name: v })} className="text-2xl font-bold" />
            <div className="flex flex-wrap items-center gap-4 mt-2 text-[13px]">
              <span className="flex items-center gap-1.5 text-[var(--muted)]">Owners <AssigneePicker value={goal.owners} onChange={(o) => up({ owners: o })} multi size={22} /></span>
              <span className="flex items-center gap-1.5 text-[var(--muted)]">Due <DatePicker value={goal.dueDate} onChange={(d) => up({ dueDate: d })} /></span>
              <select className="input !w-auto !py-0.5 !text-xs" value={goal.folderId || ''} onChange={(e) => up({ folderId: e.target.value || null })}><option value="">No folder</option>{Object.values(folders).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
            </div>
          </div>
          <Popover align="end" trigger={<button className="icon-btn"><MoreHorizontal size={16} /></button>}>
            {(close) => <MenuList close={close} items={[{ label: 'Delete goal', icon: <Trash2 size={14} />, danger: true, onClick: () => { if (confirm('Delete goal?')) { getState().remove('goal', goal.id); nav('/goals'); } } }]} />}
          </Popover>
        </div>
        <div className="card p-5 mt-6">
          <div className="flex items-center gap-3"><span className="text-3xl font-bold" style={{ color: goal.color }}>{p}%</span><ProgressBar value={p} color={goal.color} className="flex-1 !h-2.5" /></div>
          <textarea className="w-full mt-4 bg-transparent outline-none resize-none text-[14px] text-[var(--muted)]" rows={2} placeholder="Describe this goal…" defaultValue={goal.description} onBlur={(e) => up({ description: e.target.value })} />
        </div>
        <div className="flex items-center mt-8 mb-3"><h2 className="font-semibold text-lg flex-1">Targets</h2><button className="btn btn-outline" onClick={() => setAdding(true)}><Plus size={14} /> Add target</button></div>
        <div className="space-y-2">
          {goal.targets.map((t) => {
            const tp = targetProgress(t);
            return (
              <div key={t.id} className="card p-4 flex items-center gap-4">
                <span className="text-[var(--muted)]">{t.type === 'number' ? <Hash size={16} /> : t.type === 'currency' ? <DollarSign size={16} /> : t.type === 'boolean' ? <ToggleLeft size={16} /> : <ListChecks size={16} />}</span>
                <div className="flex-1 min-w-0">
                  <InlineEdit value={t.name} onSave={(v) => upT(t.id, { name: v })} className="font-medium" />
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {t.type === 'tasks' ? (t.listId ? `All tasks in ${lists[t.listId]?.name || 'List'}` : `${(t.taskIds || []).length} tasks`) : t.type === 'boolean' ? 'Done / not done' : `${t.start} → ${t.target} ${t.unit || ''}`}
                  </div>
                </div>
                {(t.type === 'number' || t.type === 'currency') && (
                  <div className="flex items-center gap-1 text-[13px]">
                    <input type="number" className="input !w-24 !py-1 text-right" value={t.current} onChange={(e) => upT(t.id, { current: Number(e.target.value) })} />
                    <span className="text-[var(--muted)]">/ {t.type === 'currency' ? '$' : ''}{t.target}</span>
                  </div>
                )}
                {t.type === 'boolean' && <button className={cn('btn !py-1', t.current ? 'bg-green-600 text-white' : 'btn-outline')} onClick={() => upT(t.id, { current: t.current ? 0 : 1 })}><Check size={14} /> {t.current ? 'Done' : 'Mark done'}</button>}
                <div className="w-32 flex items-center gap-2"><ProgressBar value={tp} color={goal.color} className="flex-1" /><span className="text-xs w-8 text-right">{tp}%</span></div>
                <button className="icon-btn" onClick={() => up({ targets: goal.targets.filter((x) => x.id !== t.id) })}><X size={14} /></button>
              </div>
            );
          })}
          {!goal.targets.length && <div className="text-sm text-[var(--muted)]">Add targets to measure progress.</div>}
        </div>
      </div>
      {adding && <AddTarget onClose={() => setAdding(false)} onAdd={(t) => { up({ targets: [...goal.targets, t] }); setAdding(false); }} />}
    </div>
  );
}

function AddTarget({ onClose, onAdd }: { onClose: () => void; onAdd: (t: GoalTarget) => void }) {
  const lists = useStore((s) => s.data.list);
  const [t, setT] = useState<GoalTarget>({ id: uid(), name: '', type: 'number', start: 0, target: 100, current: 0 });
  return (
    <Modal open onClose={onClose} title="New target" width={460}>
      <div className="p-5 space-y-3">
        <input autoFocus className="input" placeholder="Target name, e.g. Close 20 deals" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
        <div className="grid grid-cols-4 gap-1">
          {([['number', 'Number'], ['currency', 'Currency'], ['boolean', 'True/False'], ['tasks', 'Tasks']] as const).map(([k, l]) => <button key={k} className={cn('btn justify-center !text-xs', t.type === k ? 'btn-primary' : 'btn-outline')} onClick={() => setT({ ...t, type: k })}>{l}</button>)}
        </div>
        {(t.type === 'number' || t.type === 'currency') && (
          <div className="grid grid-cols-3 gap-2">
            <div><div className="label mb-1">Start</div><input type="number" className="input" value={t.start} onChange={(e) => setT({ ...t, start: Number(e.target.value), current: Number(e.target.value) })} /></div>
            <div><div className="label mb-1">Target</div><input type="number" className="input" value={t.target} onChange={(e) => setT({ ...t, target: Number(e.target.value) })} /></div>
            <div><div className="label mb-1">Unit</div><input className="input" value={t.unit || ''} onChange={(e) => setT({ ...t, unit: e.target.value })} placeholder="deals" /></div>
          </div>
        )}
        {t.type === 'tasks' && <div><div className="label mb-1">Track completion of all tasks in</div><select className="input" value={t.listId || ''} onChange={(e) => setT({ ...t, listId: e.target.value })}><option value="">Pick a List…</option>{Object.values(lists).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>}
      </div>
      <div className="flex justify-end gap-2 px-5 pb-4"><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!t.name.trim()} onClick={() => onAdd(t)}>Add target</button></div>
    </Modal>
  );
}
