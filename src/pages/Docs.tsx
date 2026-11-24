import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Plus, ChevronRight, ChevronDown, ChevronLeft, MoreHorizontal, Trash2, Globe, Copy, Star, BookOpen, MessageSquare, Search, Download, History, X } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useStore, getState, memberName, locationName, pushRecent } from '../lib/store';
import { RichEditor, Html } from '../components/RichEditor';
import { Popover, MenuList, Empty, Avatar, Toggle, SearchInput, Modal, useIsMobile } from '../components/ui';
import { CommentCard, Composer } from '../components/task/ActivityPanel';
import { useFavs } from '../components/layout/Sidebar';
import { cn, debounce, stripHtml, downloadFile } from '../lib/utils';
import type { Doc } from '../lib/types';

export default function Docs() {
  const { id } = useParams();
  const docs = useStore((s) => s.data.doc);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const doc = id ? docs[id] : undefined;
  useEffect(() => { if (id && doc) pushRecent({ type: 'doc', id }); }, [id]);
  const roots = Object.values(docs).filter((d) => !d.parentId && !d.archived).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  const filtered = q ? Object.values(docs).filter((d) => (d.title + ' ' + stripHtml(d.content)).toLowerCase().includes(q.toLowerCase())) : null;
  const create = (parentId: string | null = null, location: any = null) => {
    const d = getState().create('doc', { title: 'Untitled', content: '', parentId, location, order: Date.now() });
    nav('/doc/' + d.id);
  };
  const mobile = useIsMobile();
  // Phones: list first; opening a doc shows only the editor (with a back button).
  const showList = !mobile || !doc;
  const showMain = !mobile || !!doc;
  return (
    <div className="h-full flex">
      {showList && <div className={cn('shrink-0 border-r bg-[var(--sidebar)] flex flex-col', mobile ? 'w-full' : 'w-64')}>
        <div className="h-12 flex items-center px-3 border-b gap-2">
          <BookOpen size={16} className="text-[var(--muted)]" /><span className="font-semibold flex-1">Docs</span>
          <button className="btn btn-primary !py-1 !px-2" onClick={() => create()}><Plus size={14} /> New</button>
        </div>
        <div className="p-2"><SearchInput value={q} onChange={setQ} placeholder="Search docs…" /></div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {filtered ? filtered.map((d) => <DocRow key={d.id} doc={d} depth={0} active={id} flat />) : roots.map((d) => <DocRow key={d.id} doc={d} depth={0} active={id} />)}
          {!roots.length && <div className="text-xs text-[var(--muted)] p-3">No docs yet.</div>}
        </div>
      </div>}
      {showMain && <div className="flex-1 min-w-0 overflow-y-auto">
        {doc ? <DocEditor key={doc.id} doc={doc} onBack={mobile ? () => nav('/docs') : undefined} /> : <DocsHome create={() => create()} />}
      </div>}
    </div>
  );
}

function DocsHome({ create }: { create: () => void }) {
  const docs = useStore((s) => s.data.doc);
  const nav = useNavigate();
  const recent = Object.values(docs).filter((d) => !d.archived).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 18);
  const wikis = recent.filter((d) => d.wiki);
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Docs</h1>
      <p className="text-[var(--muted)] mt-1">Wikis, specs, meeting notes and knowledge bases, all linked to your work.</p>
      <button className="mt-5 btn btn-primary" onClick={create}><Plus size={15} /> New Doc</button>
      {wikis.length > 0 && <><div className="mt-8 font-semibold mb-3">Wikis</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{wikis.map((d) => <DocCard key={d.id} d={d} onClick={() => nav('/doc/' + d.id)} />)}</div></>}
      <div className="mt-8 font-semibold mb-3">Recently updated</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{recent.map((d) => <DocCard key={d.id} d={d} onClick={() => nav('/doc/' + d.id)} />)}</div>
      {!recent.length && <Empty icon={<FileText size={36} />} title="No docs yet" body="Create your first doc to start writing." />}
    </div>
  );
}

const DocCard = ({ d, onClick }: { d: Doc; onClick: () => void }) => (
  <button onClick={onClick} className="card p-4 text-left hover:shadow-md transition">
    <div className="flex items-center gap-2"><span className="text-lg">{d.icon || '📄'}</span><span className="font-medium truncate">{d.title || 'Untitled'}</span>{d.wiki && <span className="text-[10px] rounded bg-[var(--subtle)] border px-1">WIKI</span>}</div>
    <div className="text-xs text-[var(--muted)] mt-2 line-clamp-3 min-h-[3em]">{stripHtml(d.content).slice(0, 160) || 'Empty doc'}</div>
    <div className="text-[11px] text-[var(--faint)] mt-2">{d.updated_at && `Edited ${formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })}`}{d.location ? ` · ${locationName(d.location)}` : ''}</div>
  </button>
);

