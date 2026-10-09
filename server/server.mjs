// Local database for the CWS AI Project Radar.
// Serves the app and one shared register on this computer only: http://localhost:8765
// Data file: data/radar.sqlite (never committed).

import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 8765;
const HOST = "127.0.0.1";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = ROOT;
const PUBLIC = new Set(["index.html", "request.html"]); // never serve docs, data or the database file
const DB_FILE = join(ROOT, "data", "radar.sqlite");
const KEEP = 40;
const MAX_BODY = 4_000_000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

mkdirSync(dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec("pragma journal_mode = WAL");
db.exec(`
  create table if not exists radar_state (
    id text primary key,
    rev integer not null,
    updated_at text,
    document text not null
  );
  create table if not exists radar_history (
    rev integer primary key,
    saved_at text not null,
    document text not null
  );
`);

const readRow = db.prepare("select rev, updated_at, document from radar_state where id = 'live'");
const writeRow = db.prepare(`
  insert into radar_state (id, rev, updated_at, document) values ('live', ?, ?, ?)
  on conflict(id) do update set rev = excluded.rev, updated_at = excluded.updated_at, document = excluded.document
`);
const writeHistory = db.prepare("insert into radar_history (rev, saved_at, document) values (?, ?, ?)");
const trimHistory = db.prepare("delete from radar_history where rev <= ?");

function empty() {
  return { rev: 0, updatedAt: null, projects: [], requests: [], meta: { me: { name: "", role: "" } } };
}

function current() {
  const row = readRow.get();
  if (!row) return empty();
  try {
    const doc = JSON.parse(row.document);
    return {
      rev: row.rev,
      updatedAt: row.updated_at,
      projects: Array.isArray(doc.projects) ? doc.projects : [],
      requests: Array.isArray(doc.requests) ? doc.requests : [],
      meta: doc.meta && typeof doc.meta === "object" ? doc.meta : empty().meta,
    };
  } catch {
    return empty();
  }
}

function clean(body) {
  if (!body || typeof body !== "object") return null;
  if (!Array.isArray(body.projects) || !Array.isArray(body.requests)) return null;
  if (body.projects.length > 2000 || body.requests.length > 2000) return null;
  return {
    projects: body.projects.filter((p) => p && typeof p === "object" && typeof p.id === "string" && p.id.length <= 80),
    requests: body.requests.filter((r) => r && typeof r === "object" && typeof r.id === "string" && r.id.length <= 80),
    meta: body.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? body.meta : empty().meta,
  };
}

function save(next, clientRev) {
  db.exec("begin immediate");
  try {
    const now = current();
    if (!Number.isInteger(clientRev) || clientRev !== now.rev) {
      db.exec("rollback");
      return { conflict: now };
    }
    const saved = {
      rev: now.rev + 1,
      updatedAt: new Date().toISOString(),
      projects: next.projects,
      requests: next.requests,
      meta: next.meta,
    };
    const document = JSON.stringify({ projects: saved.projects, requests: saved.requests, meta: saved.meta });
    writeRow.run(saved.rev, saved.updatedAt, document);
    writeHistory.run(saved.rev, saved.updatedAt, document);
    if (saved.rev > KEEP) trimHistory.run(saved.rev - KEEP);
    db.exec("commit");
    return { saved };
  } catch (err) {
    try { db.exec("rollback"); } catch { /* already closed */ }
    throw err;
  }
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("too big"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, doc) {
  const body = JSON.stringify({
    rev: doc.rev || 0,
    updatedAt: doc.updatedAt || null,
    projects: doc.projects || [],
    requests: doc.requests || [],
    meta: doc.meta || empty().meta,
  });
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

function sendFile(res, rel) {
  const name = normalize(rel || "index.html").replace(/\.html?$/, "") + ".html"; // "/request" works like on Vercel
  const file = resolve(APP, name);
  if (!PUBLIC.has(name) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "cache-control": "no-store" });
    res.end("Not found");
    return;
  }
  const ext = extname(file).toLowerCase();
  res.writeHead(200, {
    "content-type": TYPES[ext] || "application/octet-stream",
    "cache-control": "no-store",
  });
  res.end(readFileSync(file));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${HOST}`);
    if (url.pathname === "/api/health") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({ ok: true, storage: true, auth: false }));
      return;
    }
    if (url.pathname === "/api/state") {
      if (req.method === "GET") {
        sendJson(res, 200, current());
        return;
      }
      if (req.method === "PUT") {
        const raw = await readBody(req);
        let body;
        try { body = JSON.parse(raw || "null"); } catch { body = null; }
        const next = clean(body);
        if (!next) {
          res.writeHead(400, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
          res.end(JSON.stringify({ error: "Der Stand hat nicht die erwartete Form." }));
          return;
        }
        const result = save(next, Number(body.rev));
        if (result.conflict) sendJson(res, 409, result.conflict);
        else sendJson(res, 200, result.saved);
        return;
      }
      res.writeHead(405, { allow: "GET, PUT", "cache-control": "no-store" });
      res.end();
      return;
    }
    const rel = decodeURIComponent(url.pathname.replace(/^\/+/, "")) || "index.html";
    sendFile(res, rel);
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify({ error: status === 413 ? "Der Stand ist zu groß." : "Speichern ist fehlgeschlagen." }));
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
  console.log("  Gemeinsame Datenbank auf diesem Computer. Stoppen mit Strg+C.");
  console.log("");
});
