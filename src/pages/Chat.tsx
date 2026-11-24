import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Hash, Plus, Lock, MessageSquare, Pencil, Trash2, CheckSquare, X, Users, Smile, MoreHorizontal, Reply } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { useStore, getState, memberName } from '../lib/store';
import { Avatar, Popover, MenuList, Empty, Modal } from '../components/ui';
import { Html, RichEditor } from '../components/RichEditor';
import { Composer, Reactions, toggleReaction } from '../components/task/ActivityPanel';
import { cn, stripHtml } from '../lib/utils';
import type { Channel, Message } from '../lib/types';

export default function Chat() {
  const { id } = useParams();
  const nav = useNavigate();
  const channels = useStore((s) => s.data.channel);
  const messages = useStore((s) => s.data.message);
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.user!.id);
  const [newCh, setNewCh] = useState(false);
  const list = Object.values(channels).filter((c) => !c.dm && (!c.private || (c.members || []).includes(me) || c.created_by === me)).sort((a, b) => a.name.localeCompare(b.name));
  const dms = Object.values(channels).filter((c) => c.dm && c.members?.includes(me));
  const current = id ? channels[id] : list[0];
  const lastRead = (cid: string) => Number(localStorage.getItem('proman.read.' + cid) || 0);
  const unread = (cid: string) => Object.values(messages).filter((m) => m.channelId === cid && m.author !== me && !m.parentId && new Date(m.created_at || 0).getTime() > lastRead(cid)).length;
  const openDM = (uid: string) => {
    const existing = dms.find((c) => c.members!.length === 2 && c.members!.includes(uid));
    if (existing) return nav('/chat/' + existing.id);
    const c = getState().create('channel', { name: 'dm', dm: true, members: [me, uid], private: true });
    nav('/chat/' + c.id);
  };
  return (
    <div className="h-full flex">
      <div className="w-60 shrink-0 border-r bg-[var(--sidebar)] flex flex-col">
        <div className="h-12 flex items-center px-3 border-b font-semibold">Chat</div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex items-center px-2 py-1 text-[11.5px] font-semibold text-[var(--muted)]">Channels<button className="ml-auto icon-btn !w-5 !h-5" onClick={() => setNewCh(true)}><Plus size={13} /></button></div>
          {list.map((c) => {
            const u = unread(c.id);
            return (
              <button key={c.id} onClick={() => nav('/chat/' + c.id)} className={cn('w-full flex items-center gap-2 rounded-md px-2 py-[5px] text-[13.5px]', current?.id === c.id ? 'bg-[var(--hover)] font-medium' : 'hover:bg-[var(--hover)]', u && 'font-semibold')}>
                {c.private ? <Lock size={13} className="text-[var(--muted)]" /> : <Hash size={14} className="text-[var(--muted)]" />}<span className="truncate flex-1 text-left">{c.name}</span>
                {u > 0 && <span className="rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-[10px] px-1.5">{u}</span>}
              </button>
            );
          })}
          <div className="flex items-center px-2 py-1 mt-4 text-[11.5px] font-semibold text-[var(--muted)]">Direct messages</div>
          {members.filter((m) => m.user_id !== me).map((m) => {
            const dm = dms.find((c) => c.members!.length === 2 && c.members!.includes(m.user_id));
            const u = dm ? unread(dm.id) : 0;
            return (
              <button key={m.user_id} onClick={() => openDM(m.user_id)} className={cn('w-full flex items-center gap-2 rounded-md px-2 py-[5px] text-[13.5px]', dm && current?.id === dm.id ? 'bg-[var(--hover)] font-medium' : 'hover:bg-[var(--hover)]', u && 'font-semibold')}>
                <Avatar user={m.profile} size={20} /><span className="truncate flex-1 text-left">{m.profile.name}</span>
                {u > 0 && <span className="rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-[10px] px-1.5">{u}</span>}
              </button>
            );
          })}
          {members.length < 2 && <div className="px-2 text-xs text-[var(--faint)]">Invite teammates to send DMs.</div>}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        {current ? <ChannelView key={current.id} channel={current} /> : <Empty icon={<MessageSquare size={36} />} title="No channels yet" action={<button className="btn btn-primary" onClick={() => setNewCh(true)}><Plus size={14} /> Create channel</button>} />}
      </div>
      {newCh && <NewChannel onClose={() => setNewCh(false)} />}
    </div>
  );
}

