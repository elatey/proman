import { useRef, useState } from 'react';
import { Video, Circle, Square, Trash2, Link2, Paperclip, Mic, MicOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useStore, getState, memberName } from '../lib/store';
import { backend } from '../lib/backend';
import { Empty, Avatar, useNow } from '../components/ui';
import { fmtDuration } from '../lib/utils';

export default function Clips() {
  const clips = useStore((s) => s.data.clip);
  const tasks = useStore((s) => s.data.task);
  const [rec, setRec] = useState<{ mr: MediaRecorder; started: number; stream: MediaStream } | null>(null);
  const [mic, setMic] = useState(true);
  const [busy, setBusy] = useState(false);
  const chunks = useRef<Blob[]>([]);
  const now = useNow(500);
  const start = async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const tracks = [...screen.getTracks()];
      if (mic) { try { const m = await navigator.mediaDevices.getUserMedia({ audio: true }); tracks.push(...m.getAudioTracks()); } catch {} }
      const stream = new MediaStream(tracks);
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm', videoBitsPerSecond: 1_200_000 });
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = () => save(Date.now());
      screen.getVideoTracks()[0].onended = () => mr.state !== 'inactive' && mr.stop();
      mr.start(1000);
      setRec({ mr, started: Date.now(), stream });
    } catch (e: any) { if (e?.name !== 'NotAllowedError') getState().toast('Screen recording is not available: ' + e.message, 'error'); }
  };
  const stop = () => { rec?.mr.stop(); rec?.stream.getTracks().forEach((t) => t.stop()); };
  const save = async (endedAt: number) => {
    const startedAt = rec?.started || endedAt;
    setRec(null);
    const blob = new Blob(chunks.current, { type: 'video/webm' });
    setBusy(true);
    try {
      const s = getState();
      const url = await backend.uploadFile(s.workspace!.id, blob, `clip-${Date.now()}.webm`);
      s.create('clip', { name: 'Clip ' + new Date().toLocaleString(), url, duration: Math.round((endedAt - startedAt) / 1000), user: s.user!.id });
      s.toast('Clip saved', 'success');
    } catch (e: any) { getState().toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const list = Object.values(clips).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center gap-2"><h1 className="text-2xl font-bold flex-1 flex items-center gap-2"><Video /> Clips</h1>
          <button className="btn btn-outline" onClick={() => setMic(!mic)} title="Record microphone">{mic ? <Mic size={14} /> : <MicOff size={14} />}{mic ? 'Mic on' : 'Mic off'}</button>
          {rec ? <button className="btn btn-danger" onClick={stop}><Square size={13} fill="currentColor" /> Stop · {fmtDuration((now - rec.started) / 1000)}</button>
            : <button className="btn btn-primary" onClick={start} disabled={busy}><Circle size={13} fill="currentColor" /> {busy ? 'Saving…' : 'Record screen'}</button>}
        </div>
        <p className="text-[var(--muted)] mt-1">Record your screen and voice to explain things asynchronously, then share or attach clips to tasks.{backend.mode === 'local' && ' (Demo mode stores clips in the browser: keep them under ~10 seconds, or connect Supabase.)'}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {list.map((c) => (
            <div key={c.id} className="card overflow-hidden">
              <video src={c.url} controls className="w-full aspect-video bg-black" />
              <div className="p-3">
                <input className="font-medium bg-transparent outline-none w-full" defaultValue={c.name} onBlur={(e) => getState().update('clip', c.id, { name: e.target.value })} />
                <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-1"><Avatar id={c.user} size={16} />{memberName(c.user)} · {fmtDuration(c.duration)} · {c.created_at && formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</div>
                <div className="flex gap-1 mt-2">
                  <button className="btn btn-outline !py-1 !text-xs" onClick={() => { navigator.clipboard.writeText(c.url); getState().toast('Clip link copied'); }}><Link2 size={12} /> Copy link</button>
                  <select className="input !py-1 !text-xs flex-1" value="" onChange={(e) => { if (!e.target.value) return; getState().create('attachment', { taskId: e.target.value, name: c.name + '.webm', url: c.url, size: 0, mime: 'video/webm', user: c.user }); getState().toast('Attached to task', 'success'); }}>
                    <option value="">Attach to task…</option>{Object.values(tasks).slice(0, 200).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button className="icon-btn hover:!text-red-600" onClick={() => getState().remove('clip', c.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {!list.length && <Empty icon={<Video size={36} />} title="No clips yet" body="Click Record screen to capture a walkthrough." />}
      </div>
    </div>
  );
}
