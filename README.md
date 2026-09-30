<div align="center">

<img src="public/icon-192.png" alt="Hunt logo" width="96" height="96" />

# Hunt

**A local-first CRM for your internship and job search.**

Log every application, cold email, LinkedIn DM and follow-up in seconds, never miss a follow-up, and see what's actually working.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-local--first-003B57?logo=sqlite&logoColor=white)
![License: PolyForm Strict](https://img.shields.io/badge/License-PolyForm%20Strict-orange.svg)

<br />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dashboard-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/dashboard-light.png" />
  <img src="docs/screenshots/dashboard-dark.png" alt="Hunt dashboard: daily goal rings, weekly stats, due follow-ups and the next 7 days of interviews and deadlines" />
</picture>

</div>

---

## Why Hunt?

A real job search is hundreds of small touchpoints across company sites, LinkedIn, email and referrals. Spreadsheets fall apart around the third follow-up. Hosted CRMs are built for sales teams and want your data in their cloud.

Hunt is built for a single person looking for work:

- **Fast to log.** One key opens a form: `A` for an application, `E` for a cold email, `L` for a LinkedIn DM. Companies and contacts are created inline as you type.
- **It remembers so you don't have to.** Every outreach gets a follow-up reminder based on your rules, and threads that go quiet are marked as ghosted automatically.
- **Honest analytics.** Reply rates, funnel conversion and time to first reply, with clear definitions, and a flag when a number is based on too little data to trust.
- **Your data stays yours.** No accounts, no cloud, no telemetry. Everything lives in one SQLite file on your machine.

## Features

| | |
| --- | --- |
| **Dashboard** | Daily goal rings, streaks with their own targets, an activity heatmap, today's follow-ups and upcoming interviews |
| **Customizable dashboard** | Drag blocks to reorder them, hide the ones you don't use, and give each its own title, width and options (which goals to show, how many rows, the look-ahead range, the heatmap period). A Pinned notes block is available too |
| **Pipeline** | Kanban board (Applied → Interview → Offer → Rejected) with drag and drop that follows the status rules and records history |
| **Applications and emails** | Dedicated pages for every role you applied to and every email you sent, with Today / This week / This month tabs, status changes right from the table, and "Log another" that keeps the company and template so you can apply to several roles in a row |
| **Companies, contacts, opportunities** | Sortable, filterable tables with saved views, detail pages, a full activity timeline, and company logos fetched from each company's website |
| **Quick log and command palette** | Keyboard-first logging, plus `Ctrl K` search across everything, including notes and job descriptions |
| **Follow-up engine** | Per-type reminder rules, follow-ups linked to the original message, snoozing, and ghosting after a configurable number of days |
| **Analytics** | Outreach volume, reply rate by channel and by template, funnel conversion, stage durations and time to first reply |
| **Weekly review** | Your week against your weekly goals, with notes on what to change next week |
| **Templates** | Reusable cold emails, DMs, connection notes and follow-ups |
| **Notes** | A page for free-form notes in markdown: headings, bullet points, checklists you can tick in the preview, code and links. Autosaves, pin to top, searchable from `Ctrl K` |
| **Documents** | Every version of your CV and your cover letters in one place, with a preview of each: PDFs in the built-in viewer, Google Drive and Docs links embedded, and cover letters you can write right in the app and copy into application forms |
| **Guardrails** | Warnings for duplicate companies and roles, a nudge if you messaged a contact in the last 7 days, the company's local time, and a LinkedIn weekly connection meter |
| **Calendar feed** | An `.ics` feed of interviews, deadlines and follow-ups to subscribe to from any calendar app |
| **Import and export** | CSV import and export for tables, full JSON backup and restore, raw database download, and automatic daily snapshots |
| **Runs where you are** | Desktop app (Electron), a PWA on your phone over your LAN, or a plain browser tab |
| **Appearance** | Light, dark or system with no flash on load, color themes (Tokyo Night, Catppuccin, Rosé Pine, Nord, Gruvbox), text size, and an optional background image with blur, dim and card opacity |
| **Update notices** | Hunt tells you when a new release is out, with the release notes and the commands to update |

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/dashboard-customize.png" alt="Dashboard in customize mode, with the settings of the Follow-ups block open" /><p align="center"><b>Customize</b>: reorder, hide and configure every block</p></td>
    <td width="50%"><img src="docs/screenshots/pipeline.png" alt="Kanban pipeline with Applied, Interview, Offer and Rejected columns and company logos" /><p align="center"><b>Pipeline</b>: drag cards between stages</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/applications.png" alt="Applications table with time filters, status, time in stage, next step, tier, source and country" /><p align="center"><b>Applications</b>: filter, sort and save views</p></td>
    <td width="50%"><img src="docs/screenshots/emails.png" alt="Emails table listing cold emails, follow-ups and replies with their outcome" /><p align="center"><b>Emails</b>: every email sent and every reply</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/follow-ups.png" alt="Follow-ups inbox listing overdue follow-ups with quick actions" /><p align="center"><b>Follow-ups</b>: everything that's due, in one inbox</p></td>
    <td width="50%"><img src="docs/screenshots/analytics.png" alt="Analytics: outreach, reply rate, activity per day and reply rate by channel, source and tier" /><p align="center"><b>Analytics</b>: see what's actually working</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/notes.png" alt="Notes page with a markdown note in split view: source on the left, preview with checklists on the right" /><p align="center"><b>Notes</b>: markdown with live preview and checklists</p></td>
    <td width="50%"><img src="docs/screenshots/documents.png" alt="Documents page previewing a PDF CV in the built-in viewer" /><p align="center"><b>Documents</b>: every CV and cover letter, with previews</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/cover-letter.png" alt="A cover letter written in Hunt, with a Copy text button" /><p align="center"><b>Cover letters</b>: write them in the app, copy into forms</p></td>
    <td width="50%"><img src="docs/screenshots/themes.png" alt="Dashboard in the Catppuccin theme over a custom background image" /><p align="center"><b>Themes</b>: color themes and a background image of your own</p></td>
  </tr>
</table>

<sub>Screenshots use the built-in sample data (<code>npm run db:seed</code>).</sub>

## Quick start

**Requirements:** Node.js 20.9 or newer (tested on Node 24).

```bash
git clone https://github.com/ahmedharabi/Hunt-CRM.git hunt
cd hunt
npm install
npm run db:migrate   # creates ./data/hunt.db (also runs automatically on server start)
npm run db:seed      # optional: ~40 companies and 3 months of sample activity
npm run dev          # http://localhost:3000
```

The sample data is tagged, so you can remove it later without touching your own entries: run `npm run db:seed -- --clear`, or use **Settings → Data**.

## Ways to run it

### Desktop app (Linux)

```bash
npm run desktop:install    # builds, then adds Hunt (with its icon) to your app launcher
```

Search for "Hunt" in your launcher and pin it to your dock. It opens in its own window and uses the same `./data/hunt.db`.

- Run `desktop:install` again after changing code, so the build is current.
- `npm run desktop` launches it from a terminal.
- `npm run desktop:uninstall` removes the launcher. Your data is not touched.
- Server logs are in `~/.config/Hunt/server.log`.

The Electron shell starts Hunt's production server on a free local port using your system Node, so the native SQLite module never needs rebuilding for Electron.

### Docker

```bash
docker compose up -d --build                     # http://localhost:3000
APP_PASSWORD=pick-something-long docker compose up -d --build   # with a login screen
```

Data is stored in the `hunt-data` volume (mounted at `/data`), so rebuilding or updating the image keeps it. Migrations run automatically on start.

### On your phone

```bash
npm run dev:lan      # or: npm run build && npm run start:lan
```

Open `http://<your-computer's-LAN-IP>:3000` on your phone (same Wi-Fi) and choose **Add to Home Screen**. The PWA manifest makes it open like a native app.

### Password protection

Hunt has no login screen by default. To require a password (recommended with `dev:lan` or `start:lan`), set it in `.env.local`:

```bash
APP_PASSWORD=pick-something-long
```

### Updates

Hunt checks GitHub for a newer release twice a day and shows **Update available** in the sidebar, with the release notes and the commands to update. Only the request to GitHub leaves your machine. Turn it off in **Settings → Updates**, or for a whole install with `HUNT_UPDATE_CHECK=0`.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `A` / `E` / `L` / `C` / `F` | Log an application, cold email, LinkedIn DM, connection request or follow-up |
| `/` or `Ctrl K` | Command palette: search everything or run an action |
| `Ctrl Enter` | Submit the open form or dialog |
| `Ctrl B` | Toggle the sidebar |

In the notes editor, `Ctrl B` / `Ctrl I` make text bold or italic, `Enter` continues a list, and `Tab` / `Shift Tab` indent or outdent a bullet.

## How it works

### Automation

- Logging an application creates the opportunity, or moves an existing one forward.
- Logging an interview moves the opportunity to Interviewing.
- A positive reply *offers* to move Applied → Screening. It never changes status silently.
- Silent threads and stalled roles are marked as ghosted after your threshold (checked when the dashboard loads).
- Every status change is written to status history, which the funnel analytics read.

### Metric definitions

- **Outreach**: outbound activities that start a thread. Follow-ups, interviews and notes don't count as new outreach.
- **Reply rate**: threads with at least one inbound reply ÷ outreach threads, grouped by the original send date.
- **Time to first reply**: first reply − original send, per thread.
- **Funnel conversion**: opportunities that ever reached stage N+1 ÷ those that ever reached stage N, from status history. Skipping a stage counts as passing it.
- **Stage duration**: time between consecutive status-history entries.
- Sample data is left out as soon as you have real activity, and metrics based on fewer than 5 data points are flagged.

### Your data

| Path | Contents |
| --- | --- |
| `./data/hunt.db` | The database (SQLite, WAL mode) |
| `./data/backups/` | A snapshot on the first request each day (the last 14 are kept) |
| `./data/uploads/` | Uploaded CVs, cover letters, background images and company logos |

`./data` is gitignored. Set `HUNT_DATA_DIR` to keep it somewhere else.

## Tech stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router, Server Components, Server Actions), React 19, TypeScript (strict)
- **Database:** SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) and [Drizzle ORM](https://orm.drizzle.team)
- **UI:** [Tailwind CSS 4](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com), [lucide](https://lucide.dev) icons, [next-themes](https://github.com/pacocoursey/next-themes)
- **Data and interaction:** [TanStack Table](https://tanstack.com/table), [dnd-kit](https://dndkit.com), [cmdk](https://cmdk.paco.me), [Recharts](https://recharts.org)
- **Forms and validation:** [react-hook-form](https://react-hook-form.com) and [Zod](https://zod.dev), with the same schemas shared by forms and server actions
- **Desktop:** [Electron](https://www.electronjs.org)
- **Testing:** [Vitest](https://vitest.dev) against in-memory SQLite

## Project structure

```
app/                 routes (App Router); (app)/ holds everything behind the sidebar
components/ui/       shadcn/ui primitives
components/layout/   sidebar, header, providers
components/shared/   app-level building blocks (badges, avatars, page shell)
components/…         forms, data-table, detail, dashboard, pipeline, analytics, notes, documents, settings
db/                  schema, client, migrations, seed, backups
electron/            desktop shell (main process)
lib/domain.ts        enums, status transitions, default goals and rules: the single source of truth
lib/dashboard-layout.ts  dashboard blocks, their options and layout repair
lib/meta.ts          labels, icons and colors per status and activity type
lib/services/        business rules, analytics, dashboard, review, backup, logos, updates (pure functions that take a db)
lib/actions/         server actions: validate with Zod, call a service, revalidate
lib/queries/         server-only reads for pages
scripts/             desktop install script
tests/               Vitest suites
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `dev:lan` | Dev server (`dev:lan` binds to `0.0.0.0`) |
| `npm run build` / `start` / `start:lan` | Production build and server |
| `npm run desktop` / `desktop:install` / `desktop:uninstall` | Run, install or remove the desktop app |
| `npm run db:generate` | Generate a migration after editing `db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Load sample data. Refuses if you already have real data; use `-- --force` to add anyway, or `-- --clear` to remove all sample rows |
| `npm run db:studio` | Drizzle Studio, a GUI for the database |
| `npm test` | Run the test suite |
| `npm run check` | Typecheck, lint, test and build |

## Contributing

Contributions are welcome: bug reports, ideas and pull requests.

1. Fork the repo and create a branch: `git checkout -b my-feature`
2. Make your change. Business rules belong in `lib/services/` (pure and testable), and status rules in `lib/domain.ts`.
3. If you change `db/schema.ts`, run `npm run db:generate` and commit the migration.
4. Make sure `npm run check` passes.
5. Open a pull request describing what changed and why.

For larger changes, please open an issue first so we can agree on the approach.

### Releasing

```bash
npm version minor    # or patch / major: bumps package.json and creates the vX.Y.Z tag
git push --follow-tags
```

CI checks that the tag matches `package.json`, runs the checks, publishes the Docker image, then creates the GitHub release with generated notes. Installed copies see it in their next update check. Edit the release on GitHub afterwards if you want to write the notes yourself.

## License

[PolyForm Strict 1.0.0](LICENSE). Hunt is free to use for any noncommercial purpose: your own job search, study, a school or a nonprofit. You may not:

- sell Hunt, or use it to make money (including offering it as a paid or hosted service),
- redistribute it, or publish a modified version or a product based on it.

Contributions are welcome: the license lets you change the code to send a pull request here. For commercial use or anything else the license doesn't cover, [get in touch](https://github.com/ahmedharabi).
