// HTTP-Kern für den lokalen Server (SQLite) und den Server auf Azure App Service (PostgreSQL):
// die Endpunkte aus api/, die beiden Seiten mit den Sicherheits-Headern aus vercel.json,
// Komprimierung (Brotli/Gzip) und ETags. Ausgeliefert werden nur index.html und request.html.
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { brotliCompressSync, constants as zc, gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ENDPOINTS = ["health", "ready", "login", "state", "admin", "public"];
const PAGES = ["index.html", "request.html"]; // never serve docs, data, infra or the database file

/** @param {{ extraHeaders?: object, log?: boolean }} opts */
export async function createApp({ extraHeaders = {}, log = false } = {}) {
  const api = {};
  for (const name of ENDPOINTS) api[name] = (await import(`../api/${name}.js`)).default;
  const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8"));
  const block = (vercel.headers || []).find((h) => !h.source.startsWith("/api")) || { headers: [] };
  const pageHeaders = { ...Object.fromEntries(block.headers.map((h) => [h.key, h.value])), ...extraHeaders };

  // Compressed once per file version: on Azure once at start-up, locally again after each edit (F5 shows it).
  const cache = new Map();
  const page = (name) => {
    const file = join(ROOT, name);
    const { mtimeMs, size } = statSync(file);
    const hit = cache.get(name);
    if (hit && hit.mtimeMs === mtimeMs && hit.size === size) return hit;
    const raw = readFileSync(file);
    const p = {
      mtimeMs, size, raw,
      gz: gzipSync(raw, { level: 9 }),
      br: brotliCompressSync(raw, { params: { [zc.BROTLI_PARAM_QUALITY]: 11 } }),
      etag: `"${createHash("sha256").update(raw).digest("base64url").slice(0, 27)}"`,
    };
    cache.set(name, p);
    return p;
  };
  PAGES.forEach(page); // not on the first request

  return async function handle(req, res) {
    const started = Date.now();
    if (log) res.on("finish", () => (res.statusCode === 200 && req.url === "/api/ready") || console.log(`${req.method} ${String(req.url || "").split("?")[0]} ${res.statusCode} ${Date.now() - started}ms`));
    try {
      const url = new URL(req.url || "/", "http://radar");
      const m = url.pathname.match(/^\/api\/([a-z]+)$/);
      if (m) {
        if (!api[m[1]]) { res.writeHead(404, { "cache-control": "no-store" }); res.end(); return; }
        await api[m[1]](req, res);
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { allow: "GET, HEAD" }); res.end(); return; }
      const name = (url.pathname === "/" ? "index" : decodeURIComponent(url.pathname.slice(1)).replace(/\.html?$/, "")) + ".html"; // "/request" works like on Vercel
      if (!PAGES.includes(name)) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }); res.end("Nicht gefunden"); return; }
      const p = page(name);
      const headers = { ...pageHeaders, "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", etag: p.etag, vary: "Accept-Encoding" };
      if (req.headers["if-none-match"] === p.etag) { res.writeHead(304, headers); res.end(); return; }
      const ae = String(req.headers["accept-encoding"] || "");
      let body = p.raw;
      if (/\bbr\b/.test(ae)) { body = p.br; headers["content-encoding"] = "br"; }
      else if (/\bgzip\b/.test(ae)) { body = p.gz; headers["content-encoding"] = "gzip"; }
      headers["content-length"] = body.length;
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : body);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) { res.writeHead(500, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify({ error: "Interner Fehler." })); }
    }
  };
}
