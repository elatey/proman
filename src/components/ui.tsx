import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, ChevronLeft, ChevronRight, Flag, X, Search, Plus, UserPlus, Calendar as CalIcon, Tag as TagIcon, Circle, CircleDashed, CheckCircle2, CircleDot,
} from 'lucide-react';
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, formatISO, startOfDay, nextMonday, setHours, setMinutes,
} from 'date-fns';
import { cn, initials, PRIORITIES, priorityMeta, readableText, toDate, COLORS, alpha, uid } from '../lib/utils';
import { useStore, statusesForList } from '../lib/store';
import type { Priority, Status, Profile } from '../lib/types';

// ------------------------------------------------------------------ Popover
type Align = 'start' | 'end' | 'center';
interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: Align;
  width?: number;
  className?: string;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  disabled?: boolean;
  side?: 'bottom' | 'top' | 'right';
}

export function Popover({ trigger, children, align = 'start', width, className, triggerClassName, open: ctrl, onOpenChange, disabled, side = 'bottom' }: PopoverProps) {
  const [inner, setInner] = useState(false);
  const open = ctrl ?? inner;
  const setOpen = (o: boolean) => { setInner(o); onOpenChange?.(o); };
  const anchor = useRef<HTMLSpanElement>(null);
  return (
    <>
      <span
        ref={anchor}
        className={cn('inline-flex min-w-0', triggerClassName)}
        onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen(!open); }}
      >
        {trigger}
      </span>
      {open && (
        <Floating anchor={anchor.current} onClose={() => setOpen(false)} align={align} width={width} className={className} side={side}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </Floating>
      )}
    </>
  );
}

export function Floating({ anchor, point, onClose, children, align = 'start', width, className, side = 'bottom' }: {
  anchor?: HTMLElement | null; point?: { x: number; y: number }; onClose: () => void; children: React.ReactNode; align?: Align; width?: number; className?: string; side?: 'bottom' | 'top' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = anchor?.getBoundingClientRect() || (point ? new DOMRect(point.x, point.y, 0, 0) : new DOMRect(0, 0, 0, 0));
    const w = Math.min(el.offsetWidth, window.innerWidth - 16), h = el.offsetHeight;
    let left = side === 'right' ? r.right + 6 : align === 'end' ? r.right - w : align === 'center' ? r.left + r.width / 2 - w / 2 : r.left;
    let top = side === 'right' ? r.top : side === 'top' ? r.top - h - 6 : r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, (side === 'bottom' ? r.top - h - 6 : window.innerHeight - h - 8));
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    setPos({ top, left: Math.max(8, left) });
  }, [anchor, point, align, side]);
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return;
      // clicks inside another floating layer opened from this one shouldn't close us
      if ((e.target as HTMLElement).closest?.('[data-floating]') && (e.target as HTMLElement).closest('[data-floating]') !== ref.current) {
        const all = Array.from(document.querySelectorAll('[data-floating]'));
        if (all.indexOf((e.target as HTMLElement).closest('[data-floating]')!) > all.indexOf(ref.current!)) return;
      }
      onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    setTimeout(() => document.addEventListener('mousedown', down), 0);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true); };
  }, [anchor, onClose]);
  return createPortal(
    <div
      ref={ref}
      data-floating
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn('pop fixed z-[1000] animate-pop overflow-auto', className)}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100dvh - 16px)', visibility: pos ? 'visible' : 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}

