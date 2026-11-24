// Touch drag & drop for phones/tablets.
//
// Mobile browsers don't start HTML5 drag & drop from a touch, so every `draggable` element in
// ProMan (list rows, board cards, calendar chips, workload chips, planner blocks, sidebar lists)
// was mouse-only. This module turns a long-press on a `[draggable="true"]` element into the same
// event sequence the mouse produces (dragstart → dragenter/dragover/dragleave → drop → dragend),
// with a `dataTransfer` object the existing React handlers read and write. No component needs
// to know whether the drag came from a mouse or a finger.
//
// - Long-press (HOLD_MS) starts a drag, so a quick swipe still scrolls and a tap still clicks.
// - A floating copy of the item follows the finger; the original is dimmed.
// - Scroll containers auto-scroll when the finger is near their edge.
// - `drop` only fires if the last `dragover` was accepted (preventDefault), like native DnD.

const HOLD_MS = 350;
const MOVE_TOLERANCE = 8; // px of movement allowed during the hold before it counts as a scroll
const EDGE = 48; // px from a scroll container's edge where auto-scroll kicks in

class TouchDataTransfer {
  private store: Record<string, string> = {};
  dropEffect = 'move';
  effectAllowed = 'all';
  files = [] as unknown as FileList;
  items = [] as unknown as DataTransferItemList;
  get types() { return Object.keys(this.store); }
  setData(type: string, value: string) { this.store[type] = String(value); }
  getData(type: string) { return this.store[type] ?? ''; }
  clearData(type?: string) { if (type) delete this.store[type]; else this.store = {}; }
  setDragImage() {}
}

interface DragState {
  source: HTMLElement;
  dt: TouchDataTransfer;
  ghost: HTMLElement;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
  target: Element | null;
  accepted: boolean;
  raf: number;
}

let pending: { el: HTMLElement; x: number; y: number; timer: number } | null = null;
let drag: DragState | null = null;
let swallowClickUntil = 0;

function fire(type: string, target: EventTarget, dt: TouchDataTransfer, x: number, y: number): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(ev, {
    dataTransfer: { value: dt },
    clientX: { value: x }, clientY: { value: y },
    pageX: { value: x + window.scrollX }, pageY: { value: y + window.scrollY },
    screenX: { value: x }, screenY: { value: y },
  });
  target.dispatchEvent(ev);
  return ev;
}

function isEditable(el: Element | null) {
  return !!el && (el.closest('input, textarea, select, [contenteditable="true"], .ProseMirror') !== null);
}

function scrollableAncestors(el: Element | null): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
    const s = getComputedStyle(n);
    const y = /(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight;
    const x = /(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth;
    if (x || y) out.push(n);
  }
  return out;
}

function autoScroll(d: DragState) {
  for (const c of scrollableAncestors(d.target)) {
    const r = c.getBoundingClientRect();
    const speed = (dist: number) => Math.ceil(((EDGE - dist) / EDGE) * 14);
    let moved = false;
    if (c.scrollHeight > c.clientHeight) {
      if (d.y < r.top + EDGE) { c.scrollTop -= speed(d.y - r.top); moved = true; }
      else if (d.y > r.bottom - EDGE) { c.scrollTop += speed(r.bottom - d.y); moved = true; }
    }
    if (c.scrollWidth > c.clientWidth) {
      if (d.x < r.left + EDGE) { c.scrollLeft -= speed(d.x - r.left); moved = true; }
      else if (d.x > r.right - EDGE) { c.scrollLeft += speed(r.right - d.x); moved = true; }
    }
    if (moved) break; // scroll the innermost container that can move
  }
}

