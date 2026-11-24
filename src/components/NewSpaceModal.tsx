import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, ColorDots } from './ui';
import { SPACE_TEMPLATES, createSpaceFromTemplate } from '../lib/seed';
import { cn } from '../lib/utils';

export function NewSpaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3E63DD');
  const [tpl, setTpl] = useState('blank');
  return (
    <Modal open={open} onClose={onClose} title="Create a Space" width={620}>
      <div className="p-5 space-y-5">
        <p className="text-sm text-[var(--muted)]">A Space represents a team, department, or group, each with its own Lists, workflows and settings.</p>
        <div><div className="label mb-1">Space name</div><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing, Engineering, HR" /></div>
        <div><div className="label mb-2">Color</div><ColorDots value={color} onChange={setColor} /></div>
        <div>
          <div className="label mb-2">Start from a template</div>
          <div className="grid grid-cols-2 gap-2">
            {SPACE_TEMPLATES.map((t) => (
              <button key={t.key} onClick={() => { setTpl(t.key); if (t.key !== 'blank') setColor(t.color); }} className={cn('text-left rounded-lg border p-3 hover:bg-[var(--subtle)]', tpl === t.key && 'border-accent ring-2 ring-accent/30')}>
                <div className="flex items-center gap-2 font-medium text-sm"><span className="w-3 h-3 rounded-full" style={{ background: t.color }} />{t.name}</div>
                <div className="text-xs text-[var(--muted)] mt-1">{t.description}</div>
                <div className="mt-2 flex flex-wrap gap-1">{t.statuses.map((s) => <span key={s.name} className="text-[9px] font-semibold px-1 rounded" style={{ background: s.color, color: '#fff' }}>{s.name}</span>)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-5">
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => {
          const id = createSpaceFromTemplate(tpl, name.trim() || SPACE_TEMPLATES.find((t) => t.key === tpl)!.name, color);
          setName(''); onClose(); nav('/space/' + id);
        }}>Create Space</button>
      </div>
    </Modal>
  );
}
