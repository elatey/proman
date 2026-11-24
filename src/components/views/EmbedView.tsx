import { useState } from 'react';
import { Globe, Pencil } from 'lucide-react';
import { getState } from '../../lib/store';
import { Empty } from '../ui';
import type { ViewProps } from '../../pages/LocationPage';

export function toEmbedUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes('vimeo.com') && /^\/\d+/.test(u.pathname)) return `https://player.vimeo.com/video${u.pathname}`;
    if (u.hostname.includes('figma.com')) return `https://www.figma.com/embed?embed_host=proman&url=${encodeURIComponent(url)}`;
    if (u.hostname.includes('loom.com') && u.pathname.startsWith('/share/')) return url.replace('/share/', '/embed/');
    if (u.hostname.includes('docs.google.com') && !u.pathname.includes('/preview')) return url.replace(/\/edit.*$/, '/preview');
    return url;
  } catch { return url; }
}

export default function EmbedView({ view }: ViewProps) {
  const url = view.config.url || '';
  const [edit, setEdit] = useState(!url);
  const [v, setV] = useState(url);
  const save = () => { getState().update('view', view.id, { config: { ...view.config, url: v } }); setEdit(false); };
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <Globe size={14} className="text-[var(--muted)]" />
        {edit ? <><input autoFocus className="input !py-1 flex-1" value={v} onChange={(e) => setV(e.target.value)} placeholder="https://… (website, Figma, Google Docs/Sheets, YouTube, Loom, Miro…)" onKeyDown={(e) => e.key === 'Enter' && save()} /><button className="btn btn-primary !py-1" onClick={save}>Embed</button></>
          : <><a href={url} target="_blank" rel="noreferrer" className="text-[13px] text-accent truncate flex-1">{url}</a><button className="btn btn-ghost !py-1" onClick={() => setEdit(true)}><Pencil size={13} /> Change</button></>}
      </div>
      {url ? <iframe src={toEmbedUrl(url)} className="flex-1 w-full border-0 bg-white" allow="fullscreen; clipboard-write" title="embed" /> : <Empty icon={<Globe size={36} />} title="Embed anything" body="Paste a link to a website, Google Doc/Sheet, Figma file, video and more. Some sites block embedding." />}
    </div>
  );
}