function tick() {
  if (!drag) return;
  const d = drag;
  d.ghost.style.transform = `translate(${d.x - d.offsetX}px, ${d.y - d.offsetY}px) scale(1.03)`;
  autoScroll(d);
  const hit = document.elementFromPoint(d.x, d.y);
  if (hit !== d.target) {
    if (d.target) fire('dragleave', d.target, d.dt, d.x, d.y);
    if (hit) fire('dragenter', hit, d.dt, d.x, d.y);
    d.target = hit;
  }
  d.accepted = d.target ? fire('dragover', d.target, d.dt, d.x, d.y).defaultPrevented : false;
  d.raf = requestAnimationFrame(tick);
}

function startDrag(el: HTMLElement, x: number, y: number) {
  const dt = new TouchDataTransfer();
  fire('dragstart', el, dt, x, y);
  if (!dt.types.length) return; // the element didn't put anything on the drag: nothing to move
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('id');
  Object.assign(ghost.style, {
    position: 'fixed', left: '0', top: '0', width: `${r.width}px`, height: `${r.height}px`, margin: '0',
    pointerEvents: 'none', zIndex: '5000', opacity: '0.92', boxShadow: '0 12px 32px -8px rgba(28,28,34,.35)',
    background: getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' ? 'var(--panel)' : '',
    borderRadius: '8px', transition: 'none', willChange: 'transform',
  });
  document.body.appendChild(ghost);
  el.style.opacity = '0.35';
  navigator.vibrate?.(12);
  drag = { source: el, dt, ghost, offsetX: x - r.left, offsetY: y - r.top, x, y, target: null, accepted: false, raf: 0 };
  document.documentElement.classList.add('touch-dragging');
  drag.raf = requestAnimationFrame(tick);
}

function endDrag(drop: boolean) {
  const d = drag;
  if (!d) return;
  drag = null;
  cancelAnimationFrame(d.raf);
  if (drop && d.target && d.accepted) fire('drop', d.target, d.dt, d.x, d.y);
  else if (d.target) fire('dragleave', d.target, d.dt, d.x, d.y);
  fire('dragend', d.source, d.dt, d.x, d.y);
  d.ghost.remove();
  d.source.style.opacity = '';
  document.documentElement.classList.remove('touch-dragging');
  swallowClickUntil = Date.now() + 400;
}

function cancelPending() {
  if (pending) { clearTimeout(pending.timer); pending = null; }
}

export function installTouchDrag() {
  if (typeof window === 'undefined' || (window as any).__touchDragInstalled) return;
  (window as any).__touchDragInstalled = true;

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || drag) { cancelPending(); return; }
    const t = e.touches[0];
    const target = e.target as Element;
    const el = target.closest?.('[draggable="true"]') as HTMLElement | null;
    // Resize handles etc. inside a draggable item handle their own pointer events.
    if (!el || isEditable(target) || target.closest('[data-no-touch-drag]')) return;
    cancelPending();
    pending = { el, x: t.clientX, y: t.clientY, timer: window.setTimeout(() => { const p = pending; pending = null; if (p) startDrag(p.el, p.x, p.y); }, HOLD_MS) };
  }, { passive: true });

  // Non-passive so we can stop the page scrolling while a drag is in progress.
  document.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (pending && t && Math.hypot(t.clientX - pending.x, t.clientY - pending.y) > MOVE_TOLERANCE) cancelPending();
    if (drag && t) { e.preventDefault(); drag.x = t.clientX; drag.y = t.clientY; }
  }, { passive: false });

  document.addEventListener('touchend', (e) => { cancelPending(); if (drag) { e.preventDefault(); endDrag(true); } }, { passive: false });
  document.addEventListener('touchcancel', () => { cancelPending(); endDrag(false); });

  // A long-press on Android also opens the context menu; don't let it interrupt a drag.
  document.addEventListener('contextmenu', (e) => { if (drag || pending) { e.preventDefault(); e.stopPropagation(); } }, true);
  // The finger lifting after a drop must not "click" whatever is underneath.
  document.addEventListener('click', (e) => { if (Date.now() < swallowClickUntil) { e.preventDefault(); e.stopPropagation(); } }, true);
}
