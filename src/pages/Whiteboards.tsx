import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PenTool, Plus, MousePointer2, Hand, StickyNote, Square, Circle, Diamond, Type, Pencil, ArrowUpRight, CheckSquare, Image as ImageIcon, Trash2, ZoomIn, ZoomOut, Maximize, Copy, Undo2 } from 'lucide-react';
import { useStore, getState, statusOf, pushRecent } from '../lib/store';
import { Empty, Popover, StatusIcon } from '../components/ui';
import { backend } from '../lib/backend';
import { cn, uid, debounce } from '../lib/utils';
import type { Whiteboard, WbElement, WbElementType } from '../lib/types';

export default function Whiteboards() {
  const { id } = useParams();
  const nav = useNavigate();
  const boards = useStore((s) => s.data.whiteboard);
  const b = id ? boards[id] : undefined;
  useEffect(() => { if (b) pushRecent({ type: 'whiteboard', id: b.id }); }, [b?.id]);
  if (b) return (
    <div className="h-full flex flex-col">
      <div className="h-12 shrink-0 flex items-center gap-2 px-4 border-b bg-[var(--panel)]">
        <PenTool size={16} className="text-[var(--muted)]" />
        <input className="font-semibold bg-transparent outline-none" defaultValue={b.name} key={b.id} onBlur={(e) => getState().update('whiteboard', b.id, { name: e.target.value || 'Whiteboard' })} />
        <div className="flex-1" />
        <button className="btn btn-ghost !py-1 text-red-600" onClick={() => { if (confirm('Delete whiteboard?')) { getState().remove('whiteboard', b.id); nav('/whiteboards'); } }}><Trash2 size={14} /></button>
      </div>
      <div className="flex-1 min-h-0"><WhiteboardCanvas board={b} /></div>
    </div>
  );
  const list = Object.values(boards);
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 sm:p-8">
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold flex-1">Whiteboards</h1>
          <button className="btn btn-primary" onClick={() => { const w = getState().create('whiteboard', { name: 'Whiteboard', elements: [] }); nav('/whiteboard/' + w.id); }}><Plus size={15} /> New Whiteboard</button></div>
        <p className="text-[var(--muted)] mt-1">Brainstorm, map flows and turn ideas into tasks, together in real time.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
          {list.map((w) => (
            <button key={w.id} onClick={() => nav('/whiteboard/' + w.id)} className="card overflow-hidden text-left hover:shadow-md">
              <div className="h-28 bg-[var(--subtle)] relative overflow-hidden" style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
                {w.elements.filter((e) => e.type === 'sticky').slice(0, 6).map((e, i) => <span key={e.id} className="absolute w-10 h-10 rounded shadow-sm" style={{ background: e.color, left: 16 + (i % 3) * 52, top: 14 + Math.floor(i / 3) * 48 }} />)}
              </div>
              <div className="p-3"><div className="font-medium">{w.name}</div><div className="text-xs text-[var(--muted)]">{w.elements.length} items</div></div>
            </button>
          ))}
        </div>
        {!list.length && <Empty icon={<PenTool size={36} />} title="No whiteboards yet" />}
      </div>
    </div>
  );
}

const STICKY = ['#FFE58F', '#FFC9C9', '#B9F2D0', '#BAE0FF', '#E2D4FF', '#FFD8A8'];
const STROKE = ['#1C1C22', '#6E56CF', '#0090FF', '#12A594', '#E5484D', '#F76B15'];
type Tool = 'select' | 'hand' | WbElementType;

