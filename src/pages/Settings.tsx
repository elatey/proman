import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, Palette, Building2, Users, Sliders, Download, Trash2, Database, Mail, Copy, Upload, X, RotateCcw, LogOut } from 'lucide-react';
import { useStore, getState, canAdmin, memberName } from '../lib/store';
import { backend } from '../lib/backend';
import { Avatar, ColorDots, Toggle, Empty } from '../components/ui';
import { BackendConfig } from './Login';
import { getTheme, setTheme, getAccent, setAccent } from '../lib/theme';
import { cn, COLORS, downloadFile, uid } from '../lib/utils';
import type { ClickApp, Role } from '../lib/types';

const TABS = [
  { k: 'profile', label: 'My profile', icon: User },
  { k: 'appearance', label: 'Appearance', icon: Palette },
  { k: 'workspace', label: 'Workspace', icon: Building2 },
  { k: 'people', label: 'People', icon: Users },
  { k: 'clickapps', label: 'ClickApps', icon: Sliders },
  { k: 'data', label: 'Import / Export', icon: Download },
  { k: 'trash', label: 'Archive & Trash', icon: Trash2 },
  { k: 'database', label: 'Database', icon: Database },
];

export default function Settings() {
  const { tab = 'profile' } = useParams();
  const nav = useNavigate();
  return (
    <div className="h-full flex">
      <div className="w-56 shrink-0 border-r bg-[var(--sidebar)] p-2">
        <div className="h-10 flex items-center px-2 font-semibold">Settings</div>
        {TABS.map((t) => <button key={t.k} onClick={() => nav('/settings/' + t.k)} className={cn('menu-item', tab === t.k && 'bg-[var(--hover)] font-medium')}><t.icon size={14} />{t.label}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          {tab === 'profile' && <Profile />}
          {tab === 'appearance' && <Appearance />}
          {tab === 'workspace' && <WorkspaceTab />}
          {tab === 'people' && <People />}
          {tab === 'clickapps' && <ClickApps />}
          {tab === 'data' && <DataTab />}
          {tab === 'trash' && <TrashTab />}
          {tab === 'database' && <DatabaseTab />}
        </div>
      </div>
    </div>
  );
}

const H = ({ title, sub }: { title: string; sub?: string }) => <div className="mb-6"><h1 className="text-xl font-bold">{title}</h1>{sub && <p className="text-sm text-[var(--muted)] mt-1">{sub}</p>}</div>;

function Profile() {
  const user = useStore((s) => s.user)!;
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const upload = () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.onchange = async () => {
      const f = i.files?.[0]; if (!f) return;
      setBusy(true);
      try { const url = await backend.uploadFile(getState().workspace!.id, f, f.name); await getState().updateProfile({ avatar_url: url }); } catch (e: any) { getState().toast(e.message, 'error'); } finally { setBusy(false); }
    };
    i.click();
  };
  return (
    <>
      <H title="My profile" sub="How you appear to your teammates." />
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-4">
          <Avatar user={user} size={64} />
          <div className="space-x-2"><button className="btn btn-outline" onClick={upload} disabled={busy}><Upload size={14} /> {busy ? 'Uploading…' : 'Upload photo'}</button>
            {user.avatar_url && <button className="btn btn-ghost" onClick={() => getState().updateProfile({ avatar_url: null })}>Remove</button>}</div>
        </div>
        <div><div className="label mb-1">Full name</div><div className="flex gap-2"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn btn-primary" disabled={!name.trim() || name === user.name} onClick={() => getState().updateProfile({ name: name.trim() }).then(() => getState().toast('Saved', 'success'))}>Save</button></div></div>
        <div><div className="label mb-1">Email</div><input className="input" value={user.email} disabled /></div>
        <div><div className="label mb-2">Avatar color</div><ColorDots value={user.color} onChange={(c) => getState().updateProfile({ color: c })} /></div>
        <div className="pt-2 border-t flex items-center justify-between">
          <div className="text-sm"><div className="font-medium">Desktop notifications</div><div className="text-xs text-[var(--muted)]">Get notified for reminders while ProMan is open.</div></div>
          {'Notification' in window ? <button className="btn btn-outline" onClick={() => Notification.requestPermission().then((p) => getState().toast('Notifications: ' + p))}>{Notification.permission === 'granted' ? 'Enabled' : 'Enable'}</button> : <span className="text-xs">Not supported</span>}
        </div>
        <button className="btn btn-outline" onClick={() => getState().signOut()}><LogOut size={14} /> Sign out</button>
      </div>
    </>
  );
}

function Appearance() {
  const [t, setT] = useState(getTheme());
  const [a, setA] = useState(getAccent());
  return (
    <>
      <H title="Appearance" sub="Personal preferences, saved on this device." />
      <div className="card p-6 space-y-6">
        <div><div className="label mb-2">Theme</div>
          <div className="grid grid-cols-3 gap-3">
            {(['light', 'dark', 'system'] as const).map((k) => (
              <button key={k} onClick={() => { setTheme(k); setT(k); }} className={cn('rounded-lg border p-3 text-sm capitalize', t === k && 'border-accent ring-2 ring-accent/30')}>
                <div className={cn('h-14 rounded-md mb-2 border', k === 'light' ? 'bg-white' : k === 'dark' ? 'bg-[#18181b]' : 'bg-gradient-to-r from-white to-[#18181b]')} />{k}
              </button>
            ))}
          </div>
        </div>
        <div><div className="label mb-2">Accent color</div><ColorDots colors={['#6e56cf', '#3E63DD', '#0090FF', '#12A594', '#30A46C', '#F76B15', '#E5484D', '#D6409F', '#2F2F37']} value={a} onChange={(c) => { setAccent(c); setA(c); }} /></div>
      </div>
    </>
  );
}

function WorkspaceTab() {
  const ws = useStore((s) => s.workspace)!;
  const nav = useNavigate();
  const [name, setName] = useState(ws.name);
  const admin = canAdmin();
  return (
    <>
      <H title="Workspace settings" sub={admin ? undefined : 'Only owners and admins can change these settings.'} />
      <div className="card p-6 space-y-5">
        <div><div className="label mb-1">Workspace name</div><div className="flex gap-2"><input className="input" disabled={!admin} value={name} onChange={(e) => setName(e.target.value)} /><button className="btn btn-primary" disabled={!admin || !name.trim()} onClick={() => getState().updateWorkspace({ name: name.trim() }).then(() => getState().toast('Saved', 'success'))}>Save</button></div></div>
        <div><div className="label mb-2">Color</div><ColorDots value={ws.color} onChange={(c) => admin && getState().updateWorkspace({ color: c })} /></div>
      </div>
      {ws.owner_id === getState().user!.id && (
        <div className="card p-6 mt-6 border-red-200 dark:border-red-900">
          <div className="font-semibold text-red-600">Danger zone</div>
          <p className="text-sm text-[var(--muted)] mt-1">Deleting the Workspace permanently removes all Spaces, tasks, docs and data for everyone.</p>
          <button className="btn btn-danger mt-3" onClick={async () => {
            if (prompt(`Type "${ws.name}" to confirm deletion`) !== ws.name) return;
            await backend.deleteWorkspace(ws.id);
            localStorage.removeItem('proman.ws');
            location.hash = '#/';
            location.reload();
          }}><Trash2 size={14} /> Delete workspace</button>
        </div>
      )}
    </>
  );
}

function People() {
  const members = useStore((s) => s.members);
  const invites = useStore((s) => s.invites);
  const ws = useStore((s) => s.workspace)!;
  const me = useStore((s) => s.user)!;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [busy, setBusy] = useState(false);
  const admin = canAdmin();
  const appUrl = location.href.split('#')[0];
  const invite = async () => {
    const list = email.split(/[\s,;]+/).map((x) => x.trim()).filter((x) => /.+@.+\..+/.test(x));
    if (!list.length) return;
    setBusy(true);
    try {
      let joined = 0;
      for (const e of list) { const r = await getState().inviteMember(e, role); if (r.joined) joined++; }
      getState().toast(joined ? `${joined} added to the workspace` : `Invited ${list.length}. They'll join when they sign up or sign in with that email.`, 'success');
      setEmail('');
    } catch (e: any) { getState().toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Join ${ws.name} on ProMan`)}&body=${encodeURIComponent(`Hi! I've invited you to our ProMan workspace "${ws.name}".\n\n1. Open ${appUrl}\n2. Sign up (or sign in) with this email address\n\nYou'll be added automatically.`)}`;
  return (
    <>
      <H title="People" sub={`${members.length} members in ${ws.name}`} />
      {admin && (
        <div className="card p-5 mb-6">
          <div className="font-semibold mb-1">Invite people</div>
          <p className="text-xs text-[var(--muted)] mb-3">Enter one or more emails. Invited people join automatically when they sign up or sign in at <b>{appUrl}</b> with that email.</p>
          <div className="flex gap-2">
            <input className="input" placeholder="name@company.com, other@company.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && invite()} />
            <select className="input !w-32" value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="member">Member</option><option value="admin">Admin</option><option value="guest">Guest</option></select>
            <button className="btn btn-primary" onClick={invite} disabled={busy}><Mail size={14} /> Invite</button>
          </div>
          <div className="flex gap-2 mt-2">
            <button className="btn btn-ghost !text-xs !py-1" onClick={() => { navigator.clipboard.writeText(appUrl); getState().toast('App link copied'); }}><Copy size={12} /> Copy app link</button>
            <a className="btn btn-ghost !text-xs !py-1" href={mailto}><Mail size={12} /> Send invite email from my mail app</a>
          </div>
          {backend.mode === 'local' && <div className="mt-3 text-xs rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-3 py-2">Demo mode: teammates must use this same browser. Connect Supabase (Settings → Database) so people can join from their own devices.</div>}
        </div>
      )}
      <div className="card divide-y">
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
            <Avatar user={m.profile} size={32} />
            <div className="flex-1 min-w-0"><div className="font-medium text-sm">{m.profile.name}{m.user_id === me.id && <span className="text-[var(--faint)]"> (you)</span>}</div><div className="text-xs text-[var(--muted)] truncate">{m.profile.email}</div></div>
            {admin && m.role !== 'owner' && m.user_id !== me.id ? (
              <select className="input !w-28 !py-1 !text-xs" value={m.role} onChange={(e) => backend.setRole(ws.id, m.user_id, e.target.value as Role).then(() => getState().refreshMembers())}>
                <option value="admin">Admin</option><option value="member">Member</option><option value="guest">Guest</option>
              </select>
            ) : <span className="text-xs capitalize text-[var(--muted)] w-28 text-right">{m.role}</span>}
            {admin && m.role !== 'owner' && m.user_id !== me.id && <button className="icon-btn hover:!text-red-600" title="Remove from workspace" onClick={() => confirm(`Remove ${m.profile.name}?`) && backend.removeMember(ws.id, m.user_id).then(() => getState().refreshMembers())}><X size={14} /></button>}
          </div>
        ))}
      </div>
      {invites.length > 0 && (
        <>
          <div className="font-semibold mt-6 mb-2">Pending invites</div>
          <div className="card divide-y">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Mail size={15} className="text-[var(--muted)]" /><span className="flex-1">{i.email}</span><span className="text-xs capitalize text-[var(--muted)]">{i.role}</span>
                {admin && <button className="icon-btn" onClick={() => backend.revokeInvite(i.id).then(() => getState().refreshMembers())}><X size={14} /></button>}
              </div>
            ))}
          </div>
        </>
      )}
      <div className="text-xs text-[var(--muted)] mt-4">Roles: <b>Owner/Admin</b> manage people and settings · <b>Member</b> full access to work · <b>Guest</b> limited access.</div>
    </>
  );
}

