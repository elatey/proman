import { useState } from 'react';
import { Filter, Layers, ArrowUpDown, Columns3, Search, User, Eye, EyeOff, Plus, X, Download, Upload, ChevronDown, CornerDownRight, Check, CheckCircle2 } from 'lucide-react';
import { useStore, getState, statusesForList } from '../../lib/store';
import { Popover, AvatarStack, Avatar, Toggle, MenuList } from '../ui';
import { BUILTIN_FILTER_FIELDS, DATE_OPS, GROUP_OPTIONS, fieldsForLists, statusesForLocation } from '../../lib/filters';
import { cn, uid, PRIORITIES, toCSV, downloadFile, parseCSV } from '../../lib/utils';
import type { FilterRule, View, ViewConfig, Task } from '../../lib/types';
import { fieldText } from '../task/FieldValue';
import { memberName, statusOf } from '../../lib/store';

export const BUILTIN_COLUMNS = [
  { key: 'assignee', label: 'Assignee' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'startDate', label: 'Start date' },
  { key: 'tags', label: 'Tags' },
  { key: 'estimate', label: 'Time estimate' },
  { key: 'tracked', label: 'Time tracked' },
  { key: 'points', label: 'Sprint points' },
  { key: 'list', label: 'List' },
  { key: 'created', label: 'Date created' },
  { key: 'updated', label: 'Date updated' },
  { key: 'createdBy', label: 'Created by' },
  { key: 'id', label: 'Task ID' },
  { key: 'comments', label: 'Comments' },
  { key: 'progress', label: 'Progress' },
];
export const DEFAULT_COLUMNS = ['assignee', 'dueDate', 'priority'];

const SORTS = [
  { value: 'manual', label: 'Manual' },
  { value: 'name', label: 'Task name' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'startDate', label: 'Start date' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'created', label: 'Date created' },
  { value: 'updated', label: 'Date updated' },
  { value: 'estimate', label: 'Time estimate' },
  { value: 'points', label: 'Sprint points' },
];

const tb = (on?: boolean) => cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] whitespace-nowrap', on ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent font-medium' : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]');

