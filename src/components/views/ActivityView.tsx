import { useMemo, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { useStore, getState, memberName } from '../../lib/store';
import { Avatar, Empty } from '../ui';
import { stripHtml, cn } from '../../lib/utils';
import type { ViewProps } from '../../pages/LocationPage';

export default function ActivityView({ allTasks }: ViewProps) {
  const activity = useStore((s) => s.data.activity);
  const comments = useStore((s) => s.data.comment);
  const members = useStore((s) => s.members);
  const [who, setWho] = useState('');
  const [kind, setKind] = useState<'all' | 'comments' | 'changes'>('all');
  const ids = useMemo(() => new Set(allTasks.map((t) => t.id)), [allTasks]);
  const taskMap = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks]);
  const items = useMemo(() => {
    const a = kind === 'comments' ? [] : Object.values(activity).filter((x) => ids.has(x.taskId)).map((x) => ({ id: x.id, user: x.user, taskId: x.taskId, text: x.text, at: x.created_at || '', c: false }));
    const c = kind === 'changes' ? [] : Object.values(comments).filter((x) => x.taskId && ids.has(x.taskId)).map((x) => ({ id: x.id, user: x.author, taskId: x.taskId!, text: stripHtml(x.body), at: x.created_at || '', c: true }));
    return [...a, ...c].filter((x) => !who || x.user === who).sort((p, q) => q.at.localeCompare(p.at)).slice(0, 400);
  }, [activity, comments, ids, who, kind]);
  const groups: [string, typeof items][] = [];
  for (const it of items) {
    const d = new Date(it.at);
    const k = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, MMM d');
    const g = groups.find((x) => x[0] === k);
    if (g) g[1].push(it); else groups.push([k, [it]]);
  }
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex gap-2 mb-4">
          <select className="input !w-auto !py-1" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Everyone</option>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile.name}</option>)}</select>
          <select className="input !w-auto !py-1" value={kind} onChange={(e) => setKind(e.target.value as any)}><option value="all">All activity</option><option value="comments">Comments</option><option value="changes">Changes</option></select>
        </div>
        {groups.map(([k, list]) => (
          <div key={k} className="mb-6">
            <div className="text-xs font-semibold text-[var(--muted)] mb-2">{k}</div>
            <div className="card divide-y">
              {list.map((it) => (
                <div key={it.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-[var(--subtle)] cursor-pointer" onClick={() => getState().openTask(it.taskId)}>
                  <Avatar id={it.user} size={26} />
                  <div className="flex-1 min-w-0 text-[13px]">
                    <div><b>{memberName(it.user)}</b> <span className="text-[var(--muted)]">{it.c ? 'commented on' : it.text + ' ·'}</span> <span className="font-medium">{taskMap.get(it.taskId)?.name}</span></div>
                    {it.c && <div className={cn('mt-1 rounded-md bg-[var(--subtle)] px-2.5 py-1.5 text-[13px] line-clamp-3')}>{it.text}</div>}
                  </div>
                  <span className="text-[11px] text-[var(--faint)] shrink-0">{format(new Date(it.at), 'h:mm a')}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!items.length && <Empty title="No activity yet" body="Changes and comments on tasks in this location will stream in here in real time." />}
      </div>
    </div>
  );
}