const APPS: { k: ClickApp; label: string; desc: string }[] = [
  { k: 'priorities', label: 'Priorities', desc: 'Urgent, High, Normal and Low flags on tasks.' },
  { k: 'tags', label: 'Tags', desc: 'Color labels to categorize tasks.' },
  { k: 'multipleAssignees', label: 'Multiple Assignees', desc: 'Assign more than one person to a task.' },
  { k: 'timeTracking', label: 'Time Tracking', desc: 'Timers, manual time entries and timesheets.' },
  { k: 'timeEstimates', label: 'Time Estimates', desc: 'Estimate how long tasks take; used in Workload.' },
  { k: 'points', label: 'Sprint Points', desc: 'Story points for agile sprints.' },
  { k: 'dependencies', label: 'Dependencies & Reschedule', desc: 'Waiting on / blocking links; moving a task in Gantt shifts dependents.' },
  { k: 'automations', label: 'Automations', desc: 'Run trigger → condition → action rules.' },
];

function ClickApps() {
  const ws = useStore((s) => s.workspace)!;
  const apps = ws.settings?.clickApps || {};
  const admin = canAdmin();
  return (
    <>
      <H title="ClickApps" sub="Turn features on or off for the whole Workspace." />
      <div className="card divide-y">
        {APPS.map((a) => (
          <div key={a.k} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1"><div className="font-medium text-sm">{a.label}</div><div className="text-xs text-[var(--muted)]">{a.desc}</div></div>
            <Toggle on={apps[a.k] !== false} onChange={(v) => admin && getState().updateWorkspace({ settings: { ...ws.settings, clickApps: { ...apps, [a.k]: v } } })} />
          </div>
        ))}
      </div>
    </>
  );
}

