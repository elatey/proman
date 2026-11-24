# ProMan

A free, self-hosted project management workspace for your team, modelled on the feature set of ClickUp:
Spaces → Folders → Lists → Tasks → Subtasks → Checklists, 18 view types, Docs, Chat, Whiteboards,
Dashboards, Goals, Automations, time tracking and more. Everyone signs in and works on the same data in real time.

- **Frontend:** React + TypeScript + Vite + Tailwind (static site, hosts anywhere for free)
- **Backend:** Supabase free tier (Postgres + Auth + Realtime + File storage)
- **Demo mode:** with no Supabase configured, ProMan runs entirely in the browser (localStorage). Good for trying it out; not shared between devices.

See [docs/FEATURES.md](docs/FEATURES.md) for the full feature list and how it maps to ClickUp.

---

## 1. Run it locally

```bash
npm install
npm run dev          # http://localhost:5173
```

Sign up with any email/password. In demo mode a sample Space with projects is created for you.

## 2. Put it online for your team (free, ~10 minutes)

### Step A: Create the database (Supabase)
1. Create a free account at https://supabase.com and click **New project** (pick a region near your team, save the database password).
2. Open **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. It is safe to re-run.
3. Open **Project Settings → API Keys** and copy the **Project URL** (`https://<ref>.supabase.co`) and the **Publishable key** (`sb_publishable_…`; the legacy "anon public" key also works until Supabase retires it). Never use the secret / service_role key in the app.
   The schema grants its own table permissions, so it works whether or not "Grant API access to new tables automatically" was ticked when the project was created.
4. Open **Authentication → URL Configuration** and set **Site URL** to the address where you'll host the app (from step B, e.g. `https://YOUR-USER.github.io/proman/`). Add the same URL under **Redirect URLs**.
5. Optional: **Authentication → Providers → Email**. Leave "Confirm email" on (users get a confirmation email) or turn it off so people can sign in right away.

### Step B: Host the website (pick one)

**GitHub Pages (recommended, already configured)**
1. Push this folder to a GitHub repository (free accounts need a public repository for Pages).
2. In the repo: **Settings → Secrets and variables → Actions → Variables**, add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the values from step A3.
3. **Settings → Pages → Source: GitHub Actions**.
4. Push to `main` (or run the "Deploy to GitHub Pages" workflow). Your app goes live at `https://YOUR-USER.github.io/REPO/`.

**Netlify / Vercel / Cloudflare Pages:** import the repo, build command `npm run build`, output folder `dist`,
and add the same two environment variables. No rewrite rules are needed (the app uses `#/` URLs).

> You can also skip the env vars: open the deployed site, click the database box on the login screen and paste the URL + key.
> That's stored per browser, so env vars are better for a team.

### Step C: Invite your team
1. Sign up on your deployed site. You'll be asked to create a Workspace.
2. Go to **Settings → People**, enter teammates' emails and click **Invite**.
3. Send them the site link. When they sign up (or sign in) with that email they join the Workspace automatically.
   Roles: Owner / Admin (manage people and settings), Member, Guest.

## Free-tier notes
- Supabase free projects **pause after ~7 days with no activity**. Opening the Supabase dashboard and clicking "Restore" brings them back. Normal daily use keeps them awake.
- Free limits (generous for small teams): 500 MB database, 1 GB file storage, 50k monthly active users.
- Back up anytime: **Settings → Import / Export → Export everything (JSON)**.

## Project layout
```
supabase/schema.sql        database tables, security policies, realtime, storage
src/lib/backend/           Supabase backend + in-browser demo backend (same interface)
src/lib/store.ts           app state, optimistic updates, realtime, activity, notifications
src/lib/automations.ts     automation engine (triggers, conditions, actions, date ticker)
src/lib/filters.ts         filtering, grouping, sorting, formulas
src/components/views/      List, Board, Calendar, Gantt/Timeline, Table, Workload, Team, Activity,
                           Mind Map, Map, Gallery, Form, Embed, Doc/Whiteboard/Chat/Dashboard views
src/components/task/       task detail view, custom fields, comments & activity
src/pages/                 Home, Inbox, Planner, Docs, Chat, Dashboards, Whiteboards, Goals,
                           Automations, Timesheets, Clips, Templates, Settings, public form/share pages
```

## Security notes
- All workspace data is protected by Postgres Row Level Security: only members of a workspace can read or write it.
  Notifications and private items (private views, personal reminders) are only readable by their owner.
- Uploaded files go to a public-read Supabase bucket under unguessable paths (anyone with the exact link can open a file).
  Deleting an attachment or clip (or a task with attachments) also deletes the stored file.
- Private Spaces hide the Space from non-members in the app, but this is not enforced by the database:
  every workspace member can technically read all Spaces' data through the API. Use separate Workspaces for data that must be isolated.
- Guests currently get the same data access as members. The role only limits admin actions.