// ------------------------------------------------------------------ Menu
export interface MenuItem { label: React.ReactNode; icon?: React.ReactNode; onClick?: () => void; danger?: boolean; divider?: boolean; hint?: string; submenu?: MenuItem[]; disabled?: boolean }
export function MenuList({ items, close }: { items: MenuItem[]; close: () => void }) {
  return (
    <div className="p-1 min-w-[200px] max-h-[70vh] overflow-auto">
      {items.map((it, i) =>
        it.divider ? <div key={i} className="my-1 border-t" /> : it.submenu ? (
          <SubMenu key={i} item={it} close={close} />
        ) : (
          <button key={i} disabled={it.disabled} className={cn('menu-item', it.danger && 'text-red-600 dark:text-red-400')} onClick={() => { close(); it.onClick?.(); }}>
            <span className="w-4 flex justify-center text-[var(--muted)]">{it.icon}</span>
            <span className="flex-1 truncate">{it.label}</span>
            {it.hint && <span className="text-xs text-[var(--faint)]">{it.hint}</span>}
          </button>
        ))}
    </div>
  );
}
function SubMenu({ item, close }: { item: MenuItem; close: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button ref={ref} className="menu-item" data-active={open} onClick={() => setOpen(!open)}>
        <span className="w-4 flex justify-center text-[var(--muted)]">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        <ChevronRight size={14} className="text-[var(--faint)]" />
      </button>
      {open && <Floating anchor={ref.current} side="right" onClose={() => setOpen(false)}><MenuList items={item.submenu!} close={() => { setOpen(false); close(); }} /></Floating>}
    </>
  );
}
export function Menu({ trigger, items, align, width }: { trigger: React.ReactNode; items: MenuItem[]; align?: Align; width?: number }) {
  return <Popover trigger={trigger} align={align} width={width}>{(close) => <MenuList items={items} close={close} />}</Popover>;
}

/** Right-click context menu hook. */
export function useContextMenu() {
  const [state, setState] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const open = (e: React.MouseEvent, items: MenuItem[]) => { e.preventDefault(); e.stopPropagation(); setState({ x: e.clientX, y: e.clientY, items }); };
  const node = state ? <Floating point={{ x: state.x, y: state.y }} onClose={() => setState(null)}><MenuList items={state.items} close={() => setState(null)} /></Floating> : null;
  return { open, node };
}

// ------------------------------------------------------------------ Modal
export function Modal({ open, onClose, children, width = 520, title, className, bare }: { open: boolean; onClose: () => void; children: React.ReactNode; width?: number | string; title?: React.ReactNode; className?: string; bare?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-floating]')) onClose();
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[900] flex items-start justify-center bg-black/40 p-2 pt-[4vh] sm:p-4 sm:pt-[8vh] animate-fade" onMouseDown={onClose}>
      <div className={cn('pop w-full max-h-[92dvh] sm:max-h-[86vh] flex flex-col animate-pop', className)} style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        {title && !bare && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b">
            <div className="font-semibold text-[15px]">{title}</div>
            <button className="icon-btn" onClick={onClose}><X size={16} /></button>
          </div>
        )}
        <div className="overflow-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({ open, onClose, onConfirm, title, body, confirmText = 'Delete' }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body?: string; confirmText?: string }) {
  return (
    <Modal open={open} onClose={onClose} width={420} title={title}>
      <div className="p-5 text-sm text-[var(--muted)]">{body}</div>
      <div className="flex justify-end gap-2 px-5 pb-4">
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={() => { onConfirm(); onClose(); }}>{confirmText}</button>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Avatar
export function Avatar({ user, id, size = 24, className, ring }: { user?: Profile | null; id?: string | null; size?: number; className?: string; ring?: boolean }) {
  const members = useStore((s) => s.members);
  const online = useStore((s) => s.online);
  const p = user || members.find((m) => m.user_id === id)?.profile;
  const style: React.CSSProperties = { width: size, height: size, fontSize: Math.max(9, size * 0.4), background: p?.color || '#8E8C99', color: readableText(p?.color || '#8E8C99') };
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none', ring && 'ring-2 ring-[var(--panel)]', className)} style={style} title={p?.name || 'Unknown'}>
      {p?.avatar_url ? <img src={p.avatar_url} className="w-full h-full rounded-full object-cover" alt="" /> : initials(p?.name)}
      {p && online.includes(p.id) && size >= 22 && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-[var(--panel)]" />}
    </span>
  );
}

export function AvatarStack({ ids, size = 24, max = 3 }: { ids: string[]; size?: number; max?: number }) {
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {ids.slice(0, max).map((id) => <Avatar key={id} id={id} size={size} ring />)}
      {ids.length > max && <span className="inline-flex items-center justify-center rounded-full bg-[var(--hover)] text-[10px] font-semibold ring-2 ring-[var(--panel)]" style={{ width: size, height: size }}>+{ids.length - max}</span>}
    </span>
  );
}

