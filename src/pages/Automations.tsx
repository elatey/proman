import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Zap, Plus, Trash2, Pencil, X, ArrowDown, Sparkles } from 'lucide-react';
import { useStore, getState, locationName, listsIn } from '../lib/store';
import { TRIGGERS, ACTIONS, CONDITION_FIELDS } from '../lib/automations';
import { statusesForLocation } from '../lib/filters';
import { Toggle, Modal, Empty } from '../components/ui';
import { cn, PRIORITIES, uid } from '../lib/utils';
import type { Automation, AutomationAction, AutomationCondition, AutomationTrigger, LocationRef } from '../lib/types';

const PRESETS: { name: string; trigger: AutomationTrigger; actions: AutomationAction[]; conditions?: AutomationCondition[] }[] = [
  { name: 'When status changes to COMPLETE, archive the task', trigger: { type: 'status_changed', to: 'COMPLETE' }, actions: [{ type: 'archive' }] },
  { name: 'When a task is created, assign the creator', trigger: { type: 'task_created' }, actions: [{ type: 'assign_creator' }] },
  { name: 'When priority changes to Urgent, add tag "urgent"', trigger: { type: 'priority_changed', to: 1 }, actions: [{ type: 'add_tag', value: 'urgent' }] },
  { name: 'When all subtasks are resolved, move the parent to COMPLETE', trigger: { type: 'subtasks_resolved' }, actions: [{ type: 'change_status', value: 'COMPLETE' }] },
  { name: 'When the due date arrives, set priority to Urgent', trigger: { type: 'due_date_arrives' }, actions: [{ type: 'change_priority', value: 1 }] },
  { name: 'When a task is created, set due date to 7 days from now', trigger: { type: 'task_created' }, actions: [{ type: 'set_due', days: 7 }] },
  { name: 'When status changes to IN PROGRESS, set start date to today', trigger: { type: 'status_changed', to: 'IN PROGRESS' }, actions: [{ type: 'set_start', days: 0 }] },
  { name: 'When a task is unblocked, comment to notify assignees', trigger: { type: 'task_unblocked' }, actions: [{ type: 'add_comment', text: '✅ {name} is unblocked and ready to start.' }] },
];

