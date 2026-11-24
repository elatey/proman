import { useMemo, useState } from 'react';
import { Plus, Minus, Trash2, CheckSquare, ZoomIn, ZoomOut } from 'lucide-react';
import { useStore, getState, statusOf, isClosed, locationName } from '../../lib/store';
import { StatusIcon } from '../ui';
import { cn, uid, alpha } from '../../lib/utils';
import type { MindNode } from '../../lib/types';
import type { ViewProps } from '../../pages/LocationPage';

interface N { id: string; text: string; children: N[]; kind: 'root' | 'list' | 'task' | 'blank'; ref?: string; color?: string; listId?: string; done?: boolean }
const W = 210, H = 40, GX = 60, GY = 12;

export default function MindMapView({ view, tasks, listIds, loc }: ViewProps) {
  const cfg = view.config;
  const mode = cfg.mindmap?.mode || 'tasks';
  const blank = cfg.mindmap?.nodes || [];
  const lists = useStore((s) => s.data.list);
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const setCfg = (mm: any) => getState().update('view', view.id, { config: { ...cfg, mindmap: { mode, nodes: blank, ...mm } } });

  const root: N = useMemo(() => {
    if (mode === 'blank') {
      const build = (parent: string | null): N[] => blank.filter((n) => n.parent === parent).map((n) => ({ id: n.id, text: n.text, kind: 'blank', color: n.color, children: build(n.id) }));
      return { id: 'root', text: view.name === 'Mind Map' ? 'Central idea' : view.name, kind: 'root', children: build('root') };
    }
    const taskNode = (t: any): N => ({ id: t.id, text: t.name, kind: 'task', ref: t.id, listId: t.listId, color: statusOf(t)?.color, done: isClosed(t), children: tasks.filter((x) => x.parentId === t.id).map(taskNode) });
    const tops = tasks.filter((t) => !t.parentId || !tasks.some((p) => p.id === t.parentId));
    const kids = listIds.length > 1
      ? listIds.map((l) => ({ id: l, text: lists[l]?.name || 'List', kind: 'list' as const, listId: l, children: tops.filter((t) => t.listId === l).map(taskNode) })).filter((n) => n.children.length || listIds.length < 8)
      : tops.map(taskNode);
    return { id: 'root', text: locationName(loc) || 'Everything', kind: 'root', listId: listIds[0], children: kids };
  }, [mode, blank, tasks, listIds, lists]);

  // layout
  const pos = new Map<string, { x: number; y: number }>();
  let cursor = 0;
  const place = (n: N, depth: number): number => {
    if (!n.children.length) { const y = cursor; cursor += H + GY; pos.set(n.id, { x: depth * (W + GX), y }); return y; }
    const ys = n.children.map((c) => place(c, depth + 1));
    const y = (ys[0] + ys[ys.length - 1]) / 2;
    pos.set(n.id, { x: depth * (W + GX), y });
    return y;
  };
  place(root, 0);
  const all: N[] = [];
  const walk = (n: N) => { all.push(n); n.children.forEach(walk); };
  walk(root);
  const width = Math.max(...[...pos.values()].map((p) => p.x)) + W + 80;
  const height = cursor + 80;

  const addChild = (n: N) => {
    const s = getState();
    if (mode === 'blank') { const id = uid(); setCfg({ nodes: [...blank, { id, text: 'New idea', parent: n.id }] }); setEditing(id); return; }
    const name = prompt(n.kind === 'task' ? 'Subtask name' : 'Task name');
    if (!name) return;
    if (n.kind === 'task') s.createTask({ name, listId: n.listId!, parentId: n.ref });
    else s.createTask({ name, listId: n.listId || listIds[0] });
  };
  const removeBlank = (id: string) => {
    const kill = new Set([id]);
    let grew = true;
    while (grew) { grew = false; for (const n of blank) if (n.parent && kill.has(n.parent) && !kill.has(n.id)) { kill.add(n.id); grew = true; } }
    setCfg({ nodes: blank.filter((n) => !kill.has(n.id)) });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b text-[13px]">
        <div className="flex rounded-lg border p-0.5">
          {(['tasks', 'blank'] as const).map((m) => <button key={m} onClick={() => setCfg({ mode: m })} className={cn('px-2.5 py-0.5 rounded-md', mode === m ? 'bg-[var(--hover)] font-medium' : 'text-[var(--muted)]')}>{m === 'tasks' ? 'Tasks mode' : 'Blank mode'}</button>)}
        </div>
        <span className="text-xs text-[var(--muted)]">{mode === 'tasks' ? 'Your Lists, tasks and subtasks as a tree. Use + to add tasks.' : 'Free-form brainstorming. Double-click to edit, convert ideas into tasks.'}</span>
        <div className="flex-1" />
        <button className="icon-btn" onClick={() => setZoom(Math.max(0.4, zoom - 0.1))}><ZoomOut size={15} /></button>
        <span className="text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button className="icon-btn" onClick={() => setZoom(Math.min(1.6, zoom + 0.1))}><ZoomIn size={15} /></button>
      </div>
      <div className="flex-1 overflow-auto bg-[var(--subtle)]" style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        <div style={{ width: width * zoom, height: height * zoom }}>
          <div className="relative origin-top-left" style={{ width, height, transform: `scale(${zoom})`, padding: 40 }}>
            <svg className="absolute left-10 top-10 pointer-events-none" width={width} height={height}>
              {all.flatMap((n) => n.children.map((c) => {
                const a = pos.get(n.id)!, b = pos.get(c.id)!;
                const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2;
                return <path key={n.id + c.id} d={`M${x1},${y1} C${x1 + GX / 2},${y1} ${x2 - GX / 2},${y2} ${x2},${y2}`} stroke={c.color || 'var(--border-strong)'} strokeWidth={2} fill="none" opacity={0.7} />;
              }))}
            </svg>
            {all.map((n) => {
              const p = pos.get(n.id)!;
              return (
                <div key={n.id} className={cn('group absolute flex items-center gap-1.5 rounded-xl border px-3 text-[13px] shadow-sm bg-[var(--panel)]', n.kind === 'root' && 'font-semibold bg-accent !text-[var(--accent-fg)] border-transparent', n.kind === 'list' && 'font-medium')}
                  style={{ left: p.x + 40, top: p.y + 40, width: W, height: H, borderColor: n.kind === 'task' || n.kind === 'blank' ? alpha(n.color || '#8E8C99', 0.6) : undefined }}
                  onDoubleClick={() => n.kind === 'blank' && setEditing(n.id)}
                  onClick={() => n.kind === 'task' && getState().openTask(n.ref!)}>
                  {n.kind === 'task' && <StatusIcon status={statusOf(getState().data.task[n.ref!])} size={13} />}
                  {editing === n.id ? (
                    <input autoFocus className="flex-1 bg-transparent outline-none" defaultValue={n.text} onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => { setCfg({ nodes: blank.map((x) => (x.id === n.id ? { ...x, text: e.target.value || 'Idea' } : x)) }); setEditing(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                  ) : <span className={cn('flex-1 truncate', n.done && 'line-through opacity-60')}>{n.text}</span>}
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
                    <button className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shadow" title="Add child" onClick={(e) => { e.stopPropagation(); addChild(n); }}><Plus size={13} /></button>
                  </div>
                  {n.kind === 'blank' && (
                    <div className="absolute -top-3 right-2 hidden group-hover:flex gap-0.5">
                      <button className="w-6 h-6 rounded-full bg-[var(--panel)] border flex items-center justify-center" title="Convert to task" onClick={(e) => { e.stopPropagation(); if (listIds[0]) { getState().createTask({ name: n.text, listId: listIds[0] }); getState().toast('Task created from idea', 'success'); } }}><CheckSquare size={12} /></button>
                      <button className="w-6 h-6 rounded-full bg-[var(--panel)] border flex items-center justify-center text-red-600" title="Delete" onClick={(e) => { e.stopPropagation(); removeBlank(n.id); }}><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
