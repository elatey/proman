import { useState } from 'react';
import { Check, MapPin, Paperclip, ExternalLink, Play, ThumbsUp } from 'lucide-react';
import type { FieldDef, Task } from '../../lib/types';
import { useStore, getState, isClosed } from '../../lib/store';
import { Popover, DatePicker, PeopleList, AvatarStack, ProgressBar, Avatar } from '../ui';
import { cn, alpha, fmtDue } from '../../lib/utils';
import { evalFormula } from '../../lib/filters';
import { backend } from '../../lib/backend';
import { runAutomations } from '../../lib/automations';

const money = (v: number, cur = 'USD') => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(v); } catch { return cur + ' ' + v; }
};

export function autoProgress(t: Task): number {
  const s = getState();
  const subs = Object.values(s.data.task).filter((x) => x.parentId === t.id);
  const items = (t.checklists || []).flatMap((c) => c.items);
  const total = subs.length + items.length;
  if (!total) return isClosed(t) ? 100 : 0;
  const done = subs.filter(isClosed).length + items.filter((i) => i.done).length;
  return Math.round((done / total) * 100);
}

/** Display + inline editor for a custom field value. */
export function FieldValue({ f, task, compact }: { f: FieldDef; task: Task; compact?: boolean }) {
  const v = task.fields?.[f.id];
  const set = (val: any) => getState().updateTask(task.id, { fields: { ...(task.fields || {}), [f.id]: val } });
  const empty = <span className="text-[var(--faint)] text-[13px]">{compact ? '–' : 'Empty'}</span>;
  const box = cn('min-h-[26px] w-full flex items-center rounded px-1.5 text-[13px] hover:bg-[var(--hover)]', f.required && (v == null || v === '' || (Array.isArray(v) && !v.length)) && 'ring-1 ring-amber-400');

  switch (f.type) {
    case 'checkbox':
      return <button className={cn(box, 'justify-start')} onClick={(e) => { e.stopPropagation(); set(!v); }}>
        <span className={cn('w-4 h-4 rounded border flex items-center justify-center', v ? 'bg-accent border-transparent' : 'border-[var(--border-strong)]')}>{v && <Check size={11} strokeWidth={3} />}</span>
      </button>;
    case 'dropdown': {
      const o = f.options?.find((x) => x.id === v);
      return (
        <Popover triggerClassName="w-full" trigger={<button className={box}>{o ? <span className="rounded px-1.5 py-0.5 text-xs font-medium truncate" style={{ background: o.color, color: '#fff' }}>{o.label}</span> : empty}</button>} width={220}>
          {(close) => <div className="p-1">{(f.options || []).map((x) => <button key={x.id} className="menu-item" onClick={() => { set(x.id === v ? null : x.id); close(); }}><span className="w-3 h-3 rounded" style={{ background: x.color }} /><span className="flex-1">{x.label}</span>{x.id === v && <Check size={14} />}</button>)}</div>}
        </Popover>
      );
    }
    case 'labels': {
      const ids: string[] = Array.isArray(v) ? v : [];
      return (
        <Popover triggerClassName="w-full" trigger={<button className={cn(box, 'flex-wrap gap-1 py-0.5')}>{ids.length ? ids.map((id) => { const o = f.options?.find((x) => x.id === id); return o ? <span key={id} className="rounded px-1.5 text-xs font-medium" style={{ background: alpha(o.color, 0.18), color: o.color }}>{o.label}</span> : null; }) : empty}</button>} width={220}>
          <div className="p-1">{(f.options || []).map((x) => <button key={x.id} className="menu-item" onClick={() => set(ids.includes(x.id) ? ids.filter((i) => i !== x.id) : [...ids, x.id])}><span className="w-3 h-3 rounded" style={{ background: x.color }} /><span className="flex-1">{x.label}</span>{ids.includes(x.id) && <Check size={14} />}</button>)}</div>
        </Popover>
      );
    }
    case 'date':
      return <DatePicker value={v} onChange={(d) => set(d)} trigger={<button className={box}>{v ? fmtDue(v) : empty}</button>} />;
    case 'people': {
      const ids: string[] = Array.isArray(v) ? v : [];
      return <Popover triggerClassName="w-full" trigger={<button className={box}>{ids.length ? <AvatarStack ids={ids} size={20} /> : empty}</button>}><PeopleList value={ids} onChange={set} /></Popover>;
    }
    case 'rating': {
      const max = f.max || 5;
      return <div className={cn(box, 'gap-0.5')}>{Array.from({ length: max }, (_, i) => <button key={i} onClick={(e) => { e.stopPropagation(); set(v === i + 1 ? 0 : i + 1); }} className={cn('text-[13px] leading-none', i < (v || 0) ? '' : 'opacity-20 grayscale hover:opacity-60')}>{f.emoji || '⭐'}</button>)}</div>;
    }
    case 'progress':
      return <div className={cn(box, 'gap-2')}><ProgressBar value={Number(v) || 0} className="flex-1" /><input type="number" min={0} max={100} className="w-10 bg-transparent text-xs text-right outline-none" value={v ?? ''} placeholder="0" onChange={(e) => set(Math.max(0, Math.min(100, Number(e.target.value))))} onClick={(e) => e.stopPropagation()} /><span className="text-xs text-[var(--muted)]">%</span></div>;
    case 'progressAuto': {
      const p = autoProgress(task);
      return <div className={cn(box, 'gap-2')}><ProgressBar value={p} className="flex-1" color="#30A46C" /><span className="text-xs text-[var(--muted)] w-8 text-right">{p}%</span></div>;
    }
    case 'formula': {
      const r = evalFormula(f.formula || '', task);
      return <div className={cn(box, 'font-mono text-xs')}>{String(r)}</div>;
    }
    case 'files': return <FilesField f={f} task={task} compact={compact} />;
    case 'relationship': return <RelationshipField f={f} task={task} />;
    case 'voting': {
      const ids: string[] = Array.isArray(v) ? v : [];
      const me = getState().user!.id;
      return <button className={cn(box, 'gap-1')} onClick={(e) => { e.stopPropagation(); set(ids.includes(me) ? ids.filter((x) => x !== me) : [...ids, me]); }}>
        <ThumbsUp size={13} className={ids.includes(me) ? 'text-accent' : 'text-[var(--muted)]'} fill={ids.includes(me) ? 'currentColor' : 'none'} /> <span className="text-xs">{ids.length}</span>
      </button>;
    }
    case 'button':
      return <button className="btn btn-outline !py-0.5 !px-2 !text-xs" onClick={(e) => {
        e.stopPropagation();
        const s = getState();
        runAutomations({ type: 'button', task, prev: task, fieldId: f.id }, {
          get: getState, updateTask: (i, p) => s.updateTask(i, p, { fromAutomation: true }), createTask: (x) => s.createTask(x, { fromAutomation: true }),
          deleteTask: s.deleteTask, duplicateTask: s.duplicateTask, addComment: s.addComment, create: s.create, update: s.update,
        });
        s.toast(`“${f.name}” ran`, 'success');
      }}><Play size={11} /> {f.name}</button>;
    case 'signature':
      return v ? <button className={cn(box, 'italic font-serif')} onClick={() => { const n = prompt('Type your full name to sign', v); if (n !== null) set(n); }}>{v}</button>
        : <button className={box} onClick={() => { const n = prompt('Type your full name to sign'); if (n) set(n); }}>{compact ? empty : <span className="text-xs text-accent">Sign</span>}</button>;
    case 'location': return <LocationField f={f} task={task} />;
    default: return <TextLike f={f} v={v} set={set} box={box} empty={empty} compact={compact} />;
  }
}