export default function Automations() {
  const [search] = useSearchParams();
  const autos = useStore((s) => s.data.automation);
  const [editing, setEditing] = useState<Partial<Automation> | null>(null);
  const preset = search.get('loc');
  const defaultLoc: LocationRef = preset ? { type: preset.split(':')[0] as any, id: preset.split(':')[1] } : { type: 'everything', id: 'all' };
  const list = Object.values(autos).filter((a) => !preset || (a.location.type === defaultLoc.type && a.location.id === defaultLoc.id)).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex items-center"><h1 className="text-2xl font-bold flex-1 flex items-center gap-2"><Zap className="text-amber-500" /> Automations</h1>
          <button className="btn btn-primary" onClick={() => setEditing({ name: '', location: defaultLoc, trigger: { type: 'task_created' }, conditions: [], actions: [{ type: 'change_status' }], enabled: true })}><Plus size={15} /> New automation</button></div>
        <p className="text-[var(--muted)] mt-1">When something happens → (optionally) if conditions match → do these actions.{preset && <> Showing automations for <b>{locationName(defaultLoc)}</b>.</>}</p>
        <div className="mt-6 space-y-2">
          {list.map((a) => (
            <div key={a.id} className="card p-4 flex items-center gap-4">
              <Zap size={18} className={a.enabled ? 'text-amber-500' : 'text-[var(--faint)]'} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{a.name || describe(a)}</div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{locationName(a.location)} · {describe(a)} · ran {a.runs || 0}×</div>
              </div>
              <Toggle on={a.enabled} onChange={(v) => getState().update('automation', a.id, { enabled: v })} />
              <button className="icon-btn" onClick={() => setEditing(a)}><Pencil size={14} /></button>
              <button className="icon-btn hover:!text-red-600" onClick={() => getState().remove('automation', a.id)}><Trash2 size={14} /></button>
            </div>
          ))}
          {!list.length && <Empty icon={<Zap size={36} />} title="No automations yet" body="Automate repetitive work: auto-assign, change statuses, set dates, post comments, call webhooks and more." />}
        </div>
        <h2 className="font-semibold mt-10 mb-3 flex items-center gap-2"><Sparkles size={16} className="text-accent" /> Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button key={p.name} className="card p-3 text-left text-[13px] hover:shadow-md" onClick={() => setEditing({ name: p.name, location: defaultLoc, trigger: p.trigger, conditions: p.conditions || [], actions: p.actions, enabled: true })}>{p.name}</button>
          ))}
        </div>
      </div>
      {editing && <AutomationEditor a={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function describe(a: Automation) {
  const t = TRIGGERS.find((x) => x.type === a.trigger.type)?.label || a.trigger.type;
  const acts = a.actions.map((x) => ACTIONS.find((y) => y.type === x.type)?.label || x.type).join(', ');
  return `When ${t.toLowerCase()} → ${acts.toLowerCase()}`;
}

function AutomationEditor({ a, onClose }: { a: Partial<Automation>; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const members = useStore((s) => s.members);
  const [x, setX] = useState<Partial<Automation>>(a);
  const loc = x.location!;
  const statuses = useMemo(() => statusesForLocation(listsIn(loc)), [loc.type, loc.id, data.list]);
  const tags = Object.values(data.tag).map((t) => t.name);
  const fields = Object.values(data.field);
  const lists = Object.values(data.list);
  const channels = Object.values(data.channel).filter((c) => !c.dm);
  const templates = Object.values(data.template).filter((t) => t.type === 'task');
  const locs: { label: string; v: LocationRef }[] = [
    { label: 'Entire Workspace', v: { type: 'everything', id: 'all' } },
    ...Object.values(data.space).map((s) => ({ label: 'Space: ' + s.name, v: { type: 'space' as const, id: s.id } })),
    ...Object.values(data.folder).map((s) => ({ label: 'Folder: ' + s.name, v: { type: 'folder' as const, id: s.id } })),
    ...lists.map((s) => ({ label: 'List: ' + s.name, v: { type: 'list' as const, id: s.id } })),
  ];
  const trig = TRIGGERS.find((t) => t.type === x.trigger?.type);
  const setT = (p: Partial<AutomationTrigger>) => setX({ ...x, trigger: { ...x.trigger!, ...p } });
  const sel = (value: any, onChange: (v: any) => void, opts: { v: any; l: string }[], placeholder = 'Any') => (
    <select className="input !py-1" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}>
      <option value="">{placeholder}</option>{opts.map((o) => <option key={String(o.v)} value={o.v}>{o.l}</option>)}
    </select>
  );
  const statusOpts = statuses.map((s) => ({ v: s.name, l: s.name }));
  const memberOpts = members.map((m) => ({ v: m.user_id, l: m.profile.name }));
  const prioOpts = PRIORITIES.map((p) => ({ v: p.value, l: p.label }));
  const save = () => {
    const s = getState();
    const payload = { name: x.name || '', location: x.location!, trigger: x.trigger!, conditions: x.conditions || [], actions: x.actions || [], enabled: x.enabled ?? true };
    if (x.id) s.update('automation', x.id, payload); else s.create('automation', { ...payload, runs: 0, fired: {} });
    onClose();
  };
  const actionParams = (act: AutomationAction, upd: (p: Partial<AutomationAction>) => void) => {
    const meta = ACTIONS.find((m) => m.type === act.type);
    switch (meta?.needs) {
      case 'status': return sel(act.value, (v) => upd({ value: v }), statusOpts, 'Pick status…');
      case 'priority': return sel(act.value, (v) => upd({ value: v ? Number(v) : null }), prioOpts, 'No priority');
      case 'member': return sel(act.value, (v) => upd({ value: v }), memberOpts, 'Pick person…');
      case 'tag': return <input className="input !py-1" list="auto-tags" value={act.value || ''} onChange={(e) => upd({ value: e.target.value.toLowerCase() })} placeholder="tag name" />;
      case 'days': return <div className="flex items-center gap-2 text-xs"><input type="number" className="input !py-1 !w-20" value={act.days ?? 0} onChange={(e) => upd({ days: Number(e.target.value) })} /> days after trigger</div>;
      case 'text': return <input className="input !py-1" value={act.text || ''} onChange={(e) => upd({ text: e.target.value })} placeholder={act.type === 'rename' ? '[{id}] {name}' : 'Text — use {name} for the task name'} />;
      case 'list': return <div className="flex gap-2">{sel(act.listId, (v) => upd({ listId: v }), lists.map((l) => ({ v: l.id, l: l.name })), act.type === 'duplicate' ? 'Same List' : 'Pick List…')}{act.type === 'create_task' && <input className="input !py-1" value={act.text || ''} onChange={(e) => upd({ text: e.target.value })} placeholder="Task name" />}</div>;
      case 'field': return <div className="flex gap-2">{sel(act.field, (v) => upd({ field: v }), fields.map((f) => ({ v: f.id, l: f.name })), 'Pick field…')}<input className="input !py-1" value={act.value ?? ''} onChange={(e) => upd({ value: e.target.value })} placeholder="Value (option id/label, number, text)" /></div>;
      case 'minutes': return <input type="number" className="input !py-1 !w-28" value={act.value ?? ''} onChange={(e) => upd({ value: Number(e.target.value) })} placeholder="minutes" />;
      case 'url': return <input className="input !py-1" value={act.url || ''} onChange={(e) => upd({ url: e.target.value })} placeholder="https://hooks.example.com/…" />;
      case 'channel': return <div className="flex gap-2">{sel(act.value, (v) => upd({ value: v }), channels.map((c) => ({ v: c.id, l: '#' + c.name })), 'Pick channel…')}<input className="input !py-1" value={act.text || ''} onChange={(e) => upd({ text: e.target.value })} placeholder="Message ({name})" /></div>;
      case 'template': return sel(act.value, (v) => upd({ value: v }), templates.map((t) => ({ v: t.id, l: t.name })), 'Pick template…');
    }
    return null;
  };
  return (
    <Modal open onClose={onClose} title={x.id ? 'Edit automation' : 'New automation'} width={640}>
      <datalist id="auto-tags">{tags.map((t) => <option key={t} value={t} />)}</datalist>
      <div className="p-5 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1"><div className="label mb-1">Name (optional)</div><input className="input" value={x.name || ''} onChange={(e) => setX({ ...x, name: e.target.value })} /></div>
          <div className="flex-1"><div className="label mb-1">Applies to</div>
            <select className="input" value={loc.type + ':' + loc.id} onChange={(e) => { const [t, i] = e.target.value.split(':'); setX({ ...x, location: { type: t as any, id: i } }); }}>{locs.map((l) => <option key={l.v.type + l.v.id} value={l.v.type + ':' + l.v.id}>{l.label}</option>)}</select></div>
        </div>
        <div className="rounded-lg border p-3 bg-[var(--subtle)]">
          <div className="text-xs font-semibold text-accent mb-2">WHEN (trigger)</div>
          <select className="input" value={x.trigger!.type} onChange={(e) => setX({ ...x, trigger: { type: e.target.value } })}>{TRIGGERS.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</select>
          <div className="mt-2 flex gap-2 items-center text-xs">
            {trig?.needs === 'status' && <><span>from</span>{sel(x.trigger!.from, (v) => setT({ from: v }), statusOpts)}<span>to</span>{sel(x.trigger!.to, (v) => setT({ to: v }), statusOpts)}</>}
            {trig?.needs === 'priority' && <><span>from</span>{sel(x.trigger!.from, (v) => setT({ from: v }), prioOpts)}<span>to</span>{sel(x.trigger!.to, (v) => setT({ to: v }), prioOpts)}</>}
            {trig?.needs === 'member' && sel(x.trigger!.value, (v) => setT({ value: v }), memberOpts, 'Anyone')}
            {trig?.needs === 'tag' && <input className="input !py-1" list="auto-tags" value={x.trigger!.value || ''} onChange={(e) => setT({ value: e.target.value.toLowerCase() || undefined })} placeholder="Any tag" />}
            {trig?.needs === 'field' && <>{sel(x.trigger!.field, (v) => setT({ field: v }), fields.filter((f) => (x.trigger!.type === 'button_clicked' ? f.type === 'button' : f.type !== 'button')).map((f) => ({ v: f.id, l: f.name })), 'Pick field…')}{x.trigger!.type === 'field_changed' && <input className="input !py-1" value={x.trigger!.to || ''} onChange={(e) => setT({ to: e.target.value || undefined })} placeholder="to value (optional)" />}</>}
            {trig?.needs === 'days' && <><input type="number" min={1} className="input !py-1 !w-20" value={x.trigger!.days || 1} onChange={(e) => setT({ days: Number(e.target.value) })} /><span>days</span><select className="input !py-1 !w-auto" value={x.trigger!.when || 'before'} onChange={(e) => setT({ when: e.target.value as any })}><option value="before">before</option><option value="after">after</option></select><span>the due date</span></>}
          </div>
        </div>
        <div className="flex justify-center text-[var(--faint)]"><ArrowDown size={16} /></div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center text-xs font-semibold text-amber-600 mb-2">IF (conditions, optional)<button className="ml-auto text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1 font-normal" onClick={() => setX({ ...x, conditions: [...(x.conditions || []), { field: 'status', op: 'is' }] })}><Plus size={12} /> Add condition</button></div>
          {(x.conditions || []).map((c, i) => {
            const upd = (p: Partial<AutomationCondition>) => setX({ ...x, conditions: x.conditions!.map((y, j) => (j === i ? { ...y, ...p } : y)) });
            return (
              <div key={i} className="flex gap-2 mb-1.5">
                <select className="input !py-1 !w-36" value={c.field} onChange={(e) => upd({ field: e.target.value, value: undefined })}>{CONDITION_FIELDS.map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}</select>
                <select className="input !py-1 !w-28" value={c.op} onChange={(e) => upd({ op: e.target.value as any })}><option value="is">is</option><option value="isnot">is not</option><option value="set">is set</option><option value="notset">is not set</option></select>
                {(c.op === 'is' || c.op === 'isnot') && (c.field === 'status' ? sel(c.value, (v) => upd({ value: v }), statusOpts, 'Pick…') : c.field === 'priority' ? sel(c.value, (v) => upd({ value: v }), prioOpts, 'Pick…') : c.field === 'assignee' ? sel(c.value, (v) => upd({ value: v }), memberOpts, 'Pick…') : c.field === 'type' ? sel(c.value, (v) => upd({ value: v }), ['task', 'milestone', 'bug', 'feature', 'request'].map((t) => ({ v: t, l: t })), 'Pick…') : c.field === 'subtask' ? sel(c.value, (v) => upd({ value: v }), [{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }], 'Pick…') : <input className="input !py-1" list="auto-tags" value={c.value || ''} onChange={(e) => upd({ value: e.target.value })} />)}
                <button className="icon-btn" onClick={() => setX({ ...x, conditions: x.conditions!.filter((_, j) => j !== i) })}><X size={14} /></button>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center text-[var(--faint)]"><ArrowDown size={16} /></div>
        <div className="rounded-lg border p-3 bg-[var(--subtle)]">
          <div className="flex items-center text-xs font-semibold text-green-600 mb-2">THEN (actions run in order)<button className="ml-auto text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1 font-normal" onClick={() => setX({ ...x, actions: [...(x.actions || []), { type: 'add_comment' }] })}><Plus size={12} /> Add action</button></div>
          {(x.actions || []).map((act, i) => {
            const upd = (p: Partial<AutomationAction>) => setX({ ...x, actions: x.actions!.map((y, j) => (j === i ? { ...y, ...p } : y)) });
            return (
              <div key={i} className="flex gap-2 mb-2 items-start">
                <select className="input !py-1 !w-56 shrink-0" value={act.type} onChange={(e) => upd({ type: e.target.value, value: undefined })}>{ACTIONS.map((a) => <option key={a.type} value={a.type}>{a.label}</option>)}</select>
                <div className="flex-1">{actionParams(act, upd)}</div>
                <button className="icon-btn" onClick={() => setX({ ...x, actions: x.actions!.filter((_, j) => j !== i) })}><X size={14} /></button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-4"><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!x.actions?.length} onClick={save}>{x.id ? 'Save' : 'Create automation'}</button></div>
    </Modal>
  );
}
