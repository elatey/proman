import { useStore } from '../../lib/store';
import { Empty } from '../ui';
import { DocEditor } from '../../pages/Docs';
import { WhiteboardCanvas } from '../../pages/Whiteboards';
import { ChannelView } from '../../pages/Chat';
import { DashboardBoard } from '../../pages/Dashboards';
import type { ViewProps } from '../../pages/LocationPage';

/** Views that embed another workspace item: Doc, Whiteboard, Chat and Dashboard views. */
export default function RefView({ view }: ViewProps) {
  const data = useStore((s) => s.data);
  const id = view.config.refId || '';
  if (view.type === 'doc') return data.doc[id] ? <div className="h-full overflow-y-auto"><DocEditor doc={data.doc[id]} /></div> : <Empty title="Doc not found" />;
  if (view.type === 'whiteboard') return data.whiteboard[id] ? <WhiteboardCanvas board={data.whiteboard[id]} /> : <Empty title="Whiteboard not found" />;
  if (view.type === 'chat') return data.channel[id] ? <ChannelView channel={data.channel[id]} /> : <Empty title="Channel not found" />;
  if (view.type === 'dashboard') return data.dashboard[id] ? <div className="h-full overflow-y-auto"><DashboardBoard dash={data.dashboard[id]} /></div> : <Empty title="Dashboard not found" />;
  return <Empty title="Unsupported view" />;
}
