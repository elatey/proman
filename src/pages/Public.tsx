import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { backend } from '../lib/backend';
import type { RawItem } from '../lib/types';
import { Logo } from '../components/ui';
import { Html } from '../components/RichEditor';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { PRIORITIES } from '../lib/utils';

function usePublic(id?: string) {
  const [item, setItem] = useState<RawItem | null | undefined>(undefined);
  useEffect(() => { if (id) backend.getPublicItem(id).then(setItem).catch(() => setItem(null)); }, [id]);
  return item;
}

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-full bg-[var(--subtle)] py-10 px-4">
    <div className="mx-auto max-w-2xl">{children}
      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[var(--faint)]"><Logo size={16} /> Powered by ProMan</div>
    </div>
  </div>
);

export function PublicForm() {
  const { id } = useParams();
  const item = usePublic(id);
  const [values, setValues] = useState<Record<string, any>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (item === undefined) return <Frame><div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div></Frame>;
  if (!item || item.data?.type !== 'form') return <Frame><div className="card p-10 text-center">This form is not available.</div></Frame>;
  const form = item.data.config.form || { title: item.data.name, fields: [] };
  if (done) return <Frame><div className="card p-10 text-center"><CheckCircle2 className="mx-auto text-green-600" size={40} /><div className="mt-3 text-lg font-semibold">Thanks! Your response was submitted.</div>
    <button className="btn btn-outline mt-5" onClick={() => { setValues({}); setDone(false); }}>Submit another response</button></div></Frame>;
  return (
    <Frame>
      <form className="card overflow-hidden" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setErr('');
        try {
          const fields: Record<string, any> = {};
          const task: Record<string, any> = { name: values.name || form.title + ' submission', description: values.description ? `<p>${String(values.description).replace(/</g, '&lt;')}</p>` : '', assignees: form.defaultAssignee ? [form.defaultAssignee] : [], watchers: [], tags: [], order: Date.now(), status: form.defaultStatus || null };
          for (const f of form.fields) {
            if (['name', 'description'].includes(f.key)) continue;
            if (f.key === 'priority') task.priority = values.priority ? Number(values.priority) : null;
            else if (f.key === 'dueDate') task.dueDate = values.dueDate ? new Date(values.dueDate).toISOString() : null;
            else if (values[f.key] !== undefined) fields[f.key] = f.type === 'number' || f.type === 'money' ? Number(values[f.key]) : values[f.key];
          }
          task.fields = fields;
          await backend.submitForm(item.id, task);
          setDone(true);
        } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
      }}>
        <div className="h-2 bg-accent" />
        <div className="p-8">
          <h1 className="text-2xl font-bold">{form.title}</h1>
          {form.description && <p className="mt-2 text-[var(--muted)] whitespace-pre-wrap">{form.description}</p>}
          <div className="mt-6 space-y-5">
            {form.fields.map((f: any) => (
              <div key={f.id}>
                <div className="font-medium text-sm mb-1.5">{f.label}{f.required && <span className="text-red-500"> *</span>}</div>
                {f.help && <div className="text-xs text-[var(--muted)] mb-1.5">{f.help}</div>}
                <FieldInput f={f} value={values[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} />
              </div>
            ))}
          </div>
          {err && <div className="mt-4 text-sm text-red-600">{err}</div>}
          <button className="btn btn-primary mt-8 !px-6 !py-2.5" disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />}{form.submitText || 'Submit'}</button>
        </div>
      </form>
    </Frame>
  );
}

export function FieldInput({ f, value, onChange }: { f: any; value: any; onChange: (v: any) => void }) {
  const req = !!f.required;
  if (f.key === 'description' || f.type === 'textarea') return <textarea className="input" rows={4} required={req} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  if (f.key === 'priority') return <select className="input" required={req} value={value || ''} onChange={(e) => onChange(e.target.value)}><option value="">Select…</option>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>;
  if (f.key === 'dueDate' || f.type === 'date') return <input type="date" className="input" required={req} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  if (f.type === 'dropdown') return <select className="input" required={req} value={value || ''} onChange={(e) => onChange(e.target.value)}><option value="">Select…</option>{(f.options || []).map((o: any) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>;
  if (f.type === 'labels') return <div className="flex flex-wrap gap-2">{(f.options || []).map((o: any) => {
    const on = (value || []).includes(o.id);
    return <button type="button" key={o.id} onClick={() => onChange(on ? value.filter((x: string) => x !== o.id) : [...(value || []), o.id])} className="rounded-full px-3 py-1 text-sm border" style={on ? { background: o.color, color: '#fff', borderColor: o.color } : {}}>{o.label}</button>;
  })}</div>;
  if (f.type === 'checkbox') return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />;
  if (f.type === 'rating') return <div className="flex gap-1 text-xl">{Array.from({ length: f.max || 5 }, (_, i) => <button type="button" key={i} onClick={() => onChange(i + 1)} className={i < (value || 0) ? '' : 'opacity-25'}>⭐</button>)}</div>;
  const type = f.type === 'number' || f.type === 'money' ? 'number' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : f.type === 'phone' ? 'tel' : 'text';
  return <input className="input" type={type} required={req} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
}

export function PublicShare() {
  const { id } = useParams();
  const item = usePublic(id);
  if (item === undefined) return <Frame><div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div></Frame>;
  if (!item) return <Frame><div className="card p-10 text-center">This link is private or no longer exists.</div></Frame>;
  const d = item.data;
  return (
    <Frame>
      <div className="card p-8">
        {item.kind === 'doc' ? (
          <><div className="text-3xl mb-1">{d.icon}</div><h1 className="text-3xl font-bold mb-6">{d.title}</h1><Html html={d.content} className="!text-[15px]" /></>
        ) : (
          <>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide mb-1">Task</div>
            <h1 className="text-2xl font-bold">{d.name}</h1>
            <div className="mt-3 flex gap-4 text-sm text-[var(--muted)]">
              {d.dueDate && <span>Due {new Date(d.dueDate).toLocaleDateString()}</span>}
              {d.priority && <span>Priority: {PRIORITIES.find((p) => p.value === d.priority)?.label}</span>}
            </div>
            {d.description && <Html html={d.description} className="mt-6" />}
            {(d.checklists || []).map((c: any) => (
              <div key={c.id} className="mt-6"><div className="font-semibold mb-2">{c.name}</div>
                {c.items.map((i: any) => <div key={i.id} className="flex gap-2 text-sm py-0.5"><input type="checkbox" readOnly checked={i.done} /> <span className={i.done ? 'line-through text-[var(--muted)]' : ''}>{i.text}</span></div>)}
              </div>
            ))}
          </>
        )}
      </div>
    </Frame>
  );
}