function TextLike({ f, v, set, box, empty, compact }: any) {
  const [edit, setEdit] = useState(false);
  const numeric = f.type === 'number' || f.type === 'money';
  if (edit) {
    if (f.type === 'textarea')
      return <textarea autoFocus className="input !text-[13px]" rows={3} defaultValue={v || ''} onBlur={(e) => { set(e.target.value); setEdit(false); }} onKeyDown={(e) => e.key === 'Escape' && setEdit(false)} />;
    return <input autoFocus className="input !py-0.5 !text-[13px]" type={numeric ? 'number' : f.type === 'email' ? 'email' : 'text'} defaultValue={v ?? ''}
      onBlur={(e) => { const x = e.target.value; set(numeric ? (x === '' ? null : Number(x)) : x); setEdit(false); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(false); }} onClick={(e) => e.stopPropagation()} />;
  }
  let display: React.ReactNode = v;
  if (v == null || v === '') display = empty;
  else if (f.type === 'money') display = money(Number(v), f.currency);
  else if (f.type === 'number') display = Number(v).toLocaleString();
  else if (f.type === 'url') display = <a href={/^https?:/.test(v) ? v : 'https://' + v} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-accent truncate inline-flex items-center gap-1">{v.replace(/^https?:\/\//, '')}<ExternalLink size={11} /></a>;
  else if (f.type === 'email') display = <a href={'mailto:' + v} onClick={(e) => e.stopPropagation()} className="text-accent truncate">{v}</a>;
  else if (f.type === 'phone') display = <a href={'tel:' + v} onClick={(e) => e.stopPropagation()} className="text-accent">{v}</a>;
  return <button className={cn(box, 'text-left', numeric && compact && 'justify-end')} onClick={(e) => { e.stopPropagation(); setEdit(true); }}><span className={cn('truncate', f.type === 'textarea' && !compact && 'whitespace-pre-wrap')}>{display}</span></button>;
}

