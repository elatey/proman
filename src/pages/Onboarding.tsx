import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { ColorDots, Logo } from '../components/ui';
import { Loader2, LogOut } from 'lucide-react';

export function Onboarding({ first }: { first: boolean }) {
  const createWorkspace = useStore((s) => s.createWorkspace);
  const user = useStore((s) => s.user);
  const signOut = useStore((s) => s.signOut);
  const nav = useNavigate();
  const [name, setName] = useState(first ? `${user?.name?.split(' ')[0] || 'My'}'s Workspace` : '');
  const [color, setColor] = useState('#6E56CF');
  const [seed, setSeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-[var(--subtle)]">
      <div className="card w-full max-w-md p-8">
        <div className="flex items-center justify-between mb-6"><Logo size={36} />{first && <button className="btn btn-ghost !text-xs" onClick={signOut}><LogOut size={14} />Sign out</button>}</div>
        <h1 className="text-2xl font-bold">{first ? 'Create your Workspace' : 'New Workspace'}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">A Workspace holds all your Spaces, people and work. If a teammate invited you, ask them to invite <b>{user?.email}</b> and sign in again.</p>
        <form className="mt-6 space-y-5" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setErr('');
          try { await createWorkspace(name.trim() || 'Workspace', color, seed); nav('/'); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
        }}>
          <div><div className="label mb-1">Workspace name</div><input className="input" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." /></div>
          <div><div className="label mb-2">Color</div><ColorDots value={color} onChange={setColor} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={seed} onChange={(e) => setSeed(e.target.checked)} className="accent-[var(--accent)]" /> Add a sample Space with example projects</label>
          {err && <div className="text-sm text-red-600">{err}</div>}
          <div className="flex gap-2">
            {!first && <button type="button" className="btn btn-outline" onClick={() => nav(-1)}>Cancel</button>}
            <button className="btn btn-primary flex-1 justify-center !py-2.5" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}Create Workspace</button>
          </div>
        </form>
      </div>
    </div>
  );
}
