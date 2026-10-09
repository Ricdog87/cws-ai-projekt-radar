import { get, list, put } from "@vercel/blob";
import { configuredUsers, matchName } from "./users.js";

const LEGACY = "radar/state.json";
const userPath = (id) => `radar/users/${id}.json`;
const foreignPath = (id) => `radar/foreign/${id}.json`;

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
  await writeJson(userPath(userId), {
    rev: doc.rev || 0,
    updatedAt: doc.updatedAt || null,
    projects: doc.projects || [],
    requests: doc.requests || [],
    meta: doc.meta || emptyUserDoc().meta,
  });
}

export async function readForeign(userId) {
  const raw = await readJson(foreignPath(userId));
  if (!raw || !Array.isArray(raw.projects)) return [];
  return raw.projects.filter((p) => p && typeof p === "object" && p.id);
}

/** Publish copies of shared/assigned projects into a separate foreign file per assignee. */
export async function publishShared(ownerId, ownedProjects) {
  const users = configuredUsers();
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
    await writeJson(foreignPath(u.id), {
      updatedAt: new Date().toISOString(),
      projects: [...keepFromOthers, ...mineForThem],
    });
  }
}

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
    if (/already exists|409|conflict|overwrite|must not exist|precondition|412/i.test(msg) || (err && (err.statusCode === 409 || err.status === 409))) {
      return null;
    }
    throw err;
  }
}

export async function migrateLegacyIfNeeded() {
  const users = configuredUsers();
  if (!users.length) return;
  const any = await readJson(userPath(users[0].id));
  if (any) return;
  const legacy = await readJson(LEGACY);
  if (!legacy || !Array.isArray(legacy.projects)) return;
  for (const u of users) {
    const projects = legacy.projects
      .filter((p) => p && (p.ownerId === u.id || (!p.ownerId && u.id === users[0].id)))
      .map((p) => ({ ...p, ownerId: u.id }));
    const requests = Array.isArray(legacy.requests)
      ? legacy.requests.filter((r) => r && (r.ownerId === u.id || (!r.ownerId && u.id === users[0].id))).map((r) => ({ ...r, ownerId: u.id }))
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
