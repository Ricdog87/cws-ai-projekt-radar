import { get, put } from "@vercel/blob";
import { configuredUsers } from "./users.js";

const LEGACY = "radar/state.json";
const userPath = (id) => `radar/users/${id}.json`;

export function emptyUserDoc() {
  return {
    rev: 0,
    updatedAt: null,
    projects: [],
    requests: [],
    meta: { me: { name: "", role: "" }, team: [] },
  };
}

async function readJson(pathname) {
  try {
    const result = await get(pathname, { access: "private", abortCache: true });
    if (!result || result.statusCode === 404 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    const doc = JSON.parse(text);
    if (!doc || typeof doc !== "object") return null;
    return doc;
  } catch (err) {
    const code = err && (err.statusCode || err.status);
    const msg = String((err && err.message) || err || "");
    if (code === 404 || /not found|404/i.test(msg)) return null;
    throw err;
  }
}

async function writeJson(pathname, doc) {
  await put(pathname, JSON.stringify(doc), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

export async function readUserDoc(userId) {
  const raw = await readJson(userPath(userId));
  if (!raw) return emptyUserDoc();
  return {
    rev: Number(raw.rev) || 0,
    updatedAt: raw.updatedAt || null,
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    requests: Array.isArray(raw.requests) ? raw.requests : [],
    meta: raw.meta && typeof raw.meta === "object" ? raw.meta : emptyUserDoc().meta,
  };
}

export async function writeUserDoc(userId, doc) {
  await writeJson(userPath(userId), doc);
}

/** One-time: split the old shared document into per-user files. */
export async function migrateLegacyIfNeeded() {
  const users = configuredUsers();
  if (!users.length) return;
  const any = await readJson(userPath(users[0].id));
  if (any) return;
  const legacy = await readJson(LEGACY);
  if (!legacy || !Array.isArray(legacy.projects)) return;
  for (const u of users) {
    const projects = legacy.projects.filter((p) => p && (p.ownerId === u.id || (!p.ownerId && u.id === users[0].id)));
    const requests = Array.isArray(legacy.requests)
      ? legacy.requests.filter((r) => r && (r.ownerId === u.id || (!r.ownerId && u.id === users[0].id)))
      : [];
    await writeUserDoc(u.id, {
      rev: 1,
      updatedAt: legacy.updatedAt || new Date().toISOString(),
      projects: projects.map((p) => ({ ...p, ownerId: u.id })),
      requests: requests.map((r) => ({ ...r, ownerId: u.id })),
      meta: u.id === users[0].id && legacy.meta ? legacy.meta : { me: { name: u.name, role: u.role }, team: [] },
    });
  }
}

export async function totalRev() {
  const users = configuredUsers();
  let sum = 0;
  for (const u of users) {
    const doc = await readUserDoc(u.id);
    sum += doc.rev || 0;
  }
  return sum;
}
