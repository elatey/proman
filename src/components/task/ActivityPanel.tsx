import { useMemo, useRef, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { SmilePlus, Reply, Check, MoreHorizontal, Trash2, Pencil, UserCheck, Send, Bell, BellOff } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { useStore, getState, memberName } from '../../lib/store';
import { Avatar, Popover, MenuList, AssigneePicker } from '../ui';
import { RichEditor, Html } from '../RichEditor';
import { cn } from '../../lib/utils';
import type { Comment, Task, Reaction } from '../../lib/types';

const EMOJIS = ['👍', '❤️', '😂', '🎉', '👀', '🚀', '✅', '🙏'];

export function Reactions({ reactions, onToggle }: { reactions?: Reaction; onToggle: (e: string) => void }) {
  const me = useStore((s) => s.user!.id);
  const entries = Object.entries(reactions || {}).filter(([, u]) => u.length);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {entries.map(([e, users]) => (
        <button key={e} onClick={() => onToggle(e)} title={users.map(memberName).join(', ')}
          className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-[1px] text-xs', users.includes(me) && 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]')}>{e} {users.length}</button>
      ))}
      <Popover trigger={<button className="icon-btn !w-6 !h-6"><SmilePlus size={13} /></button>}>
        {(close) => <div className="p-1.5 flex gap-0.5">{EMOJIS.map((e) => <button key={e} className="w-8 h-8 rounded hover:bg-[var(--hover)] text-lg" onClick={() => { onToggle(e); close(); }}>{e}</button>)}</div>}
      </Popover>
    </div>
  );
}

export const toggleReaction = (r: Reaction | undefined, emoji: string, me: string): Reaction => {
  const cur = { ...(r || {}) };
  const list = cur[emoji] || [];
  cur[emoji] = list.includes(me) ? list.filter((x) => x !== me) : [...list, me];
  return cur;
};

