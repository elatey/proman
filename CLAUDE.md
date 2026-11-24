# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ProMan is a free, self-hosted project-management app with ClickUp's feature set (own branding, not ClickUp's). It is a static React SPA backed by Supabase (free tier). User-facing setup and deploy steps are in README.md. The feature map, including what's deliberately not built, is in docs/FEATURES.md. Update FEATURES.md when you add or remove a feature.

## Commands

```bash
npm install
npm run dev        # Vite dev server, http://localhost:5173
npm run build      # tsc -b (type-check) + vite build -> dist/
npm run typecheck  # tsc -b only
npm run preview    # serve dist/
```

There is no test suite and no linter. Verify changes with `npm run typecheck` and by driving the app in a browser. In dev builds the Zustand store is exposed as `window.__store` (see the end of `src/lib/store.ts`). Use it to inspect or seed state from the browser console or devtools scripts.

Supabase is optional during development. With no `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (see `.env.example`), the app runs in **demo mode**: all data lives in browser localStorage. Signing up any email creates a workspace seeded with sample data.

## Architecture

### Two interchangeable backends, one generic data model
- `src/lib/backend/types.ts` defines the `Backend` interface. `local.ts` (localStorage + BroadcastChannel) and `supabase.ts` both implement it. `backend/index.ts` picks one at startup: env vars first, then credentials saved from the login screen (`proman.sb.*` in localStorage), else local.
- **All workspace content is stored as generic "items"**: one Postgres table `items(id, workspace_id, kind, data jsonb, ...)`. `kind` is one of the `Kind` union in `src/lib/types.ts` (space, folder, list, task, comment, view, doc, automation, notification, …), and every entity field lives in `data`. Only `profiles`, `workspaces`, `members` and `invites` are real tables, because security depends on them.
- Consequence: **adding a field or entity type needs no SQL migration.** Add it to the TypeScript types and use it. Change `supabase/schema.sql` only for auth, RLS, RPCs or storage. The file is idempotent, and users re-run the whole thing in the Supabase SQL editor.
- Partial updates go through the `patch_item` RPC (`data = data || patch`), so concurrent edits to different fields of the same item merge instead of overwriting.
- RLS: members can read everything in their workspace, except `notification` items (only the recipient, `data.user`) and items with `data.private` (only the creator or `data.user`/`data.members`). Private Spaces and guest roles are enforced only in the UI.
- Uploaded files: `backend.uploadFile` returns a public URL stored on `attachment`/`clip` items; the store's `remove`/`removeMany` call `backend.deleteFile` for those kinds, so always delete attachments through the store. Storage `remove()` needs the `files_select` policy in schema.sql.
- The local backend re-reads localStorage on every operation (`fresh()`) and writes back synchronously. This prevents multiple tabs from clobbering each other; don't reintroduce an in-memory cache with debounced writes. Two tabs signed in as different users simulate multi-user realtime.

### State: `src/lib/store.ts` (Zustand)
- Items are flattened to entities (`{ id, kind, ...data, created_by, created_at, updated_at }`) and kept in `data[kind][id]`. Select narrowly, e.g. `useStore(s => s.data.task)`.
- Generic mutations: `create`, `createMany`, `update`, `remove`, `removeMany`. They are optimistic: local state updates first, then the backend call. Realtime echoes are reconciled through the `pending` map, so fast typing doesn't jump back.
- **Task mutations must go through `createTask` / `updateTask` / `deleteTask` / `duplicateTask`, not the generic `update`.** These write activity-log entries, create notifications for watchers, assignees and mentions, handle recurrence on completion, remap statuses when a task moves between Lists, and fire automations. Use `update('task', …)` only for silent writes that shouldn't trigger any of that.
- Comments go through `addComment`, which parses `data-id="<uuid>"` mention spans from TipTap HTML to notify people.
- Status inheritance: a List uses its own `statuses`, else its Folder's, else its Space's. Always resolve them with `statusesForList(listId)`. A task's `status` is a status **id** scoped to that chain. Automations and filters compare status **names**, because ids differ across Lists.
- `listsIn(location)` expands a Space, Folder or `everything` location into List ids; views, dashboards and automations scope by it.

### Automations: `src/lib/automations.ts`
Trigger → conditions → actions run **client-side** in the browser of whoever made the change (`runAutomations`, called from the store), with a depth guard against loops. Date-based triggers and reminder alerts run from a 1-minute ticker in `App.tsx` (`tickAutomations`), de-duplicated via the automation's `fired` map. The engine reaches store helpers through `registerHelpers` to avoid a circular import. Add new triggers and actions to the `TRIGGERS`/`ACTIONS` catalogs (the UI in `pages/Automations.tsx` reads them) and implement them in `matches` / `runAction`.

### Views
- `pages/LocationPage.tsx` renders any Space/Folder/List/Everything location. It shows the views bar, creates default List and Board views on first visit, and runs `ViewHost`, which filters and sorts tasks with `lib/filters.ts` (`applyFilters`, `sortTasks`, `groupTasks`) before passing `ViewProps` to the view component.
- Views are `view` items whose `config` (filters, groupBy, sortBy, columns, …) is shared with all members. `VIEW_TYPES` in LocationPage is the registry. Heavy views are `lazy()`-loaded from `src/components/views/`. Doc, Whiteboard, Chat and Dashboard views embed the page-level components through `RefView` (`config.refId`).
- Shared view building blocks are in `components/views/shared.tsx`: `Cell` (column renderer), `applyGroupChange` (what a drag between groups changes), `taskMenu`, `BulkBar`. Custom-field rendering and editing is in `components/task/FieldValue.tsx`.
- Drag and drop is native HTML5. Tasks carry `application/x-task` (droppable on views and on sidebar Lists); sidebar Lists carry `application/x-list`.

### UI conventions
- `src/components/ui.tsx` is the in-house component kit: `Popover`/`Floating` (portal-based; outside clicks are ignored for nested `[data-floating]` layers), `Menu`/`useContextMenu`, `Modal`, and the status, priority, assignee, date and tag pickers.
- Styling is Tailwind v4 plus CSS variables in `src/index.css` (`--accent`, `--bg`, `--panel`, `--border`, `--text`, `--muted`, …) for light/dark theming. Custom base styles must stay inside `@layer base` and component classes (`.btn`, `.input`, `.card`, `.menu-item`) inside `@layer components`. Unlayered CSS overrides Tailwind utilities.
- Rich text is TipTap **v2** (`components/RichEditor.tsx`) with @mentions and `/` slash commands. It only emits `onChange` after user interaction, so load-time normalisation never writes back over teammates' edits. Render stored HTML with `<Html>`, which sanitises it.
- Routing uses `HashRouter` and `vite.config.ts` sets `base: './'`, so the build works on any static host, including GitHub Pages sub-paths, with no rewrite rules. Public, no-login routes are `#/form/:id` and `#/share/:id`. They are backed by the `get_public_item` / `submit_form` RPCs, gated on `data.public`.

### Deployment
`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on push to `main`, reading repository **variables** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The anon key is meant to be public; RLS protects the data.
