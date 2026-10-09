# CWS AI Project Radar

Daily steering dashboard for all AI projects at CWS, end to end from intake to closure, plus the intake point for new use cases from the business units.

**Live:** https://cws-ai-projekt-radar.vercel.app

Everyone has their own dashboard (login with an access code). Tasks with `@Name` show up for the recipient under "Team & Aufgaben". Project data lives in the private Vercel Blob store, never in this repository. Locally the radar also runs via `Start-Radar.cmd`. The dashboard UI is German. See "Web link (Vercel)" and "Run locally".

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
  - One card per person with their open tasks across all projects, overdue first. Each task has an owner, a deadline, a stand (Not started, In progress, Waiting, Done) and one status note. Tasks without an owner sit on top.
  - "Copy list for Teams / e-mail" sends a person their task list. The note is the project stand; the conversation stays in Teams.
  - Overdue tasks show in the navigation and move the project up in "Needs attention".
- **Share a project:** in the project under "Overview → Share": copy the status as text for Teams or e-mail, or download a status one-pager (HTML, printable as PDF).
- **Today:** daily focus with KPIs, pipeline, "Do first", open follow-ups and the next 14 days, including task deadlines and booked assessment meetings.
- **Project requests:**
  - Use cases from business units for workflows, automation and AI agents.
  - Every request comes with a booked assessment meeting.
  - Potential in hours per month (cases × minutes), priority from potential, urgency, effort and data availability.
  - Prioritisation matrix (quick wins, strategic, fill-ins, not now).
  - Turn into a project with one click.
- **Portfolio:** board by phase or table with status and readiness pills.
- **Header:** path "Project Radar / …", status "Live" (connected) or "Lokal", "+ Project" and your profile (name, role).

## Less admin: documents in, updates out

The radar is built so you type as little as possible. Three ways to keep projects current:

**1. Read in documents** ("Dokument einlesen": top bar, sidebar, "Heute", or in a project next to "Updates & Verlauf")

- Drop a Teams transcript (`.vtt` or `.docx` from "Download transcript"), a `.txt` file, or paste text: the AI notes and follow-up tasks from the Teams meeting recap, a Copilot answer, or your own notes. Drag and drop onto the page works too.
- The radar finds the project (project code, title words, participants in the project team) or suggests a new project with title, business unit, description and goal taken from the conversation.
- It suggests, each with the quote and speaker it comes from:
  - **Tasks** with owner and due date ("Ich kläre bis Freitag …", "Kannst du bitte bis Ende der Woche …", "Jonas macht …"). Relative dates like "bis Freitag", "nächste Woche", "KW 43", "Ende Oktober" are resolved from the meeting date.
  - **Done** items that match open tasks or the next step.
  - **Decisions** and **open decisions**, **blockers and risks**, a solved blocker.
  - **Phase change** ("Abnahme ist durch" → Go-live), **new go-live date**, **status** (blocker or escalation in the meeting), **new participants** for the project team.
  - **Next step:** the most urgent new task, when the current one is done, overdue or empty.
  - **Key points** as meeting minutes in the project history.
- You check everything in one review, untick what is wrong, edit text, owner and dates, and apply with one click.
- **Privacy:** the transcript is analysed only in this browser, never uploaded and never stored. Only the points you confirm end up in the project (meeting title, date, participants, key points, tasks, decisions).
- **More accuracy, optional:** "Genauer mit Copilot" copies a prompt for Microsoft Copilot (best in the Teams meeting chat, where Copilot knows the transcript). Paste Copilot's JSON answer back and the review fills with Copilot's result. A Copilot answer can also be pasted straight into "Meeting einlesen".
- Try it: `data/Beispiel-Meeting Rechnungseingang-20261005_100000.vtt` with the sample projects loaded.

Supported, all read locally in the browser without a library:

| Format | What the radar takes from it |
|---|---|
| Teams transcript `.vtt` / `.docx` | Speakers, timestamps, who committed to what |
| Teams recap, Copilot answer, notes (paste or `.txt`) | Headings like "Folgeaufgaben", "Entscheidungen", "Risiken" with their bullets |
| PDF (exported from Word, PowerPoint, browser, reports) | Text, headings and lists; scanned image-only PDFs have no text |
| PowerPoint `.pptx` | Slide titles, bullets, tables and speaker notes; first slide gives title and date |
| Word `.docx` | Headings and list items |
| E-mail `.msg` (Outlook, drag the mail to the desktop first) / `.eml` | Subject, date, sender and recipients; quoted history and signature are cut. "Kannst du bitte …" goes to the single recipient, "Ich kümmere mich …" to the sender |