function NewChannel({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [priv, setPriv] = useState(false);
  const me = useStore((s) => s.user!.id);
  return (
    <Modal open onClose={onClose} title="Create a channel" width={440}>
      <div className="p-5 space-y-3">
        <div><div className="label mb-1">Name</div><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="e.g. marketing" /></div>
        <div><div className="label mb-1">Description</div><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's this channel about?" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} className="accent-[var(--accent)]" /> Private (invite only)</label>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-4"><button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!name.trim()} onClick={() => { const c = getState().create('channel', { name: name.trim(), description: desc, private: priv, members: priv ? [me] : [] }); onClose(); nav('/chat/' + c.id); }}>Create</button></div>
    </Modal>
  );
}

export function ChannelView({ channel }: { channel: Channel }) {
  const messages = useStore((s) => s.data.message);
  const me = useStore((s) => s.user!.id);
  const members = useStore((s) => s.members);
  const [thread, setThread] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const list = useMemo(() => Object.values(messages).filter((m) => m.channelId === channel.id && !m.parentId).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')), [messages, channel.id]);
  useEffect(() => { bottom.current?.scrollIntoView(); localStorage.setItem('proman.read.' + channel.id, String(Date.now())); }, [list.length, channel.id]);
  const other = channel.dm ? channel.members?.find((m) => m !== me) : null;
  const title = channel.dm ? memberName(other) : channel.name;
  const send = (body: string, parentId: string | null = null) => {
    const s = getState();
    s.create('message', { channelId: channel.id, author: me, body, parentId, reactions: {} });
    const text = stripHtml(body).slice(0, 120);
    const mentioned = Array.from(body.matchAll(/data-id="([0-9a-f-]{36})"/g)).map((m) => m[1]);
    for (const m of mentioned) if (m !== me) s.notify({ user: m, actor: me, type: 'mention', text: `mentioned you in ${channel.dm ? 'a DM' : '#' + channel.name}: ${text}`, channelId: channel.id, primary: true });
    if (channel.dm) for (const m of channel.members || []) if (m !== me && !mentioned.includes(m)) s.notify({ user: m, actor: me, type: 'dm', text: `sent you a message: ${text}`, channelId: channel.id, primary: true });
    if (parentId) {
      const root = s.data.message[parentId];
      const participants = new Set([root?.author, ...Object.values(s.data.message).filter((x) => x.parentId === parentId).map((x) => x.author)]);
      participants.delete(me);
      for (const p of participants) if (p && !mentioned.includes(p)) s.notify({ user: p, actor: me, type: 'chat', text: `replied in a thread: ${text}`, channelId: channel.id });
    }
  };
  let lastDay = '', lastAuthor = '', lastAt = 0;
  return (
    <div className="h-full flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-12 shrink-0 flex items-center gap-2 px-4 border-b bg-[var(--panel)]">
          {channel.dm ? <Avatar id={other} size={24} /> : channel.private ? <Lock size={15} /> : <Hash size={16} />}
          <span className="font-semibold">{title}</span>
          {channel.description && <span className="text-xs text-[var(--muted)] truncate">· {channel.description}</span>}
          <div className="flex-1" />
          {!channel.dm && (
            <Popover align="end" width={260} trigger={<button className="btn btn-ghost !py-1"><Users size={14} /> {channel.private ? channel.members?.length : members.length}</button>}>
              <div className="p-2">
                {channel.private ? (
                  <>{members.map((m) => {
                    const on = (channel.members || []).includes(m.user_id);
                    return <button key={m.user_id} className="menu-item" onClick={() => getState().update('channel', channel.id, { members: on ? channel.members!.filter((x) => x !== m.user_id) : [...(channel.members || []), m.user_id] })}><Avatar user={m.profile} size={20} /><span className="flex-1">{m.profile.name}</span>{on && '✓'}</button>;
                  })}</>
                ) : <div className="text-xs text-[var(--muted)] p-2">Everyone in the workspace can see this channel.</div>}
              </div>
            </Popover>
          )}
          {!channel.dm && <Popover align="end" trigger={<button className="icon-btn"><MoreHorizontal size={16} /></button>}>
            {(close) => <MenuList close={close} items={[
              { label: 'Rename', icon: <Pencil size={14} />, onClick: () => { const n = prompt('Channel name', channel.name); if (n) getState().update('channel', channel.id, { name: n }); } },
              { label: 'Edit description', icon: <Pencil size={14} />, onClick: () => { const n = prompt('Description', channel.description || ''); if (n != null) getState().update('channel', channel.id, { description: n }); } },
              { label: 'Delete channel', icon: <Trash2 size={14} />, danger: true, onClick: () => { if (confirm('Delete this channel and all messages?')) getState().removeMany([...list.map((m) => ({ kind: 'message' as const, id: m.id })), { kind: 'channel', id: channel.id }]); } },
            ]} />}
          </Popover>}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!list.length && <div className="text-center py-16"><div className="text-3xl mb-2">{channel.dm ? '👋' : '#'}</div><div className="font-semibold">{channel.dm ? `This is the start of your conversation with ${title}` : `Welcome to #${channel.name}`}</div><div className="text-sm text-[var(--muted)]">Send a message to get things going.</div></div>}
          {list.map((m) => {
            const d = m.created_at ? new Date(m.created_at) : new Date();
            const day = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, MMMM d');
            const showDay = day !== lastDay;
            const compact = !showDay && lastAuthor === m.author && d.getTime() - lastAt < 5 * 60000;
            lastDay = day; lastAuthor = m.author; lastAt = d.getTime();
            return (
              <div key={m.id}>
                {showDay && <div className="flex items-center gap-3 my-4"><div className="flex-1 border-t" /><span className="text-xs font-medium text-[var(--muted)] rounded-full border px-3 py-0.5">{day}</span><div className="flex-1 border-t" /></div>}
                <MessageRow m={m} compact={compact} onThread={() => setThread(m.id)} channel={channel} />
              </div>
            );
          })}
          <div ref={bottom} />
        </div>
        <Composer onSend={(b) => send(b)} placeholder={`Message ${channel.dm ? title : '#' + channel.name}`} allowAssign={false} />
      </div>
      {thread && messages[thread] && (
        <div className="w-[380px] shrink-0 border-l flex flex-col bg-[var(--subtle)]">
          <div className="h-12 flex items-center px-4 border-b bg-[var(--panel)] font-semibold text-sm">Thread<button className="ml-auto icon-btn" onClick={() => setThread(null)}><X size={15} /></button></div>
          <div className="flex-1 overflow-y-auto p-3">
            <MessageRow m={messages[thread]} compact={false} channel={channel} inThread />
            <div className="border-t my-2" />
            {Object.values(messages).filter((x) => x.parentId === thread).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')).map((r) => <MessageRow key={r.id} m={r} compact={false} channel={channel} inThread />)}
          </div>
          <Composer small onSend={(b) => send(b, thread)} placeholder="Reply…" allowAssign={false} />
        </div>
      )}
    </div>
  );
}

function MessageRow({ m, compact, onThread, channel, inThread }: { m: Message; compact: boolean; onThread?: () => void; channel: Channel; inThread?: boolean }) {
  const me = useStore((s) => s.user!.id);
  const replies = useStore((s) => Object.values(s.data.message).filter((x) => x.parentId === m.id));
  const task = useStore((s) => (m.taskId ? s.data.task[m.taskId] : undefined));
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const s = getState();
  const makeTask = () => {
    const lists = Object.values(s.data.list).filter((l) => !l.archived);
    if (!lists.length) return s.toast('Create a List first', 'error');
    const t = s.createTask({ name: stripHtml(m.body).slice(0, 120) || 'Task from chat', listId: localStorage.getItem('proman.lastList') || lists[0].id, description: m.body + `<p><em>From chat in ${channel.dm ? 'a DM' : '#' + channel.name}</em></p>` });
    s.update('message', m.id, { taskId: t.id });
    s.toast('Task created from message', 'success', { label: 'Open', run: () => s.openTask(t.id) });
  };
  return (
    <div className={cn('group relative flex gap-3 rounded-md px-2 hover:bg-[var(--subtle)]', compact ? 'py-0.5' : 'pt-2 pb-1')}>
      <div className="w-9 shrink-0">{!compact ? <Avatar id={m.author} size={34} /> : <span className="hidden group-hover:block text-[10px] text-[var(--faint)] pt-1">{m.created_at && format(new Date(m.created_at), 'h:mm')}</span>}</div>
      <div className="flex-1 min-w-0">
        {!compact && <div className="flex items-baseline gap-2"><span className="font-semibold text-[14px]">{memberName(m.author)}</span><span className="text-[11px] text-[var(--faint)]">{m.created_at && format(new Date(m.created_at), 'h:mm a')}</span>{m.edited && <span className="text-[10px] text-[var(--faint)]">(edited)</span>}</div>}
        {edit ? (
          <div className="rounded-md border bg-[var(--panel)] px-2 py-1 my-1">
            <RichEditor value={draft} onChange={setDraft} slash={false} compact autofocus onSubmit={() => { s.update('message', m.id, { body: draft, edited: true }); setEdit(false); }} />
            <div className="flex justify-end gap-1"><button className="btn btn-ghost !py-0.5 !text-xs" onClick={() => setEdit(false)}>Cancel</button><button className="btn btn-primary !py-0.5 !text-xs" onClick={() => { s.update('message', m.id, { body: draft, edited: true }); setEdit(false); }}>Save</button></div>
          </div>
        ) : <Html html={m.body} className="!text-[14px]" />}
        {task && <button onClick={() => s.openTask(task.id)} className="mt-1 inline-flex items-center gap-1.5 rounded-md border bg-[var(--panel)] px-2 py-1 text-xs"><CheckSquare size={12} className="text-accent" />{task.name}</button>}
        {Object.values(m.reactions || {}).some((u) => u.length) && <div className="mt-1"><Reactions reactions={m.reactions} onToggle={(e) => s.update('message', m.id, { reactions: toggleReaction(m.reactions, e, me) })} /></div>}
        {!inThread && replies.length > 0 && <button onClick={onThread} className="mt-1 text-xs text-accent font-medium hover:underline flex items-center gap-1"><Reply size={12} />{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</button>}
      </div>
      <div className="absolute -top-3 right-2 hidden group-hover:flex items-center rounded-md border bg-[var(--panel)] shadow-sm">
        <Popover align="end" trigger={<button className="icon-btn" title="React"><Smile size={14} /></button>}>
          {(close) => <div className="p-1.5 flex gap-0.5">{['👍', '❤️', '😂', '🎉', '👀', '🚀', '✅', '🙏'].map((e) => <button key={e} className="w-8 h-8 rounded hover:bg-[var(--hover)] text-lg" onClick={() => { s.update('message', m.id, { reactions: toggleReaction(m.reactions, e, me) }); close(); }}>{e}</button>)}</div>}
        </Popover>
        {!inThread && <button className="icon-btn" title="Reply in thread" onClick={onThread}><MessageSquare size={14} /></button>}
        <button className="icon-btn" title="Create task" onClick={makeTask}><CheckSquare size={14} /></button>
        {m.author === me && <button className="icon-btn" title="Edit" onClick={() => setEdit(true)}><Pencil size={13} /></button>}
        {m.author === me && <button className="icon-btn hover:!text-red-600" title="Delete" onClick={() => s.remove('message', m.id)}><Trash2 size={13} /></button>}
      </div>
    </div>
  );
}
