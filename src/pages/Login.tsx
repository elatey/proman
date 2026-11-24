import { useState } from 'react';
import { useStore } from '../lib/store';
import { backend, getSupabaseConfig, setSupabaseConfig, setForceLocal } from '../lib/backend';
import { Logo, Modal } from '../components/ui';
import { Database, HardDrive, Loader2, CheckCircle2, ListChecks, MessagesSquare, LayoutDashboard, FileText } from 'lucide-react';

export function Login() {
  const signIn = useStore((s) => s.signIn);
  const signUp = useStore((s) => s.signUp);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'in') await signIn(email, password);
      else await signUp(email, password, name);
    } catch (e: any) {
      if (e.message === 'CONFIRM_EMAIL') { setInfo('Check your inbox to confirm your email, then sign in.'); setMode('in'); }
      else setErr(e.message || 'Something went wrong');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-full flex">
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 text-white" style={{ background: 'linear-gradient(140deg, var(--accent), #1c1c3a)' }}>
        <div className="flex items-center gap-2.5 text-lg font-bold"><Logo size={34} /> ProMan</div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight">One place for all of your team's work.</h1>
          <p className="mt-4 text-white/75 text-[15px]">Tasks, docs, chat, goals, dashboards and automations, in one workspace your whole team shares in real time.</p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
            {[[ListChecks, '15+ task views'], [FileText, 'Docs & wikis'], [MessagesSquare, 'Team chat'], [LayoutDashboard, 'Dashboards & goals']].map(([I, t]: any) => (
              <div key={t} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2.5"><I size={16} />{t}</div>
            ))}
          </div>
        </div>
        <div className="text-xs text-white/50">Free and open source. Host it yourself.</div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex lg:hidden items-center gap-2 font-bold text-lg mb-8"><Logo /> ProMan</div>
          <h2 className="text-2xl font-bold">{mode === 'in' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="text-sm text-[var(--muted)] mt-1">{mode === 'in' ? 'Sign in to your workspace.' : 'Start collaborating with your team in minutes.'}</p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === 'up' && <div><div className="label mb-1">Full name</div><input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" autoComplete="name" /></div>}
            <div><div className="label mb-1">Email</div><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" /></div>
            <div><div className="label mb-1">Password</div><input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></div>
            {err && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-md px-3 py-2">{err}</div>}
            {info && <div className="text-sm text-green-700 bg-green-50 dark:bg-green-950/40 rounded-md px-3 py-2 flex gap-2"><CheckCircle2 size={16} className="shrink-0 mt-0.5" />{info}</div>}
            <button className="btn btn-primary w-full justify-center !py-2.5" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}{mode === 'in' ? 'Sign in' : 'Create account'}</button>
          </form>
          <div className="mt-4 text-sm text-center text-[var(--muted)]">
            {mode === 'in' ? <>No account? <button className="text-accent font-medium" onClick={() => setMode('up')}>Sign up</button></> : <>Already have an account? <button className="text-accent font-medium" onClick={() => setMode('in')}>Sign in</button></>}
            {mode === 'in' && backend.resetPassword && (
              <div className="mt-2"><button className="text-xs hover:underline" onClick={async () => {
                if (!email) { setErr('Enter your email above first.'); return; }
                try { await backend.resetPassword!(email); setInfo('Password reset email sent.'); } catch (e: any) { setErr(e.message); }
              }}>Forgot password?</button></div>
            )}
          </div>
          <button onClick={() => setCfgOpen(true)} className="mt-8 w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs hover:bg-[var(--subtle)]">
            {backend.mode === 'supabase' ? <Database size={16} className="text-green-600" /> : <HardDrive size={16} className="text-amber-600" />}
            <span className="flex-1">
              <span className="font-semibold block text-[13px]">{backend.mode === 'supabase' ? 'Connected to cloud database' : 'Demo mode (this browser only)'}</span>
              <span className="text-[var(--muted)]">{backend.mode === 'supabase' ? 'Your team shares data in real time.' : 'Connect Supabase so your team can share data.'}</span>
            </span>
          </button>
        </div>
      </div>
      <BackendConfig open={cfgOpen} onClose={() => setCfgOpen(false)} />
    </div>
  );
}

export function BackendConfig({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cfg = getSupabaseConfig();
  const [url, setUrl] = useState(cfg.url);
  const [key, setKey] = useState(cfg.key);
  return (
    <Modal open={open} onClose={onClose} title="Database connection" width={520}>
      <div className="p-5 space-y-4 text-sm">
        <p className="text-[var(--muted)]">
          ProMan stores team data in <b>Supabase</b> (free tier). Create a project at supabase.com, run <code>supabase/schema.sql</code> in its SQL editor,
          then paste the <b>Project URL</b> and <b>anon public key</b> from <i>Project Settings → API</i>.
        </p>
        {cfg.fromEnv ? (
          <div className="rounded-md bg-green-50 dark:bg-green-950/40 px-3 py-2 text-green-700">This deployment is pre-configured with a Supabase project.</div>
        ) : (
          <>
            <div><div className="label mb-1">Project URL</div><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" /></div>
            <div><div className="label mb-1">Anon public key</div><textarea className="input font-mono text-xs" rows={3} value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi..." /></div>
          </>
        )}
        <div className="flex flex-wrap gap-2 justify-end">
          {backend.mode === 'supabase' && <button className="btn btn-outline" onClick={() => { setForceLocal(true); location.reload(); }}>Use demo mode instead</button>}
          {backend.mode === 'local' && localStorage.getItem('proman.forceLocal') && <button className="btn btn-outline" onClick={() => { setForceLocal(false); location.reload(); }}>Use cloud database</button>}
          {!cfg.fromEnv && <button className="btn btn-outline" onClick={() => { setSupabaseConfig('', ''); location.reload(); }}>Disconnect</button>}
          {!cfg.fromEnv && <button className="btn btn-primary" onClick={() => { setSupabaseConfig(url, key); setForceLocal(false); location.reload(); }}>Save & reload</button>}
        </div>
      </div>
    </Modal>
  );
}