// ------------------------------------------------------------------ Status
export function StatusIcon({ status, size = 14 }: { status?: Status; size?: number }) {
  const c = status?.color || '#8E8C99';
  if (!status || status.type === 'notstarted') return <CircleDashed size={size} color={c} strokeWidth={2.4} />;
  if (status.type === 'closed' || status.type === 'done') return <CheckCircle2 size={size} color="#fff" fill={c} strokeWidth={2.4} />;
  return <CircleDot size={size} color={c} strokeWidth={2.6} />;
}

export function StatusPill({ status, small }: { status?: Status; small?: boolean }) {
  const c = status?.color || '#8E8C99';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded font-semibold uppercase tracking-wide whitespace-nowrap', small ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-1')} style={{ background: c, color: readableText(c) }}>
      {status?.name || 'NO STATUS'}
    </span>
  );
}

export function StatusPicker({ listId, value, onChange, trigger }: { listId: string; value?: string; onChange: (id: string) => void; trigger?: React.ReactNode }) {
  const statuses = statusesForList(listId);
  const cur = statuses.find((s) => s.id === value) || statuses[0];
  const groups: [string, Status[]][] = [
    ['Not started', statuses.filter((s) => s.type === 'notstarted')],
    ['Active', statuses.filter((s) => s.type === 'active')],
    ['Done', statuses.filter((s) => s.type === 'done')],
    ['Closed', statuses.filter((s) => s.type === 'closed')],
  ];
  return (
    <Popover trigger={trigger || <button className="hover:opacity-90"><StatusPill status={cur} /></button>} width={220}>
      {(close) => (
        <div className="p-1">
          {groups.filter(([, s]) => s.length).map(([g, ss]) => (
            <div key={g}>
              <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-[var(--faint)]">{g}</div>
              {ss.map((s) => (
                <button key={s.id} className="menu-item" onClick={() => { onChange(s.id); close(); }}>
                  <StatusIcon status={s} />
                  <span className="flex-1 uppercase text-xs font-medium">{s.name}</span>
                  {s.id === cur?.id && <Check size={14} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}

// ------------------------------------------------------------------ Priority
export function PriorityFlag({ p, showLabel, size = 14 }: { p?: Priority | null; showLabel?: boolean; size?: number }) {
  const m = priorityMeta(p);
  if (!m) return <span className="inline-flex items-center gap-1 text-[var(--faint)]"><Flag size={size} />{showLabel && <span className="text-[13px]">Empty</span>}</span>;
  return <span className="inline-flex items-center gap-1"><Flag size={size} color={m.color} fill={m.color} />{showLabel && <span className="text-[13px]">{m.label}</span>}</span>;
}

export function PriorityPicker({ value, onChange, trigger }: { value?: Priority | null; onChange: (p: Priority | null) => void; trigger?: React.ReactNode }) {
  return (
    <Popover trigger={trigger || <button className="icon-btn"><PriorityFlag p={value} /></button>} width={180}>
      {(close) => (
        <div className="p-1">
          {PRIORITIES.map((p) => (
            <button key={p.value} className="menu-item" onClick={() => { onChange(p.value); close(); }}>
              <Flag size={14} color={p.color} fill={p.color} /> <span className="flex-1">{p.label}</span>{value === p.value && <Check size={14} />}
            </button>
          ))}
          <div className="border-t my-1" />
          <button className="menu-item text-[var(--muted)]" onClick={() => { onChange(null); close(); }}><X size={14} /> Clear</button>
        </div>
      )}
    </Popover>
  );
}

// ------------------------------------------------------------------ People
export function PeopleList({ value, onChange, multi = true, close }: { value: string[]; onChange: (ids: string[]) => void; multi?: boolean; close?: () => void }) {
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.user?.id);
  const [q, setQ] = useState('');
  const list = members.filter((m) => (m.profile.name + m.profile.email).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.user_id === me ? -1 : b.user_id === me ? 1 : a.profile.name.localeCompare(b.profile.name)));
  return (
    <div className="p-1 w-64">
      <div className="p-1"><input autoFocus className="input !py-1.5" placeholder="Search people..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="max-h-64 overflow-auto">
        {list.map((m) => {
          const on = value.includes(m.user_id);
          return (
            <button key={m.user_id} className="menu-item" onClick={() => {
              if (multi) onChange(on ? value.filter((x) => x !== m.user_id) : [...value, m.user_id]);
              else { onChange(on ? [] : [m.user_id]); close?.(); }
            }}>
              <Avatar user={m.profile} size={22} />
              <span className="flex-1 truncate">{m.profile.name}{m.user_id === me && <span className="text-[var(--faint)]"> (me)</span>}</span>
              {on && <Check size={14} className="text-accent" />}
            </button>
          );
        })}
        {!list.length && <div className="px-3 py-4 text-center text-xs text-[var(--muted)]">No people found</div>}
      </div>
    </div>
  );
}

export function AssigneePicker({ value, onChange, size = 24, multi, trigger }: { value: string[]; onChange: (ids: string[]) => void; size?: number; multi?: boolean; trigger?: React.ReactNode }) {
  const allowMulti = multi ?? (useStore((s) => s.workspace?.settings?.clickApps?.multipleAssignees) !== false);
  return (
    <Popover trigger={trigger || (
      <button className="inline-flex items-center">
        {value.length ? <AvatarStack ids={value} size={size} /> : (
          <span className="inline-flex items-center justify-center rounded-full border border-dashed border-[var(--border-strong)] text-[var(--faint)] hover:text-[var(--text)] hover:border-[var(--muted)]" style={{ width: size, height: size }}><UserPlus size={size * 0.55} /></span>
        )}
      </button>
    )}>
      {(close) => <PeopleList value={value} onChange={onChange} multi={allowMulti} close={close} />}
    </Popover>
  );
}

// ------------------------------------------------------------------ Date picker
export function DatePanel({ value, onChange, close, withTime = true, timeOn = false, onTimeToggle }: { value?: string | null; onChange: (iso: string | null, hasTime?: boolean) => void; close?: () => void; withTime?: boolean; timeOn?: boolean; onTimeToggle?: (on: boolean) => void }) {
  const d = toDate(value);
  const [month, setMonth] = useState(startOfMonth(d || new Date()));
  const [time, setTime] = useState(d && timeOn ? format(d, 'HH:mm') : '');
  const start = startOfWeek(startOfMonth(month));
  const end = endOfWeek(endOfMonth(month));
  const days: Date[] = [];
  for (let x = start; x <= end; x = addDays(x, 1)) days.push(x);
  const pick = (day: Date) => {
    let out = startOfDay(day);
    if (time) { const [h, m] = time.split(':').map(Number); out = setMinutes(setHours(out, h), m); }
    onChange(formatISO(out), !!time);
    close?.();
  };
  const quick: [string, Date][] = [
    ['Today', new Date()], ['Tomorrow', addDays(new Date(), 1)], ['This weekend', addDays(startOfWeek(new Date()), 6)],
    ['Next week', nextMonday(new Date())], ['2 weeks', addDays(new Date(), 14)], ['4 weeks', addDays(new Date(), 28)],
  ];
  return (
    <div className="flex">
      <div className="w-36 border-r p-1.5 flex flex-col">
        {quick.map(([l, dt]) => (
          <button key={l} className="menu-item justify-between" onClick={() => pick(dt)}>
            <span>{l}</span><span className="text-[11px] text-[var(--faint)]">{format(dt, 'EEE')}</span>
          </button>
        ))}
        <div className="flex-1" />
        {value && <button className="menu-item text-red-600" onClick={() => { onChange(null); close?.(); }}><X size={14} /> Clear</button>}
      </div>
      <div className="p-3 w-64">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-sm">{format(month, 'MMMM yyyy')}</div>
          <div className="flex">
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft size={16} /></button>
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] text-[var(--faint)] mb-1">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((x) => <div key={x}>{x}</div>)}</div>
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((day) => {
            const sel = d && isSameDay(day, d);
            return (
              <button key={day.toISOString()} onClick={() => pick(day)}
                className={cn('h-8 rounded-md text-[13px]', !isSameMonth(day, month) && 'text-[var(--faint)]', sel ? 'bg-accent font-semibold' : 'hover:bg-[var(--hover)]', isToday(day) && !sel && 'text-accent font-bold')}>
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
        {withTime && (
          <div className="mt-2 flex items-center gap-2 border-t pt-2">
            <span className="text-xs text-[var(--muted)]">Time</span>
            <input type="time" className="input !py-1 !text-xs" value={time} onChange={(e) => {
              setTime(e.target.value);
              onTimeToggle?.(!!e.target.value);
              if (d && e.target.value) { const [h, m] = e.target.value.split(':').map(Number); onChange(formatISO(setMinutes(setHours(startOfDay(d), h), m)), true); }
              if (d && !e.target.value) onChange(formatISO(startOfDay(d)), false);
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

export function DatePicker({ value, onChange, trigger, placeholder = 'Date', hasTime, className }: { value?: string | null; onChange: (iso: string | null, hasTime?: boolean) => void; trigger?: React.ReactNode; placeholder?: string; hasTime?: boolean; className?: string }) {
  const d = toDate(value);
  return (
    <Popover trigger={trigger || (
      <button className={cn('inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[13px] hover:bg-[var(--hover)]', !d && 'text-[var(--faint)]', className)}>
        <CalIcon size={13} /> {d ? format(d, hasTime ? 'MMM d, h:mm a' : 'MMM d') : placeholder}
      </button>
    )}>
      {(close) => <DatePanel value={value} onChange={onChange} close={close} timeOn={hasTime} />}
    </Popover>
  );
}

// ------------------------------------------------------------------ Tags
export function TagChip({ name, onRemove, small }: { name: string; onRemove?: () => void; small?: boolean }) {
  const tags = useStore((s) => s.data.tag);
  const color = Object.values(tags).find((t) => t.name === name)?.color || '#8E8C99';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap', small ? 'text-[10.5px] px-1.5 py-[1px]' : 'text-xs px-2 py-0.5')} style={{ background: alpha(color, 0.16), color }}>
      {name}
      {onRemove && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="opacity-60 hover:opacity-100"><X size={11} /></button>}
    </span>
  );
}

export function TagPicker({ value, onChange, spaceId, trigger }: { value: string[]; onChange: (tags: string[]) => void; spaceId?: string; trigger?: React.ReactNode }) {
  const tags = useStore((s) => s.data.tag);
  const create = useStore((s) => s.create);
  const [q, setQ] = useState('');
  const all = Object.values(tags).filter((t) => !t.spaceId || !spaceId || t.spaceId === spaceId);
  const list = all.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
  const exact = all.some((t) => t.name.toLowerCase() === q.trim().toLowerCase());
  return (
    <Popover trigger={trigger || <button className="icon-btn"><TagIcon size={14} /></button>} width={240}>
      <div className="p-1">
        <div className="p-1"><input autoFocus className="input !py-1.5" placeholder="Search or create tag..." value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q.trim()) {
              const name = q.trim().toLowerCase();
              if (!exact) create('tag', { name, color: COLORS[Math.floor(Math.random() * COLORS.length)], spaceId: spaceId || null });
              if (!value.includes(name)) onChange([...value, name]);
              setQ('');
            }
          }} /></div>
        <div className="max-h-60 overflow-auto">
          {list.map((t) => (
            <button key={t.id} className="menu-item" onClick={() => onChange(value.includes(t.name) ? value.filter((x) => x !== t.name) : [...value, t.name])}>
              <span className="flex-1"><TagChip name={t.name} /></span>
              {value.includes(t.name) && <Check size={14} />}
            </button>
          ))}
          {q.trim() && !exact && (
            <button className="menu-item text-accent" onClick={() => {
              const name = q.trim().toLowerCase();
              create('tag', { name, color: COLORS[Math.floor(Math.random() * COLORS.length)], spaceId: spaceId || null });
              onChange([...value, name]);
              setQ('');
            }}><Plus size={14} /> Create tag "{q.trim()}"</button>
          )}
        </div>
      </div>
    </Popover>
  );
}

// ------------------------------------------------------------------ Misc
export function ColorDots({ value, onChange, colors = COLORS }: { value?: string; onChange: (c: string) => void; colors?: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button key={c} onClick={() => onChange(c)} className={cn('w-6 h-6 rounded-full flex items-center justify-center', value === c && 'ring-2 ring-offset-2 ring-offset-[var(--panel)]')} style={{ background: c, ['--tw-ring-color' as any]: c }}>
          {value === c && <Check size={12} color={readableText(c)} />}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: React.ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none" onClick={(e) => { e.preventDefault(); onChange(!on); }}>
      <span className={cn('relative w-8 h-[18px] rounded-full transition', on ? 'bg-accent' : 'bg-[var(--border-strong)]')}>
        <span className={cn('absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all', on ? 'left-[16px]' : 'left-[2px]')} />
      </span>
      {label && <span className="text-[13px]">{label}</span>}
    </label>
  );
}

export function Checkbox({ checked, onChange, className, round }: { checked: boolean; onChange: (v: boolean) => void; className?: string; round?: boolean }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={cn('shrink-0 inline-flex items-center justify-center border w-4 h-4 transition', round ? 'rounded-full' : 'rounded', checked ? 'bg-accent border-transparent' : 'border-[var(--border-strong)] hover:border-[var(--muted)]', className)}>
      {checked && <Check size={11} strokeWidth={3} />}
    </button>
  );
}

export function Empty({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && <div className="mb-3 text-[var(--faint)]">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {body && <div className="text-sm text-[var(--muted)] mt-1 max-w-sm">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search...', className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <div className={cn('relative', className)}>
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
      <input autoFocus={autoFocus} className="input !pl-8 !py-1.5" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return createPortal(
    <div className="fixed bottom-4 tabbar-offset left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-2 items-center w-max max-w-[calc(100vw-16px)]">
      {toasts.map((t) => (
        <div key={t.id} className={cn('pop animate-pop flex items-center gap-3 px-4 py-2.5 text-sm', t.tone === 'error' && '!bg-red-600 !text-white !border-red-700', t.tone === 'success' && '!border-green-500')}>
          <span>{t.text}</span>
          {t.action && <button className="font-semibold text-accent" onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>}
          <button className="opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)}><X size={14} /></button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function InlineEdit({ value, onSave, className, placeholder, multiline, autoFocus }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string; multiline?: boolean; autoFocus?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => { if (v.trim() !== value) onSave(v.trim() || value); };
  if (multiline)
    return <textarea autoFocus={autoFocus} className={cn('bg-transparent outline-none resize-none w-full', className)} value={v} placeholder={placeholder} rows={1}
      onChange={(e) => { setV(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
      ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
      onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } if (e.key === 'Escape') { setV(value); (e.target as HTMLTextAreaElement).blur(); } }} />;
  return <input autoFocus={autoFocus} className={cn('bg-transparent outline-none w-full', className)} value={v} placeholder={placeholder}
    onChange={(e) => setV(e.target.value)} onBlur={commit}
    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setV(value); (e.target as HTMLInputElement).blur(); } }} />;
}

export function ProgressBar({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn('h-1.5 rounded-full bg-[var(--hover)] overflow-hidden', className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color || 'var(--accent)' }} />
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: React.ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1 border-b', className)}>
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)} className={cn('relative px-3 py-2 text-[13px] font-medium', value === t.value ? 'text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]')}>
          {t.label}{t.count != null && <span className="ml-1.5 text-[11px] text-[var(--faint)]">{t.count}</span>}
          {value === t.value && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded bg-[var(--text)]" />}
        </button>
      ))}
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M9 11.5h9M9 16h14M9 20.5h6" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="22" cy="11.5" r="2.4" fill="white" />
    </svg>
  );
}

const MOBILE_QUERY = '(max-width: 767px)';
export const isMobileNow = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
/** True on phone-width screens (< 768px). Re-renders when the window crosses the breakpoint. */
export const useIsMobile = () => {
  const [m, setM] = useState(isMobileNow);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return m;
};

export const useNow = (ms = 1000) => {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return n;
};

export const useLocal = <T,>(key: string, init: T): [T, (v: T) => void] => {
  const [v, setV] = useState<T>(() => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : init; } catch { return init; } });
  return [v, (x: T) => { setV(x); localStorage.setItem(key, JSON.stringify(x)); }];
};

export { uid, useMemo };
