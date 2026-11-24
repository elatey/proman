import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useStore, getState } from './lib/store';
import { tickAutomations } from './lib/automations';
import { Toasts } from './components/ui';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Shell } from './components/layout/Shell';
import { PublicForm, PublicShare } from './pages/Public';
import { Home } from './pages/Home';
import { Inbox } from './pages/Inbox';
import { LocationPage } from './pages/LocationPage';
import { TaskPage } from './pages/TaskPage';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';

const Docs = lazy(() => import('./pages/Docs'));
const Chat = lazy(() => import('./pages/Chat'));
const Dashboards = lazy(() => import('./pages/Dashboards'));
const Whiteboards = lazy(() => import('./pages/Whiteboards'));
const Goals = lazy(() => import('./pages/Goals'));
const Automations = lazy(() => import('./pages/Automations'));
const Timesheets = lazy(() => import('./pages/Timesheets'));
const Settings = lazy(() => import('./pages/Settings'));
const Planner = lazy(() => import('./pages/Planner'));
const Clips = lazy(() => import('./pages/Clips'));
const Templates = lazy(() => import('./pages/Templates'));

export const Spinner = () => <div className="flex h-full items-center justify-center text-[var(--muted)]"><Loader2 className="animate-spin" /></div>;

export default function App() {
  const authReady = useStore((s) => s.authReady);
  const user = useStore((s) => s.user);
  const workspace = useStore((s) => s.workspace);
  const loading = useStore((s) => s.loading);
  const workspaces = useStore((s) => s.workspaces);
  const loc = useLocation();

  useEffect(() => { getState().init(); }, []);

  // 1-minute ticker: date-based automations + due reminders
  useEffect(() => {
    if (!workspace || loading) return;
    const tick = () => {
      const s = getState();
      tickAutomations({
        get: getState,
        updateTask: (id, p) => s.updateTask(id, p, { fromAutomation: true }),
        createTask: (t) => s.createTask(t, { fromAutomation: true }),
        deleteTask: s.deleteTask,
        duplicateTask: s.duplicateTask,
        addComment: s.addComment,
        create: s.create,
        update: s.update,
      });
      const now = Date.now();
      for (const r of Object.values(s.data.reminder)) {
        if (r.user === s.user?.id && !r.done && !r.notified && r.due && new Date(r.due).getTime() <= now) {
          s.update('reminder', r.id, { notified: true });
          s.notify({ user: r.user, actor: r.assignedBy || null, type: 'reminder', text: `Reminder: ${r.text}`, taskId: r.taskId || null, primary: true });
          if ('Notification' in window && Notification.permission === 'granted') new Notification('ProMan reminder', { body: r.text });
        }
      }
    };
    const t0 = setTimeout(tick, 3000);
    const t = setInterval(tick, 60000);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, [workspace?.id, loading]);

  if (loc.pathname.startsWith('/form/')) return <Routes><Route path="/form/:id" element={<PublicForm />} /></Routes>;
  if (loc.pathname.startsWith('/share/')) return <Routes><Route path="/share/:id" element={<PublicShare />} /></Routes>;

  if (!authReady) return <Spinner />;
  if (!user) return <><Login /><Toasts /></>;
  if (!workspace && !loading) return <><Onboarding first={!workspaces.length} /><Toasts /></>;
  if (loading || !workspace) return <Spinner />;

  return (
    <>
      <Shell>
        <ErrorBoundary resetKey={loc.pathname}>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/everything/:viewId?" element={<LocationPage type="everything" />} />
            <Route path="/space/:id/:viewId?" element={<LocationPage type="space" />} />
            <Route path="/folder/:id/:viewId?" element={<LocationPage type="folder" />} />
            <Route path="/list/:id/:viewId?" element={<LocationPage type="list" />} />
            <Route path="/task/:id" element={<TaskPage />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/doc/:id" element={<Docs />} />
            <Route path="/chat/:id?" element={<Chat />} />
            <Route path="/dashboards" element={<Dashboards />} />
            <Route path="/dashboard/:id" element={<Dashboards />} />
            <Route path="/whiteboards" element={<Whiteboards />} />
            <Route path="/whiteboard/:id" element={<Whiteboards />} />
            <Route path="/goals/:id?" element={<Goals />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/timesheets" element={<Timesheets />} />
            <Route path="/clips" element={<Clips />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/settings/:tab?" element={<Settings />} />
            <Route path="/new-workspace" element={<Onboarding first={false} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </Shell>
      <Toasts />
    </>
  );
}

export function useGo() {
  const nav = useNavigate();
  return nav;
}