- Several files at once: they are reviewed one after another ("danach noch 2 Dateien", "Überspringen").
- Each document is listed in the project under "Entscheidungen & Meetings" with its type.
- Lines like "Entscheidung: …", "Aufgabe: …", "Risiko: …" are recognised anywhere.

**2. Quick capture** (`Strg+K` or "Schnell erfassen" in the top bar)

One line, the radar works out the rest and shows a preview before saving:

- `AI-003 Abnahme erledigt` ticks off the matching task.
- `nächster Schritt: Go-live vorbereiten bis 15.10.` sets the next step with due date.
- `Jonas klärt bis Freitag den API-Zugang` or `Aufgabe: … @Jonas` creates a task with owner and due date.
- `Entscheidung: …`, `Blocker: …`, `Risiko: …`, `Status gelb`, `Go-live 30.11.`, `Phase Test`.
- Several points separated by `;`. Text without a keyword becomes an update in the history. The project comes from the code, the title words, or the project you have open.

**3. The radar thinks along**

- **Status suggestion** from the facts (overdue next step or tasks, blocker, delay, go-live passed). Shown in the project with one click to accept; "Needs attention" flags projects whose status looks better than it is.
- **Next step moves on by itself:** when you tick off the task that is the next step, the next open task by due date takes its place. Without a next step the radar suggests one from the open tasks.
- **Agenda for the next meeting:** one click copies an agenda (status, done since the last meeting, open and overdue tasks, blockers, decisions needed, critical readiness questions) for the Teams invite.
- **Decision log** per project ("Entscheidungen & Meetings"), filled from meetings, quick capture or by hand, with all read-in meetings and their key points.

## Smart delegation

In "Team & Aufgaben" every person can carry:

- **Zuständig für:** keywords such as `Salesforce, CRM`, `Datenschutz`, `n8n, Automatisierung`. Systems from the access catalog are recognised with their synonyms.
- **Art:** AI team or contact in another department.
- **Start ab:** for new hires. "+ Platzhalter für neue Stelle" creates e.g. "AI Automation Expert (neu)" starting 1 January; overwrite the name later and all tasks follow.

The radar then suggests the right person, marked "Vorschlag", for tasks from documents and quick capture without an owner, for unassigned tasks in a project ("→ Name") and as owner of access checklist rows (e.g. Salesforce rows go to the Salesforce owner). "Delegieren" on a task copies a ready Teams message with task, due date, project and goal.