function DocRow({ doc, depth, active, flat }: { doc: Doc; depth: number; active?: string; flat?: boolean }) {
  const docs = useStore((s) => s.data.doc);
  const nav = useNavigate();
  const kids = flat ? [] : Object.values(docs).filter((d) => d.parentId === doc.id && !d.archived).sort((a, b) => (a.order || 0) - (b.order || 0));
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div className={cn('group flex items-center gap-1 rounded-md pr-1 h-[30px] text-[13.5px] cursor-pointer', active === doc.id ? 'bg-[var(--hover)] font-medium' : 'hover:bg-[var(--hover)]')} style={{ paddingLeft: 4 + depth * 14 }} onClick={() => nav('/doc/' + doc.id)}>
        <button className={cn('w-5 h-5 flex items-center justify-center text-[var(--muted)]', !kids.length && 'invisible')} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
        <span className="text-sm">{doc.icon || '📄'}</span>
        <span className="flex-1 truncate">{doc.title || 'Untitled'}</span>
        <button className="hidden group-hover:flex icon-btn !w-5 !h-5" title="Add page" onClick={(e) => { e.stopPropagation(); const d = getState().create('doc', { title: 'Untitled', content: '', parentId: doc.id, location: doc.location || null, order: Date.now() }); nav('/doc/' + d.id); }}><Plus size={12} /></button>
      </div>
      {open && kids.map((k) => <DocRow key={k.id} doc={k} depth={depth + 1} active={active} />)}
    </div>
  );
}

