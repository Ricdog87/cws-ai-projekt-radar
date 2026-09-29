# CWS AI Project Radar

Daily steering dashboard for all AI projects at CWS, end to end from intake to closure, plus the intake point for new use cases from the business units.

**Runs locally in the browser, no cloud.** See "Run locally".

## What's inside

Designed like the **AI Governance Portal** (AI Cockpit) so both tools feel the same. Always light, even when Windows runs in dark mode.

- **Project overview (start page):**
  - All AI projects in parallel on one timeline across the 8 phases up to the go-live.
  - Current phase with progress, "Today" line, delay hatched, go-live and a forecast go-live when late.
  - A star marks what you are working on right now ("in progress"); those projects sit at the top.
  - Range: all, 12, 6 or 3 months.
  - **Needs attention:** the most urgent projects on top, with the reason (overdue, blocker, delay, no next step, no update for 10 days) and the next step.
  - **Live status cards:** tick off the checklist of the current phase, move to the next phase, set the status, edit next step and due date, and log a quick update, without opening the project. Everything saves right away and lands in the project history.
  - **Tasks on the card:** add a task with owner and due date right on the card and tick it off there.
  - **Status report:** one HTML file with all active projects (status, phase, go-live, next step, blockers, open tasks) to send by e-mail or Teams, or print as PDF.
  - Built for screen sharing: status, progress and next steps at a glance.
- **Team & tasks:**
  - Your AI team and project members with role and country.
  - One card per person with their open tasks across all projects, overdue first. Tasks without an owner sit on top.
  - "Copy list for Teams / e-mail" sends a person their task list.
  - Overdue tasks show in the navigation and move the project up in "Needs attention".
- **Share a project:** in the project under "Overview → Share": copy the status as text for Teams or e-mail, or download a status one-pager (HTML, printable as PDF).
- **Today:** daily focus with KPIs, pipeline, "Do first", open follow-ups and the next 14 days, including booked assessment meetings.
- **Project requests:**
  - Use cases from business units for workflows, automation and AI agents.
  - Every request comes with a booked assessment meeting.
  - Potential in hours per month (cases × minutes), priority from potential, urgency, effort and data availability.
  - Prioritisation matrix (quick wins, strategic, fill-ins, not now).
  - Turn into a project with one click.
- **Portfolio:** board by phase or table with status and readiness pills.
- **Header:** path "Project Radar / …", status "Local", "+ Project" and your profile (name, role).

## Project requests from business units

1. Share **`app/request.html`** with the business units (Teams, e-mail or SharePoint). It opens in any browser, no installation, no login.
2. They describe their use case in their own words: type (workflow, automation, AI agent, not sure yet), current situation, their idea for a solution, expected outcome, cases per month, minutes per case, systems, urgency, data, business unit, country / site, contact.
3. **They must book an assessment meeting** with you (30 min). The form only saves once a future date is entered and the booking is confirmed.
4. "Save request" creates `AI-Request_<business-unit>_<date>.json`, which they send to you. Alternatively "Copy as text" for Teams or e-mail.
5. You load the file in the radar via "Import request" or "Import". Duplicates are detected. The meeting shows up in the request list, in "Today" and in the next 14 days.
6. Status: New → In review → Accepted, Parked or Rejected. "Turn into project" creates a project in phase "Intake" with all details.

Calls or e-mails can be added directly in the radar with "Add request".

**Settings at the top of `app/request.html`:**

```js
const CONTACT_NAME = "the AI Center of Excellence";
const CONTACT_EMAIL = "ricardo.serrano@cws.com";
const BOOKING_URL = "";   // Microsoft Bookings or Outlook "Book time with me" link
const MEETING_MINUTES = 30;
```

With `BOOKING_URL` set, the form shows an "Open booking calendar" button. Without it, it asks the requester to send a Teams invite to `CONTACT_EMAIL`.

## Project lifecycle

Intake & idea → **Discovery & readiness** → Concept & approval → Build → Test & acceptance → Go-live & rollout → Hypercare → Closed

Each phase has a checklist (readiness check, data protection, works council, AI Act risk class, inventory entry and more). Progress in percent comes from the phase and the completed checklist items.

**Schedule:** every phase has a planned end. Without your own dates, the radar spreads the phases automatically between start and go-live, followed by 6 weeks of hypercare and 2 weeks of closure. You set your own dates in the project under "Overview → Schedule". If today is past the planned end of the current phase, the radar shows the delay and a forecast go-live.

## Readiness check and access matrix (per project)

Built on the pattern of the "Sales Along the Route | Nordwest" checklist:

- **9 areas:** target picture & scope, current process & business rules, data & data quality, architecture & integration, tools/licences/access, security/data protection/AI governance, operations/support/scaling, KPIs/acceptance/decision, roles/dates/next steps.
- **Per question:** core question ★, critical, type, priority, answer / current state, evidence needed, owner, status (Open, Partial, Resolved, Not relevant), follow-up, due date.
- **Scoring as in the Excel:** readiness = (resolved + ½ partial) / (all − not relevant).
  - **READY:** 80 % or more and no critical gap open.
  - **NOT READY:** below 50 % or at least one critical gap open.
  - **CONDITIONAL GO:** everything in between.
  - Plus readiness per area.
