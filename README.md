# CWS AI Projekt-Radar

Tägliches Steuerungs-Dashboard für alle AI-Projekte bei CWS, End-to-End vom Intake bis zum Abschluss.

**Betrieb:** lokal im Browser, keine Cloud. Siehe „Lokal starten“.

## Ansichten

- **Heute**: Die drei Projekte, die heute am meisten Aufmerksamkeit brauchen, mit Begründung (überfällig, kritisch, Blocker, Go-Live naht, kein Update, live ohne Inventory-Eintrag). Dazu KPIs, Pipeline je Phase und Termine der nächsten 14 Tage.
- **Portfolio**: Board nach Phase oder sortierbare Liste. Filter nach Abteilung, Sponsor, Status, Phase.
- **Roadmap**: 12 Monate, Start bis Go-Live, eingefärbt nach Status.
- **1:1**: Pro Person (z. B. Henning, Lilli) alle Änderungen seit dem letzten Termin, offene Entscheidungen, Blocker und anstehende Go-Lives. „Agenda kopieren“ erzeugt Text für Teams oder Outlook, „1:1 abschließen“ setzt den Stichtag neu.

## Projektlebenszyklus

Intake & Idee → **Discovery & Readiness** → Konzept & Freigabe → Umsetzung → Test & Abnahme → Go-Live & Rollout → Hypercare → Abgeschlossen

Jede Phase hat eine Checkliste (u. a. Readiness-Check, Datenschutz, Betriebsrat, AI-Act-Risikoklasse, Inventory-Eintrag). Der Fortschritt in Prozent ergibt sich aus Phase und erledigten Checklistenpunkten.

## Readiness-Check und Zugangsmatrix (je Projekt)

Aufgebaut nach dem Muster der Checkliste „Sales Along the Route | Nordwest“:

- **9 Prüfbereiche:** Zielbild & Scope, Ist-Prozess & Business-Regeln, Daten & Datenqualität, Architektur & Integration, Tools/Lizenzen/Zugänge, Security/Datenschutz/AI Governance, Betrieb/Support/Skalierung, KPIs/Abnahme/Entscheidung, Rollen/Termine/nächste Schritte.
- **Je Frage:** Kernfrage ★, kritisch, Typ, Priorität, Antwort / Ist-Stand, benötigte Evidenz, Owner, Status (Offen, Teilweise, Geklärt, Nicht relevant), Folgeaktion, Fälligkeit.
- **Bewertung wie in der Excel:** Readiness = (Geklärt + ½ Teilweise) / (alle − nicht relevant).
  - **READY:** ab 80 % und keine kritische Lücke offen.
  - **NOT READY:** unter 50 % oder mindestens eine kritische Lücke offen.
  - **CONDITIONAL GO:** alles dazwischen.
  - Dazu Readiness je Prüfbereich.
- **Tool- & Zugangsmatrix:** Tool/System, Zweck, Zugriff/Lizenz, vorhanden?, Phase/Abhängigkeit, Approver/Owner, nächster Schritt/Ticket.
- **Folgeaktionen mit Owner und Fälligkeit** erscheinen in „Heute“. Überfällige Aktionen, NOT READY und kritische Lücken rücken ein Projekt nach oben.
- **Kritische Lücken und Readiness** stehen in der 1:1-Vorbereitung und in der kopierten Agenda.
- **Statuswechsel** landen im Verlauf. So sieht das 1:1, was seit dem letzten Termin geklärt wurde.
- **Export:** Readiness und Zugangsmatrix als CSV, direkt in Excel zu öffnen.
- **Neue Projekte** starten mit einem Standard-Check (29 Fragen, 15 Kernfragen, 5 kritische) und einer Standard-Zugangsmatrix.

### Excel-Checkliste einlesen

- **„Laden“ oben rechts → .xlsx wählen:** Das Radar legt ein neues Projekt an, mit Titel, Teilnehmenden, Ziel/Scope, Meeting-Datum, allen Prüffragen und der Zugangsmatrix.
- **Im Projekt unter „Readiness → Excel übernehmen“:** ersetzt den Check eines bestehenden Projekts.
- **Erkannt wird das Format der Nordwest-Checkliste:**
  - Kopfzeile mit „Leitfrage“ und „Status“, weitere Spalten per Name.
  - Kritische Fragen aus der Formel „Kritische Lücken“.
  - Zugangsmatrix über die Spalten „Tool“ und „Vorhanden?“.
- Die Excel-Datei wird nur im Browser gelesen und nirgends hochgeladen.

## Lokal starten (aktueller Betrieb)

Solange echte CWS-Daten eingepflegt werden, läuft das Radar **ausschließlich lokal**. Es gibt keinen Server und keine Cloud, und die Seite stellt keine einzige Netzwerkanfrage (auch Schriften sind eingebettet).

1. Repository als ZIP herunterladen oder klonen.
2. `app/index.html` per Doppelklick in **Edge oder Chrome** öffnen. Tipp: als Lesezeichen speichern.
3. Projekte anlegen. Gespeichert wird automatisch im Browser dieses Rechners.

**Sichern ist Pflicht.** Die Daten liegen im Browser-Speicher. Wer den Browser-Verlauf inklusive „Website-Daten“ löscht, löscht auch das Radar.

- **Sichern** (oben rechts) lädt eine Datei `CWS-AI-Radar_Sicherung_JJJJ-MM-TT.json` herunter. Sie gehört in deinen CWS-OneDrive- oder SharePoint-Ordner, nicht in dieses Repository (`.gitignore` blockiert Sicherungen, CSV-Exporte und Excel-Dateien).
- **Laden** spielt eine Sicherung wieder ein, z. B. auf einem neuen Rechner. Vor dem Ersetzen fragt das Radar nach.
- Nach 7 Tagen ohne Sicherung erscheint ein Hinweis.
- Zum Ausprobieren `data/beispielprojekte.json` laden und später mit „Beispiele entfernen“ wieder löschen.
- Beim Laden einer Sicherung kannst du wählen: **Hinzufügen / aktualisieren** (bestehende Projekte bleiben) oder **Alles ersetzen**.

Immer dieselbe Datei im selben Browser öffnen. Ein anderer Browser oder ein privates Fenster sieht die Daten nicht.

## Technik

- `app/index.html`: komplette App in einer Datei, ohne Build-Schritt und ohne externe Abhängigkeiten.
- CI abgeglichen mit cws.com/workwear:
  - CWS-Rot `#EA0046`, Gelb `#F9E344`, Schrift Schwarz auf Weiß.
  - Weiße Kopfzeile mit Rot-Gelb-Markenblock, Hauptaktionen als rote Pillen-Buttons.
  - Alle Werte stehen als Tokens ganz oben im zweiten `<style>`-Block (`--cws-red`, `--cws-yellow`, `--cta` …).
- Schriften (SIL Open Font License), als Base64 eingebettet:
  - Archivo für Text und Überschriften, nah an der Website-Typo.
  - Saira für die Wortmarke.
  - IBM Plex Mono für Projekt-IDs.
- Datenformat der Sicherung: `{ app, version, exportedAt, projects[], meta }`. Damit ist die spätere Übernahme in eine zentrale Lösung (SharePoint-Liste, Dataverse, Datenbank) ohne Abtippen möglich.

## Governance

Empfehlung zum Verhältnis zum AI Cockpit (AI Inventory + CR): [docs/entscheidung-ai-cockpit.md](docs/entscheidung-ai-cockpit.md)
