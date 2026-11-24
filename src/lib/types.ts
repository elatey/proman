// Core domain types. Every workspace entity is stored as an "item" (id, kind, data).
// In the client we flatten it to { id, kind, ...data, created_by, created_at, updated_at }.

export type Role = 'owner' | 'admin' | 'member' | 'guest';

export interface Profile {
  id: string;
  email: string;
  name: string;
  color: string;
  avatar_url?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  color: string;
  owner_id: string;
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  clickApps?: Partial<Record<ClickApp, boolean>>;
  taskPrefix?: string;
}

export type ClickApp =
  | 'timeTracking' | 'points' | 'priorities' | 'tags' | 'multipleAssignees'
  | 'dependencies' | 'customTaskIds' | 'milestones' | 'sprints' | 'automations' | 'wipLimits' | 'timeEstimates';

export interface Member {
  user_id: string;
  role: Role;
  profile: Profile;
}

export interface Invite { id: string; email: string; role: Role; created_at?: string }

export interface Base {
  id: string;
  kind: Kind;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  private?: boolean;
}

export type Kind =
  | 'space' | 'folder' | 'list' | 'task' | 'link' | 'comment' | 'activity' | 'time'
  | 'field' | 'view' | 'doc' | 'whiteboard' | 'dashboard' | 'goal' | 'goalFolder'
  | 'automation' | 'notification' | 'channel' | 'message' | 'reminder' | 'template'
  | 'tag' | 'attachment' | 'clip' | 'block';

export type StatusType = 'notstarted' | 'active' | 'done' | 'closed';
export interface Status { id: string; name: string; color: string; type: StatusType; wip?: number }

export interface LocationRef { type: 'everything' | 'space' | 'folder' | 'list'; id: string }

export interface Space extends Base {
  kind: 'space';
  name: string;
  color: string;
  icon?: string;
  statuses: Status[];
  private?: boolean;
  members?: string[];
  order: number;
  archived?: boolean;
  description?: string;
}

export interface Folder extends Base {
  kind: 'folder';
  name: string;
  spaceId: string;
  parentFolderId?: string | null;
  color?: string;
  statuses?: Status[] | null;
  order: number;
  archived?: boolean;
  sprintFolder?: boolean;
}

export interface List extends Base {
  kind: 'list';
  name: string;
  spaceId: string;
  folderId?: string | null;
  color?: string;
  statuses?: Status[] | null;
  order: number;
  archived?: boolean;
  description?: string;
  sprint?: { start: string; end: string } | null;
  personalOf?: string | null;
}

export type Priority = 1 | 2 | 3 | 4; // 1 urgent, 2 high, 3 normal, 4 low

export interface ChecklistItem { id: string; text: string; done: boolean; assignee?: string | null; children?: ChecklistItem[] }
export interface Checklist { id: string; name: string; items: ChecklistItem[] }

export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'days';
  interval: number;
  on: 'complete' | 'schedule';
  createNew?: boolean;
}

export interface Task extends Base {
  kind: 'task';
  name: string;
  listId: string;
  extraLists?: string[];
  parentId?: string | null;
  description?: string;
  status: string; // status id
  priority?: Priority | null;
  assignees: string[];
  watchers: string[];
  tags: string[];
  startDate?: string | null;
  dueDate?: string | null;
  dueTime?: boolean;
  estimate?: number | null; // minutes
  points?: number | null;
  fields?: Record<string, any>;
  checklists?: Checklist[];
  order: number;
  archived?: boolean;
  completedAt?: string | null;
  recurrence?: Recurrence | null;
  type?: 'task' | 'milestone' | 'bug' | 'feature' | 'request';
  cover?: string | null;
  public?: boolean;
  fromForm?: string;
}

export interface Link extends Base { kind: 'link'; from: string; to: string; type: 'blocks' | 'relates' }

export interface Reaction { [emoji: string]: string[] }