export function ViewToolbar({ view, listIds, tasks, features }: { view: View; listIds: string[]; tasks: Task[]; features: { group?: boolean; subtasks?: boolean; columns?: boolean; sort?: boolean } }) {
  const cfg = view.config || {};
  const set = (p: Partial<ViewConfig>) => getState().update('view', view.id, { config: { ...cfg, ...p } });
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.user!.id);
  const fields = fieldsForLists(listIds);
  const groupLabel = GROUP_OPTIONS.find((g) => g.value === (cfg.groupBy || 'status'))?.label || fields.find((f) => f.id === cfg.groupBy)?.name || 'Status';
  const sort = cfg.sortBy?.[0];
  const nFilters = (cfg.filters || []).length;

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b bg-[var(--panel)] overflow-x-auto">
      <div className="relative">
        <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
        <input className="w-40 focus:w-56 transition-all rounded-md bg-transparent hover:bg-[var(--hover)] focus:bg-[var(--subtle)] pl-7 pr-2 py-1 text-[13px] outline-none" placeholder="Search tasks…" value={cfg.search || ''} onChange={(e) => set({ search: e.target.value })} />
      </div>
      <div className="flex-1" />
      {features.group && (
        <Popover align="end" trigger={<button className={tb(cfg.groupBy !== undefined && cfg.groupBy !== 'status')}><Layers size={14} /> Group: {groupLabel}</button>}>
          {(close) => <MenuList close={close} items={[
            ...GROUP_OPTIONS.map((g) => ({ label: g.label, icon: (cfg.groupBy || 'status') === g.value ? <Check size={13} /> : undefined, onClick: () => set({ groupBy: g.value }) })),
            ...(fields.filter((f) => ['dropdown', 'labels', 'checkbox'].includes(f.type)).length ? [{ divider: true, label: '' }] : []),
            ...fields.filter((f) => ['dropdown', 'labels', 'checkbox'].includes(f.type)).map((f) => ({ label: f.name, icon: cfg.groupBy === f.id ? <Check size={13} /> : undefined, onClick: () => set({ groupBy: f.id }) })),
          ]} />}
        </Popover>
      )}
      {features.subtasks && (
        <Popover align="end" trigger={<button className={tb(cfg.showSubtasks === 'separate' || cfg.showSubtasks === 'expanded')}><CornerDownRight size={14} /> Subtasks</button>}>
          {(close) => <MenuList close={close} items={[
            { label: 'Collapse all', icon: (cfg.showSubtasks || 'collapsed') === 'collapsed' ? <Check size={13} /> : undefined, onClick: () => set({ showSubtasks: 'collapsed' }) },
            { label: 'Expand all', icon: cfg.showSubtasks === 'expanded' ? <Check size={13} /> : undefined, onClick: () => set({ showSubtasks: 'expanded' }) },
            { label: 'As separate tasks', icon: cfg.showSubtasks === 'separate' ? <Check size={13} /> : undefined, onClick: () => set({ showSubtasks: 'separate' }) },
          ]} />}
        </Popover>
      )}
      {features.sort && (
        <Popover align="end" width={260} trigger={<button className={tb(!!sort)}><ArrowUpDown size={14} /> {sort ? `Sort: ${SORTS.find((s) => s.value === sort.field)?.label || fields.find((f) => f.id === sort.field)?.name}` : 'Sort'}</button>}>
          <div className="p-3 space-y-2">
            <select className="input !py-1" value={sort?.field || 'manual'} onChange={(e) => set({ sortBy: e.target.value === 'manual' ? [] : [{ field: e.target.value, dir: sort?.dir || 'asc' }] })}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              {fields.filter((f) => !['files', 'button'].includes(f.type)).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {sort && <div className="flex gap-1">{(['asc', 'desc'] as const).map((d) => <button key={d} className={cn('btn flex-1 justify-center !py-1', sort.dir === d ? 'btn-primary' : 'btn-outline')} onClick={() => set({ sortBy: [{ field: sort.field, dir: d }] })}>{d === 'asc' ? 'Ascending' : 'Descending'}</button>)}</div>}
          </div>
        </Popover>
      )}
      <FilterButton cfg={cfg} set={set} listIds={listIds} count={nFilters} />
      <button className={tb(cfg.meMode)} onClick={() => set({ meMode: !cfg.meMode })} title="Show only tasks assigned to me"><User size={14} /> Me mode</button>
      <Popover align="end" trigger={<button className={tb(!!cfg.assigneeFilter?.length)}>{cfg.assigneeFilter?.length ? <AvatarStack ids={cfg.assigneeFilter.filter((x) => x !== '__none')} size={18} /> : <><Avatar id={me} size={18} /></>} Assignee</button>}>
        <div className="p-1 w-60">
          {members.map((m) => {
            const on = cfg.assigneeFilter?.includes(m.user_id);
            return <button key={m.user_id} className="menu-item" onClick={() => set({ assigneeFilter: on ? cfg.assigneeFilter!.filter((x) => x !== m.user_id) : [...(cfg.assigneeFilter || []), m.user_id] })}><Avatar user={m.profile} size={20} /><span className="flex-1">{m.profile.name}</span>{on && <Check size={13} />}</button>;
          })}
          <button className="menu-item" onClick={() => { const on = cfg.assigneeFilter?.includes('__none'); set({ assigneeFilter: on ? cfg.assigneeFilter!.filter((x) => x !== '__none') : [...(cfg.assigneeFilter || []), '__none'] }); }}><span className="w-5" /><span className="flex-1">Unassigned</span>{cfg.assigneeFilter?.includes('__none') && <Check size={13} />}</button>
          {!!cfg.assigneeFilter?.length && <button className="menu-item text-[var(--muted)]" onClick={() => set({ assigneeFilter: [] })}><X size={13} /> Clear</button>}
        </div>
      </Popover>
      <button className={tb(cfg.showClosed)} onClick={() => set({ showClosed: !cfg.showClosed })} title="Show closed tasks">{cfg.showClosed ? <Eye size={14} /> : <EyeOff size={14} />} Closed</button>
      {features.columns && <ColumnsButton cfg={cfg} set={set} listIds={listIds} />}
      <Popover align="end" trigger={<button className={tb()}>•••</button>}>
        {(close) => <MenuList close={close} items={[
          { label: 'Export CSV', icon: <Download size={14} />, onClick: () => exportCSV(view.name, tasks, listIds) },
          ...(listIds.length === 1 ? [{ label: 'Import CSV', icon: <Upload size={14} />, onClick: () => importCSV(listIds[0]) }] : []),
          { label: 'Reset view settings', icon: <X size={14} />, onClick: () => getState().update('view', view.id, { config: { groupBy: 'status', showSubtasks: 'collapsed' } }) },
        ]} />}
      </Popover>
    </div>
  );
}

