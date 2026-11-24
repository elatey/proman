import { useState } from 'react';
import { GripVertical, Plus, Trash2, X } from 'lucide-react';
import { Modal, ColorDots, Toggle, Tabs, Popover } from './ui';
import { useStore, getState, statusesForList } from '../lib/store';
import { uid, STATUS_COLORS, defaultStatuses, cn, COLORS } from '../lib/utils';
import type { Space, Folder, List, Status, StatusType, FieldDef, FieldType, LocationRef } from '../lib/types';

export const FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
  { type: 'text', label: 'Text', icon: 'T' },
  { type: 'textarea', label: 'Text area (Long text)', icon: '¶' },
  { type: 'number', label: 'Number', icon: '#' },
  { type: 'money', label: 'Money', icon: '$' },
  { type: 'dropdown', label: 'Dropdown', icon: '▾' },
  { type: 'labels', label: 'Labels', icon: '◉' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑' },
  { type: 'date', label: 'Date', icon: '📅' },
  { type: 'people', label: 'People', icon: '👤' },
  { type: 'email', label: 'Email', icon: '@' },
  { type: 'phone', label: 'Phone', icon: '☎' },
  { type: 'url', label: 'Website', icon: '🔗' },
  { type: 'rating', label: 'Rating', icon: '★' },
  { type: 'progress', label: 'Progress (Manual)', icon: '▰' },
  { type: 'progressAuto', label: 'Progress (Auto)', icon: '▰' },
  { type: 'formula', label: 'Formula', icon: 'ƒ' },
  { type: 'location', label: 'Location', icon: '📍' },
  { type: 'files', label: 'Files', icon: '📎' },
  { type: 'relationship', label: 'Relationship', icon: '⇄' },
  { type: 'voting', label: 'Voting', icon: '👍' },
  { type: 'signature', label: 'Signature', icon: '✍' },
  { type: 'button', label: 'Button', icon: '▶' },
];

