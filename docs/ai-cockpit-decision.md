# AI Project Radar and AI Cockpit: merge or keep separate?

**Recommendation: two tools, one data flow.** Do not merge them into one interface, but link them through fixed IDs and a clear handover at go-live.

## Why not merge

| | AI Project Radar | AI Cockpit (AI Inventory + CR) |
|---|---|---|
| Purpose | Steering: what do I need to do today, where do we stand? | Governance: which AI systems run at CWS, at what risk, with which changes? |
| Lifetime of an entry | Weeks to months, ends with project closure | Years, as long as the system is in operation |
| Maintained by | Project lead, visibility for sponsors and management | Business units report, IT, data protection and compliance review |
| Read by | Sponsors, management, business units | Data protection, IT security, works council, audit |
| Obligation | Internal | EU AI Act (deployer duties, AI literacy, high-risk documentation), GDPR records |

1. **The inventory must stay audit-proof.** Ideas in intake, cancelled pilots and half-finished concepts do not belong in a register of record. If both live in one tool, every auditor asks: "Which of these is live?"
2. **Different permissions.** Business units enter CRs. The project lead maintains project status. One tool needs a permission model nobody wants to maintain.
3. **Different rhythm.** The radar changes daily, the inventory quarterly. A shared tool becomes either too slow for steering or too noisy for governance.

## How the two work together

```
Idea / request ──► Radar: Intake → Discovery → Concept → Build → Test → Go-live → Hypercare → Closed
                                       │                               │
                         prepare AI Act classification      Gate "Entry created in AI Inventory"
                                                                       │
                                                                       ▼
                                                    AI Cockpit: inventory entry (AI ID)
                                                                       │
                                        after go-live: changes = change request in the Cockpit
                                                                       │
                                  small CR ──► implement directly in operations
                                  large CR ──► new project in the radar, CR number linked
```

**Ground rules**

- **One source of truth per object.** Master data of the AI system (risk class, data categories, owner) lives in the Cockpit. Project data (phase, dates, next step, blockers) lives in the radar.
- **Linked through IDs.** The radar has the fields *AI Inventory ID* and *Change requests*. The Cockpit gets a field *Project ID* (AI-001 …).
- **Go-live gate.** No go-live without an inventory entry. The radar shows "Live without AI Inventory ID" in the daily focus until the ID is entered.
- **CR threshold.** Rule of thumb: more than 5 person-days, or a new data source, or a change of risk class → own project in the radar. Everything below stays a plain CR in the Cockpit.

## When merging does make sense

Only if all three apply:

- Only the project lead maintains the Cockpit; no business unit enters CRs themselves.
- Nobody besides the project lead and the sponsors looks at it (no data protection, no works council, no audit).
- Fewer than about 10 AI systems are in operation.

Then one tool with three views (projects, inventory, CRs) is enough. As soon as one point no longer holds, separate them.

## Next steps

1. Add the field *Project ID* in the Cockpit and link the running systems to AI-001 onwards.
2. Agree the CR threshold with management.
3. Phase 2: show CR status from the Cockpit automatically in the radar. Prerequisite: clarify where the Cockpit lives technically (SharePoint list, Excel, own tool), then build the connection.
