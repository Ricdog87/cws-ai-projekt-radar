# CWS AI Projekt-Radar

Das tägliche Steuerungs-Dashboard für alle KI-Projekte bei CWS, von der Idee bis zum Abschluss, und der Eingang für neue Use Cases aus den Fachbereichen.

**Live:** https://cws-ai-projekt-radar.vercel.app

Jede Person hat ein eigenes Dashboard (Anmeldung mit Zugangscode). Projekte und Aufgaben liegen in einer Datenbank, nicht in diesem Repository. Gespeichert wird automatisch, gesichert wird jeden Tag von selbst. Die Oberfläche ist komplett auf Deutsch, das Anfrageformular lässt sich für internationale Fachbereiche auf Englisch umschalten.

## Was drin ist

- **Projektübersicht:** alle KI-Projekte auf einer Zeitachse über die 8 Phasen bis zum Go-live, mit Fortschritt, Verzug und Prognose. „Braucht Aufmerksamkeit“ zeigt das Dringendste zuerst, mit Grund. Live-Karten: Checkliste abhaken, Phase wechseln, Status setzen, nächsten Schritt pflegen, Aufgaben anlegen, Update erfassen, ohne das Projekt zu öffnen.
- **Heute:** Kennzahlen, **Nächste Schritte** (vom Radar erkannt, ein Klick übernimmt), Pipeline, „Zuerst erledigen“, Nachhaken bei anderen, „Diese Woche“ als Wochenrückblick, die nächsten 14 Tage.
- **Team & Aufgaben:** eine Karte pro Person mit offenen Aufgaben über alle Projekte. Teammitglieder mit Zuständigkeiten („Salesforce, CRM“, „Datenschutz“), damit das Radar die richtige Person vorschlägt. Platzhalter für neue Stellen.
- **Projektanfragen:** Use Cases der Fachbereiche mit gebuchtem Bewertungstermin, Potenzial in Stunden pro Monat, Priorisierungsmatrix, mit einem Klick zum Projekt.
- **Portfolio:** Kacheln nach Phase oder Tabelle.
- **Verwaltung** (nur Admins): Zugänge, Anfrageformular, Sicherungen, Aktivitätsprotokoll.

## Weniger Verwaltung: Dokumente rein, Ergebnisse raus

**1. Dokument einlesen** (oben rechts, in der Seitenleiste oder per Drag & Drop)

- Teams-Transkript (`.vtt`, `.docx`), Teams-Zusammenfassung, Copilot-Antwort, Notizen, **PDF, PowerPoint, Word, E-Mail** (`.msg`, `.eml`), auch mehrere Dateien auf einmal.
- Das Radar erkennt das Projekt (Kürzel, Titelwörter, Teilnehmende) oder schlägt ein neues vor.
- Es findet Aufgaben mit Verantwortlichen und Termin („Ich kläre bis Freitag …“, „Kannst du bitte bis Ende der Woche …“), Erledigtes, Entscheidungen, offene Entscheidungen, Blocker, Risiken, Phasenwechsel, Go-live-Termine, Status und den nächsten Schritt.
- Alles läuft durch eine Prüfung: falsche Punkte abwählen, Text und Termine anpassen, mit einem Klick übernehmen.
- **Datenschutz:** Dokumente werden nur im Browser ausgewertet, nie hochgeladen und nie gespeichert. Ins Projekt kommt nur, was du bestätigst.
- Optional genauer mit Microsoft Copilot: Prompt kopieren, Antwort einfügen.

**2. Schnell erfassen** (`Strg+K`): eine Zeile, das Radar macht den Rest. Beispiele: `AI-003 Abnahme erledigt`, `nächster Schritt: Go-live vorbereiten bis 15.10.`, `Jonas klärt bis Freitag den API-Zugang`, `Entscheidung: …`, `Blocker: …`, `Status gelb`, `Go-live 30.11.`.

