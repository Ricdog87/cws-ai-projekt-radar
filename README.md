# CWS AI Projekt-Radar

Tägliches Steuerungs-Dashboard für alle AI-Projekte bei CWS, End-to-End vom Intake bis zum Abschluss.

**Betrieb:** lokal im Browser, keine Cloud. Siehe „Lokal starten“.

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

## Lokal starten (aktueller Betrieb)

Solange echte CWS-Daten eingepflegt werden, läuft das Radar **ausschließlich lokal**. Es gibt keinen Server und keine Cloud, und die Seite stellt keine einzige Netzwerkanfrage (auch Schriften sind eingebettet).

1. Repository als ZIP herunterladen oder klonen.
2. `app/index.html` per Doppelklick in **Edge oder Chrome** öffnen. Tipp: als Lesezeichen speichern.
3. Projekte anlegen. Gespeichert wird automatisch im Browser dieses Rechners.

**Sichern ist Pflicht.** Die Daten liegen im Browser-Speicher. Wer den Browser-Verlauf inklusive „Website-Daten“ löscht, löscht auch das Radar.

- **Sichern** (oben rechts) lädt eine Datei `CWS-AI-Radar_Sicherung_JJJJ-MM-TT.json` herunter. Sie gehört in deinen CWS-OneDrive- oder SharePoint-Ordner, nicht in dieses Repository (`.gitignore` blockiert solche Dateien).
- **Laden** spielt eine Sicherung wieder ein, z. B. auf einem neuen Rechner. Vor dem Ersetzen fragt das Radar nach.
- Nach 7 Tagen ohne Sicherung erscheint ein Hinweis.
- Zum Ausprobieren `data/beispielprojekte.json` laden und später mit „Beispiele entfernen“ wieder löschen.

Immer dieselbe Datei im selben Browser öffnen. Ein anderer Browser oder ein privates Fenster sieht die Daten nicht.

## Technik

- `app/index.html`: komplette App in einer Datei, ohne Build-Schritt und ohne externe Abhängigkeiten.
- CI-Farben stehen als Tokens ganz oben im zweiten `<style>`-Block (`--cws-red`, `--cws-yellow`, `--cws-black`). Exakte Werte aus dem CWS-Styleguide dort eintragen.
- Schriften: Saira, Source Sans 3, IBM Plex Mono (SIL Open Font License), als Base64 eingebettet.
- Datenformat der Sicherung: `{ app, version, exportedAt, projects[], meta }`. Damit ist die spätere Übernahme in eine zentrale Lösung (SharePoint-Liste, Dataverse, Datenbank) ohne Abtippen möglich.

## Governance

Empfehlung zum Verhältnis zum AI Cockpit (AI Inventory + CR): [docs/entscheidung-ai-cockpit.md](docs/entscheidung-ai-cockpit.md)