function FilesField({ f, task, compact }: { f: FieldDef; task: Task; compact?: boolean }) {
  const v: { name: string; url: string }[] = Array.isArray(task.fields?.[f.id]) ? task.fields![f.id] : [];
  const [busy, setBusy] = useState(false);
  const upload = () => {
    const i = document.createElement('input');
    i.type = 'file';
    i.onchange = async () => {
      const file = i.files?.[0];
      if (!file) return;
      setBusy(true);
      try {
        const url = await backend.uploadFile(getState().workspace!.id, file, file.name);
        getState().updateTask(task.id, { fields: { ...(task.fields || {}), [f.id]: [...v, { name: file.name, url }] } });
      } catch (e: any) { getState().toast(e.message, 'error'); } finally { setBusy(false); }
    };
    i.click();
  };
  return (
    <div className="min-h-[26px] flex items-center gap-1 flex-wrap px-1.5 text-[13px]">
      {v.map((x, i) => <a key={i} href={x.url} target="_blank" rel="noreferrer" download={x.name} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded bg-[var(--subtle)] border px-1.5 text-xs max-w-[140px] truncate"><Paperclip size={11} />{x.name}</a>)}
      <button className="text-xs text-[var(--muted)] hover:text-accent" onClick={(e) => { e.stopPropagation(); upload(); }}>{busy ? 'Uploading…' : compact && v.length ? '+' : '+ Add file'}</button>
    </div>
  );
}

function RelationshipField({ f, task }: { f: FieldDef; task: Task }) {
  const tasks = useStore((s) => s.data.task);
  const ids: string[] = Array.isArray(task.fields?.[f.id]) ? task.fields![f.id] : [];
  const [q, setQ] = useState('');
  const set = (val: string[]) => getState().updateTask(task.id, { fields: { ...(task.fields || {}), [f.id]: val } });
  return (
    <Popover triggerClassName="w-full" width={300} trigger={
      <button className="min-h-[26px] w-full flex items-center gap-1 flex-wrap rounded px-1.5 text-[13px] hover:bg-[var(--hover)]">
        {ids.length ? ids.map((id) => tasks[id] && <span key={id} className="rounded bg-[var(--subtle)] border px-1.5 text-xs truncate max-w-[160px]">{tasks[id].name}</span>) : <span className="text-[var(--faint)]">Empty</span>}
      </button>
    }>
      <div className="p-2">
        <input autoFocus className="input !py-1.5 mb-1" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-60 overflow-auto">
          {Object.values(tasks).filter((t) => t.id !== task.id && t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30).map((t) => (
            <button key={t.id} className="menu-item" onClick={() => set(ids.includes(t.id) ? ids.filter((x) => x !== t.id) : [...ids, t.id])}><span className="flex-1 truncate">{t.name}</span>{ids.includes(t.id) && <Check size={14} />}</button>
          ))}
        </div>
      </div>
    </Popover>
  );
}

function LocationField({ f, task }: { f: FieldDef; task: Task }) {
  const v = task.fields?.[f.id] as { address: string; lat: number; lng: number } | undefined;
  const [busy, setBusy] = useState(false);
  const edit = async () => {
    const address = prompt('Address', v?.address || '');
    if (address == null) return;
    if (!address) { getState().updateTask(task.id, { fields: { ...(task.fields || {}), [f.id]: null } }); return; }
    setBusy(true);
    try {
      // Free geocoding via OpenStreetMap Nominatim (low volume, user-triggered only).
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(address)).then((r) => r.json());
      const hit = r?.[0];
      getState().updateTask(task.id, { fields: { ...(task.fields || {}), [f.id]: { address: hit?.display_name || address, lat: hit ? Number(hit.lat) : 0, lng: hit ? Number(hit.lon) : 0 } } });
      if (!hit) getState().toast('Address saved, but it could not be placed on the map', 'error');
    } catch { getState().updateTask(task.id, { fields: { ...(task.fields || {}), [f.id]: { address, lat: 0, lng: 0 } } }); } finally { setBusy(false); }
  };
  return <button className="min-h-[26px] w-full flex items-center gap-1 rounded px-1.5 text-[13px] hover:bg-[var(--hover)] text-left" onClick={(e) => { e.stopPropagation(); edit(); }}>
    <MapPin size={13} className="text-[var(--muted)] shrink-0" />{busy ? 'Locating…' : v?.address ? <span className="truncate">{v.address}</span> : <span className="text-[var(--faint)]">Empty</span>}
  </button>;
}

export function fieldText(f: FieldDef, t: Task): string {
  const v = t.fields?.[f.id];
  if (v == null) return '';
  switch (f.type) {
    case 'dropdown': return f.options?.find((o) => o.id === v)?.label || '';
    case 'labels': return (v as string[]).map((id) => f.options?.find((o) => o.id === id)?.label).filter(Boolean).join(', ');
    case 'people': return (v as string[]).map((id) => getState().members.find((m) => m.user_id === id)?.profile.name).join(', ');
    case 'files': return (v as any[]).map((x) => x.name).join(', ');
    case 'location': return v.address || '';
    case 'formula': return String(evalFormula(f.formula || '', t));
    case 'voting': return String((v as any[]).length);
    case 'relationship': return (v as string[]).map((id) => getState().data.task[id]?.name).filter(Boolean).join(', ');
    default: return String(v);
  }
}