**3. Das Radar denkt mit: nächste Schritte von selbst**

Für jedes aktive Projekt prüft das Radar, was als Nächstes dran ist, in der Reihenfolge eines erfahrenen Projektleiters:

1. Überfällige Aufgaben (bei anderen: „Bei Jonas nachhaken: …“)
2. Offene Blocker
3. Go-live überschritten oder in weniger als 14 Tagen bei offenem Test
4. Kritische Lücken im Readiness-Check
5. Fehlende Zugänge und Lizenzen
6. Offene Entscheidungen
7. Der nächste offene Punkt der Phasen-Checkliste, oder der Phasenwechsel, wenn alles erledigt ist
8. AI-Inventory-Eintrag nach dem Go-live, Stillstand von mehr als 10 Tagen, fehlender Go-live-Termin

Jeder Vorschlag kommt mit Grund, verantwortlicher Person (aus den Zuständigkeiten im Team) und Termin (in Arbeitstagen). „Übernehmen“ setzt den nächsten Schritt und legt die Aufgabe an, damit sie in Team & Aufgaben und beim Nachhaken auftaucht. „Alle übernehmen“ erledigt das für alle Projekte auf einmal.

Ist ein nächster Schritt erledigt (Aufgabe abgehakt oder Checklisten-Punkt erledigt), rückt der nächste **automatisch** nach: zuerst die nächste offene Aufgabe, sonst der nächste erkannte Schritt. Er ist dann mit „automatisch erkannt“ markiert.

Dazu: Statusvorschlag aus den Fakten, Agenda für das nächste Meeting, Entscheidungslog, Teams-Texte zum Delegieren und Erinnern.

## Verwaltung (für Admins)

Alles, was früher in den Vercel-Einstellungen oder in Dateien gepflegt werden musste, liegt jetzt in der App unter **Verwaltung**:

- **Zugänge:** Person anlegen (Name, Rolle, Admin ja/nein). Der Zugangscode wird einmal angezeigt, „Einladung für Teams kopieren“ erzeugt die fertige Nachricht. „Neuer Code“ sperrt den alten sofort auf allen Geräten. „Sperren“ und „Löschen“; beim Löschen gehen Projekte und Anfragen an dich über. Mindestens ein Admin bleibt immer.
- **Anfrageformular:** Link zum Teilen, Ansprechpartner, E-Mail, Link zur Terminbuchung (z. B. Microsoft Bookings), Termindauer, wer die Anfragen bekommt, Formular offen oder zu.
- **Sicherungen:** jeden Tag automatisch der Stand vor der ersten Änderung, 30 Tage lang. Herunterladen (als Importdatei) oder mit einem Klick wiederherstellen; der aktuelle Stand wird vorher selbst gesichert. Gesamtsicherung aller Personen als eine Datei.
- **Aktivität:** wer wann was geändert hat (Projekt angelegt, Phase, Status, nächster Schritt, erledigte Aufgaben, neue Anfragen).

## Projektanfragen der Fachbereiche

1. Link zum Formular teilen (Verwaltung → Anfrageformular → „Link kopieren“), z. B. in Teams oder im Intranet.
2. Der Fachbereich beschreibt den Use Case in eigenen Worten, schätzt Fälle und Minuten pro Fall und beantwortet einfache Fragen zu Daten und Nutzung (Signal für Datenschutz, Betriebsrat und EU AI Act, keine rechtliche Einstufung).
3. **Bewertungstermin ist Pflicht:** gesendet wird erst mit gebuchtem Termin in der Zukunft.
4. „Anfrage senden“ legt die Anfrage direkt unter **Projektanfragen** ab, mit Nummer (REQ-…). Ohne Online-Speicher speichert das Formular eine Datei, die über „Importieren“ geladen wird.
5. Status: Neu → In Prüfung → Angenommen, Zurückgestellt oder Abgelehnt. „Zum Projekt machen“ legt das Projekt in Phase Aufnahme an.

