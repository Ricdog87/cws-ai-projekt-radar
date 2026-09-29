# AI Project Radar across countries: how to share and roll out

**Recommendation: share now with what the radar already does, pilot a central M365 version with one or two countries, decide on the full rollout after the pilot.**

## Where we stand

The radar runs locally in one browser. That keeps it fast, free and outside every approval process, but only the person running it sees live data.

What already works without any central system:

| Need | How it works today |
|---|---|
| Delegate to the AI team | Tasks per project with owner and due date. "Team & tasks" shows who has what open and what is overdue. Overdue tasks move a project up in "Needs attention". |
| Inform a team member | "Copy list for Teams / e-mail" per person: all open tasks across projects. |
| Inform stakeholders and leads | Per project "Copy status for Teams / e-mail" or "Download status one-pager" (HTML). "Status report" on the overview: all active projects in one file, printable as PDF. |
| Hand over a project | Back up and import. Import merges by project, nothing is overwritten unasked. |

What does not work locally: several people editing the same project, team members ticking off their own tasks, country leads seeing a live cross-country view.

## Options

| | A. Stay local, share via files | B. Central on Microsoft 365 | C. Standard tool (Planner, Project for the web, Jira) |
|---|---|---|---|
| Live view for leads | No, reports on request | Yes, with permissions | Yes |
| Team ticks off own tasks | No | Yes | Yes |
| Phases, gates, readiness check | Yes | Yes, carried over | Lost or rebuilt by hand |
| Approvals needed | None | IT, data protection, works council | IT, data protection, works council |
| Effort | None | To estimate with IT | Licences plus setup |

**Option B in practice:** SharePoint lists for projects, tasks and team on one CWS site. The radar reads and writes those lists instead of the browser storage, or Power Apps on the same lists. Tasks can sync to Planner so people see them in Teams. The backup format was built for this move: existing data imports without retyping.

**Permissions in B:**

- **AI team lead:** everything.
- **Country leads:** edit projects of their country, read all.
- **Project members:** edit tasks and updates of their projects.
- **Stakeholders and sponsors:** read the status of their projects.

## What B needs before it starts

1. **IT:** SharePoint site and lists in the CWS tenant, access via Entra ID groups, decision radar app versus Power Apps.
2. **Data protection:** names of team members and task assignments become personal data in a shared system. Record of processing, retention period.
3. **Works council:** a central tool that shows who has which task overdue can count as a system suited to monitor performance (Germany: §87(1) no. 6 BetrVG; similar rules in other countries). Involve early, agree purpose limitation: project steering, no performance evaluation.
4. **Project rule change:** the radar is local-only by design. A central version is a new decision, not a quiet extension.

## Decisions for Henning and Lilli

1. Do we want a live cross-country view, or are regular status reports enough for now?
2. Which one or two countries and which leads join a pilot?
3. Who owns the central version (AI team, IT, PMO)?
4. Go-ahead to involve IT, data protection and works council for option B.

## Next steps if B is chosen

1. Pilot with the AI team and one or two countries, 8 weeks, local version plus weekly status report as fallback.
2. In parallel: IT sets up the SharePoint site, data protection and works council review.
3. Move pilot data from the backup into the lists, then open read access for stakeholders.
4. Decide on the full rollout from the pilot: use by leads, time saved on status reporting, feedback from project members.