export function StatusEditor({ value, onChange }: { value: Status[]; onChange: (s: Status[]) => void }) {
  const [drag, setDrag] = useState<number | null>(null);
  const groups: { type: StatusType; label: string }[] = [
    { type: 'notstarted', label: 'Not started' }, { type: 'active', label: 'Active' }, { type: 'done', label: 'Done' }, { type: 'closed', label: 'Closed' },
  ];
  const upd = (id: string, p: Partial<Status>) => onChange(value.map((s) => (s.id === id ? { ...s, ...p } : s)));
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.type}>
          <div className="label mb-1.5">{g.label}</div>
          <div className="space-y-1.5">
            {value.map((s, i) => s.type !== g.type ? null : (
              <div key={s.id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (drag == null) return; const n = [...value]; const [m] = n.splice(drag, 1); n.splice(i, 0, { ...m, type: g.type }); onChange(n); setDrag(null); }}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 bg-[var(--panel)]">
                <GripVertical size={14} className="text-[var(--faint)] cursor-grab" />
                <Popover trigger={<button className="w-4 h-4 rounded-full shrink-0" style={{ background: s.color }} />}>
                  {(close) => <div className="p-3 w-56"><ColorDots colors={STATUS_COLORS} value={s.color} onChange={(c) => { upd(s.id, { color: c }); close(); }} /></div>}
                </Popover>
                <input className="flex-1 bg-transparent outline-none text-[13px] font-medium uppercase" value={s.name} onChange={(e) => upd(s.id, { name: e.target.value.toUpperCase() })} />
                <input type="number" min={0} title="WIP limit (Board view)" placeholder="WIP" className="w-14 bg-transparent text-xs text-[var(--muted)] outline-none text-right" value={s.wip || ''} onChange={(e) => upd(s.id, { wip: Number(e.target.value) || undefined })} />
                <select className="text-xs bg-transparent text-[var(--muted)] outline-none" value={s.type} onChange={(e) => upd(s.id, { type: e.target.value as StatusType })}>
                  {groups.map((x) => <option key={x.type} value={x.type}>{x.label}</option>)}
                </select>
                <button className="icon-btn !w-6 !h-6" disabled={value.length <= 1} onClick={() => onChange(value.filter((x) => x.id !== s.id))}><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="text-xs text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1 px-1" onClick={() => onChange([...value, { id: uid(), name: 'NEW STATUS', color: STATUS_COLORS[value.length % STATUS_COLORS.length], type: g.type }])}><Plus size={13} /> Add status</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FieldManager({ scope }: { scope: LocationRef }) {
  const fields = useStore((s) => s.data.field);
  const list = Object.values(fields).filter((f) => f.scope.type === scope.type && f.scope.id === scope.id);
  const global = Object.values(fields).filter((f) => f.scope.type === 'everything');
  const [editing, setEditing] = useState<FieldDef | null>(null);
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {list.map((f) => <FieldRow key={f.id} f={f} onEdit={() => setEditing(f)} />)}
        {!list.length && <div className="text-sm text-[var(--muted)]">No Custom Fields on this location yet.</div>}
      </div>
      <Popover trigger={<button className="btn btn-outline"><Plus size={14} /> New field</button>} width={260}>
        {(close) => (
          <div className="p-1 max-h-80 overflow-auto">
            {FIELD_TYPES.map((t) => (
              <button key={t.type} className="menu-item" onClick={() => {
                close();
                const f = getState().create('field', { name: t.label, type: t.type, scope, options: ['dropdown', 'labels'].includes(t.type) ? [{ id: uid(), label: 'Option 1', color: COLORS[0] }, { id: uid(), label: 'Option 2', color: COLORS[4] }] : undefined, max: t.type === 'rating' ? 5 : undefined, currency: t.type === 'money' ? 'USD' : undefined });
                setEditing(f);
              }}><span className="w-5 text-center text-[var(--muted)]">{t.icon}</span>{t.label}</button>
            ))}
          </div>
        )}
      </Popover>
      {global.length > 0 && (
        <div className="pt-3 border-t">
          <div className="label mb-1.5">Workspace-wide fields (available everywhere)</div>
          {global.map((f) => <FieldRow key={f.id} f={f} onEdit={() => setEditing(f)} />)}
        </div>
      )}
      {editing && <FieldEditModal field={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function FieldRow({ f, onEdit }: { f: FieldDef; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 hover-row cursor-pointer" onClick={onEdit}>
      <span className="w-5 text-center text-[var(--muted)]">{FIELD_TYPES.find((t) => t.type === f.type)?.icon}</span>
      <span className="flex-1 font-medium text-[13px]">{f.name}</span>
      <span className="text-xs text-[var(--muted)]">{FIELD_TYPES.find((t) => t.type === f.type)?.label}</span>
    </div>
  );
}

export function FieldEditModal({ field, onClose }: { field: FieldDef; onClose: () => void }) {
  const live = useStore((s) => s.data.field[field.id]) || field;
  const upd = (p: Partial<FieldDef>) => getState().update('field', field.id, p);
  return (
    <Modal open onClose={onClose} title="Edit Custom Field" width={460}>
      <div className="p-5 space-y-4">
        <div><div className="label mb-1">Field name</div><input className="input" autoFocus value={live.name} onChange={(e) => upd({ name: e.target.value })} /></div>
        <div><div className="label mb-1">Type</div>
          <select className="input" value={live.type} onChange={(e) => upd({ type: e.target.value as FieldType })}>{FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</select>
        </div>
        {(live.type === 'dropdown' || live.type === 'labels') && (
          <div>
            <div className="label mb-1.5">Options</div>
            <div className="space-y-1.5">
              {(live.options || []).map((o) => (
                <div key={o.id} className="flex items-center gap-2">
                  <Popover trigger={<button className="w-5 h-5 rounded" style={{ background: o.color }} />}>
                    {(close) => <div className="p-3 w-56"><ColorDots value={o.color} onChange={(c) => { upd({ options: live.options!.map((x) => (x.id === o.id ? { ...x, color: c } : x)) }); close(); }} /></div>}
                  </Popover>
                  <input className="input !py-1" value={o.label} onChange={(e) => upd({ options: live.options!.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })} />
                  <button className="icon-btn" onClick={() => upd({ options: live.options!.filter((x) => x.id !== o.id) })}><X size={14} /></button>
                </div>
              ))}
              <button className="text-xs text-accent flex items-center gap-1" onClick={() => upd({ options: [...(live.options || []), { id: uid(), label: 'Option ' + ((live.options?.length || 0) + 1), color: COLORS[(live.options?.length || 0) % COLORS.length] }] })}><Plus size={13} /> Add option</button>
            </div>
          </div>
        )}
        {live.type === 'money' && <div><div className="label mb-1">Currency</div><select className="input" value={live.currency || 'USD'} onChange={(e) => upd({ currency: e.target.value })}>{['USD', 'EUR', 'GBP', 'GHS', 'NGN', 'KES', 'ZAR', 'CAD', 'AUD', 'JPY', 'INR', 'BRL'].map((c) => <option key={c}>{c}</option>)}</select></div>}
        {live.type === 'rating' && <div className="flex gap-3"><div className="flex-1"><div className="label mb-1">Emoji</div><input className="input" value={live.emoji || '⭐'} onChange={(e) => upd({ emoji: e.target.value })} /></div><div className="w-24"><div className="label mb-1">Max</div><input type="number" min={1} max={10} className="input" value={live.max || 5} onChange={(e) => upd({ max: Number(e.target.value) })} /></div></div>}
        {live.type === 'formula' && (
          <div><div className="label mb-1">Formula</div>
            <input className="input font-mono text-xs" placeholder="{Budget} - {Cost}" value={live.formula || ''} onChange={(e) => upd({ formula: e.target.value })} />
            <div className="text-xs text-[var(--muted)] mt-1">Reference fields with {'{Field name}'}. Use + − × ÷ and parentheses. Also: {'{estimate}'} (hours), {'{points}'}, DAYS_UNTIL_DUE.</div>
          </div>
        )}
        {live.type === 'button' && <div className="text-xs text-[var(--muted)]">Create an Automation with the trigger “Button Custom Field clicked” and pick this field.</div>}
        <Toggle on={!!live.required} onChange={(v) => upd({ required: v })} label="Required (highlighted when empty)" />
        <div className="flex justify-between pt-2">
          <button className="btn btn-ghost text-red-600" onClick={() => { getState().remove('field', field.id); onClose(); }}><Trash2 size={14} /> Delete field</button>
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </Modal>
  );
}

export function SpaceSettingsModal({ space, folder, list, tab, onClose }: { space: Space; folder?: Folder; list?: List; tab: 'general' | 'statuses' | 'fields'; onClose: () => void }) {
  const [t, setT] = useState(tab);
  const target = list || folder || space;
  const inherited = list ? statusesForList(list.id) : folder ? (folder.statuses?.length ? folder.statuses : space.statuses) : space.statuses;
  const own = (target as any).statuses as Status[] | null | undefined;
  const [custom, setCustom] = useState<boolean>(!!own?.length || !list && !folder);
  const [statuses, setStatuses] = useState<Status[]>(own?.length ? own : inherited.length ? inherited.map((s) => ({ ...s })) : defaultStatuses());
  const [name, setName] = useState(space.name);
  const [color, setColor] = useState(space.color);
  const [icon, setIcon] = useState(space.icon || '');
  const members = useStore((s) => s.members);
  const kind = list ? 'list' : folder ? 'folder' : 'space';
  const save = () => {
    const s = getState();
    if (t === 'statuses') {
      const final = custom ? statuses : null;
      // remap tasks whose status no longer exists
      if (final) {
        const ids = new Set(final.map((x) => x.id));
        const listIds = list ? [list.id] : Object.values(s.data.list).filter((l) => (folder ? l.folderId === folder.id : l.spaceId === space.id)).map((l) => l.id);
        for (const task of Object.values(s.data.task)) if (listIds.includes(task.listId) && !ids.has(task.status)) {
          const old = statusesForList(task.listId).find((x) => x.id === task.status);
          const match = final.find((x) => x.name === old?.name) || final.find((x) => x.type === old?.type) || final[0];
          s.update('task', task.id, { status: match.id });
        }
      }
      s.update(kind as any, target.id, { statuses: final } as any);
    }
    if (t === 'general') s.update('space', space.id, { name, color, icon: icon || undefined });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={`${kind === 'space' ? 'Space' : kind === 'folder' ? 'Folder' : 'List'} settings — ${target.name}`} width={560}>
      {kind === 'space' && <Tabs className="px-4" value={t} onChange={setT} tabs={[{ value: 'general', label: 'General' }, { value: 'statuses', label: 'Statuses' }, { value: 'fields', label: 'Custom Fields' }]} />}
      <div className="p-5">
        {t === 'general' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-20"><div className="label mb-1">Icon</div><input className="input text-center" maxLength={2} value={icon} placeholder={name[0]} onChange={(e) => setIcon(e.target.value)} /></div>
              <div className="flex-1"><div className="label mb-1">Name</div><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            </div>
            <div><div className="label mb-2">Color</div><ColorDots value={color} onChange={setColor} /></div>
            <Toggle on={!!space.private} onChange={(v) => getState().update('space', space.id, { private: v, members: v ? Array.from(new Set([...(space.members || []), getState().user!.id])) : space.members })} label="Private Space (only selected members see it)" />
            {space.private && (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const on = (space.members || []).includes(m.user_id);
                  return <button key={m.user_id} onClick={() => getState().update('space', space.id, { members: on ? (space.members || []).filter((x) => x !== m.user_id) : [...(space.members || []), m.user_id] })}
                    className={cn('rounded-full border px-2.5 py-1 text-xs', on && 'bg-accent border-transparent')}>{m.profile.name}</button>;
                })}
              </div>
            )}
          </div>
        )}
        {t === 'statuses' && (
          <div>
            {kind !== 'space' && (
              <div className="mb-4 flex gap-2">
                <button className={cn('btn flex-1 justify-center', !custom ? 'btn-primary' : 'btn-outline')} onClick={() => setCustom(false)}>Inherit from {folder && !list ? 'Space' : 'parent'}</button>
                <button className={cn('btn flex-1 justify-center', custom ? 'btn-primary' : 'btn-outline')} onClick={() => setCustom(true)}>Use custom statuses</button>
              </div>
            )}
            {custom ? <StatusEditor value={statuses} onChange={setStatuses} /> : <div className="text-sm text-[var(--muted)]">Using: {inherited.map((s) => s.name).join(' → ')}</div>}
          </div>
        )}
        {t === 'fields' && <FieldManager scope={{ type: 'space', id: space.id }} />}
      </div>
      {t !== 'fields' && <div className="flex justify-end gap-2 px-5 pb-4"><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></div>}
    </Modal>
  );
}
