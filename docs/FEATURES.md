# ProMan feature map (vs. ClickUp 4.0)

How this was researched: ClickUp's Help Center articles (views, the views control bar, Custom Field types,
Automation triggers and actions, Intro to ClickUp 4.0, Spaces Sidebar), its "Ultimate guide to ClickUp terms",
product screenshots in those articles (task view, My Tasks, Inbox, Planner, Spaces sidebar), and the ClickUp
YouTube channel. ClickUp's channel has ~1,600 videos; they were sampled, not all watched. The Help Center
documents the same features with screenshots and was the main source.

Legend: ✅ built · 🟡 partial / simplified · ❌ not built

## Hierarchy & navigation
| ClickUp | ProMan |
|---|---|
| Workspace → Space → Folder → (Subfolder) → List → Task → Subtask (nested) → Checklist (nested) | ✅ all levels, multiple workspaces |
| Sidebar: Home, Inbox, Favorites, Spaces tree, Everything | ✅ plus Planner, Chat, Docs, Dashboards, Whiteboards, Goals, Timesheets, Automations, Clips, Templates |
| Right-click menus, drag Lists between Folders/Spaces, drag tasks onto a List | ✅ |
| Private Spaces with selected members | 🟡 hidden in the app; not enforced in the database |
| Archive / restore Spaces, Folders, Lists, tasks, docs | ✅ |
| Global search & command bar (Ctrl/⌘K) | ✅ tasks, lists, folders, spaces, docs, chat, dashboards, people, comments, commands |
| Keyboard shortcuts | ✅ T, R, D, H, I, /, ?, Ctrl+K, Ctrl+\ |
| Task tray (minimise tasks) | ✅ |
| Dark mode, theme colours | ✅ light / dark / system + accent colours |

## Tasks
| ClickUp | ProMan |
|---|---|
| Custom statuses per Space/Folder/List with groups (Not started, Active, Done, Closed), WIP limits | ✅ |
| Assignees (multiple), followers, priorities (Urgent/High/Normal/Low), tags | ✅ |
| Start & due dates, due times, recurring tasks (reopen or create new) | ✅ |
| Time estimates, sprint points, time tracking (timer + manual, billable, notes) | ✅ |
| Task types (Task, Milestone, Bug, Feature, Request) | ✅ |
| Dependencies (waiting on / blocking), linked tasks, dependency warnings in Gantt | ✅ |
| Rich description with slash commands, @mentions, tables, checklists, images | ✅ |
| Subtasks (nested), checklists (nested items, assignees, convert to subtasks) | ✅ |
| Attachments (drag & drop), cover images | ✅ |
| Comments: threaded replies, reactions, @mentions, assigned comments, resolve | ✅ |
| Activity log | ✅ |
| Duplicate, move, convert to subtask/task, save as template, copy link/ID | ✅ |
| Public share link (read-only) | ✅ |
| Bulk actions (status, assignees, dates, priority, tags, move, duplicate, archive, delete) | ✅ |
| Tasks in multiple Lists | 🟡 supported in the data model and filters; no UI to add a task to a second List |
| Scheduled comments / emails from tasks | ❌ |

## Custom Fields
ClickUp's Help Center lists 22 types. All are built: Text, Text area, Number, Money (currency), Dropdown, Labels,
Checkbox, Date, People, Email, Phone, Website, Rating (custom emoji), Progress (manual), Progress (auto), Formula,
Location (geocoded, used by Map view), Files, Relationship, Voting, Signature, Button (runs an Automation).
Fields can be added at Workspace, Space, Folder or List level. Required fields and filtering/grouping/sorting by field
also work. ❌ Rollup and AI fields are not built.

## Views (18 of ClickUp's view types)
| View | Status |
|---|---|
| List (grouping, subtasks collapsed/expanded/separate, columns, inline add, drag & drop, bulk select) | ✅ |
| Board / Kanban (drag between columns, WIP limits, collapsible columns, covers) | ✅ |
| Calendar (month/week/day, drag to reschedule, unscheduled sidebar) | ✅ |
| Gantt (drag/resize bars, dependency arrows by dragging, milestones, day/week/month zoom, reschedule dependents) | ✅ |
| Timeline (people-first lanes) | ✅ |
| Table (spreadsheet, resizable columns, totals, inline edit) | ✅ |
| Workload (capacity by task count or hours, drag to reassign/reschedule) | ✅ |
| Team | ✅ |
| Activity | ✅ |
| Mind Map (Tasks mode + Blank mode, convert ideas to tasks) | ✅ |
| Map (Location field, OpenStreetMap) | ✅ |
| Gallery | ✅ |
| Form (builder, public link, embed code, submissions become tasks) | ✅ ❌ conditional logic |
| Embed (websites, YouTube, Figma, Google Docs/Sheets, Loom) | ✅ |
| Doc, Whiteboard, Chat, Dashboard as views | ✅ |
| View controls: search, filter builder (AND/OR), group, sort, Me mode, assignee filter, show closed, columns | ✅ |
| Pin, default, private, protected, duplicate views; CSV export/import | ✅ |
| Artifact view, Page view | ❌ |