export function DocEditor({ doc, onBack }: { doc: Doc; onBack?: () => void }) {
  const nav = useNavigate();
  const docs = useStore((s) => s.data.doc);
  const comments = useStore((s) => s.data.comment);
  const { isFav, toggle } = useFavs();
  const [showComments, setShowComments] = useState(false);
  const [history, setHistory] = useState(false);
  const save = useMemo(() => debounce((html: string) => {
    const s = getState();
    s.update('doc', doc.id, { content: html, lastEditedBy: s.user!.id });
    snapshot(doc.id, html);
  }, 700), [doc.id]);
  const saveTitle = useMemo(() => debounce((t: string) => getState().update('doc', doc.id, { title: t }), 400), [doc.id]);
  const subpages = Object.values(docs).filter((d) => d.parentId === doc.id && !d.archived);
  const crumbs: Doc[] = [];
  for (let p = doc.parentId ? docs[doc.parentId] : undefined; p; p = p.parentId ? docs[p.parentId] : undefined) crumbs.unshift(p);
  const docComments = Object.values(comments).filter((c) => c.docId === doc.id && !c.parentId).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  const link = location.href.split('#')[0] + '#/share/' + doc.id;

  return (
    <div className="flex min-h-full">
      <div className="flex-1 min-w-0">
        <div className="sticky top-0 z-20 h-11 flex items-center gap-1 px-2 sm:px-4 border-b bg-[var(--panel)]/95 backdrop-blur text-[13px]">
          {onBack && <button className="icon-btn !w-10 !h-10 shrink-0" aria-label="All docs" onClick={onBack}><ChevronLeft size={20} /></button>}
          <div className="flex items-center gap-1 text-[var(--muted)] min-w-0">
            {doc.location && <><span className="truncate">{locationName(doc.location)}</span><ChevronRight size={12} /></>}
            {crumbs.map((c) => <span key={c.id} className="flex items-center gap-1"><button className="hover:text-[var(--text)] truncate" onClick={() => nav('/doc/' + c.id)}>{c.title || 'Untitled'}</button><ChevronRight size={12} /></span>)}
            <span className="text-[var(--text)] truncate">{doc.title || 'Untitled'}</span>
          </div>
          <div className="flex-1" />
          <span className="text-xs text-[var(--faint)] hidden md:inline mr-2">{doc.updated_at && `Edited ${formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}${doc.lastEditedBy ? ' by ' + memberName(doc.lastEditedBy) : ''}`}</span>
          <button className={cn('btn btn-ghost !py-1', showComments && '!bg-[var(--hover)]')} onClick={() => setShowComments(!showComments)}><MessageSquare size={14} /> {docComments.length || ''}</button>
          <Popover align="end" width={320} trigger={<button className="btn btn-ghost !py-1"><Globe size={14} /> Share</button>}>
            <div className="p-4 space-y-3">
              <button className="btn btn-outline w-full justify-center" onClick={() => { navigator.clipboard.writeText(location.href.split('#')[0] + '#/doc/' + doc.id); getState().toast('Link copied'); }}><Copy size={14} /> Copy workspace link</button>
              <Toggle on={!!doc.public} onChange={(v) => getState().update('doc', doc.id, { public: v })} label="Public read-only link" />
              {doc.public && <div className="flex gap-1"><input readOnly className="input !py-1 !text-xs" value={link} /><button className="btn btn-outline !py-1" onClick={() => { navigator.clipboard.writeText(link); getState().toast('Public link copied'); }}><Copy size={13} /></button></div>}
            </div>
          </Popover>
          <button className="icon-btn" onClick={() => toggle({ type: 'doc', id: doc.id })}><Star size={15} className={isFav(doc.id) ? 'text-amber-500' : ''} fill={isFav(doc.id) ? 'currentColor' : 'none'} /></button>
          <Popover align="end" trigger={<button className="icon-btn"><MoreHorizontal size={16} /></button>}>
            {(close) => <MenuList close={close} items={[
              { label: doc.wiki ? 'Unmark as wiki' : 'Mark as wiki', icon: <BookOpen size={14} />, onClick: () => getState().update('doc', doc.id, { wiki: !doc.wiki }) },
              { label: 'Add sub-page', icon: <Plus size={14} />, onClick: () => { const d = getState().create('doc', { title: 'Untitled', content: '', parentId: doc.id, location: doc.location || null, order: Date.now() }); nav('/doc/' + d.id); } },
              { label: 'Page history', icon: <History size={14} />, onClick: () => setHistory(true) },
              { label: 'Duplicate', icon: <Copy size={14} />, onClick: () => { const { id, kind, created_at, updated_at, created_by, ...rest } = doc as any; const d = getState().create('doc', { ...rest, title: doc.title + ' (copy)' }); nav('/doc/' + d.id); } },
              { label: 'Export as Markdown', icon: <Download size={14} />, onClick: () => downloadFile((doc.title || 'doc') + '.md', htmlToMarkdown(doc.content), 'text/markdown') },
              { label: 'Export as HTML', icon: <Download size={14} />, onClick: () => downloadFile((doc.title || 'doc') + '.html', `<!doctype html><meta charset="utf-8"><title>${doc.title}</title><body style="font-family:system-ui;max-width:760px;margin:40px auto">${doc.content}</body>`, 'text/html') },
              { label: 'Print / Save as PDF', icon: <Download size={14} />, onClick: () => window.print() },
              { divider: true, label: '' },
              { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => { if (confirm('Delete this doc and its sub-pages?')) { const kill = Object.values(docs).filter((d) => d.parentId === doc.id).map((d) => ({ kind: 'doc' as const, id: d.id })); getState().removeMany([...kill, { kind: 'doc', id: doc.id }]); nav('/docs'); } } },
            ]} />}
          </Popover>
        </div>
        <div className="max-w-[820px] mx-auto px-5 sm:px-10 py-6 sm:py-10">
          <Popover trigger={<button className="text-4xl hover:bg-[var(--hover)] rounded-lg p-1 -ml-1">{doc.icon || '📄'}</button>}>
            {(close) => <div className="p-2 grid grid-cols-8 gap-1 w-72">{'📄📝📘📗📙📕📒📓🧭🚀🎯💡📌📊📈🗂️🧪🛠️🎨🧩📣🤝✅⭐🔥🌍🏁🧠💬🗓️🔒'.match(/\p{Extended_Pictographic}️?/gu)!.map((e) => <button key={e} className="text-xl rounded hover:bg-[var(--hover)] p-1" onClick={() => { getState().update('doc', doc.id, { icon: e }); close(); }}>{e}</button>)}</div>}
          </Popover>
          <input className="w-full text-[28px] sm:text-[38px] font-bold bg-transparent outline-none mt-2 mb-4 placeholder:text-[var(--faint)]" placeholder="Untitled" defaultValue={doc.title === 'Untitled' ? '' : doc.title} key={doc.id} onChange={(e) => saveTitle(e.target.value || 'Untitled')} />
          <RichEditor value={doc.content} onChange={save} toolbar className="!text-[15.5px] min-h-[50vh]" placeholder="Start writing, or press / for commands…" />
          {subpages.length > 0 && (
            <div className="mt-10 border-t pt-4">
              <div className="label mb-2">Pages</div>
              {subpages.map((p) => <button key={p.id} className="flex items-center gap-2 py-1 text-[14px] hover:underline" onClick={() => nav('/doc/' + p.id)}><span>{p.icon || '📄'}</span>{p.title || 'Untitled'}</button>)}
            </div>
          )}
        </div>
      </div>
      {showComments && (
        <div className="fixed inset-0 z-[750] md:static md:z-auto md:w-[340px] shrink-0 border-l bg-[var(--subtle)] flex flex-col md:sticky md:top-0 md:h-[calc(100vh-48px)]">
          <div className="h-11 flex items-center px-4 border-b bg-[var(--panel)] font-semibold text-sm">Comments <button className="ml-auto icon-btn" onClick={() => setShowComments(false)}><X size={14} /></button></div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {docComments.map((c) => <CommentCard key={c.id} c={c} />)}
            {!docComments.length && <div className="text-center text-xs text-[var(--muted)] py-8">No comments on this doc yet.</div>}
          </div>
          <Composer onSend={(body, assignee) => getState().addComment({ docId: doc.id, body, assignee })} />
        </div>
      )}
      {history && <HistoryModal doc={doc} onClose={() => setHistory(false)} />}
    </div>
  );
}