Schutz gegen Spam: Pflichtfelder, verstecktes Lockfeld für Bots, höchstens 5 Anfragen pro Stunde und Absender, 40 pro Tag.

## Projektphasen

Aufnahme & Idee → **Discovery & Readiness** → Konzept & Freigabe → Umsetzung → Test & Abnahme → Go-live & Rollout → Hypercare → Abgeschlossen

Jede Phase hat eine Checkliste (Readiness-Check, Datenschutz, Betriebsrat, AI-Act-Risikoklasse, AI-Inventory-Eintrag …). Ohne eigene Termine verteilt das Radar die Phasen zwischen Start und Go-live, danach 6 Wochen Hypercare und 2 Wochen Abschluss. Liegt heute hinter dem geplanten Ende der aktuellen Phase, zeigt es Verzug und eine Go-live-Prognose.

**Readiness-Check** (29 Fragen in 9 Bereichen, Kernfragen ★, kritische Fragen): Bereit ab 80 % ohne kritische Lücke, Nicht bereit unter 50 % oder mit kritischer Lücke, dazwischen Bedingtes Go. Excel-Checklisten (deutsche oder englische Spalten) lassen sich importieren.

**Schnittstellen & Zugänge als Excel:** pro Projekt eine maßgeschneiderte Checkliste (SAP, Salesforce, SharePoint, Azure OpenAI, n8n, Power Platform …) mit API, technischem Nutzer, Lizenz, Testumgebung und Freigabe, Termin aus dem Phasenplan. Mit der IT ausfüllen und wieder einlesen.

## Backend und Daten

```
Browser (index.html, request.html)
   │  HTTPS, nur zur eigenen Domain (/api)
   ▼
Vercel Functions  api/health · login · state · admin · public
   │  api/_lib: auth.js (Konten, Codes, Sitzungen) · radar.js (Regeln, Sichtbarkeit, Sicherungen, Protokoll)
   ▼
Speicher-Schicht  api/_lib/db.js: PostgreSQL (empfohlen) · Vercel Blob · SQLite (lokal)
```

- **Eine Tabelle** `radar_kv` (Schlüssel, JSON-Wert, Version), gleich in PostgreSQL und SQLite (`db/schema.sql`). Gespeichert wird nur, wenn die Version noch stimmt. Zwei gleichzeitige Änderungen überschreiben sich nicht; die App führt die Stände zusammen.
- **Sichtbarkeit:** eigene Projekte, freigegebene Projekte („Im Radar freigeben“) und Projekte mit einer offenen Aufgabe auf den eigenen Namen. Änderungen an fremden Projekten landen beim Eigentümer, aber nur, wenn die eigene Fassung neuer ist.
- **Anmeldung:** Zugangscodes nur als scrypt-Hash gespeichert. Nach der Anmeldung hält der Browser ein signiertes Sitzungs-Token (60 Tage, verlängert sich bei Nutzung), nie den Code. Neuer Code oder Sperren beendet alle Sitzungen der Person.
- **Sparsamer Abgleich:** offene Tabs fragen alle 15 Sekunden nur, ob sich etwas geändert hat (eine kleine Abfrage), und nur, wenn der Tab sichtbar ist. Nur bei Änderungen kommt der volle Stand. Ohne Verbindung arbeitet die App im Browser weiter und übernimmt die Änderungen, sobald die Verbindung wieder steht.
- **Sicherheit:** Content Security Policy (nur Anfragen an die eigene Domain), `noindex`, kein Referrer, Mikrofon nur fürs Diktat. `.vercelignore` veröffentlicht nur `index.html`, `request.html`, `api/`, `package.json`, `vercel.json`.

### Einrichtung (einmalig)