Names are typed in by you and live only in your data (your login's storage and your backups), never in the code or in the repository.

**Heute** adds two blocks:

- **Nachhaken:** tasks of other people that are overdue, due within two days or on "Wartet", grouped by person, with "Erinnerung kopieren".
- **Diese Woche:** what changed per project in the last 7 days (new, done, new tasks, decisions, documents, phase and status), with "Wochenrückblick kopieren" for your lead.

## Interfaces & access checklist (always Excel)

Every project can download "Checkliste (Excel)": on the live-status card, on the portfolio board and in the project table, under "Teilen", and in the tab "Tools & Zugriff". The file is built from that project's own profile, tasks, decisions, meetings and linked request. The download does not write anything back into the project. "Vor dem Speichern prüfen" still lets you untick rows and save them into the project first.

- **Tailored to the project:** the radar reads the project profile, tasks, decisions, read-in meetings, the linked project request and readiness answers. It recognises systems such as SAP, ERP, Salesforce/CRM, shared mailboxes (Exchange/Outlook), SharePoint, Teams bots, Azure OpenAI, Copilot Studio, Power Platform, n8n, Power BI, databases, SFTP/CSV, ticket systems, HR systems, DATEV, OCR, D&B, routing services, telephony and EDI, plus unknown systems named like "Zugriff auf Advantext" or "XY-API".
- **Per system the concrete checks:** API/interface, technical user or access, licence, test environment and approval, each with owner role and the phase it is needed in. Basics for every AI project are added (Entra ID app registration, Key Vault, test/production, IT security, data protection, AI Inventory, logging; works council when employee or applicant data is involved).
- **Due dates from the schedule:** an item is due when the phase that needs it starts (at least one week from today).
- **Download first:** "Excel herunterladen" writes the tailored workbook immediately. Untouched template rows are left out of the file. To keep the rows in the radar, use "Vor dem Speichern prüfen", untick what is not needed, add systems by hand, then "übernehmen & Excel laden".
- **The Excel file** (`<code>_Schnittstellen-Zugaenge_<date>.xlsx`): sheet "Übersicht" with project data and live counts (available, missing, unclear, overdue, ready %, by type), sheet "Checkliste" with filter, frozen header, dropdowns for "Vorhanden?" and "Art", colours by status and red for overdue, plus the source each item was detected in.
- **Round trip:** fill the list with IT, then "Bearbeitete Excel einlesen" in the project. Rows are matched by a hidden ID column; new rows are added.
- **Meetings:** systems named in a meeting show up in the meeting review under "Systeme & Zugänge" and go straight into the checklist.
- Open access items with a due date in the past show in "Needs attention" and in the meeting agenda.

## Project requests from business units

1. Share **`request.html`** with the business units (Teams, e-mail or SharePoint). It opens in any browser, no installation, no login.
2. They describe their use case in their own words: type (workflow, automation, AI agent, not sure yet), current situation, their idea for a solution, expected outcome, cases per month, minutes per case, systems, urgency, data, who it concerns, whether it only suggests or decides, and whether it touches hiring, performance, credit or monitoring. Those answers are a signal for the assessment meeting, not an EU AI Act classification. The BPM & AI team does that check, and an AI system is registered in the AI Inventory before go-live.
3. **They must book an assessment meeting** with you (30 min). The form only saves once a future date is entered and the booking is confirmed.
4. "Save request" creates `AI-Request_<business-unit>_<date>.json`, which they send to you. Alternatively "Copy as text" for Teams or e-mail.
5. You load the file in the radar via "Import request" or "Import". Duplicates are detected. The meeting shows up in the request list, in "Today" and in the next 14 days.
6. Status: New → In review → Accepted, Parked or Rejected. "Turn into project" creates a project in phase "Intake" with all details.

Calls or e-mails can be added directly in the radar with "Add request".

**Settings at the top of `request.html`:**

```js
const CONTACT_NAME = "the AI Teamlead of the BPM & AI team";
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

Locally the radar runs **on this computer only**. Nothing is sent to the internet.

1. Clone the repository or download it as ZIP.
2. **Start via the local link (recommended):** double-click `Start-Radar.cmd`. The radar opens at **http://localhost:8765**.
   - In Cursor: `Ctrl+Shift+B` (task "Start radar"), or in the terminal `.\Start-Radar.cmd`.
   - The server (`server/server.mjs`, started by `start.ps1`) keeps one shared database in `data/radar.sqlite`. Every browser on this computer sees the same projects. The file is not committed. Stop with `Ctrl+C`.
   - The local server only serves `index.html` and `request.html`; README, `docs/` and `data/` are not reachable.
   - View inside Cursor: `Ctrl+Shift+P` → "Simple Browser: Show" → `http://localhost:8765`.
3. **Without a server:** open `index.html` by double-clicking it in Edge or Chrome.
4. Add projects. With the database server they are saved in `data/radar.sqlite` and show up in every browser on this computer. Opening `index.html` as a file keeps data in that browser only.

**Important:** local data and the web link are separate. `http://localhost:8765`, the double-clicked file and the web link each see **different** data. When switching, "Sichern" once and "Importieren" on the new one. Port 8765 is fixed so the address, and with it the data, stays the same.

**Backing up is a must** in local mode: data lives in browser storage there, and clearing browsing history including "site data" also deletes the radar. On the web link the data is stored per login; a backup is still useful before big imports.

- **Back up** downloads `CWS-AI-Radar_Backup_YYYY-MM-DD.json`. Store it in your CWS OneDrive or SharePoint folder, not in this repository (`.gitignore` blocks backups, request files, CSV exports and Excel files).
- **Import** loads a backup again, e.g. on a new computer. The radar asks before replacing anything.
- After 7 days without a backup a reminder appears.
- To try it out, import `data/sample-projects.json` and remove it later with "Remove samples".
- When importing a backup you choose: **Add / update** (existing projects stay) or **Replace all**.

Data from earlier German versions of the radar imports as is; stored values stayed the same.

## Web link (Vercel, interim)

Until CWS GitHub and Azure access are in place, the radar is deployed from this repository (`Ricdog87/cws-ai-projekt-radar`, branch `main`) to Vercel (personal account). Every push to `main` goes live automatically; other branches get a preview link.

- **Only the app is published.** `.vercelignore` is an allowlist: `index.html`, `request.html`, `api/`, `package.json`, `vercel.json`. README, `docs/`, `data/`, `server/`, `db/` and the Cursor rules are not reachable via the link. A new file in the root is not published unless it is added there.
- Addresses: `/` is the radar, `/request` the request form for business units. Share the request link instead of sending the file.
- **Storage:** `api/state.js` saves each user's projects in the private Vercel Blob store (env `BLOB_READ_WRITE_TOKEN`). Every save carries a revision; if two people save at the same time the server answers `409` and the app merges both stands.
- **Login:** users come from the env `RADAR_USERS` (JSON list `{ id, name, role, code }`). The app sends `x-radar-user` and `x-radar-key`. Never commit access codes; set them only in the Vercel project settings.
- **Delegation across logins:** a project shared with a colleague ("Im Radar freigeben", `sharedWith`) or with an open task whose owner matches their login name shows up in their dashboard, and they can work on it. Their changes go back to the owner's project (`ownerId`).
- **Headers** (`vercel.json`): Content Security Policy (only same-origin requests to `/api`, no external scripts or fonts), `X-Robots-Tag: noindex`, no referrer, microphone only for dictation, API responses `no-store`.
- Documents, transcripts and Excel files are read in the browser. Only the results you confirm are saved.

## Tech

- `index.html`: the whole app in one file, no build step, no external dependencies. `Store` connects to `/api` when available ("Live") and falls back to localStorage (`cws-ai-radar-v1`, "Lokal").
- `request.html`: standalone request form for business units, creates `{ app:"cws-ai-anfrage", version, request }`.
- `api/`: Vercel functions (`health.js`, `login.js`, `state.js`, `_lib/blob.js`, `_lib/users.js`), dependency `@vercel/blob`.
- `server/server.mjs`: local server and SQLite database (`data/radar.sqlite`, structure in `db/schema.sql`). `start.ps1` + `Start-Radar.cmd` start it on `http://localhost:8765`. `.vscode/tasks.json` starts it in Cursor with `Ctrl+Shift+B`. Without Node.js, `start.ps1` falls back to a static server and the browser keeps the data itself.
- CI matched with cws.com/workwear:
  - CWS red `#EA0046`, yellow `#F9E344`, black text on white.
  - Original "CWS | WORKWEAR" logo (embedded PNG) at the top of the sidebar, main actions as red buttons, active navigation in light CWS pink.
  - Icons: Lucide (ISC licence), embedded inline.
  - Browser tab icon from the red part of the logo.
  - All values are tokens at the top of the second `<style>` block (`--cws-red`, `--cws-yellow`, `--cta` …).
- Fonts (SIL Open Font License), embedded as Base64:
  - Inter for text and headings, as in the AI Governance Portal.
  - IBM Plex Mono for project IDs.
- Backup format: `{ app, version, exportedAt, projects[], requests[], meta }`. Tasks live in `project.tasks[]` (`text`, `owner`, `due`, `status` `offen`/`arbeit`/`wartet`/`erledigt`, optional `note`). The team lives in `meta.team[]` (`name`, `role`, `country`, optional `skills`, `kind` `team`/`kontakt`, `from`). Tools/access rows in `project.tools[]` carry optional `cat`, `kind`, `iface`, `due`, `src`, `pers`. Decisions live in `project.decisions[]` (`text`, `date`, `meetingId`), read-in meetings in `project.meetings[]` (`date`, `title`, `participants`, `minutes`, `summary`, `counts`, `source`); transcripts themselves are never stored. All are optional; older backups import as is. The status note is the project stand on a task. Conversation stays in Teams. This makes a later move to a central solution (SharePoint list, Dataverse, database) possible without retyping.

## Governance

- Recommendation on how the radar relates to the AI Cockpit (AI Inventory + CR): [docs/ai-cockpit-decision.md](docs/ai-cockpit-decision.md)
- Sharing and cross-country rollout (local, M365 or standard tool): [docs/rollout-decision.md](docs/rollout-decision.md)
- Names: team members and project members may be entered by name. Stakeholders, sponsors and business units stay as roles.