export interface Comment extends Base {
  kind: 'comment';
  taskId?: string | null;
  docId?: string | null;
  body: string;
  author: string;
  assignee?: string | null;
  resolved?: boolean;
  parentId?: string | null;
  reactions?: Reaction;
}

export interface Activity extends Base {
  kind: 'activity';
  taskId: string;
  user: string;
  text: string;
  field?: string;
}

export interface TimeEntry extends Base {
  kind: 'time';
  taskId: string;
  user: string;
  start: string;
  end?: string | null;
  duration?: number; // seconds
  note?: string;
  billable?: boolean;
}

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'money' | 'dropdown' | 'labels' | 'checkbox' | 'date'
  | 'email' | 'phone' | 'url' | 'rating' | 'progress' | 'progressAuto' | 'people' | 'files'
  | 'formula' | 'location' | 'relationship' | 'voting' | 'signature' | 'button';

export interface FieldOption { id: string; label: string; color: string }

export interface FieldDef extends Base {
  kind: 'field';
  name: string;
  type: FieldType;
  scope: LocationRef; // 'everything' = workspace-wide
  options?: FieldOption[];
  currency?: string;
  max?: number;
  emoji?: string;
  formula?: string;
  required?: boolean;
  automationId?: string;
}

export type ViewType =
  | 'list' | 'board' | 'calendar' | 'gantt' | 'timeline' | 'table' | 'workload' | 'team'
  | 'activity' | 'mindmap' | 'map' | 'gallery' | 'form' | 'embed' | 'doc' | 'whiteboard'
  | 'chat' | 'dashboard';

export interface FilterRule { id: string; field: string; op: string; value?: any }

export interface ViewConfig {
  groupBy?: string;
  subGroupBy?: string;
  sortBy?: { field: string; dir: 'asc' | 'desc' }[];
  filters?: FilterRule[];
  filterMatch?: 'all' | 'any';
  columns?: string[];
  showSubtasks?: 'collapsed' | 'expanded' | 'separate';
  showClosed?: boolean;
  meMode?: boolean;
  assigneeFilter?: string[];
  search?: string;
  // type-specific
  url?: string;
  refId?: string; // doc / whiteboard / channel / dashboard id
  calendarMode?: 'month' | 'week' | 'day';
  ganttScale?: 'day' | 'week' | 'month';
  form?: FormConfig;
  mindmap?: { mode: 'tasks' | 'blank'; nodes?: MindNode[] };
  collapsed?: string[];
  colWidths?: Record<string, number>;
}

export interface MindNode { id: string; text: string; parent: string | null; color?: string }

export interface FormField { id: string; key: string; label: string; required?: boolean; help?: string; type?: FieldType; options?: FieldOption[]; max?: number }
export interface FormConfig { title: string; description?: string; fields: FormField[]; submitText?: string; defaultAssignee?: string; defaultStatus?: string }

export interface View extends Base {
  kind: 'view';
  name: string;
  type: ViewType;
  location: LocationRef;
  config: ViewConfig;
  order: number;
  pinned?: boolean;
  private?: boolean;
  public?: boolean;
  isDefault?: boolean;
  protected?: boolean;
}

export interface Doc extends Base {
  kind: 'doc';
  title: string;
  content: string;
  parentId?: string | null;
  location?: LocationRef | null;
  icon?: string;
  public?: boolean;
  archived?: boolean;
  order?: number;
  wiki?: boolean;
  lastEditedBy?: string;
}

export type WbElementType = 'sticky' | 'rect' | 'ellipse' | 'diamond' | 'text' | 'pen' | 'arrow' | 'task' | 'image';
export interface WbElement {
  id: string;
  type: WbElementType;
  x: number; y: number; w: number; h: number;
  color?: string;
  text?: string;
  points?: number[]; // pen
  from?: string | null; to?: string | null; // arrows between elements
  x2?: number; y2?: number;
  taskId?: string;
  src?: string;
  fontSize?: number;
}

export interface Whiteboard extends Base { kind: 'whiteboard'; name: string; location?: LocationRef | null; elements: WbElement[] }