export function WhiteboardCanvas({ board }: { board: Whiteboard }) {
  const [els, setEls] = useState<WbElement[]>(board.elements || []);
  const [tool, setTool] = useState<Tool>('select');
  const [sel, setSel] = useState<string[]>([]);
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const [editing, setEditing] = useState<string | null>(null);
  const [color, setColor] = useState(STICKY[0]);
  const [history, setHistory] = useState<WbElement[][]>([]);
  const svg = useRef<SVGSVGElement>(null);
  const interacting = useRef(false);
  const action = useRef<any>(null);
  const tasks = useStore((s) => s.data.task);

  const persist = useMemo(() => debounce((e: WbElement[]) => getState().update('whiteboard', board.id, { elements: e }), 350), [board.id]);
  // realtime: adopt remote changes while idle
  useEffect(() => { if (!interacting.current && !editing) setEls(board.elements || []); }, [board.elements]);
  const commit = (next: WbElement[], snapshot = true) => { if (snapshot) setHistory((h) => [...h.slice(-30), els]); setEls(next); persist(next); };
  const undo = () => { const prev = history[history.length - 1]; if (!prev) return; setHistory(history.slice(0, -1)); setEls(prev); persist(prev); };

  const pt = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.z, y: (e.clientY - r.top - view.y) / view.z };
  };
  const byId = (id?: string | null) => els.find((e) => e.id === id);
  const center = (e: WbElement) => ({ x: e.x + e.w / 2, y: e.y + e.h / 2 });

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (editing || ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { commit(els.filter((x) => !sel.includes(x.id) && !sel.includes(x.from || '') && !sel.includes(x.to || ''))); setSel([]); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && sel.length) { e.preventDefault(); const copies = els.filter((x) => sel.includes(x.id)).map((x) => ({ ...x, id: uid(), x: x.x + 24, y: x.y + 24 })); commit([...els, ...copies]); setSel(copies.map((c) => c.id)); }
      const map: Record<string, Tool> = { v: 'select', h: 'hand', s: 'sticky', r: 'rect', o: 'ellipse', t: 'text', p: 'pen', a: 'arrow' };
      if (!e.ctrlKey && !e.metaKey && map[e.key]) setTool(map[e.key]);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [sel, els, editing, history]);

  const down = (e: React.PointerEvent, target?: WbElement, handle?: 'resize') => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pt(e);
    interacting.current = true;
    if (tool === 'hand' || e.button === 1 || (e.button === 0 && e.altKey)) { action.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; return; }
    if (tool === 'select') {
      if (target && handle === 'resize') { action.current = { kind: 'resize', id: target.id, sx: p.x, sy: p.y, w: target.w, h: target.h }; return; }
      if (target) {
        const ids = e.shiftKey ? Array.from(new Set([...sel, target.id])) : sel.includes(target.id) ? sel : [target.id];
        setSel(ids);
        action.current = { kind: 'move', ids, sx: p.x, sy: p.y, orig: els.filter((x) => ids.includes(x.id)).map((x) => ({ id: x.id, x: x.x, y: x.y, x2: x.x2, y2: x.y2, points: x.points })), before: els };
        return;
      }
      setSel([]);
      action.current = { kind: 'marquee', sx: p.x, sy: p.y, x: p.x, y: p.y };
      return;
    }
    if (tool === 'pen') { const id = uid(); action.current = { kind: 'pen', id }; setHistory((h) => [...h.slice(-30), els]); setEls([...els, { id, type: 'pen', x: 0, y: 0, w: 0, h: 0, color: STROKE.includes(color) ? color : '#1C1C22', points: [p.x, p.y] }]); return; }
    if (tool === 'arrow') { const id = uid(); action.current = { kind: 'arrow', id }; setHistory((h) => [...h.slice(-30), els]); setEls([...els, { id, type: 'arrow', x: p.x, y: p.y, x2: p.x, y2: p.y, w: 0, h: 0, from: target?.id || null, to: null, color: STROKE.includes(color) ? color : '#1C1C22' }]); return; }
    // shapes
    const id = uid();
    const size = tool === 'sticky' ? { w: 180, h: 160 } : tool === 'text' ? { w: 220, h: 40 } : { w: 160, h: 100 };
    const el: WbElement = { id, type: tool as WbElementType, x: p.x - size.w / 2, y: p.y - size.h / 2, ...size, color: tool === 'sticky' ? (STICKY.includes(color) ? color : STICKY[0]) : tool === 'text' ? (STROKE.includes(color) ? color : '#1C1C22') : color, text: tool === 'text' ? 'Text' : '' };
    commit([...els, el]);
    setSel([id]);
    setTool('select');
    if (tool === 'sticky' || tool === 'text') setTimeout(() => setEditing(id), 30);
    interacting.current = false;
  };

  const move = (e: React.PointerEvent) => {
    const a = action.current;
    if (!a) return;
    const p = pt(e);
    if (a.kind === 'pan') setView((v) => ({ ...v, x: a.vx + e.clientX - a.sx, y: a.vy + e.clientY - a.sy }));
    if (a.kind === 'move') {
      const dx = p.x - a.sx, dy = p.y - a.sy;
      setEls((list) => list.map((x) => { const o = a.orig.find((q: any) => q.id === x.id); if (!o) return x; return { ...x, x: o.x + dx, y: o.y + dy, x2: o.x2 != null ? o.x2 + dx : x.x2, y2: o.y2 != null ? o.y2 + dy : x.y2, points: o.points ? o.points.map((v: number, i: number) => v + (i % 2 ? dy : dx)) : x.points }; }));
    }
    if (a.kind === 'resize') setEls((list) => list.map((x) => (x.id === a.id ? { ...x, w: Math.max(40, a.w + p.x - a.sx), h: Math.max(30, a.h + p.y - a.sy) } : x)));
    if (a.kind === 'pen') setEls((list) => list.map((x) => (x.id === a.id ? { ...x, points: [...(x.points || []), p.x, p.y] } : x)));
    if (a.kind === 'arrow') setEls((list) => list.map((x) => (x.id === a.id ? { ...x, x2: p.x, y2: p.y } : x)));
    if (a.kind === 'marquee') action.current = { ...a, x: p.x, y: p.y };
    if (a.kind === 'marquee') setSel(els.filter((x) => x.type !== 'arrow' && inside(x, a.sx, a.sy, p.x, p.y)).map((x) => x.id));
  };

  const up = (e: React.PointerEvent) => {
    const a = action.current;
    action.current = null;
    interacting.current = false;
    if (!a) return;
    if (a.kind === 'move') { setHistory((h) => [...h.slice(-30), a.before]); persist(els); }
    if (a.kind === 'resize' || a.kind === 'pen') persist(els);
    if (a.kind === 'arrow') {
      const p = pt(e);
      const hit = [...els].reverse().find((x) => x.type !== 'arrow' && x.type !== 'pen' && p.x >= x.x && p.x <= x.x + x.w && p.y >= x.y && p.y <= x.y + x.h);
      const next = els.map((x) => (x.id === a.id ? { ...x, to: hit && hit.id !== x.from ? hit.id : null } : x)).filter((x) => !(x.id === a.id && Math.hypot((x.x2 || 0) - x.x, (x.y2 || 0) - x.y) < 8 && !x.to));
      setEls(next); persist(next); setTool('select');
    }
  };

  const wheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const r = svg.current!.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const z = Math.max(0.2, Math.min(3, view.z * (e.deltaY < 0 ? 1.1 : 0.9)));
      setView({ z, x: mx - ((mx - view.x) / view.z) * z, y: my - ((my - view.y) / view.z) * z });
    } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
  };

  const setText = (id: string, text: string) => commit(els.map((x) => (x.id === id ? { ...x, text } : x)), false);
  const selected = els.filter((x) => sel.includes(x.id));
  const toTask = () => {
    const lists = Object.values(getState().data.list);
    if (!lists.length) return getState().toast('Create a List first', 'error');
    const listId = localStorage.getItem('proman.lastList') || lists[0].id;
    const next = els.map((x) => {
      if (!sel.includes(x.id) || x.type === 'task' || x.type === 'arrow' || x.type === 'pen') return x;
      const t = getState().createTask({ name: x.text?.trim() || 'Task from whiteboard', listId });
      return { ...x, type: 'task' as const, taskId: t.id };
    });
    commit(next);
    getState().toast('Converted to tasks', 'success');
  };
  const addImage = () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.onchange = async () => {
      const f = i.files?.[0]; if (!f) return;
      try {
        const src = await backend.uploadFile(getState().workspace!.id, f, f.name);
        const c = pt({ clientX: svg.current!.getBoundingClientRect().left + 300, clientY: svg.current!.getBoundingClientRect().top + 200 });
        commit([...els, { id: uid(), type: 'image', x: c.x, y: c.y, w: 280, h: 200, src }]);
      } catch (e: any) { getState().toast(e.message, 'error'); }
    };
    i.click();
  };
  const addTaskCard = (taskId: string) => {
    const c = pt({ clientX: svg.current!.getBoundingClientRect().left + 320, clientY: svg.current!.getBoundingClientRect().top + 220 });
    commit([...els, { id: uid(), type: 'task', x: c.x, y: c.y, w: 240, h: 80, taskId }]);
  };

  const tools: [Tool, any, string][] = [['select', MousePointer2, 'Select (V)'], ['hand', Hand, 'Pan (H)'], ['sticky', StickyNote, 'Sticky note (S)'], ['rect', Square, 'Rectangle (R)'], ['ellipse', Circle, 'Ellipse (O)'], ['diamond', Diamond, 'Diamond'], ['text', Type, 'Text (T)'], ['pen', Pencil, 'Pen (P)'], ['arrow', ArrowUpRight, 'Connector (A)']];
  const marquee = action.current?.kind === 'marquee' ? action.current : null;

  return (
    <div className="relative h-full overflow-hidden bg-[var(--subtle)]" style={{ backgroundImage: 'radial-gradient(var(--border-strong) 1px, transparent 1px)', backgroundSize: `${22 * view.z}px ${22 * view.z}px`, backgroundPosition: `${view.x}px ${view.y}px` }}>
      <svg ref={svg} className={cn('absolute inset-0 w-full h-full touch-none', tool === 'hand' ? 'cursor-grab' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair')}
        onPointerDown={(e) => down(e)} onPointerMove={move} onPointerUp={up} onWheel={wheel}>
        <defs><marker id="wb-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke" /></marker></defs>
        <g transform={`translate(${view.x},${view.y}) scale(${view.z})`}>
          {els.map((x) => {
            const on = sel.includes(x.id);
            if (x.type === 'pen') return <polyline key={x.id} points={(x.points || []).join(',')} fill="none" stroke={x.color} strokeWidth={on ? 4 : 2.5} strokeLinecap="round" strokeLinejoin="round" onPointerDown={(e) => down(e, x)} />;
            if (x.type === 'arrow') {
              const a = byId(x.from), b = byId(x.to);
              const p1 = a ? edgePoint(a, b ? center(b) : { x: x.x2!, y: x.y2! }) : { x: x.x, y: x.y };
              const p2 = b ? edgePoint(b, a ? center(a) : { x: x.x, y: x.y }) : { x: x.x2!, y: x.y2! };
              return <g key={x.id} onPointerDown={(e) => down(e, x)}><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={14} /><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={on ? 'var(--accent)' : x.color} strokeWidth={2} markerEnd="url(#wb-arrow)" /></g>;
            }
            return (
              <g key={x.id} onPointerDown={(e) => down(e, x)} onDoubleClick={(e) => { e.stopPropagation(); if (x.type === 'task' && x.taskId) getState().openTask(x.taskId); else if (x.type !== 'image') setEditing(x.id); }}>
                {x.type === 'sticky' && <rect x={x.x} y={x.y} width={x.w} height={x.h} rx={4} fill={x.color} style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.15))' }} />}
                {x.type === 'rect' && <rect x={x.x} y={x.y} width={x.w} height={x.h} rx={10} fill="var(--panel)" stroke={x.color} strokeWidth={2} />}
                {x.type === 'ellipse' && <ellipse cx={x.x + x.w / 2} cy={x.y + x.h / 2} rx={x.w / 2} ry={x.h / 2} fill="var(--panel)" stroke={x.color} strokeWidth={2} />}
                {x.type === 'diamond' && <polygon points={`${x.x + x.w / 2},${x.y} ${x.x + x.w},${x.y + x.h / 2} ${x.x + x.w / 2},${x.y + x.h} ${x.x},${x.y + x.h / 2}`} fill="var(--panel)" stroke={x.color} strokeWidth={2} />}
                {x.type === 'image' && <image href={x.src} x={x.x} y={x.y} width={x.w} height={x.h} preserveAspectRatio="xMidYMid slice" />}
                {x.type === 'task' && <TaskCard x={x} task={x.taskId ? tasks[x.taskId] : undefined} />}
                {x.type !== 'image' && x.type !== 'task' && (
                  <foreignObject x={x.x + 6} y={x.y + 6} width={Math.max(10, x.w - 12)} height={Math.max(10, x.h - 12)}>
                    {editing === x.id ? (
                      <textarea autoFocus className="w-full h-full bg-transparent outline-none resize-none text-[15px] leading-snug" style={{ color: x.type === 'sticky' ? '#1C1C22' : x.type === 'text' ? x.color : 'var(--text)', textAlign: x.type === 'text' ? 'left' : 'center' }}
                        defaultValue={x.text} onPointerDown={(e) => e.stopPropagation()} onBlur={(e) => { setText(x.id, e.target.value); setEditing(null); }} onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur(); }} />
                    ) : (
                      <div className={cn('w-full h-full flex overflow-hidden whitespace-pre-wrap break-words text-[15px] leading-snug select-none', x.type === 'text' ? 'items-start' : 'items-center justify-center text-center')} style={{ color: x.type === 'sticky' ? '#1C1C22' : x.type === 'text' ? x.color : 'var(--text)', fontSize: x.type === 'text' ? 18 : 15 }}>{x.text}</div>
                    )}
                  </foreignObject>
                )}
                {on && <><rect x={x.x - 3} y={x.y - 3} width={x.w + 6} height={x.h + 6} fill="none" stroke="var(--accent)" strokeWidth={1.5 / view.z} strokeDasharray="4 3" rx={6} pointerEvents="none" />
                  <rect x={x.x + x.w - 5} y={x.y + x.h - 5} width={10} height={10} rx={2} fill="var(--accent)" className="cursor-nwse-resize" onPointerDown={(e) => down(e, x, 'resize')} /></>}
              </g>
            );
          })}
          {marquee && <rect x={Math.min(marquee.sx, marquee.x)} y={Math.min(marquee.sy, marquee.y)} width={Math.abs(marquee.x - marquee.sx)} height={Math.abs(marquee.y - marquee.sy)} fill="color-mix(in srgb, var(--accent) 10%, transparent)" stroke="var(--accent)" strokeDasharray="4 3" />}
        </g>
      </svg>
      {/* toolbar */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pop flex flex-col p-1 gap-0.5">
        {tools.map(([t, I, label]) => <button key={t} title={label} onClick={() => setTool(t)} className={cn('icon-btn !w-9 !h-9', tool === t && '!bg-accent !text-[var(--accent-fg)]')}><I size={17} /></button>)}
        <div className="border-t my-0.5" />
        <Popover side="right" width={320} trigger={<button title="Insert task" className="icon-btn !w-9 !h-9"><CheckSquare size={17} /></button>}>
          {(close) => <TaskPicker onPick={(id) => { addTaskCard(id); close(); }} />}
        </Popover>
        <button title="Image" className="icon-btn !w-9 !h-9" onClick={addImage}><ImageIcon size={17} /></button>
        <button title="Undo (Ctrl+Z)" className="icon-btn !w-9 !h-9" onClick={undo} disabled={!history.length}><Undo2 size={17} /></button>
      </div>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pop flex items-center gap-1 px-2 py-1.5 max-w-[calc(100%-24px)] overflow-x-auto">
        {[...STICKY, ...STROKE].map((c) => <button key={c} onClick={() => { setColor(c); if (sel.length) commit(els.map((x) => (sel.includes(x.id) ? { ...x, color: x.type === 'sticky' && !STICKY.includes(c) ? x.color : c } : x))); }} className={cn('w-5 h-5 rounded-full border', color === c && 'ring-2 ring-offset-1 ring-[var(--accent)]')} style={{ background: c }} />)}
        {selected.length > 0 && <>
          <span className="w-px h-5 bg-[var(--border)] mx-1" />
          <button className="btn btn-ghost !py-0.5 !px-2 !text-xs" onClick={toTask}><CheckSquare size={13} /> To task</button>
          <button className="icon-btn !w-7 !h-7" title="Duplicate (Ctrl+D)" onClick={() => { const copies = selected.map((x) => ({ ...x, id: uid(), x: x.x + 24, y: x.y + 24 })); commit([...els, ...copies]); setSel(copies.map((c) => c.id)); }}><Copy size={14} /></button>
          <button className="icon-btn !w-7 !h-7 hover:!text-red-600" title="Delete" onClick={() => { commit(els.filter((x) => !sel.includes(x.id) && !sel.includes(x.from || '') && !sel.includes(x.to || ''))); setSel([]); }}><Trash2 size={14} /></button>
        </>}
      </div>
      <div className="absolute right-3 bottom-3 pop flex items-center gap-1 px-1.5 py-1">
        <button className="icon-btn" onClick={() => setView({ ...view, z: Math.max(0.2, view.z * 0.85) })}><ZoomOut size={15} /></button>
        <span className="text-xs w-11 text-center">{Math.round(view.z * 100)}%</span>
        <button className="icon-btn" onClick={() => setView({ ...view, z: Math.min(3, view.z * 1.15) })}><ZoomIn size={15} /></button>
        <button className="icon-btn" title="Fit" onClick={() => {
          if (!els.length) return setView({ x: 0, y: 0, z: 1 });
          const r = svg.current!.getBoundingClientRect();
          const minX = Math.min(...els.map((e) => e.x)), minY = Math.min(...els.map((e) => e.y)), maxX = Math.max(...els.map((e) => e.x + e.w)), maxY = Math.max(...els.map((e) => e.y + e.h));
          const z = Math.min(2, Math.max(0.2, Math.min(r.width / (maxX - minX + 200), r.height / (maxY - minY + 200))));
          setView({ z, x: r.width / 2 - ((minX + maxX) / 2) * z, y: r.height / 2 - ((minY + maxY) / 2) * z });
        }}><Maximize size={15} /></button>
      </div>
      {!els.length && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[var(--muted)] text-sm">Pick a tool on the left (or press S for a sticky note) and click anywhere on the canvas.</div>}
    </div>
  );
}

