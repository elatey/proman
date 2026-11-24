import { isThisWeek } from 'date-fns';
import { useStore, getState, statusOf, isClosed } from '../../lib/store';
import { Avatar, StatusIcon, ProgressBar } from '../ui';
import { cn, fmtDue, dueTone, isOverdue } from '../../lib/utils';
import type { Task } from '../../lib/types';
import type { ViewProps } from '../../pages/LocationPage';

export default function TeamView({ allTasks }: ViewProps) {
  const members = useStore((s) => s.members);
  const online = useStore((s) => s.online);
  const live = allTasks.filter((t) => !t.archived);
  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {members.map((m) => {
          const mine = live.filter((t) => t.assignees?.includes(m.user_id));
          const inProgress = mine.filter((t) => !isClosed(t) && statusOf(t)?.type === 'active');
          const todo = mine.filter((t) => !isClosed(t) && statusOf(t)?.type === 'notstarted');
          const doneWeek = mine.filter((t) => isClosed(t) && t.completedAt && isThisWeek(new Date(t.completedAt)));
          const overdue = mine.filter((t) => !isClosed(t) && isOverdue(t.dueDate));
          const pct = mine.length ? Math.round((mine.filter(isClosed).length / mine.length) * 100) : 0;
          return (
            <div key={m.user_id} className="card p-4 flex flex-col max-h-[460px]">
              <div className="flex items-center gap-3">
                <Avatar user={m.profile} size={38} />
                <div className="flex-1 min-w-0"><div className="font-semibold truncate">{m.profile.name}</div><div className="text-xs text-[var(--muted)]">{online.includes(m.user_id) ? '● Online' : m.role}</div></div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                {[['In progress', inProgress.length, '#3E63DD'], ['To do', todo.length, '#8E8C99'], ['Done (wk)', doneWeek.length, '#30A46C'], ['Overdue', overdue.length, '#E5484D']].map(([l, n, c]) => (
                  <div key={l as string} className="rounded-lg bg-[var(--subtle)] py-2"><div className="text-lg font-bold" style={{ color: c as string }}>{n as number}</div><div className="text-[10.5px] text-[var(--muted)]">{l}</div></div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-[var(--muted)]"><ProgressBar value={pct} className="flex-1" color="#30A46C" />{pct}% complete</div>
              <div className="mt-3 text-xs font-medium text-[var(--muted)]">Working on</div>
              <div className="flex-1 overflow-y-auto mt-1 -mx-1">
                {[...inProgress, ...todo].slice(0, 12).map((t) => <MiniTask key={t.id} t={t} />)}
                {!inProgress.length && !todo.length && <div className="text-xs text-[var(--faint)] px-1 py-2">Nothing assigned</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniTask({ t }: { t: Task }) {
  return (
    <button onClick={() => getState().openTask(t.id)} className="w-full flex items-center gap-2 rounded px-1 py-1 text-[13px] hover:bg-[var(--hover)] text-left">
      <StatusIcon status={statusOf(t)} size={13} /><span className="truncate flex-1">{t.name}</span>
      <span className={cn('text-[11px]', dueTone(t.dueDate))}>{fmtDue(t.dueDate)}</span>
    </button>
  );
}