export type WidgetType =
  | 'statusPie' | 'assigneeBar' | 'priorityBar' | 'completedLine' | 'burndown' | 'count'
  | 'taskList' | 'timeTracked' | 'workload' | 'goals' | 'text' | 'embed' | 'overdue' | 'calc';

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  w: number; // grid columns 1..12
  h: number; // rows
  config: { location?: LocationRef; filters?: FilterRule[]; text?: string; url?: string; field?: string; op?: 'sum' | 'avg' | 'count' };
}

export interface Dashboard extends Base { kind: 'dashboard'; name: string; widgets: Widget[]; location?: LocationRef | null }

export interface GoalTarget {
  id: string;
  name: string;
  type: 'number' | 'currency' | 'boolean' | 'tasks';
  start: number;
  target: number;
  current: number;
  unit?: string;
  taskIds?: string[];
  listId?: string;
}

export interface Goal extends Base {
  kind: 'goal';
  name: string;
  color: string;
  dueDate?: string | null;
  owners: string[];
  description?: string;
  folderId?: string | null;
  targets: GoalTarget[];
}
export interface GoalFolder extends Base { kind: 'goalFolder'; name: string }

export interface AutomationTrigger { type: string; from?: any; to?: any; field?: string; value?: any; days?: number; when?: 'before' | 'after' }
export interface AutomationCondition { field: string; op: 'is' | 'isnot' | 'set' | 'notset'; value?: any }
export interface AutomationAction { type: string; value?: any; text?: string; days?: number; field?: string; listId?: string; url?: string }

export interface Automation extends Base {
  kind: 'automation';
  name: string;
  location: LocationRef;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  fired?: Record<string, string>; // dedupe keys for date-based triggers
  runs?: number;
}

export interface Notification extends Base {
  kind: 'notification';
  user: string; // recipient
  actor?: string | null;
  type: 'assigned' | 'mention' | 'comment' | 'status' | 'reminder' | 'dm' | 'chat' | 'due' | 'info' | 'assignedComment';
  text: string;
  taskId?: string | null;
  docId?: string | null;
  channelId?: string | null;
  read?: boolean;
  cleared?: boolean;
  later?: boolean;
  primary?: boolean;
}

export interface Channel extends Base {
  kind: 'channel';
  name: string;
  description?: string;
  dm?: boolean;
  members?: string[];
  private?: boolean;
  location?: LocationRef | null;
}

export interface Message extends Base {
  kind: 'message';
  channelId: string;
  author: string;
  body: string;
  parentId?: string | null;
  reactions?: Reaction;
  edited?: boolean;
  taskId?: string | null;
}

export interface Reminder extends Base {
  kind: 'reminder';
  user: string;
  text: string;
  due?: string | null;
  done?: boolean;
  taskId?: string | null;
  assignedBy?: string | null;
  notified?: boolean;
}

export interface Template extends Base {
  kind: 'template';
  name: string;
  type: 'task' | 'list' | 'folder' | 'space' | 'doc';
  description?: string;
  payload: any;
}

export interface Tag extends Base { kind: 'tag'; name: string; color: string; spaceId?: string | null }

export interface Attachment extends Base {
  kind: 'attachment';
  taskId?: string | null;
  name: string;
  url: string;
  size: number;
  mime: string;
  user: string;
}

export interface Clip extends Base { kind: 'clip'; name: string; url: string; duration: number; user: string; taskId?: string | null }

export interface Block extends Base { kind: 'block'; user: string; taskId?: string | null; title?: string; start: string; end: string }

export type Entity =
  | Space | Folder | List | Task | Link | Comment | Activity | TimeEntry | FieldDef | View | Doc
  | Whiteboard | Dashboard | Goal | GoalFolder | Automation | Notification | Channel | Message
  | Reminder | Template | Tag | Attachment | Clip | Block;

export type EntityOf<K extends Kind> = Extract<Entity, { kind: K }>;

export interface RawItem {
  id: string;
  workspace_id: string;
  kind: Kind;
  data: any;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}