// Simple local version history (per browser): snapshot at most every 5 minutes.
function snapshot(docId: string, html: string) {
  const key = 'proman.dochist.' + docId;
  const list: { at: number; html: string }[] = JSON.parse(localStorage.getItem(key) || '[]');
  if (list.length && Date.now() - list[0].at < 5 * 60000) list[0] = { at: list[0].at, html };
  else list.unshift({ at: Date.now(), html });
  try { localStorage.setItem(key, JSON.stringify(list.slice(0, 20))); } catch {}
}
function HistoryModal({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const list: { at: number; html: string }[] = JSON.parse(localStorage.getItem('proman.dochist.' + doc.id) || '[]');
  const [sel, setSel] = useState(0);
  return (
    <Modal open onClose={onClose} title="Page history (this device)" width={900}>
      <div className="flex h-[60vh]">
        <div className="w-56 border-r overflow-y-auto p-2">
          {list.map((v, i) => <button key={v.at} className="menu-item" data-active={i === sel} onClick={() => setSel(i)}>{format(new Date(v.at), 'MMM d, h:mm a')}</button>)}
          {!list.length && <div className="text-xs text-[var(--muted)] p-2">No snapshots yet. Versions are saved as you edit.</div>}
        </div>
        <div className="flex-1 overflow-y-auto p-6">{list[sel] && <Html html={list[sel].html} className="!text-[14px]" />}</div>
      </div>
      {list[sel] && <div className="flex justify-end px-5 py-3 border-t"><button className="btn btn-primary" onClick={() => { getState().update('doc', doc.id, { content: list[sel].html }); onClose(); }}>Restore this version</button></div>}
    </Modal>
  );
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (n: Node): string => {
    if (n.nodeType === 3) return n.textContent || '';
    const el = n as HTMLElement;
    const inner = Array.from(el.childNodes).map(walk).join('');
    switch (el.tagName) {
      case 'H1': return `# ${inner}\n\n`;
      case 'H2': return `## ${inner}\n\n`;
      case 'H3': return `### ${inner}\n\n`;
      case 'P': return `${inner}\n\n`;
      case 'STRONG': case 'B': return `**${inner}**`;
      case 'EM': case 'I': return `*${inner}*`;
      case 'S': return `~~${inner}~~`;
      case 'CODE': return el.parentElement?.tagName === 'PRE' ? inner : `\`${inner}\``;
      case 'PRE': return '```\n' + inner + '\n```\n\n';
      case 'A': return `[${inner}](${el.getAttribute('href')})`;
      case 'IMG': return `![](${el.getAttribute('src')})`;
      case 'BLOCKQUOTE': return inner.split('\n').filter(Boolean).map((l) => '> ' + l).join('\n') + '\n\n';
      case 'HR': return '---\n\n';
      case 'UL': return Array.from(el.children).map((li) => (el.dataset.type === 'taskList' ? `- [${(li as HTMLElement).dataset.checked === 'true' ? 'x' : ' '}] ` : '- ') + walk(li).trim()).join('\n') + '\n\n';
      case 'OL': return Array.from(el.children).map((li, i) => `${i + 1}. ` + walk(li).trim()).join('\n') + '\n\n';
      default: return inner;
    }
  };
  return walk(doc.body).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
