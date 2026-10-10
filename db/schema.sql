-- CWS AI Projekt-Radar · Datenbankstruktur (ab Version 2)
--
-- Eine Tabelle, gleich in PostgreSQL (Web: Neon, Supabase, später Azure) und
-- SQLite (lokaler Server, data/radar.sqlite). Jede Zeile ist ein Schlüssel mit
-- einem JSON-Wert und einer Versionsnummer. Gespeichert wird nur, wenn die
-- Version noch stimmt (kein Überschreiben fremder Änderungen).
--
--   doc:<nutzer>            Projekte, Anfragen und Team einer Person
--   users                   Konten (Codes nur als scrypt-Hash), gelöschte Konten
--   secret                  Schlüssel für die Sitzungen (wird automatisch erzeugt)
--   rev                     Änderungsmarke: Version steigt mit jedem Speichern
--   audit                   Aktivitätsprotokoll (neueste zuerst, max. 400)
--   settings                Anfrageformular: Kontakt, Termin-Link, Eingang
--   snap:<datum>:<nutzer>   Tagessicherung (Stand vor der ersten Änderung des Tages, 30 Tage)
--   inbox:<datum>           Zähler der Formular-Anfragen pro Tag (Spam-Bremse)
--
-- Die Tabelle legt das Backend beim ersten Start selbst an (api/_lib/db.js).

create table if not exists radar_kv (
  key         text primary key,
  value       jsonb not null,             -- SQLite: text
  version     integer not null default 1,
  updated_at  timestamptz not null default now()
);

-- Inhalt von doc:<nutzer> → projects[]
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
