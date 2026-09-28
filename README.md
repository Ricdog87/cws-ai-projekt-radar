# CWS AI Projekt-Radar

Tägliches Steuerungs-Dashboard für alle AI-Projekte bei CWS, End-to-End vom Intake bis zum Abschluss.

**Live-Version:** https://claude.ai/artifact/YA61BnCwx87j3kvV95XyMo (privat, Freigabe über das Teilen-Menü)

## Ansichten

- **Heute**: Die drei Projekte, die heute am meisten Aufmerksamkeit brauchen, mit Begründung (überfällig, kritisch, Blocker, Go-Live naht, kein Update, live ohne Inventory-Eintrag). Dazu KPIs, Pipeline je Phase und Termine der nächsten 14 Tage.
- **Portfolio**: Board nach Phase oder sortierbare Liste. Filter nach Abteilung, Sponsor, Status, Phase.
- **Roadmap**: 12 Monate, Start bis Go-Live, eingefärbt nach Status.
- **1:1**: Pro Person (z. B. Henning, Lilli) alle Änderungen seit dem letzten Termin, offene Entscheidungen, Blocker und anstehende Go-Lives. „Agenda kopieren“ erzeugt Text für Teams oder Outlook, „1:1 abschließen“ setzt den Stichtag neu.

## Projektlebenszyklus

Intake & Idee → Analyse & Business Case → Konzept & Freigabe → Umsetzung → Test & Abnahme → Go-Live & Rollout → Hypercare → Abgeschlossen

Jede Phase hat eine Checkliste (u. a. Datenschutz, Betriebsrat, AI-Act-Risikoklasse, Inventory-Eintrag). Der Fortschritt in Prozent ergibt sich aus Phase und erledigten Checklistenpunkten.

## Projektsteckbrief

ID, Titel, Beschreibung, Ziel & Nutzen, Business Value, Abteilung, Sponsor, fachlicher Ansprechpartner, Projektleitung, 1:1-Partner, Priorität, Start, Go-Live, Tech-Stack, nächster Schritt mit Fälligkeit, Blocker, offene Entscheidungen, EU-AI-Act-Risikoklasse, AI-Inventory-ID, Change Requests, Update-Verlauf.

## Technik

- `app/index.html`: komplette App, eine Datei, ohne Build-Schritt.
- Als Claude-Artifact läuft sie mit geteilter Datenbank (alle mit Zugriff sehen denselben Stand live). Außerhalb davon speichert sie im Browser (localStorage).
- CI-Farben stehen als Tokens ganz oben im `<style>`-Block (`--cws-red`, `--cws-yellow`, `--cws-black`). Exakte Werte aus dem CWS-Styleguide dort eintragen.
- `data/beispielprojekte.json`: die Beispielprojekte, mit denen das Radar startet.

## Governance

Empfehlung zum Verhältnis zum AI Cockpit (AI Inventory + CR): [docs/entscheidung-ai-cockpit.md](docs/entscheidung-ai-cockpit.md)
