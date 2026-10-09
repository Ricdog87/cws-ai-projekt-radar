import { get, list, put } from "@vercel/blob";
import { configuredUsers, matchName } from "./users.js";

const LEGACY = "radar/state.json";
const userPath = (id) => `radar/users/${id}.json`;
const inboxPath = (id) => `radar/inbox/${id}.json`;

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

export async function readInbox(userId) {
  const raw = await readJson(inboxPath(userId));
  if (!raw || !Array.isArray(raw.projects)) return [];
  return raw.projects.filter((p) => p && typeof p === "object" && p.id);
}

export async function writeInbox(userId, projects) {
  await writeJson(inboxPath(userId), { updatedAt: new Date().toISOString(), projects });
}

/** Keep a copy of shared / assigned projects in the other person's inbox. */
export async function syncInboxes(ownerId, ownedProjects) {
  const users = configuredUsers();
  const byUser = new Map(users.map((u) => [u.id, []]));
  for (const p of ownedProjects) {
    const targets = new Set();
    if (Array.isArray(p.sharedWith)) p.sharedWith.forEach((id) => targets.add(id));
    for (const t of p.tasks || []) {
      if (!t || t.status === "erledigt") continue;
      const hit = users.find((u) => u.id !== ownerId && matchName(t.owner, u.name));
      if (hit) targets.add(hit.id);
    }
    for (const id of targets) {
      if (id === ownerId || !byUser.has(id)) continue;
      byUser.get(id).push(p);
    }
  }
  for (const u of users) {
    if (u.id === ownerId) continue;
    const existing = await readInbox(u.id);
    const map = new Map(existing.map((p) => [p.id, p]));
    // Drop previous copies owned by this owner, then add current ones.
    for (const [id, p] of map) {
      if (p.ownerId === ownerId) map.delete(id);
    }
    for (const p of byUser.get(u.id) || []) map.set(p.id, p);
    await writeInbox(u.id, [...map.values()]);
  }
}

/** Monotonic revision: create-only markers so two writers cannot claim the same rev. */
export async function currentRev() {
  try {
    const { blobs } = await list({ prefix: "radar/revs/", limit: 1000 });
    let max = 0;
    for (const b of blobs || []) {
      const n = parseInt(String(b.pathname).split("/").pop() || "0", 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return max;
  } catch {
    return 0;
  }
}

export async function claimRev(clientRev) {
  const next = clientRev + 1;
  try {
    await put(`radar/revs/${next}`, String(next), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "text/plain",
      cacheControlMaxAge: 0,
    });
    return next;
  } catch (err) {
    const msg = String((err && err.message) || err || "");
    if (/already exists|409|conflict|overwrite/i.test(msg) || (err && (err.statusCode === 409 || err.status === 409))) {
      return null;
    }
    // Some SDK versions use a different error – treat failed exclusive create as conflict.
    if (/must not exist|precondition|412/i.test(msg)) return null;
    throw err;
  }
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
    const doc = {
      rev: 1,
      updatedAt: legacy.updatedAt || new Date().toISOString(),
      projects: projects.map((p) => ({ ...p, ownerId: u.id })),
      requests: requests.map((r) => ({ ...r, ownerId: u.id })),
      meta: u.id === users[0].id && legacy.meta ? legacy.meta : { me: { name: u.name, role: u.role }, team: [] },
    };
    await writeUserDoc(u.id, doc);
    await syncInboxes(u.id, doc.projects);
  }
  if (!(await currentRev())) {
    await put("radar/revs/1", "1", {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
      cacheControlMaxAge: 0,
    });
  }
}
