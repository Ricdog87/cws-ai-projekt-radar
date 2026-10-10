// Small helpers shared by all endpoints: JSON in and out, German error messages, rate limits.
import { store } from "./db.js";

export const VERSION = "2.0";

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

/** Request body as an object (Vercel may have parsed it already). */
export async function readJson(req, max = 4_000_000) {
  let body;
  try {
    body = req.body;
  } catch {
    throw fail(400, "Die Daten sind kein gültiges JSON.");
  }
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) return body;
  let raw = typeof body === "string" ? body : Buffer.isBuffer(body) ? body.toString("utf8") : null;
  if (raw === null) {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > max) throw fail(413, "Der Stand ist zu groß.");
      chunks.push(c);
    }
    raw = Buffer.concat(chunks).toString("utf8");
  }
  if (raw.length > max) throw fail(413, "Der Stand ist zu groß.");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw fail(400, "Die Daten sind kein gültiges JSON.");
  }
}

const hits = new Map();
/** true when `key` was used more than `max` times within `windowMs` (per function instance). */
export function limited(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  if (hits.size > 5000) hits.clear();
  hits.set(key, list);
  return list.length > max;
}
export const clientIp = (req) =>
  String((req.headers && (req.headers["x-forwarded-for"] || req.headers["x-real-ip"])) || (req.socket && req.socket.remoteAddress) || "")
    .split(",")[0]
    .trim();

export function storageMessage(e) {
  const msg = String((e && (e.name + " " + e.message)) || e);
  if (/suspended|quota|limit/i.test(msg)) return "Der Online-Speicher ist gesperrt, weil das Kontingent erschöpft ist. Daten bleiben in diesem Browser.";
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|connect|password authentication/i.test(msg)) return "Die Datenbank ist gerade nicht erreichbar. Daten bleiben in diesem Browser.";
  return "Speichern ist fehlgeschlagen. Daten bleiben in diesem Browser.";
}

export const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** Wrap an endpoint: provides the storage (or null) and turns errors into German JSON answers. */
export function endpoint(fn) {
  return async (req, res) => {
    try {
      const kv = await store();
      await fn(req, res, kv);
    } catch (e) {
      const status = e && e.status ? e.status : 500;
      if (status >= 500) console.error("radar:", e);
      if (!res.headersSent) send(res, status, { error: status >= 500 ? storageMessage(e) : e.message });
    }
  };
}

export function needStore(kv) {
  if (!kv) throw fail(503, "Kein Online-Speicher verbunden. Daten bleiben in diesem Browser.");
}
