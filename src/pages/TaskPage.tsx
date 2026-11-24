import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useStore, pushRecent } from '../lib/store';
import { TaskModal } from '../components/task/TaskModal';
import { Empty } from '../components/ui';

export function TaskPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const task = useStore((s) => s.data.task[id!]);
  useEffect(() => { if (id) pushRecent({ type: 'task', id }); }, [id]);
  if (!task) return <Empty title="Task not found" body="It may have been deleted, or you don't have access." />;
  return <TaskModal id={id!} onClose={() => nav(task.listId ? '/list/' + task.listId : '/')} page />;
}
