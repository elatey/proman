import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox as InboxIcon, Activity, Clock, CheckCheck, Check, Bell, AtSign, UserPlus, MessageSquare, CircleDot, MailOpen, Mail, Hash, Filter, Undo2, UserCheck } from 'lucide-react';
import { isToday, isThisWeek, isThisMonth, formatDistanceToNow, format } from 'date-fns';
import { useStore, getState, memberName } from '../lib/store';
import { Avatar, Empty, Popover } from '../components/ui';
import { cn } from '../lib/utils';
import type { Notification } from '../lib/types';

const ICONS: Record<string, any> = { assigned: UserPlus, mention: AtSign, comment: MessageSquare, status: CircleDot, reminder: Bell, dm: Mail, chat: Hash, due: Clock, info: Bell, assignedComment: UserCheck };

export function Inbox() {
  const notifications = useStore((s) => s.data.notification);
  const tasks = useStore((s) => s.data.task);
  const me = useStore((s) => s.user!.id);
  const nav = useNavigate();
  const [tab, setTab] = useState<'primary' | 'other' | 'later' | 'cleared'>('primary');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const mine = Object.values(notifications).filter((n) => n.user === me).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const isPrimary = (n: Notification) => n.primary || ['assigned', 'mention', 'reminder', 'dm', 'assignedComment'].includes(n.type);
  const lists = {
    primary: mine.filter((n) => !n.cleared && !n.later && isPrimary(n)),
    other: mine.filter((n) => !n.cleared && !n.later && !isPrimary(n)),
    later: mine.filter((n) => !n.cleared && n.later),
    cleared: mine.filter((n) => n.cleared),
  };
  const shown = lists[tab].filter((n) => !unreadOnly || !n.read);
  const s = getState();
  const buckets: [string, Notification[]][] = [];
  for (const n of shown) {
    const d = n.created_at ? new Date(n.created_at) : new Date();
    const k = isToday(d) ? 'Today' : isThisWeek(d) ? 'This week' : isThisMonth(d) ? 'Earlier this month' : format(d, 'MMMM yyyy');
    const b = buckets.find((x) => x[0] === k);
    if (b) b[1].push(n); else buckets.push([k, [n]]);
  }
  const open = (n: Notification) => {
    s.update('notification', n.id, { read: true });
    if (n.taskId) s.openTask(n.taskId);
    else if (n.docId) nav('/doc/' + n.docId);
    else if (n.channelId) nav('/chat/' + n.channelId);
  };
  const tabs = [
    { k: 'primary' as const, label: 'Primary', icon: InboxIcon },
    { k: 'other' as const, label: 'Other', icon: Activity },
    { k: 'later' as const, label: 'Later', icon: Clock },
    { k: 'cleared' as const, label: 'Cleared', icon: CheckCheck },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="h-12 flex items-center px-6 border-b bg-[var(--panel)] font-semibold">Inbox</div>
      <div className="flex border-b bg-[var(--panel)]">
        {tabs.map((t) => {
          const unread = lists[t.k].filter((n) => !n.read).length;
          return (
            <button key={t.k} onClick={() => setTab(t.k)} className={cn('flex-1 min-w-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-6 py-3 border-r last:border-r-0 text-left relative', tab === t.k ? '' : 'text-[var(--muted)] hover:bg-[var(--subtle)]')}>
              <t.icon size={17} className="shrink-0 hidden sm:block" />
              <span className="min-w-0"><span className="block text-[14px] font-medium truncate">{t.label}</span>{(t.k === 'primary' || t.k === 'other') && <span className="block text-xs text-[var(--muted)]">{unread} unread</span>}</span>
              {tab === t.k && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-[var(--text)]" />}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3 sm:px-6 py-2.5">
        <button className={cn('btn !py-1 !text-xs', unreadOnly ? 'btn-primary' : 'btn-outline')} onClick={() => setUnreadOnly(!unreadOnly)}><Filter size={12} /> Unread only</button>
        <div className="flex-1" />
        {tab !== 'cleared' && shown.length > 0 && <>
          <button className="btn btn-outline !py-1 !text-xs" onClick={() => shown.forEach((n) => !n.read && s.update('notification', n.id, { read: true }))}><MailOpen size={12} /> Mark all read</button>
          <button className="btn btn-outline !py-1 !text-xs" onClick={() => shown.forEach((n) => s.update('notification', n.id, { cleared: true, read: true }))}><CheckCheck size={12} /> Clear all</button>
        </>}
        {tab === 'cleared' && shown.length > 0 && <button className="btn btn-outline !py-1 !text-xs" onClick={() => s.removeMany(shown.map((n) => ({ kind: 'notification', id: n.id })))}>Delete all</button>}
      </div>
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 pb-8">
        {buckets.map(([k, items]) => (
          <div key={k} className="mb-4">
            <div className="text-[13px] text-[var(--muted)] px-1 py-2">{k}</div>
            <div className="card overflow-hidden divide-y">
              {items.map((n) => {
                const I = ICONS[n.type] || Bell;
                const t = n.taskId ? tasks[n.taskId] : null;
                return (
                  <div key={n.id} onClick={() => open(n)} className={cn('group flex items-center gap-3 px-3 sm:px-4 py-3 cursor-pointer hover:bg-[var(--subtle)]', !n.read && 'bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]')}>
                    {!n.read ? <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" /> : <span className="w-2 shrink-0" />}
                    <I size={16} className="text-[var(--muted)] shrink-0" />
                    {/* phones: title + time on one line, who/what underneath */}
                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span className="flex items-center gap-2 sm:w-56 shrink-0 min-w-0">
                        <span className="truncate text-[13.5px] font-medium">{t?.name || (n.type === 'reminder' ? 'Reminder' : n.channelId ? 'Chat' : 'Notification')}</span>
                        <span className="sm:hidden text-xs text-[var(--faint)] shrink-0">{n.created_at && formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                      </span>
                      <span className="flex items-center gap-2 flex-1 min-w-0">
                        {n.actor ? <Avatar id={n.actor} size={22} /> : <span className="hidden sm:inline-block w-[22px]" />}
                        <span className="flex-1 truncate text-[13.5px] text-[var(--muted)]"><b className="text-[var(--text)] font-medium">{n.actor ? memberName(n.actor) : ''}</b> {n.text}</span>
                      </span>
                    </div>
                    <span className="hidden sm:inline text-xs text-[var(--faint)] shrink-0 group-hover:hidden">{n.created_at && formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                    <span className="hidden group-hover:flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button className="icon-btn" title={n.read ? 'Mark unread' : 'Mark read'} onClick={() => s.update('notification', n.id, { read: !n.read })}>{n.read ? <Mail size={14} /> : <MailOpen size={14} />}</button>
                      {tab !== 'later' && tab !== 'cleared' && <button className="icon-btn" title="Save for later" onClick={() => s.update('notification', n.id, { later: true })}><Clock size={14} /></button>}
                      {tab === 'later' && <button className="icon-btn" title="Move back" onClick={() => s.update('notification', n.id, { later: false })}><Undo2 size={14} /></button>}
                      {tab !== 'cleared' ? <button className="btn btn-primary !py-1 !px-2 !text-xs" onClick={() => s.update('notification', n.id, { cleared: true, read: true })}><Check size={12} /> Clear</button>
                        : <button className="btn btn-outline !py-1 !px-2 !text-xs" onClick={() => s.update('notification', n.id, { cleared: false })}><Undo2 size={12} /> Restore</button>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {!shown.length && <Empty icon={<CheckCheck size={36} />} title={tab === 'cleared' ? 'Nothing cleared yet' : 'Inbox zero'} body={tab === 'later' ? 'Save notifications for later and they will wait here.' : "You're all caught up. Notifications about tasks assigned to you, mentions and comments show up here."} />}
      </div>
    </div>
  );
}