function DataTab() {
  const data = useStore((s) => s.data);
  const ws = useStore((s) => s.workspace)!;
  const exportJson = () => {
    const all = Object.values(data).flatMap((m) => Object.values(m));
    downloadFile(`proman-backup-${ws.name.replace(/\W+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, workspace: ws.name, exportedAt: new Date().toISOString(), items: all }, null, 1), 'application/json');
  };
  const importJson = () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
    i.onchange = async () => {
      const f = i.files?.[0]; if (!f) return;
      try {
        const j = JSON.parse(await f.text());
        const items: any[] = j.items || [];
        if (!confirm(`Import ${items.length} items into "${ws.name}"? Items get new IDs, so nothing is overwritten.`)) return;
        const map = new Map<string, string>();
        items.forEach((x) => map.set(x.id, uid()));
        const remap = (v: any): any => (typeof v === 'string' && map.has(v) ? map.get(v) : Array.isArray(v) ? v.map(remap) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remap(x)])) : v);
        const s = getState();
        s.createMany(items.map((x) => { const { id, kind, created_at, updated_at, created_by, ...rest } = x; return { kind, id: map.get(id), data: remap(rest) }; }));
        s.toast(`Imported ${items.length} items`, 'success');
      } catch (e: any) { getState().toast('Import failed: ' + e.message, 'error'); }
    };
    i.click();
  };
  const counts = Object.entries(data).map(([k, v]) => [k, Object.keys(v).length] as const).filter(([, n]) => n);
  return (
    <>
      <H title="Import / Export" sub="Back up your workspace or move data between workspaces." />
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-4"><div className="flex-1"><div className="font-medium text-sm">Export everything (JSON)</div><div className="text-xs text-[var(--muted)]">A complete backup of Spaces, Lists, tasks, docs, chat, goals and more.</div></div><button className="btn btn-outline" onClick={exportJson}><Download size={14} /> Export</button></div>
        <div className="flex items-center gap-4"><div className="flex-1"><div className="font-medium text-sm">Import a backup (JSON)</div><div className="text-xs text-[var(--muted)]">Adds the items from a ProMan export into this workspace.</div></div><button className="btn btn-outline" onClick={importJson}><Upload size={14} /> Import</button></div>
        <div className="text-xs text-[var(--muted)] border-t pt-4">To import tasks from a spreadsheet (or another tool's CSV export), open a List → ••• in the view toolbar → <b>Import CSV</b>. Columns recognised: Name, Status, Priority, Due date, Start date, Tags, Description.</div>
      </div>
      <div className="card p-5 mt-6"><div className="font-medium text-sm mb-2">Workspace contents</div><div className="flex flex-wrap gap-2">{counts.map(([k, n]) => <span key={k} className="text-xs rounded-full bg-[var(--subtle)] border px-2.5 py-1">{n} {k}</span>)}</div></div>
    </>
  );
}

function TrashTab() {
  const data = useStore((s) => s.data);
  const items = [
    ...Object.values(data.task).filter((t) => t.archived).map((t) => ({ kind: 'task' as const, id: t.id, name: t.name })),
    ...Object.values(data.list).filter((t) => t.archived).map((t) => ({ kind: 'list' as const, id: t.id, name: t.name })),
    ...Object.values(data.folder).filter((t) => t.archived).map((t) => ({ kind: 'folder' as const, id: t.id, name: t.name })),
    ...Object.values(data.space).filter((t) => t.archived).map((t) => ({ kind: 'space' as const, id: t.id, name: t.name })),
    ...Object.values(data.doc).filter((t) => t.archived).map((t) => ({ kind: 'doc' as const, id: t.id, name: t.title })),
  ];
  return (
    <>
      <H title="Archive" sub="Archived items are hidden from views. Restore them or delete permanently." />
      <div className="card divide-y">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="text-[10px] uppercase rounded bg-[var(--subtle)] border px-1.5 w-14 text-center">{i.kind}</span>
            <span className="flex-1 truncate">{i.name}</span>
            <button className="btn btn-outline !py-1 !text-xs" onClick={() => getState().update(i.kind, i.id, { archived: false } as any)}><RotateCcw size={12} /> Restore</button>
            <button className="icon-btn hover:!text-red-600" onClick={() => { if (confirm('Delete permanently?')) i.kind === 'task' ? getState().deleteTask(i.id) : getState().remove(i.kind, i.id); }}><Trash2 size={14} /></button>
          </div>
        ))}
        {!items.length && <Empty title="Nothing archived" />}
      </div>
    </>
  );
}

function DatabaseTab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <H title="Database" sub="Where your team's data lives." />
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <Database size={20} className={backend.mode === 'supabase' ? 'text-green-600' : 'text-amber-600'} />
          <div className="flex-1"><div className="font-medium">{backend.mode === 'supabase' ? 'Supabase cloud database (shared, realtime)' : 'Demo mode: data stays in this browser'}</div>
            <div className="text-xs text-[var(--muted)]">{backend.mode === 'supabase' ? 'Everyone signed in to this deployment sees the same data in real time.' : 'Connect a free Supabase project so your team can log in from anywhere.'}</div></div>
          <button className="btn btn-outline" onClick={() => setOpen(true)}>Configure</button>
        </div>
      </div>
      <BackendConfig open={open} onClose={() => setOpen(false)} />
    </>
  );
}
