import { useState } from 'react';
import { GripVertical, Plus, Trash2, Copy, ExternalLink, Globe, Code } from 'lucide-react';
import { useStore, getState, statusesForList } from '../../lib/store';
import { fieldsForLists } from '../../lib/filters';
import { Toggle, Popover } from '../ui';
import { FieldInput } from '../../pages/Public';
import { uid, cn } from '../../lib/utils';
import type { FormConfig, FormField } from '../../lib/types';
import type { ViewProps } from '../../pages/LocationPage';

export default function FormView({ view, listIds, allTasks }: ViewProps) {
  const cfg = view.config;
  const form: FormConfig = cfg.form || { title: view.name, fields: [] };
  const members = useStore((s) => s.members);
  const [drag, setDrag] = useState<number | null>(null);
  const save = (p: Partial<FormConfig>) => {
    const next = { ...form, ...p };
    getState().update('view', view.id, { config: { ...cfg, form: next } });
  };
  const listId = view.location.type === 'list' ? view.location.id : listIds[0];
  const custom = fieldsForLists(listIds).filter((f) => !['formula', 'progressAuto', 'button', 'relationship', 'files', 'people', 'voting', 'signature', 'location'].includes(f.type));
  const builtin = [{ key: 'name', label: 'Task name' }, { key: 'description', label: 'Description' }, { key: 'priority', label: 'Priority' }, { key: 'dueDate', label: 'Due date' }];
  const used = new Set(form.fields.map((f) => f.key));
  const addField = (key: string, label: string) => {
    const cf = getState().data.field[key];
    save({ fields: [...form.fields, { id: uid(), key, label, required: key === 'name', ...(cf ? { type: cf.type, options: cf.options, max: cf.max } : {}) } as FormField] });
  };
  const upd = (id: string, p: Partial<FormField>) => save({ fields: form.fields.map((f) => (f.id === id ? { ...f, ...p } : f)) });
  const link = location.href.split('#')[0] + '#/form/' + view.id;
  const submissions = allTasks.filter((t) => t.fromForm === view.id).length;

  if (view.location.type !== 'list') return (
    <div className="p-10 text-center text-sm text-[var(--muted)]">Forms create tasks in a specific List. Add this view from a List to build a form.</div>
  );

  return (
    <div className="h-full flex">
      <div className="w-64 shrink-0 border-r overflow-y-auto p-4 bg-[var(--subtle)]">
        <div className="label mb-2">Task fields</div>
        {builtin.map((b) => <button key={b.key} disabled={used.has(b.key)} onClick={() => addField(b.key, b.label)} className="w-full menu-item border bg-[var(--panel)] mb-1.5 disabled:opacity-40"><Plus size={13} />{b.label}</button>)}
        <div className="label mt-4 mb-2">Custom Fields</div>
        {custom.map((f) => <button key={f.id} disabled={used.has(f.id)} onClick={() => addField(f.id, f.name)} className="w-full menu-item border bg-[var(--panel)] mb-1.5 disabled:opacity-40"><Plus size={13} />{f.name}</button>)}
        {!custom.length && <div className="text-xs text-[var(--muted)]">Add Custom Fields to this List to collect more data.</div>}
        <div className="label mt-6 mb-2">Settings</div>
        <div className="space-y-3 text-[13px]">
          <div><div className="text-xs text-[var(--muted)] mb-1">Assign submissions to</div>
            <select className="input !py-1" value={form.defaultAssignee || ''} onChange={(e) => save({ defaultAssignee: e.target.value || undefined })}><option value="">Nobody</option>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile.name}</option>)}</select></div>
          <div><div className="text-xs text-[var(--muted)] mb-1">Status for new submissions</div>
            <select className="input !py-1" value={form.defaultStatus || ''} onChange={(e) => save({ defaultStatus: e.target.value || undefined })}><option value="">Default</option>{statusesForList(listId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><div className="text-xs text-[var(--muted)] mb-1">Submit button text</div><input className="input !py-1" value={form.submitText || ''} placeholder="Submit" onChange={(e) => save({ submitText: e.target.value })} /></div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-[var(--subtle)]">
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-2.5 border-b bg-[var(--panel)] text-[13px]">
          <Toggle on={!!view.public} onChange={(v) => getState().update('view', view.id, { public: v })} label={<span className="flex items-center gap-1.5"><Globe size={14} /> Share publicly</span>} />
          {view.public && <>
            <input readOnly className="input !py-1 !text-xs flex-1 max-w-md" value={link} />
            <button className="btn btn-outline !py-1" onClick={() => { navigator.clipboard.writeText(link); getState().toast('Form link copied'); }}><Copy size={13} /> Copy</button>
            <a className="btn btn-outline !py-1" href={link} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open</a>
            <Popover align="end" width={380} trigger={<button className="btn btn-outline !py-1"><Code size={13} /> Embed</button>}>
              <div className="p-3"><div className="text-xs text-[var(--muted)] mb-1">Paste this into your website:</div><textarea readOnly className="input font-mono !text-[11px]" rows={3} value={`<iframe src="${link}" width="100%" height="800" frameborder="0"></iframe>`} /></div>
            </Popover>
          </>}
          <div className="flex-1" />
          <span className="text-xs text-[var(--muted)]">{submissions} submissions</span>
        </div>
        <div className="max-w-2xl mx-auto my-8 card overflow-hidden">
          <div className="h-2 bg-accent" />
          <div className="p-8">
            <input className="w-full text-2xl font-bold bg-transparent outline-none" value={form.title} onChange={(e) => save({ title: e.target.value })} placeholder="Form title" />
            <textarea className="w-full mt-2 bg-transparent outline-none resize-none text-[var(--muted)]" rows={2} value={form.description || ''} onChange={(e) => save({ description: e.target.value })} placeholder="Add a description" />
            <div className="mt-4 space-y-3">
              {form.fields.map((f, i) => (
                <div key={f.id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag == null) return; const n = [...form.fields]; const [m] = n.splice(drag, 1); n.splice(i, 0, m); save({ fields: n }); setDrag(null); }}
                  className="group relative rounded-lg border p-4 hover:border-[var(--accent)]">
                  <GripVertical size={14} className="absolute left-1 top-5 text-[var(--faint)] opacity-0 group-hover:opacity-100 cursor-grab" />
                  <div className="flex items-center gap-2 mb-2">
                    <input className="flex-1 font-medium text-sm bg-transparent outline-none" value={f.label} onChange={(e) => upd(f.id, { label: e.target.value })} />
                    <Toggle on={!!f.required} onChange={(v) => upd(f.id, { required: v })} label={<span className="text-xs">Required</span>} />
                    <button className="icon-btn !w-6 !h-6" disabled={f.key === 'name'} onClick={() => save({ fields: form.fields.filter((x) => x.id !== f.id) })}><Trash2 size={13} /></button>
                  </div>
                  <input className="w-full text-xs text-[var(--muted)] bg-transparent outline-none mb-2" placeholder="Help text (optional)" value={f.help || ''} onChange={(e) => upd(f.id, { help: e.target.value })} />
                  <div className="pointer-events-none opacity-70"><FieldInput f={f} value={undefined} onChange={() => {}} /></div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary mt-6 pointer-events-none">{form.submitText || 'Submit'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