function TaskCard({ x, task }: { x: WbElement; task?: any }) {
  return (
    <foreignObject x={x.x} y={x.y} width={x.w} height={x.h}>
      <div className="w-full h-full rounded-lg border bg-[var(--panel)] shadow-sm p-2.5 text-[13px] overflow-hidden" style={{ borderLeft: `4px solid ${task ? statusOf(task)?.color : '#888'}` }}>
        {task ? <><div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]"><StatusIcon status={statusOf(task)} size={11} />{statusOf(task)?.name}</div><div className="font-medium mt-1 line-clamp-2">{task.name}</div></> : <div className="text-[var(--muted)]">Deleted task</div>}
      </div>
    </foreignObject>
  );
}

function TaskPicker({ onPick }: { onPick: (id: string) => void }) {
  const tasks = useStore((s) => s.data.task);
  const [q, setQ] = useState('');
  return (
    <div className="p-2">
      <input autoFocus className="input !py-1.5 mb-1" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-64 overflow-auto">{Object.values(tasks).filter((t) => t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30).map((t) => <button key={t.id} className="menu-item" onClick={() => onPick(t.id)}><StatusIcon status={statusOf(t)} /><span className="truncate">{t.name}</span></button>)}</div>
    </div>
  );
}

function inside(e: WbElement, x1: number, y1: number, x2: number, y2: number) {
  const [l, r] = [Math.min(x1, x2), Math.max(x1, x2)], [t, b] = [Math.min(y1, y2), Math.max(y1, y2)];
  if (e.type === 'pen') return (e.points || []).some((v, i) => (i % 2 ? false : v >= l && v <= r && e.points![i + 1] >= t && e.points![i + 1] <= b));
  return e.x >= l && e.x + e.w <= r && e.y >= t && e.y + e.h <= b;
}
function edgePoint(e: WbElement, toward: { x: number; y: number }) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  const dx = toward.x - cx, dy = toward.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const s = Math.min(Math.abs((e.w / 2) / (dx || 1e-9)), Math.abs((e.h / 2) / (dy || 1e-9)));
  return { x: cx + dx * s, y: cy + dy * s };
}
