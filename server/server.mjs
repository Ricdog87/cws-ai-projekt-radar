// Lokaler Server für den CWS AI Projekt-Radar: http://localhost:8765
// Nutzt dasselbe Backend wie die Web-Version (api/), nur mit einer SQLite-Datei auf diesem Computer:
// data/radar.sqlite (wird nie committet). Nur auf diesem Computer erreichbar.
// Ohne Konten ist jeder an diesem Computer der eine lokale Nutzer. Mit RADAR_USERS gibt es auch lokal Anmeldungen.

import { createServer } from "node:http";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 8765);
const HOST = "127.0.0.1";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DB_FILE = process.env.RADAR_DB_FILE || join(ROOT, "data", "radar.sqlite");
const PAGES = new Set(["index.html", "request.html"]); // never serve docs, data or the database file

process.env.RADAR_LOCAL = "1";
const { sqliteDriver, useStore } = await import("../api/_lib/db.js");
mkdirSync(dirname(DB_FILE), { recursive: true });
const kv = await sqliteDriver(DB_FILE);
useStore(kv);
await migrateOldTable();

const api = {};
for (const name of ["health", "login", "state", "admin", "public"]) api[name] = (await import(`../api/${name}.js`)).default;

// Same security headers as on Vercel (vercel.json)
const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8"));
const pageHeaders = Object.fromEntries(((vercel.headers || []).find((h) => !h.source.startsWith("/api")) || { headers: [] }).headers.map((h) => [h.key, h.value]));

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${HOST}`);
    const m = url.pathname.match(/^\/api\/([a-z]+)$/);
    if (m) {
      if (!api[m[1]]) { res.writeHead(404, { "cache-control": "no-store" }); res.end(); return; }
      await api[m[1]](req, res);
      return;
    }
    const name = (url.pathname === "/" ? "index" : decodeURIComponent(url.pathname.slice(1)).replace(/\.html?$/, "")) + ".html"; // "/request" works like on Vercel
    const file = join(ROOT, name);
    if (!PAGES.has(name) || !existsSync(file)) { res.writeHead(404, { "cache-control": "no-store" }); res.end("Nicht gefunden"); return; }
    res.writeHead(200, { ...pageHeaders, "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(readFileSync(file));
  } catch (err) {
    console.error(err);
    if (!res.headersSent) { res.writeHead(500, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify({ error: "Speichern ist fehlgeschlagen." })); }
  }
});

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
  console.log(`  CWS AI Projekt-Radar läuft auf http://localhost:${PORT}`);
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
