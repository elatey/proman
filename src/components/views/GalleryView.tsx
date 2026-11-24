import { useMemo } from 'react';
import { useStore, getState, statusOf, isClosed } from '../../lib/store';
import { groupTasks } from '../../lib/filters';
import { StatusPill, AvatarStack, PriorityFlag, TagChip, useContextMenu } from '../ui';
import { taskMenu, TaskBadges } from './shared';
import { cn, fmtDue, dueTone, alpha, stripHtml } from '../../lib/utils';
import type { ViewProps } from '../../pages/LocationPage';

export default function GalleryView({ view, tasks, listIds }: ViewProps) {
  const atts = useStore((s) => s.data.attachment);
  const ctx = useContextMenu();
  const visible = view.config.showSubtasks === 'separate' ? tasks : tasks.filter((t) => !t.parentId);
  const groups = view.config.groupBy && view.config.groupBy !== 'none' ? groupTasks(visible, view.config.groupBy, listIds, false) : [{ key: 'all', label: '', color: '', tasks: visible }];
  const cover = (id: string, c?: string | null) => c || Object.values(atts).find((a) => a.taskId === id && a.mime.startsWith('image/'))?.url;
  return (
    <div className="h-full overflow-y-auto p-4">
      {groups.map((g) => (
        <div key={g.key} className="mb-6">
          {g.label && <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: g.color }}>{g.label} · {g.tasks.length}</div>}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {g.tasks.map((t) => {
              const img = cover(t.id, t.cover);
              const st = statusOf(t);
              return (
                <div key={t.id} onClick={() => getState().openTask(t.id)} onContextMenu={(e) => ctx.open(e, taskMenu(t))} className="card overflow-hidden cursor-pointer hover:shadow-md transition">
                  {img ? <img src={img} alt="" className="h-40 w-full object-cover" /> : (
                    <div className="h-40 p-4 text-[12px] text-[var(--muted)] overflow-hidden" style={{ background: alpha(st?.color || '#888', 0.1) }}>{stripHtml(t.description).slice(0, 220) || <span className="text-3xl opacity-40">{t.name[0]}</span>}</div>
                  )}
                  <div className="p-3">
                    <div className={cn('font-medium text-[14px] leading-snug', isClosed(t) && 'line-through text-[var(--muted)]')}>{t.name}</div>
                    <div className="flex flex-wrap gap-1 mt-1.5"><StatusPill status={st} small />{t.tags?.map((x) => <TagChip key={x} name={x} small />)}</div>
                    <div className="flex items-center gap-2 mt-2.5">
                      <AvatarStack ids={t.assignees || []} size={20} />
                      <span className={cn('text-xs', dueTone(t.dueDate, isClosed(t)))}>{fmtDue(t.dueDate)}</span>
                      <PriorityFlag p={t.priority} size={12} />
                      <span className="flex-1" />
                      <TaskBadges t={t} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {ctx.node}
    </div>
  );
}