function FilterButton({ cfg, set, listIds, count }: { cfg: ViewConfig; set: (p: Partial<ViewConfig>) => void; listIds: string[]; count: number }) {
  const rules = cfg.filters || [];
  const fields = fieldsForLists(listIds);
  const updRule = (id: string, p: Partial<FilterRule>) => set({ filters: rules.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  return (
    <Popover align="end" width={560} trigger={<button className={tb(count > 0)}><Filter size={14} /> Filter{count ? ` (${count})` : ''}</button>}>
      <div className="p-3">
        <div className="flex items-center mb-2">
          <span className="font-semibold text-sm flex-1">Filters</span>
          {rules.length > 1 && (
            <select className="input !w-auto !py-0.5 !text-xs" value={cfg.filterMatch || 'all'} onChange={(e) => set({ filterMatch: e.target.value as any })}>
              <option value="all">Match all (AND)</option><option value="any">Match any (OR)</option>
            </select>
          )}
        </div>
        <div className="space-y-1.5">
          {rules.map((r) => <RuleRow key={r.id} r={r} upd={(p) => updRule(r.id, p)} remove={() => set({ filters: rules.filter((x) => x.id !== r.id) })} listIds={listIds} />)}
          {!rules.length && <div className="text-xs text-[var(--muted)] py-2">No filters applied.</div>}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Popover trigger={<button className="btn btn-outline !py-1 !text-xs"><Plus size={13} /> Add filter</button>}>
            {(close) => <MenuList close={close} items={[
              ...BUILTIN_FILTER_FIELDS.map((f) => ({ label: f.label, onClick: () => set({ filters: [...rules, { id: uid(), field: f.field, op: f.kind === 'date' ? 'overdue' : f.kind === 'text' ? 'contains' : f.kind === 'bool' ? 'is' : 'is', value: f.kind === 'bool' ? true : undefined }] }) })),
              ...(fields.length ? [{ divider: true, label: '' }] : []),
              ...fields.map((f) => ({ label: f.name, onClick: () => set({ filters: [...rules, { id: uid(), field: f.id, op: ['text', 'textarea', 'email', 'url', 'phone'].includes(f.type) ? 'contains' : 'is' }] }) })),
            ]} />}
          </Popover>
          <div className="flex-1" />
          {rules.length > 0 && <button className="text-xs text-[var(--muted)] hover:text-[var(--text)]" onClick={() => set({ filters: [] })}>Clear all</button>}
        </div>
      </div>
    </Popover>
  );
}

function RuleRow({ r, upd, remove, listIds }: { r: FilterRule; upd: (p: Partial<FilterRule>) => void; remove: () => void; listIds: string[] }) {
  const s = getState();
  const builtin = BUILTIN_FILTER_FIELDS.find((f) => f.field === r.field);
  const cf = s.data.field[r.field];
  const label = builtin?.label || cf?.name || r.field;
  const kind = builtin?.kind || (cf ? (['dropdown', 'labels'].includes(cf.type) ? 'option' : cf.type === 'people' ? 'member' : cf.type === 'date' ? 'date' : cf.type === 'checkbox' ? 'bool' : ['number', 'money', 'rating', 'progress'].includes(cf.type) ? 'number' : 'text') : 'text');
  const multi = (opts: { value: any; label: string; color?: string }[]) => {
    const vals: any[] = Array.isArray(r.value) ? r.value : r.value != null && r.value !== '' ? [r.value] : [];
    return (
      <Popover triggerClassName="flex-1 min-w-0" width={240} trigger={<button className="input !py-1 !text-xs text-left truncate">{vals.length ? vals.map((v) => opts.find((o) => o.value === v)?.label || v).join(', ') : 'Select…'}</button>}>
        <div className="p-1 max-h-64 overflow-auto">
          {opts.map((o) => <button key={String(o.value)} className="menu-item" onClick={() => upd({ value: vals.includes(o.value) ? vals.filter((x) => x !== o.value) : [...vals, o.value] })}>{o.color && <span className="w-2.5 h-2.5 rounded-full" style={{ background: o.color }} />}<span className="flex-1">{o.label}</span>{vals.includes(o.value) && <Check size={13} />}</button>)}
        </div>
      </Popover>
    );
  };
  let ops: { op: string; label: string }[] = [{ op: 'is', label: 'is' }, { op: 'isnot', label: 'is not' }, { op: 'set', label: 'is set' }, { op: 'notset', label: 'is not set' }];
  if (kind === 'date') ops = DATE_OPS;
  if (kind === 'text') ops = [{ op: 'contains', label: 'contains' }, { op: 'notcontains', label: "doesn't contain" }, { op: 'set', label: 'is set' }, { op: 'notset', label: 'is not set' }];
  if (kind === 'number') ops = [{ op: 'is', label: '=' }, { op: 'gt', label: '>' }, { op: 'lt', label: '<' }, { op: 'set', label: 'is set' }, { op: 'notset', label: 'is not set' }];
  if (kind === 'bool') ops = [{ op: 'is', label: 'is' }];
  let valueEl: React.ReactNode = null;
  if (!['set', 'notset', 'today', 'overdue', 'thisweek', 'next7'].includes(r.op)) {
    if (kind === 'status') valueEl = multi(statusesForLocation(listIds).map((x) => ({ value: x.name, label: x.name, color: x.color })));
    else if (kind === 'member') valueEl = multi([{ value: '__me', label: 'Me' }, ...s.members.map((m) => ({ value: m.user_id, label: m.profile.name, color: m.profile.color }))]);
    else if (kind === 'priority') valueEl = multi([...PRIORITIES.map((p) => ({ value: p.value, label: p.label, color: p.color })), { value: 0, label: 'No priority' }]);
    else if (kind === 'tag') valueEl = multi(Object.values(s.data.tag).map((t) => ({ value: t.name, label: t.name, color: t.color })));
    else if (kind === 'list') valueEl = multi(Object.values(s.data.list).map((l) => ({ value: l.id, label: l.name })));
    else if (kind === 'type') valueEl = multi(['task', 'milestone', 'bug', 'feature', 'request'].map((t) => ({ value: t, label: t })));
    else if (kind === 'option') valueEl = multi((cf?.options || []).map((o) => ({ value: o.id, label: o.label, color: o.color })));
    else if (kind === 'date') valueEl = <input type="date" className="input !py-1 !text-xs flex-1" value={r.value || ''} onChange={(e) => upd({ value: e.target.value })} />;
    else if (kind === 'bool') valueEl = <select className="input !py-1 !text-xs flex-1" value={String(r.value ?? true)} onChange={(e) => upd({ value: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select>;
    else valueEl = <input className="input !py-1 !text-xs flex-1" type={kind === 'number' ? 'number' : 'text'} value={r.value ?? ''} onChange={(e) => upd({ value: e.target.value })} placeholder="Value" />;
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-28 shrink-0 text-xs font-medium truncate">{label}</span>
      <select className="input !w-32 !py-1 !text-xs shrink-0" value={r.op} onChange={(e) => upd({ op: e.target.value })}>{ops.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}</select>
      <div className="flex-1 min-w-0 flex">{valueEl}</div>
      <button className="icon-btn !w-6 !h-6" onClick={remove}><X size={13} /></button>
    </div>
  );
}

function ColumnsButton({ cfg, set, listIds }: { cfg: ViewConfig; set: (p: Partial<ViewConfig>) => void; listIds: string[] }) {
  const cols = cfg.columns || DEFAULT_COLUMNS;
  const fields = fieldsForLists(listIds);
  const toggle = (k: string) => set({ columns: cols.includes(k) ? cols.filter((c) => c !== k) : [...cols, k] });
  return (
    <Popover align="end" width={260} trigger={<button className={tb()}><Columns3 size={14} /> Columns</button>}>
      <div className="p-2 max-h-[60vh] overflow-auto">
        <div className="label px-1 py-1">Fields</div>
        {BUILTIN_COLUMNS.map((c) => <div key={c.key} className="px-1 py-1"><Toggle on={cols.includes(c.key)} onChange={() => toggle(c.key)} label={c.label} /></div>)}
        {fields.length > 0 && <div className="label px-1 py-1 mt-1 border-t pt-2">Custom Fields</div>}
        {fields.map((f) => <div key={f.id} className="px-1 py-1"><Toggle on={cols.includes(f.id)} onChange={() => toggle(f.id)} label={f.name} /></div>)}
      </div>
    </Popover>
  );
}

export function exportCSV(name: string, tasks: Task[], listIds: string[]) {
  const s = getState();
  const fields = fieldsForLists(listIds);
  const rows = [
    ['Task ID', 'Name', 'Status', 'Priority', 'Assignees', 'Start date', 'Due date', 'Tags', 'List', 'Parent', 'Estimate (min)', 'Points', 'Created', ...fields.map((f) => f.name)],
    ...tasks.map((t) => [
      t.id, t.name, statusOf(t)?.name, PRIORITIES.find((p) => p.value === t.priority)?.label || '', (t.assignees || []).map(memberName).join('; '),
      t.startDate?.slice(0, 10) || '', t.dueDate?.slice(0, 10) || '', (t.tags || []).join('; '), s.data.list[t.listId]?.name, t.parentId ? s.data.task[t.parentId]?.name : '',
      t.estimate || '', t.points || '', t.created_at?.slice(0, 10) || '', ...fields.map((f) => fieldText(f, t)),
    ]),
  ];
  downloadFile(`${name.replace(/\W+/g, '_')}.csv`, toCSV(rows), 'text/csv');
}

export function importCSV(listId: string) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,text/csv';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const rows = parseCSV(await file.text());
    if (rows.length < 2) return;
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
    const iName = col('name', 'task name', 'title', 'task'), iStatus = col('status'), iPri = col('priority'), iDue = col('due date', 'due'), iStart = col('start date', 'start'), iTags = col('tags'), iDesc = col('description', 'notes');
    const s = getState();
    const statuses = statusesForList(listId);
    let n = 0;
    for (const r of rows.slice(1)) {
      const name = r[iName >= 0 ? iName : 0]?.trim();
      if (!name) continue;
      const st = iStatus >= 0 ? statuses.find((x) => x.name.toLowerCase() === r[iStatus]?.trim().toLowerCase()) : undefined;
      const pr = iPri >= 0 ? PRIORITIES.find((p) => p.label.toLowerCase() === r[iPri]?.trim().toLowerCase())?.value : undefined;
      const d = (i: number) => (i >= 0 && r[i] && !isNaN(Date.parse(r[i])) ? new Date(r[i]).toISOString() : null);
      s.createTask({ name, listId, status: st?.id, priority: pr || null, dueDate: d(iDue), startDate: d(iStart), tags: iTags >= 0 ? r[iTags].split(/[;,]/).map((x) => x.trim().toLowerCase()).filter(Boolean) : [], description: iDesc >= 0 && r[iDesc] ? `<p>${r[iDesc]}</p>` : '' }, { silent: true });
      n++;
    }
    s.toast(`Imported ${n} tasks`, 'success');
  };
  input.click();
}