- **Tool & access matrix:** tool/system, purpose, access/licence, available?, phase/dependency, approver/owner, next step/ticket.
- **Follow-ups with owner and due date** appear in "Today". Overdue follow-ups, NOT READY and critical gaps move a project up.
- **Critical gaps and readiness** show in the portfolio, the overview and "Today".
- **Status changes** are logged in the project history.
- **Export:** readiness and access matrix as CSV, opens directly in Excel.
- **New projects** start with a default check (29 questions, 15 core, 5 critical) and a default access matrix.

### Import an Excel checklist

- **"Import" → choose .xlsx:** the radar creates a new project with title, participants, goal/scope, meeting date, all questions and the access matrix.
- **In the project under "Readiness → Import Excel":** replaces the check of an existing project.
- **Recognised format** (German or English headers):
  - Header row with "Leitfrage"/"Question" and "Status", other columns by name.
  - Critical questions from the "critical gaps" formula.
  - Access matrix via the columns "Tool" and "Vorhanden?"/"Available?".
- The Excel file is only read in the browser and never uploaded.

## Run locally

While real CWS data is entered, the radar runs **locally only**. No server, no cloud, and the page makes no network request at all (fonts are embedded too).

1. Clone the repository or download it as ZIP.
2. **Start via the local link (recommended):** double-click `Start-Radar.cmd`. The radar opens at **http://localhost:8765**.
   - In Cursor: `Ctrl+Shift+B` (task "Start radar"), or in the terminal `.\Start-Radar.cmd`.
   - The mini server (`start.ps1`) only needs PowerShell. It is only reachable on this computer and sends nothing to the internet. Stop with `Ctrl+C`.
   - View inside Cursor: `Ctrl+Shift+P` → "Simple Browser: Show" → `http://localhost:8765`.
3. **Without a server:** open `app/index.html` by double-clicking it in Edge or Chrome.
4. Add projects. Everything is saved automatically in this computer's browser.

**Important:** the browser keeps data separately per address. `http://localhost:8765` and the double-clicked file see **different** data. Pick one. When switching, "Back up" once and "Import" on the new one. Port 8765 is fixed so the address, and with it the data, stays the same.

**Backing up is a must.** Data lives in browser storage. Clearing browsing history including "site data" also deletes the radar.

- **Back up** downloads `CWS-AI-Radar_Backup_YYYY-MM-DD.json`. Store it in your CWS OneDrive or SharePoint folder, not in this repository (`.gitignore` blocks backups, request files, CSV exports and Excel files).
- **Import** loads a backup again, e.g. on a new computer. The radar asks before replacing anything.
- After 7 days without a backup a reminder appears.
- To try it out, import `data/sample-projects.json` and remove it later with "Remove samples".
- When importing a backup you choose: **Add / update** (existing projects stay) or **Replace all**.

Data from earlier German versions of the radar imports as is; stored values stayed the same.

## Tech

- `app/index.html`: the whole app in one file, no build step, no external dependencies.
- `app/request.html`: standalone request form for business units, creates `{ app:"cws-ai-anfrage", version, request }`.
- `start.ps1` + `Start-Radar.cmd`: local mini web server on `http://localhost:8765` (PowerShell `HttpListener`, serves only the `app` folder). `.vscode/tasks.json` starts it in Cursor with `Ctrl+Shift+B`.
- CI matched with cws.com/workwear:
  - CWS red `#EA0046`, yellow `#F9E344`, black text on white.
  - Original "CWS | WORKWEAR" logo (embedded PNG) at the top of the sidebar, main actions as red buttons, active navigation in light CWS pink.
  - Icons: Lucide (ISC licence), embedded inline.
  - Browser tab icon from the red part of the logo.
  - All values are tokens at the top of the second `<style>` block (`--cws-red`, `--cws-yellow`, `--cta` …).
- Fonts (SIL Open Font License), embedded as Base64:
  - Inter for text and headings, as in the AI Governance Portal.
  - IBM Plex Mono for project IDs.
- Backup format: `{ app, version, exportedAt, projects[], requests[], meta }`. Tasks live in `project.tasks[]` (`text`, `owner`, `due`, `status` `offen`/`erledigt`), the team in `meta.team[]` (`name`, `role`, `country`). Both are optional; older backups import as is. This makes a later move to a central solution (SharePoint list, Dataverse, database) possible without retyping.

## Governance

- Recommendation on how the radar relates to the AI Cockpit (AI Inventory + CR): [docs/ai-cockpit-decision.md](docs/ai-cockpit-decision.md)
- Sharing and cross-country rollout (local, M365 or standard tool): [docs/rollout-decision.md](docs/rollout-decision.md)
- Names: team members and project members may be entered by name. Stakeholders, sponsors and business units stay as roles.
