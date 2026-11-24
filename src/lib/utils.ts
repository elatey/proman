import { clsx, type ClassValue } from 'clsx';
import { format, isToday, isTomorrow, isYesterday, isPast, differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import type { Status, Priority } from './types';

export const cn = (...a: ClassValue[]) => clsx(a);

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export const shortId = (id: string) => id.replace(/-/g, '').slice(0, 7);

export const COLORS = [
  '#6E56CF', '#3E63DD', '#0090FF', '#00A2C7', '#12A594', '#30A46C', '#7CB342', '#FFB224',
  '#F76B15', '#E5484D', '#D6409F', '#AB4ABA', '#8E8C99', '#2F2F37',
];

export const STATUS_COLORS = ['#8E8C99', '#3E63DD', '#6E56CF', '#0090FF', '#12A594', '#30A46C', '#FFB224', '#F76B15', '#E5484D', '#D6409F', '#AB4ABA', '#2F2F37'];

export const defaultStatuses = (): Status[] => [
  { id: uid(), name: 'TO DO', color: '#8E8C99', type: 'notstarted' },
  { id: uid(), name: 'IN PROGRESS', color: '#3E63DD', type: 'active' },
  { id: uid(), name: 'COMPLETE', color: '#30A46C', type: 'closed' },
];

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 1, label: 'Urgent', color: '#E5484D' },
  { value: 2, label: 'High', color: '#FFB224' },
  { value: 3, label: 'Normal', color: '#3E63DD' },
  { value: 4, label: 'Low', color: '#8E8C99' },
];
export const priorityMeta = (p?: Priority | null) => PRIORITIES.find((x) => x.value === p);

export const toDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
};

export const fmtDue = (s?: string | null, withTime = false): string => {
  const d = toDate(s);
  if (!d) return '';
  const t = withTime ? ' ' + format(d, 'h:mm a') : '';
  if (isToday(d)) return 'Today' + t;
  if (isTomorrow(d)) return 'Tomorrow' + t;
  if (isYesterday(d)) return 'Yesterday' + t;
  const diff = differenceInCalendarDays(d, new Date());
  if (diff > 0 && diff < 7) return format(d, 'EEE') + t;
  return (d.getFullYear() === new Date().getFullYear() ? format(d, 'MMM d') : format(d, 'MMM d, yyyy')) + t;
};

export const dueTone = (s?: string | null, closed?: boolean) => {
  const d = toDate(s);
  if (!d || closed) return 'text-[var(--muted)]';
  if (isToday(d)) return 'text-amber-600 dark:text-amber-400';
  if (isPast(d)) return 'text-red-600 dark:text-red-400';
  return 'text-[var(--muted)]';
};

export const isOverdue = (s?: string | null) => {
  const d = toDate(s);
  return !!d && isPast(d) && !isToday(d);
};

export const fmtDuration = (sec: number): string => {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
};

export const fmtMinutes = (min?: number | null): string => {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

// Parse "2h 30m", "1.5h", "90m", "90", "1d" into minutes (1d = 8h like ClickUp).
export const parseDuration = (s: string): number | null => {
  s = s.trim().toLowerCase();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60);
  let total = 0;
  let matched = false;
  for (const [, n, u] of s.matchAll(/(\d+(?:\.\d+)?)\s*(d|h|m)/g)) {
    matched = true;
    const v = parseFloat(n);
    total += u === 'd' ? v * 480 : u === 'h' ? v * 60 : v;
  }
  return matched ? Math.round(total) : null;
};

export const initials = (name?: string) =>
  (name || '?')
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export const stripHtml = (html?: string) => (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export const readableText = (hex: string) => {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#fff';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1c1c22' : '#ffffff';
};

export const alpha = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

export const downloadFile = (name: string, content: string, mime = 'text/plain') => {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export const toCSV = (rows: (string | number | null | undefined)[][]) =>
  rows.map((r) => r.map((c) => {
    const s = c == null ? '' : String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');

export const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
};

export const between = (a: number | undefined, b: number | undefined) => {
  const lo = a ?? (b != null ? b - 2000 : 0);
  const hi = b ?? lo + 2000;
  return (lo + hi) / 2;
};

export const debounce = <A extends any[]>(fn: (...a: A) => void, ms: number) => {
  let t: any;
  const d = (...a: A) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a: A) => { clearTimeout(t); fn(...a); };
  return d as ((...a: A) => void) & { flush: (...a: A) => void };
};

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