export function ActivityPanel({ task }: { task: Task }) {
  const comments = useStore((s) => s.data.comment);
  const activity = useStore((s) => s.data.activity);
  const me = useStore((s) => s.user!.id);
  const [filter, setFilter] = useState<'all' | 'comments' | 'activity'>('all');
  const [showAll, setShowAll] = useState(false);
  const items = useMemo(() => {
    const c = Object.values(comments).filter((x) => x.taskId === task.id && !x.parentId).map((x) => ({ t: 'c' as const, at: x.created_at || '', x }));
    const a = Object.values(activity).filter((x) => x.taskId === task.id).map((x) => ({ t: 'a' as const, at: x.created_at || '', x }));
    const all = [...(filter !== 'activity' ? c : []), ...(filter !== 'comments' ? a : [])].sort((p, q) => p.at.localeCompare(q.at));
    return all;
  }, [comments, activity, task.id, filter]);
  const hidden = !showAll && items.length > 40 ? items.length - 40 : 0;
  const watching = (task.watchers || []).includes(me);
  return (
    <>
      <div className="h-11 shrink-0 flex items-center gap-1 px-4 border-b bg-[var(--panel)]">
        <span className="font-semibold text-[14px] flex-1">Activity</span>
        {(['all', 'comments', 'activity'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={cn('px-2 py-0.5 rounded text-xs capitalize', filter === f ? 'bg-[var(--hover)] font-medium' : 'text-[var(--muted)]')}>{f}</button>)}
        <button className="icon-btn !w-7 !h-7" title={watching ? 'Stop following' : 'Follow task'} onClick={() => getState().update('task', task.id, { watchers: watching ? task.watchers.filter((w) => w !== me) : [...(task.watchers || []), me] })}>
          {watching ? <Bell size={14} className="text-accent" /> : <BellOff size={14} />}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {hidden > 0 && <button className="text-xs text-[var(--muted)] hover:underline px-2" onClick={() => setShowAll(true)}>Show {hidden} older items</button>}
        {items.slice(hidden).map((it) =>
          it.t === 'a' ? (
            <div key={it.x.id} className="flex items-start gap-2 px-2 py-0.5 text-xs text-[var(--muted)]">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-[var(--faint)] shrink-0" />
              <span className="flex-1"><b className="font-medium text-[var(--text)]/80">{it.x.user === me ? 'You' : memberName(it.x.user)}</b> {it.x.text}</span>
              <span className="shrink-0 text-[var(--faint)]" title={it.at && format(new Date(it.at), 'PPpp')}>{it.at && formatDistanceToNow(new Date(it.at), { addSuffix: false })}</span>
            </div>
          ) : <CommentCard key={it.x.id} c={it.x} />,
        )}
        {!items.length && <div className="text-center text-xs text-[var(--muted)] py-10">No activity yet</div>}
      </div>
      <Composer onSend={(body, assignee) => getState().addComment({ taskId: task.id, body, assignee })} />
    </>
  );
}

export function CommentCard({ c, compact }: { c: Comment; compact?: boolean }) {
  const me = useStore((s) => s.user!.id);
  const replies = useStore((s) => Object.values(s.data.comment).filter((x) => x.parentId === c.id).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')));
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const s = getState();
  return (
    <div className={cn('rounded-lg border bg-[var(--panel)]', c.assignee && !c.resolved && 'border-amber-300 dark:border-amber-800', c.resolved && 'opacity-70')}>
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <Avatar id={c.author} size={24} />
        <span className="font-medium text-[13px]">{memberName(c.author)}</span>
        <span className="text-[11px] text-[var(--faint)]" title={c.created_at && format(new Date(c.created_at), 'PPpp')}>{c.created_at && formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
        <div className="flex-1" />
        {c.author === me && (
          <Popover align="end" trigger={<button className="icon-btn !w-6 !h-6"><MoreHorizontal size={14} /></button>}>
            {(close) => <MenuList close={close} items={[
              { label: 'Edit', icon: <Pencil size={14} />, onClick: () => setEditing(true) },
              { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => s.remove('comment', c.id) },
            ]} />}
          </Popover>
        )}
      </div>
      {c.assignee && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 px-2 py-1 text-xs">
          <UserCheck size={13} className="text-amber-600" /> Assigned to <b>{memberName(c.assignee)}</b>
          <div className="flex-1" />
          <button className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5', c.resolved ? 'bg-green-600 text-white' : 'border hover:bg-[var(--hover)]')} onClick={() => s.update('comment', c.id, { resolved: !c.resolved })}><Check size={12} />{c.resolved ? 'Resolved' : 'Resolve'}</button>
        </div>
      )}
      <div className="px-3 py-2">
        {editing ? (
          <div>
            <div className="rounded-md border px-2 py-1"><RichEditor value={draft} onChange={setDraft} slash={false} compact autofocus onSubmit={() => { s.update('comment', c.id, { body: draft }); setEditing(false); }} /></div>
            <div className="flex justify-end gap-1 mt-1"><button className="btn btn-ghost !py-0.5 !text-xs" onClick={() => setEditing(false)}>Cancel</button><button className="btn btn-primary !py-0.5 !text-xs" onClick={() => { s.update('comment', c.id, { body: draft }); setEditing(false); }}>Save</button></div>
          </div>
        ) : <Html html={c.body} />}
      </div>
      <div className="flex items-center gap-1 px-2 pb-2">
        <Reactions reactions={c.reactions} onToggle={(e) => s.update('comment', c.id, { reactions: toggleReaction(c.reactions, e, me) })} />
        <div className="flex-1" />
        {!compact && <button className="btn btn-ghost !py-0.5 !px-2 !text-xs" onClick={() => setReplying(!replying)}><Reply size={12} /> Reply{replies.length ? ` (${replies.length})` : ''}</button>}
      </div>
      {(replies.length > 0 || replying) && (
        <div className="border-t bg-[var(--subtle)] rounded-b-lg px-3 py-2 space-y-2">
          {replies.map((r) => (
            <div key={r.id} className="flex gap-2">
              <Avatar id={r.author} size={20} />
              <div className="flex-1 min-w-0">
                <div className="text-xs"><b>{memberName(r.author)}</b> <span className="text-[var(--faint)]">{r.created_at && formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span></div>
                <Html html={r.body} />
              </div>
              {r.author === me && <button className="text-[var(--faint)] hover:text-red-600 self-start" onClick={() => s.remove('comment', r.id)}><Trash2 size={12} /></button>}
            </div>
          ))}
          {replying && <Composer small onSend={(body) => { s.addComment({ taskId: c.taskId || undefined, docId: c.docId || undefined, body, parentId: c.id }); }} placeholder="Reply…" />}
        </div>
      )}
    </div>
  );
}

export function Composer({ onSend, small, placeholder = 'Write a comment… Use @ to mention', allowAssign = true, submitLabel }: { onSend: (html: string, assignee: string | null) => void; small?: boolean; placeholder?: string; allowAssign?: boolean; submitLabel?: string }) {
  const [html, setHtml] = useState('');
  const [assignee, setAssignee] = useState<string[]>([]);
  const ed = useRef<Editor | null>(null);
  const send = () => {
    const body = ed.current?.getHTML() || html;
    if (!body || ed.current?.isEmpty) return;
    onSend(body, assignee[0] || null);
    ed.current?.commands.clearContent();
    setHtml('');
    setAssignee([]);
  };
  return (
    <div className={cn(!small && 'p-3 border-t bg-[var(--panel)]')}>
      <div className="rounded-lg border bg-[var(--panel)] focus-within:border-[var(--accent)] transition">
        <div className="px-3 py-2 max-h-48 overflow-auto"><RichEditor value="" onChange={setHtml} placeholder={placeholder} slash={false} compact onSubmit={send} editorRef={ed} /></div>
        <div className="flex items-center gap-1 px-2 pb-1.5">
          {allowAssign && !small && (
            <AssigneePicker value={assignee} onChange={(a) => setAssignee(a.slice(-1))} size={20} multi={false} trigger={
              <button className={cn('btn btn-ghost !py-0.5 !px-1.5 !text-xs', assignee[0] && '!text-amber-600')} title="Assign this comment"><UserCheck size={13} />{assignee[0] ? memberName(assignee[0]) : 'Assign'}</button>
            } />
          )}
          <div className="flex-1" />
          <span className="text-[10px] text-[var(--faint)] mr-1 hidden sm:inline">Ctrl+Enter</span>
          <button className="btn btn-primary !py-1 !px-2.5 !text-xs" onClick={send}><Send size={12} /> {submitLabel || (small ? 'Reply' : 'Comment')}</button>
        </div>
      </div>
    </div>
  );
}
