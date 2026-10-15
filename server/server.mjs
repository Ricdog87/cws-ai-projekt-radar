// Lokaler Server für den CWS KI-Projekt-Radar: http://localhost:8765
// Nutzt dasselbe Backend wie die Web-Version (api/), nur mit einer SQLite-Datei auf diesem Computer:
// data/radar.sqlite (wird nie committet). Nur auf diesem Computer erreichbar.
// Ohne Konten ist jeder an diesem Computer der eine lokale Nutzer. Mit RADAR_USERS gibt es auch lokal Anmeldungen.

import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT, createApp } from "./app.mjs";

const PORT = Number(process.env.PORT || 8765);
const HOST = "127.0.0.1";
const DB_FILE = process.env.RADAR_DB_FILE || join(ROOT, "data", "radar.sqlite");

process.env.RADAR_LOCAL = "1";
const { sqliteDriver, useStore } = await import("../api/_lib/db.js");
mkdirSync(dirname(DB_FILE), { recursive: true });
const kv = await sqliteDriver(DB_FILE);
useStore(kv);
await migrateOldTable();

const server = createServer(await createApp());

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${PORT} ist schon belegt. Der Radar läuft vermutlich bereits: http://localhost:${PORT}`);
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log(`  CWS KI-Projekt-Radar läuft auf http://localhost:${PORT}`);
  console.log("  Datenbank auf diesem Computer: data/radar.sqlite. Stoppen mit Strg+C.");
  console.log("");
});

/** Up to version 1 the local server kept one document in the table radar_state. Take it over once. */
async function migrateOldTable() {
  const db = kv.raw;
  const old = db.prepare("select name from sqlite_master where type = 'table' and name = 'radar_state'").get();
  if (!old || (await kv.get("doc:lokal"))) return;
  const row = db.prepare("select document from radar_state where id = 'live'").get();
  if (!row) return;
  try {
    const doc = JSON.parse(row.document);
    await kv.put("doc:lokal", {
      updatedAt: new Date().toISOString(),
      projects: Array.isArray(doc.projects) ? doc.projects : [],
      requests: Array.isArray(doc.requests) ? doc.requests : [],
      meta: doc.meta && typeof doc.meta === "object" ? doc.meta : { me: { name: "", role: "" }, team: [] },
    }, { version: null });
    await kv.put("rev", { at: new Date().toISOString() });
    console.log("  Bisherigen lokalen Stand übernommen.");
  } catch (e) {
    console.error("Alter Stand konnte nicht übernommen werden:", e.message);
  }
}
