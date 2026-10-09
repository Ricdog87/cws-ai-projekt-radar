-- CWS AI Projekt-Radar
-- SQLite-Datei: data/radar.sqlite (liegt nicht im Repository).
--
-- Gespeichert wird ein versioniertes Dokument: Projekte, Anfragen und Team
-- gehören zusammen, weil Checklisten, Aufgaben, Entscheidungen und Meetings
-- an genau einem Projekt hängen. radar_state ist der aktuelle Stand,
-- radar_history die letzten 40 Stände.
--
-- Die weiteren Tabellen beschreiben den Inhalt dieses Dokuments, damit die
-- Struktur lesbar ist und später nach Azure SQL übernommen werden kann.

create table if not exists radar_state (
  id          text primary key,          -- immer 'live'
  rev         integer not null,
  updated_at  text,
  document    text not null              -- { projects, requests, meta }
);

create table if not exists radar_history (
  rev         integer primary key,
  saved_at    text not null,
  document    text not null
);

-- Inhalt von document.projects[]
-- project: id, code, title, description, goal, value, sponsor, department,
--   businessOwner, lead, region, team, phase, health, priority, focus, archived,
--   startDate, targetDate, plan, nextStep, nextStepDue, blockers, openDecisions,
--   techStack, aiAct, aiInventoryId, crRefs, gates, readiness, tools, tasks,
--   updates, decisions, meetings, createdAt, updatedAt
--
-- tasks[]:     id, text, owner, due, status, note, createdAt, doneAt
-- updates[]:   id, at, text, kind
-- decisions[]: id, at, text, owner, status
-- meetings[]:  id, at, title, points
-- tools[]:     id, tool, purpose, available, phase, owner, due, kind, iface
-- readiness:   source, meetingAt, items[] (id, nr, area, q, status, owner, due, …)
--
-- Inhalt von document.requests[]
-- request: id, code, status, type, title, department, site, requester,
--   requesterEmail, problem, idea, goal, systems, volume, minutes, urgency,
--   deadline, dataAvailable, personalData, affects, decides, sensitiveUse,
--   meetingAt, projectId, createdAt, updatedAt
--
-- Inhalt von document.meta
-- meta.me:   name, role
-- meta.team: name, role, country
