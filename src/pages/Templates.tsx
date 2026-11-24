import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutTemplate, Trash2, Layers, CheckSquare, List as ListIcon } from 'lucide-react';
import { useStore, getState, statusesForList } from '../lib/store';
import { SPACE_TEMPLATES, createSpaceFromTemplate } from '../lib/seed';
import { Modal, Tabs, Empty } from '../components/ui';
import { uid } from '../lib/utils';
import type { Template } from '../lib/types';

export default function Templates() {
  const nav = useNavigate();
  const templates = useStore((s) => s.data.template);
  const [tab, setTab] = useState<'spaces' | 'mine'>('spaces');
  const [apply, setApply] = useState<Template | null>(null);
  const mine = Object.values(templates);
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-bold flex items-center gap-2"><LayoutTemplate /> Template Center</h1>
        <p className="text-[var(--muted)] mt-1">Start faster with ready-made Spaces, or reuse your own task and List templates.</p>
        <Tabs className="mt-5" value={tab} onChange={setTab} tabs={[{ value: 'spaces', label: 'Space templates', count: SPACE_TEMPLATES.length }, { value: 'mine', label: 'My templates', count: mine.length }]} />
        {tab === 'spaces' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
            {SPACE_TEMPLATES.map((t) => (
              <div key={t.key} className="card p-4 flex flex-col">
                <div className="flex items-center gap-2 font-semibold"><span className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: t.color }}><Layers size={14} /></span>{t.name}</div>
                <p className="text-xs text-[var(--muted)] mt-2 flex-1">{t.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">{t.statuses.map((s) => <span key={s.name} className="text-[9px] font-semibold px-1 rounded text-white" style={{ background: s.color }}>{s.name}</span>)}</div>
                <button className="btn btn-primary mt-4 justify-center" onClick={() => { const id = createSpaceFromTemplate(t.key); nav('/space/' + id); }}>Use template</button>
              </div>
            ))}
          </div>
        )}
        {tab === 'mine' && (
          <div className="mt-5 card divide-y">
            {mine.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                {t.type === 'task' ? <CheckSquare size={16} className="text-[var(--muted)]" /> : <ListIcon size={16} className="text-[var(--muted)]" />}
                <div className="flex-1 min-w-0"><div className="font-medium">{t.name}</div><div className="text-xs text-[var(--muted)]">{t.type} template · {t.description}</div></div>
                <button className="btn btn-outline !py-1" onClick={() => setApply(t)}>Use</button>
                <button className="icon-btn hover:!text-red-600" onClick={() => getState().remove('template', t.id)}><Trash2 size={14} /></button>
              </div>
            ))}
            {!mine.length && <Empty title="No saved templates" body="Save any task or List as a template from its ••• menu." />}
          </div>
        )}
      </div>
      {apply && <ApplyTemplate t={apply} onClose={() => setApply(null)} />}
    </div>
  );
}

function ApplyTemplate({ t, onClose }: { t: Template; onClose: () => void }) {
  const nav = useNavigate();
  const data = useStore((s) => s.data);
  const [target, setTarget] = useState(t.type === 'task' ? Object.keys(data.list)[0] || '' : Object.keys(data.space)[0] || '');
  const [name, setName] = useState(t.type === 'task' ? t.name : t.payload?.list?.name || t.name);
  const go = () => {
    const s = getState();
    if (t.type === 'task') {
      const p = t.payload;
      const task = s.createTask({ name, listId: target, description: p.description, checklists: (p.checklists || []).map((c: any) => ({ ...c, id: uid(), items: c.items.map((i: any) => ({ ...i, id: uid(), done: false })) })), tags: p.tags || [], priority: p.priority || null, type: p.type || 'task' });
      for (const sub of p.subtasks || []) s.createTask({ name: sub.name, listId: target, parentId: task.id }, { silent: true });
      s.openTask(task.id);
    } else {
      const list = s.create('list', { name, spaceId: target, folderId: null, order: Date.now(), statuses: t.payload.list?.statuses || null });
      const statuses = statusesForList(list.id);
      const idMap = new Map<string, string>();
      for (const x of t.payload.tasks || []) idMap.set(x.id, uid());
      s.createMany((t.payload.tasks || []).map((x: any) => {
        const { id, ...rest } = x;
        return { kind: 'task', id: idMap.get(id), data: { ...rest, listId: list.id, parentId: x.parentId ? idMap.get(x.parentId) || null : null, status: statuses.find((st) => st.id === x.status)?.id || statuses[0].id } };
      }));
      nav('/list/' + list.id);
    }
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={`Use “${t.name}”`} width={420}>
      <div className="p-5 space-y-3">
        <div><div className="label mb-1">Name</div><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><div className="label mb-1">{t.type === 'task' ? 'Create in List' : 'Create in Space'}</div>
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
            {t.type === 'task' ? Object.values(data.list).map((l) => <option key={l.id} value={l.id}>{l.name}</option>) : Object.values(data.space).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-4"><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!target} onClick={go}>Create</button></div>
    </Modal>
  );
}
