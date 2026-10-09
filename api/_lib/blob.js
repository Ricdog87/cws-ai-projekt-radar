import { del, get, list, put } from "@vercel/blob";
import { configuredUsers, matchName } from "./users.js";

const LEGACY = "radar/state.json";
const legacyUserPath = (id) => `radar/users/${id}.json`;
const legacyForeignPath = (id) => `radar/foreign/${id}.json`;
const userPrefix = (id) => `radar/users/${id}/`;
const foreignPrefix = (id) => `radar/foreign/${id}/`;

export function emptyUserDoc() {
  return {
    rev: 0,
    updatedAt: null,
    projects: [],
    requests: [],
    meta: { me: { name: "", role: "" }, team: [] },
  };
}

function normalizeUserDoc(raw) {
  if (!raw || typeof raw !== "object") return emptyUserDoc();
  return {
    rev: Number(raw.rev) || 0,
    updatedAt: raw.updatedAt || null,
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    requests: Array.isArray(raw.requests) ? raw.requests : [],
    meta: raw.meta && typeof raw.meta === "object" ? raw.meta : emptyUserDoc().meta,
  };
}

async function readJson(pathname) {
  try {
    const result = await get(pathname, { access: "private", useCache: false });
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

async function writeJson(pathname, doc, { overwrite = false } = {}) {
  await put(pathname, JSON.stringify(doc), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: overwrite,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

async function listAll(prefix) {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix, limit: 1000, cursor });
    out.push(...(page.blobs || []));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

function revFromUserPath(pathname, userId) {
  const base = userPrefix(userId);
  if (!pathname.startsWith(base)) return -1;
  const name = pathname.slice(base.length);
  const m = /^r(\d+)\.json$/.exec(name);
  return m ? parseInt(m[1], 10) : -1;
}

async function latestUnderPrefix(prefix, scoreFn) {
  const blobs = await listAll(prefix);
  let best = null;
  let bestScore = -1;
  for (const b of blobs) {
    const score = scoreFn(b);
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

async function pruneOld(prefix, keepPathname, maxKeep = 8) {
  try {
    const blobs = await listAll(prefix);
    const others = blobs
      .filter((b) => b.pathname !== keepPathname)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const drop = others.slice(Math.max(0, maxKeep - 1));
    if (!drop.length) return;
    await del(drop.map((b) => b.url));
  } catch {
    /* best-effort cleanup */
  }
}

export async function readUserDoc(userId) {
  const latest = await latestUnderPrefix(userPrefix(userId), (b) => revFromUserPath(b.pathname, userId));
  if (latest) {
    const raw = await readJson(latest.pathname);
    if (raw) return normalizeUserDoc(raw);
  }
  const legacy = await readJson(legacyUserPath(userId));
  return normalizeUserDoc(legacy);
}

export async function writeUserDoc(userId, doc) {
  const rev = Number(doc.rev) || 0;
  const pathname = `${userPrefix(userId)}r${String(rev).padStart(8, "0")}.json`;
  const payload = {
    rev,
    updatedAt: doc.updatedAt || null,
    projects: doc.projects || [],
    requests: doc.requests || [],
    meta: doc.meta || emptyUserDoc().meta,
  };
  try {
    await writeJson(pathname, payload, { overwrite: false });
  } catch (err) {
    const msg = String((err && err.message) || err || "");
    if (/already exists|409|conflict|overwrite/i.test(msg) || (err && (err.statusCode === 409 || err.status === 409))) {
      await writeJson(pathname, payload, { overwrite: true });
    } else {
      throw err;
    }
  }
  await pruneOld(userPrefix(userId), pathname);
}

export async function readForeign(userId) {
  const latest = await latestUnderPrefix(foreignPrefix(userId), (b) => {
    const t = Date.parse(b.uploadedAt || 0);
    return Number.isNaN(t) ? 0 : t;
  });
  let raw = null;
  if (latest) raw = await readJson(latest.pathname);
  if (!raw) raw = await readJson(legacyForeignPath(userId));
  if (!raw || !Array.isArray(raw.projects)) return [];
  return raw.projects.filter((p) => p && typeof p === "object" && p.id);
}

/** Publish copies of shared/assigned projects into a separate foreign folder per assignee. */
export async function publishShared(ownerId, ownedProjects) {
  const users = configuredUsers();
  const stamp = Date.now();
  for (const u of users) {
    if (u.id === ownerId) continue;
    const keepFromOthers = (await readForeign(u.id)).filter((p) => p.ownerId && p.ownerId !== ownerId);
    const mineForThem = [];
    for (const p of ownedProjects) {
      let share = Array.isArray(p.sharedWith) && p.sharedWith.includes(u.id);
      if (!share) {
        share = (p.tasks || []).some((t) => t && t.status !== "erledigt" && matchName(t.owner, u.name));
      }
      if (share) mineForThem.push(p);
    }
    const pathname = `${foreignPrefix(u.id)}t${stamp}.json`;
    await writeJson(
      pathname,
      {
        updatedAt: new Date().toISOString(),
        projects: [...keepFromOthers, ...mineForThem],
      },
      { overwrite: false },
    );
    await pruneOld(foreignPrefix(u.id), pathname);
  }
}

export async function currentRev() {
  try {
    const blobs = await listAll("radar/revs/");
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
    if (
      /already exists|409|conflict|overwrite|must not exist|precondition|412/i.test(msg) ||
      (err && (err.statusCode === 409 || err.status === 409))
    ) {
      return null;
    }
    throw err;
  }
}

export async function migrateLegacyIfNeeded() {
  const users = configuredUsers();
  if (!users.length) return;
  const first = await readUserDoc(users[0].id);
  if (first.projects.length || first.rev > 0) return;
  const anyVersioned = await listAll(userPrefix(users[0].id));
  if (anyVersioned.length) return;
  const flat = await readJson(legacyUserPath(users[0].id));
  if (flat) return;
  const legacy = await readJson(LEGACY);
  if (!legacy || !Array.isArray(legacy.projects)) return;
  for (const u of users) {
    const projects = legacy.projects
      .filter((p) => p && (p.ownerId === u.id || (!p.ownerId && u.id === users[0].id)))
      .map((p) => ({ ...p, ownerId: u.id }));
    const requests = Array.isArray(legacy.requests)
      ? legacy.requests
          .filter((r) => r && (r.ownerId === u.id || (!r.ownerId && u.id === users[0].id)))
          .map((r) => ({ ...r, ownerId: u.id }))
      : [];
    const doc = {
      rev: 1,
      updatedAt: legacy.updatedAt || new Date().toISOString(),
      projects,
      requests,
      meta: u.id === users[0].id && legacy.meta ? legacy.meta : { me: { name: u.name, role: u.role }, team: [] },
    };
    await writeUserDoc(u.id, doc);
    await publishShared(u.id, projects);
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