1. **Datenbank verbinden:** Vercel → Projekt `cws-ai-projekt-radar` → **Storage** → **Create Database** → **Neon (Postgres)**, Region **Frankfurt (eu-central-1)**, Plan **Free**, mit dem Projekt verbinden. Vercel setzt `DATABASE_URL` selbst. Danach einmal **Redeploy**. Die Tabelle legt das Backend beim ersten Aufruf selbst an. Jede andere PostgreSQL-Datenbank geht auch (Supabase, später Azure Database for PostgreSQL): `DATABASE_URL` setzen, fertig.
2. **Erster Admin:** `RADAR_USERS` in den Vercel-Einstellungen (JSON-Liste `{ "id", "name", "role", "code", "admin" }`). Beim ersten Start werden die Einträge übernommen; der erste Eintrag ist Admin, wenn keiner `"admin": true` trägt. Alle weiteren Personen legst du in der App unter Verwaltung an.
3. Ohne `DATABASE_URL` nutzt das Backend Vercel Blob (`BLOB_READ_WRITE_TOKEN`). Das braucht bei täglicher Nutzung einen bezahlten Vercel-Plan, weil der Gratis-Plan nur wenige Schreibvorgänge pro Monat erlaubt.

Optional: `RADAR_SECRET` (eigener Schlüssel für Sitzungen; sonst erzeugt das Backend ihn selbst), `DATABASE_SSL_INSECURE=1` nur für Datenbanken mit eigenem Zertifikat.

**Beim ersten Login nach dem Umzug** fragt die App: „Dieser Browser hat schon Daten … In die Datenbank übernehmen“. Damit wandert dein Stand aus dem Browser in die Datenbank. Eine Kopie bleibt im Browser.

## Lokal starten

1. Repository klonen oder als ZIP laden.
2. `Start-Radar.cmd` doppelklicken oder in Cursor `Strg+Shift+B`. Das Radar öffnet sich unter **http://localhost:8765**.
3. Der lokale Server (`server/server.mjs`, Node.js ab 22.13) nutzt **dasselbe Backend** wie die Web-Version, mit einer SQLite-Datei `data/radar.sqlite` (nie im Repository). Ohne Konten ist man an diesem Computer automatisch angemeldet; Verwaltung, Tagessicherungen und Protokoll gibt es auch lokal. Ein Stand aus der alten lokalen Version wird beim ersten Start übernommen.
4. Ohne Node.js startet `start.ps1` einen einfachen Webserver; dann bleiben die Daten im Browser. `index.html` lässt sich auch direkt per Doppelklick öffnen.

Lokale Daten und die Web-Version sind getrennt. Zum Umziehen: lokal „Sichern“, online „Importieren“.

## Technik

- `index.html`: die ganze App in einer Datei, ohne Build-Schritt und ohne externe Abhängigkeiten (Schriften, Logo und Icons eingebettet).
- `request.html`: Anfrageformular, Deutsch mit Umschalter auf Englisch.
- `api/`: Backend für Vercel (Node.js), Abhängigkeiten `pg` und `@vercel/blob`.
- `server/server.mjs`, `start.ps1`, `Start-Radar.cmd`: lokaler Betrieb.
- CI wie cws.com/workwear: CWS-Rot `#EA0046`, Gelb `#F9E344`, Schrift Inter, Icons Lucide.
- Sicherungsformat `{ app, version, exportedAt, projects[], requests[], meta }`. Neue Felder sind immer optional, ältere Sicherungen lassen sich weiter laden.

## Governance

- Verhältnis zum AI Cockpit (AI Inventory + CR): [docs/ai-cockpit-decision.md](docs/ai-cockpit-decision.md)
- Teilen und länderübergreifender Rollout: [docs/rollout-decision.md](docs/rollout-decision.md)
- Namen: Teammitglieder und Projektbeteiligte dürfen mit Namen eingetragen werden. Stakeholder, Sponsoren und Fachbereiche bleiben Rollen. Keine echten CWS-Daten ins Repository.
