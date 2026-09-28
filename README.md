# CWS AI Projekt-Radar

Tägliches Steuerungs-Dashboard für alle AI-Projekte bei CWS, End-to-End vom Intake bis zum Abschluss.

**Betrieb:** lokal im Browser, keine Cloud. Siehe „Lokal starten“.

## Aufbau

Gestaltet wie das **AI Governance Portal** (AI Cockpit), damit beide Tools zusammenpassen:

- **Seitenleiste:**
  - **Mein Tag:** Heute, 1:1-Vorbereitung
  - **Projekte:** Portfolio, Roadmap
  - **Daten:** Excel / Sicherung laden, Sichern
  - Die Leiste lässt sich auf Icons einklappen. Auf dem Handy öffnet sie sich über das Menü.
- **Kopfzeile:** Pfad „AI Center of Excellence / …“, Status „Lokal“, Button „+ Projekt“ und dein Profil. Name und Rolle hinterlegst du per Klick auf den Avatar.
- **Heute:**
  - Zwei Aktionskarten: „Projekt anlegen“ und „1:1 vorbereiten“.
  - 8 Kennzahl-Karten: aktiv, kritisch, Risiko, überfällig, NOT READY, kritische Lücken, Go-Lives, abgeschlossen. Ein roter Rand zeigt Handlungsbedarf.
  - Dazu Pipeline, Tagesfokus, offene Folgeaktionen (deine eigenen mit „Du“ markiert) und die Termine der nächsten 14 Tage.
- **Portfolio:** Board nach Phase oder Tabelle mit Status- und Readiness-Pillen. Filter nach Abteilung, Sponsor, Status, Phase.
- **Roadmap:** 12 Monate, Start bis Go-Live, eingefärbt nach Status.
- **1:1:**
  - Pro Person (z. B. Henning, Lilli) die Änderungen seit dem letzten Termin, Entscheidungen, Blocker, kritische Lücken und Go-Lives.
  - „Agenda kopieren“ erzeugt Text für Teams oder Outlook.

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

1. Repository klonen oder als ZIP herunterladen.
2. **Starten über den lokalen Link (empfohlen):** Doppelklick auf `Radar-starten.cmd`. Das Radar öffnet sich unter **http://localhost:8765**.
   - In Cursor: `Strg+Shift+B` (Task „Radar starten“), oder im Terminal `.\Radar-starten.cmd`.
   - Der Mini-Server (`start.ps1`) braucht nur PowerShell. Er ist nur auf diesem Rechner erreichbar und sendet nichts ins Internet. Beenden mit `Strg+C`.
   - Innerhalb von Cursor ansehen: `Strg+Shift+P` → „Simple Browser: Show“ → `http://localhost:8765`.
3. **Alternativ ohne Server:** `app/index.html` per Doppelklick in Edge oder Chrome öffnen.
4. Projekte anlegen. Gespeichert wird automatisch im Browser dieses Rechners.

**Wichtig:** Der Browser speichert die Daten getrennt je Adresse. `http://localhost:8765` und die per Doppelklick geöffnete Datei sehen **unterschiedliche** Daten. Entscheide dich für einen Weg. Beim Wechsel einmal „Sichern“ und am neuen Weg „Laden“. Der Port 8765 ist fest eingestellt, damit die Adresse und damit die Daten gleich bleiben.

**Sichern ist Pflicht.** Die Daten liegen im Browser-Speicher. Wer den Browser-Verlauf inklusive „Website-Daten“ löscht, löscht auch das Radar.

- **Sichern** (oben rechts) lädt eine Datei `CWS-AI-Radar_Sicherung_JJJJ-MM-TT.json` herunter. Sie gehört in deinen CWS-OneDrive- oder SharePoint-Ordner, nicht in dieses Repository (`.gitignore` blockiert Sicherungen, CSV-Exporte und Excel-Dateien).
- **Laden** spielt eine Sicherung wieder ein, z. B. auf einem neuen Rechner. Vor dem Ersetzen fragt das Radar nach.
- Nach 7 Tagen ohne Sicherung erscheint ein Hinweis.
- Zum Ausprobieren `data/beispielprojekte.json` laden und später mit „Beispiele entfernen“ wieder löschen.
- Beim Laden einer Sicherung kannst du wählen: **Hinzufügen / aktualisieren** (bestehende Projekte bleiben) oder **Alles ersetzen**.

Immer dieselbe Datei im selben Browser öffnen. Ein anderer Browser oder ein privates Fenster sieht die Daten nicht.

## Technik

- `app/index.html`: komplette App in einer Datei, ohne Build-Schritt und ohne externe Abhängigkeiten.
- `start.ps1` + `Radar-starten.cmd`: lokaler Mini-Webserver auf `http://localhost:8765` (PowerShell `HttpListener`, liefert nur den Ordner `app` aus). `.vscode/tasks.json` startet ihn in Cursor per `Strg+Shift+B`.
- CI abgeglichen mit cws.com/workwear:
  - CWS-Rot `#EA0046`, Gelb `#F9E344`, Schrift Schwarz auf Weiß.
  - Original-Logo „CWS | WORKWEAR“ (als PNG eingebettet) oben in der Seitenleiste, Hauptaktionen als rote Buttons, aktive Navigation in zartem CWS-Rosa.
  - Icons: Lucide (ISC-Lizenz), inline eingebettet.
  - Browser-Tab-Icon aus dem roten Logo-Teil.
  - Alle Werte stehen als Tokens ganz oben im zweiten `<style>`-Block (`--cws-red`, `--cws-yellow`, `--cta` …).
- Schriften (SIL Open Font License), als Base64 eingebettet:
  - Inter für Text und Überschriften, wie im AI Governance Portal.
  - IBM Plex Mono für Projekt-IDs.
- Datenformat der Sicherung: `{ app, version, exportedAt, projects[], meta }`. Damit ist die spätere Übernahme in eine zentrale Lösung (SharePoint-Liste, Dataverse, Datenbank) ohne Abtippen möglich.

## Governance

Empfehlung zum Verhältnis zum AI Cockpit (AI Inventory + CR): [docs/entscheidung-ai-cockpit.md](docs/entscheidung-ai-cockpit.md)