## Collaboration & productivity
| ClickUp | ProMan |
|---|---|
| Home / My Tasks (Recents, Agenda, My Work: To Do/Done/Delegated, Assigned to me, Reminders, Assigned comments, LineUp) | ✅ |
| Inbox (Primary / Other / Later / Cleared, mark read, clear, save for later) | ✅ |
| Notifications for assignment, mentions, comments, status changes, DMs, threads, reminders | ✅ in-app (+ desktop for reminders) ❌ email notifications |
| Reminders (personal + delegated, due-time alerts) | ✅ |
| Planner (time-block tasks on a week calendar) | ✅ ❌ Google/Outlook calendar sync |
| Docs (nested pages, wikis, slash commands, comments, public sharing, Markdown/HTML/PDF export, page history) | ✅ 🟡 page history is per device; no live multi-cursor co-editing (edits sync, last write wins) |
| Chat (channels, private channels, DMs, threads, reactions, mentions, create task from message, unread counts) | ✅ ❌ SyncUps (calls), scheduled messages |
| Whiteboards (sticky notes, shapes, text, pen, connectors, images, task cards, convert to task, pan/zoom, undo) | ✅ |
| Dashboards (14 widget types: status pie, assignee/priority bars, completed line, burndown, count, overdue, calculation, task list, time tracked, workload, goals, text, embed) | ✅ |
| Goals (folders, owners, targets: number / currency / true-false / task completion) | ✅ |
| Timesheets (weekly grid, billable, CSV export) | ✅ |
| Clips (screen + mic recording, attach to tasks) | ✅ |
| Templates (Space templates, saved task & List templates) | ✅ 🟡 5 built-in Space templates (ClickUp has 1,000+) |
| Sprints (sprint Lists with dates, sprint points, burndown widget) | 🟡 no automatic spillover |

## Automations
21 triggers: task created, status changed (from/to), assignee added/removed, priority changed, due/start date changed,
due/start date arrives, date before/after, tag added/removed, comment added, custom field changed, name changed,
moved to List, checklists resolved, subtasks resolved, time tracked, task unblocked, Button field clicked.
Conditions: status, priority, assignee, tag, task type, is subtask (is / is not / set / not set).
23 actions: change status/priority, add/remove assignee, assign creator, add follower, add/remove tag, set due/start
date, add comment, create subtask/task, move to List, duplicate, archive, delete, apply template, set custom field,
estimate time, rename, send channel message, call webhook. Automations run in the browser of whoever made the change.
Date triggers run from any open client. ❌ Integration triggers (GitHub, Slack, email) are not built.

## People, security & admin
| ClickUp | ProMan |
|---|---|
| Sign up / sign in, password reset | ✅ (Supabase Auth) |
| Invite by email, roles (Owner, Admin, Member, Guest), remove members | ✅ 🟡 guests aren't limited to shared items |
| ClickApps (turn features on/off per Workspace) | ✅ priorities, tags, multiple assignees, time tracking, estimates, points, dependencies, automations |
| Real-time collaboration and presence (online dots) | ✅ |
| Import / export | ✅ CSV tasks import, CSV view export, full JSON backup/restore |
| Granular per-item permissions (view/comment/edit/full) | ❌ |
| SSO, audit logs, 2FA | ❌ (2FA can be enabled in Supabase Auth) |

## Not built
- **AI** (ClickUp Brain, Super Agents, AI fields, AI notetaker, AI cards). These need a paid AI API, so they don't fit the free-hosting goal.
- **Third-party integrations** (Slack, GitHub, Google Drive/Calendar, Zoom) and the public API/webhooks inbound.
- **Native mobile/desktop apps.** The web app works in mobile browsers but isn't optimised for small screens.
- Email-in to tasks/channels, SyncUps video calls, org chart, Rollup fields, form conditional logic, sprint spillover.
