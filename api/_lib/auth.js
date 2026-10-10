// Users, access codes and sessions.
// Users live in the storage (key "users") and are managed in the app under "Verwaltung".
// RADAR_USERS (env, JSON list { id, name, role, code, admin? }) seeds them once and stays a fallback:
// a user from the env keeps their env code until an admin issues a new one in the app.
// After the login the browser only holds a signed session token, never the code.
import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

const DAY = 86_400_000;
export const TOKEN_DAYS = 60;
const CACHE_MS = 15_000;
const ID_OK = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

export function envUsers(env = process.env) {
  const raw = env.RADAR_USERS || "";
  if (!raw.trim()) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((u) => u && typeof u === "object" && u.id && u.name && u.code)
      .map((u) => ({
        id: String(u.id).slice(0, 40),
        name: String(u.name).slice(0, 80),
        role: String(u.role || "").slice(0, 80),
        code: String(u.code),
        admin: u.admin === true,
      }))
      .filter((u) => ID_OK.test(u.id));
  } catch {
    return [];
  }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/* ---------- access codes ---------- */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
export function newCode() {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}
const normCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export function hashCode(code, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(normCode(code), salt, 32).toString("hex") };
}
function codeMatches(u, code) {
  if (!code) return false;
  if (u.hash && u.salt) {
    const got = scryptSync(normCode(code), u.salt, 32);
    const want = Buffer.from(u.hash, "hex");
    return got.length === want.length && timingSafeEqual(got, want);
  }
  const env = envUsers().find((e) => e.id === u.id);
  return !!env && safeEqual(env.code, code);
}

/* ---------- user list ---------- */
let usersCache = null;
const codeCache = new Map(); // legacy header logins: avoid one scrypt per request
let secretCache = null;

export function resetAuthCache() {
  usersCache = null;
  secretCache = null;
  codeCache.clear();
}

function fromEnv(u, admin) {
  return { id: u.id, name: u.name, role: u.role, admin, active: true, ver: 1, source: "env", createdAt: new Date().toISOString() };
}

/** { version, list, removed } – cached for a few seconds per function instance. */
export async function loadUsers(kv, { fresh = false } = {}) {
  if (!fresh && usersCache && Date.now() - usersCache.at < CACHE_MS) return usersCache;
  const env = envUsers();
  let rec = await kv.get("users");
  if (!rec && env.length) {
    const anyAdmin = env.some((u) => u.admin);
    const list = env.map((u, i) => fromEnv(u, anyAdmin ? u.admin : i === 0));
    try {
      await kv.put("users", { list, removed: [] }, { version: null });
    } catch (e) {
      if (!e.conflict) throw e;
    }
    rec = await kv.get("users");
  } else if (rec) {
    const known = new Set((rec.value.list || []).map((u) => u.id));
    const removed = new Set(rec.value.removed || []);
    const add = env.filter((u) => !known.has(u.id) && !removed.has(u.id));
    if (add.length) {
      try {
        await kv.put("users", { ...rec.value, list: [...rec.value.list, ...add.map((u) => fromEnv(u, u.admin))] }, { version: rec.version });
      } catch (e) {
        if (!e.conflict) throw e;
      }
      rec = await kv.get("users");
    }
  }
  usersCache = {
    at: Date.now(),
    version: rec ? rec.version : null,
    list: rec ? rec.value.list || [] : [],
    removed: rec ? rec.value.removed || [] : [],
  };
  return usersCache;
}

export const activeUsers = (cache) => cache.list.filter((u) => u.active !== false);
export const publicUser = (u) => ({ id: u.id, name: u.name, role: u.role || "", admin: !!u.admin });
export const publicUsers = (cache) => activeUsers(cache).map(({ id, name, role }) => ({ id, name, role: role || "" }));

/** Change the user list with retries on concurrent writes. fn(value) may throw an Error with a German message. */
export async function mutateUsers(kv, fn) {
  for (let i = 0; i < 5; i++) {
    const rec = await kv.get("users");
    const value = rec ? JSON.parse(JSON.stringify(rec.value)) : { list: [], removed: [] };
    value.list ||= [];
    value.removed ||= [];
    const result = fn(value);
    const admins = value.list.filter((u) => u.active !== false && u.admin);
    if (!admins.length) throw Object.assign(new Error("Mindestens ein aktiver Admin muss bleiben."), { status: 400 });
    try {
      await kv.put("users", value, { version: rec ? rec.version : null });
      usersCache = null;
      codeCache.clear();
      return result;
    } catch (e) {
      if (!e.conflict) throw e;
    }
  }
  throw Object.assign(new Error("Die Benutzerliste wird gerade geändert. Bitte noch einmal versuchen."), { status: 409 });
}

/* ---------- sessions ---------- */
async function secret(kv) {
  if (process.env.RADAR_SECRET) return process.env.RADAR_SECRET;
  if (secretCache) return secretCache;
  let rec = await kv.get("secret");
  if (!rec) {
    try {
      await kv.put("secret", { value: randomBytes(32).toString("hex") }, { version: null });
    } catch (e) {
      if (!e.conflict) throw e;
    }
    rec = await kv.get("secret");
  }
  secretCache = rec.value.value;
  return secretCache;
}

export async function issueToken(kv, u) {
  const payload = Buffer.from(JSON.stringify({ u: u.id, v: u.ver || 1, e: Date.now() + TOKEN_DAYS * DAY })).toString("base64url");
  const sig = createHmac("sha256", await secret(kv)).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

async function readToken(kv, token) {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  const want = createHmac("sha256", await secret(kv)).update(payload).digest("base64url");
  if (!safeEqual(sig, want)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data && typeof data.e === "number" && data.e > Date.now() ? data : null;
  } catch {
    return null;
  }
}

/** Check a code at login. Returns the stored user or null. */
export async function login(kv, userId, code) {
  const cache = await loadUsers(kv, { fresh: true });
  const u = activeUsers(cache).find((x) => x.id === String(userId || ""));
  return u && codeMatches(u, code) ? u : null;
}

/** On the local server without accounts everyone on this computer is the one local user. */
export const LOCAL_USER = { id: "lokal", name: "", role: "", admin: true, ver: 1, renew: false, local: true };

/** The signed-in user of a request: { id, name, role, admin, renew } or null. */
export async function authenticate(kv, req) {
  const cache = await loadUsers(kv);
  if (process.env.RADAR_LOCAL === "1" && !activeUsers(cache).length) return LOCAL_USER;
  const h = req.headers || {};
  const bearer = String(h.authorization || "").match(/^Bearer\s+(.+)$/i);
  if (bearer) {
    const t = await readToken(kv, bearer[1]);
    const u = t && activeUsers(cache).find((x) => x.id === t.u);
    if (!u || (u.ver || 1) !== t.v) return null;
    return { ...publicUser(u), ver: u.ver || 1, renew: t.e - Date.now() < (TOKEN_DAYS - 7) * DAY };
  }
  // Older app versions still send id + code with every request
  const id = String(h["x-radar-user"] || "");
  const code = String(h["x-radar-key"] || "");
  if (!id || !code) return null;
  const u = activeUsers(cache).find((x) => x.id === id);
  if (!u) return null;
  const k = `${u.id}:${u.ver || 1}:${createHash("sha256").update(code).digest("hex")}`;
  if (!codeCache.has(k)) {
    if (codeCache.size > 200) codeCache.clear();
    codeCache.set(k, codeMatches(u, code));
  }
  return codeCache.get(k) ? { ...publicUser(u), ver: u.ver || 1, renew: true } : null;
}

export function slugId(name, taken) {
  const base = String(name || "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "nutzer";
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}
