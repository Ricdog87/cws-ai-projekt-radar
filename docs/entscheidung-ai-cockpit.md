# AI Projekt-Radar und AI Cockpit: zusammenlegen oder getrennt lassen?

**Empfehlung: zwei Tools, ein Datenfluss.** Nicht in eine Oberfläche zusammenlegen, aber über feste IDs und eine klare Übergabe am Go-Live verzahnen.

## Warum nicht zusammenlegen

| | AI Projekt-Radar | AI Cockpit (AI Inventory + CR) |
|---|---|---|
| Zweck | Steuerung: Was muss ich heute tun, wo stehen wir? | Governance: Welche KI-Systeme laufen bei CWS, mit welchem Risiko, welche Änderungen? |
| Lebensdauer eines Eintrags | Wochen bis Monate, endet mit Projektabschluss | Jahre, solange das System im Betrieb ist |
| Wer pflegt | Projektleitung (du), Einblick für Sponsoren und Führung | Fachbereiche melden, IT, Datenschutz, Compliance prüfen |
| Wer liest | Sponsor, Führung, Fachbereiche | Datenschutz, IT-Security, Betriebsrat, Audit |
| Pflicht | intern | EU AI Act (Betreiberpflichten, KI-Kompetenz, Hochrisiko-Doku), DSGVO-Nachweise |

1. **Das Inventar muss audit-sauber bleiben.** Ideen im Intake, abgebrochene Piloten und halbfertige Konzepte gehören nicht in ein Nachweisverzeichnis. Wenn beides in einem Tool liegt, fragt jeder Prüfer: „Was davon ist live?“
2. **Unterschiedliche Rechte.** CRs trägt der Fachbereich ein. Den Projektstatus pflegst du. In einem Tool brauchst du ein Rechtemodell, das keiner pflegen will.
3. **Unterschiedlicher Rhythmus.** Das Radar ändert sich täglich, das Inventar quartalsweise. Ein gemeinsames Tool wird entweder zu träge für die Steuerung oder zu laut für die Governance.

## Wie die beiden zusammenspielen

```
Idee / Anfrage ──► Radar: Intake → Analyse → Konzept → Umsetzung → Test → Go-Live → Hypercare → Abschluss
                                       │                               │
                         AI-Act-Einstufung vorbereiten      Gate „Eintrag im AI Inventory angelegt“
                                                                       │
                                                                       ▼
                                                    AI Cockpit: Inventory-Eintrag (AI-ID)
                                                                       │
                                        nach Go-Live: Änderungen = Change Request im Cockpit
                                                                       │
                                  kleiner CR ──► direkt im Betrieb umsetzen
                                  großer CR  ──► neues Projekt im Radar, CR-Nummer verknüpft
```

**Spielregeln**

- **Eine Wahrheit je Objekt.** Stammdaten des KI-Systems (Risikoklasse, Datenkategorien, Owner) liegen im Cockpit. Projektdaten (Phase, Termine, nächster Schritt, Blocker) liegen im Radar.
- **Verknüpfung über IDs.** Das Radar hat die Felder *AI-Inventory-ID* und *Change Requests*. Das Cockpit bekommt ein Feld *Projekt-ID* (AI-001 …).
- **Go-Live-Gate.** Kein Go-Live ohne Inventory-Eintrag. Das Radar zeigt „Live ohne AI-Inventory-ID“ im Tagesfokus an, bis die ID eingetragen ist.
- **CR-Schwelle.** Faustregel: mehr als 5 Personentage oder neue Datenquelle oder Änderung der Risikoklasse → eigenes Projekt im Radar. Alles darunter bleibt reiner CR im Cockpit.

## Wann doch zusammenlegen

Nur wenn alle drei Punkte zutreffen:

- Das Cockpit pflegst ausschließlich du, kein Fachbereich trägt selbst CRs ein.
- Niemand außer dir und den Sponsoren schaut hinein (kein Datenschutz, kein Betriebsrat, kein Audit).
- Es gibt weniger als ca. 10 KI-Systeme im Betrieb.

Dann reicht ein Tool mit drei Ansichten (Projekte, Inventar, CRs). Sobald ein Punkt kippt, trennen.

## Nächste Schritte

1. Im Cockpit das Feld *Projekt-ID* ergänzen und die laufenden Systeme mit AI-001 ff. verknüpfen.
2. CR-Schwelle mit der Führung festlegen.
3. Phase 2: CR-Status aus dem Cockpit automatisch im Radar anzeigen. Voraussetzung: klären, wo das Cockpit technisch liegt (SharePoint-Liste, Excel, eigenes Tool), dann die Anbindung bauen.
