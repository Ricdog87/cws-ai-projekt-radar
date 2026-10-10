// The radar's data rules: who sees which project, saving with versions, editing shared projects,
// activity log, daily backups, settings and the request inbox.
//
// Keys in the storage:
//   doc:<userId>          projects, requests and team of one user
//   users / secret        accounts and the session key (auth.js)
//   rev                   change marker; its version moves on with every save (cheap polling)
//   audit                 activity log (newest first, capped)
//   settings              request form and inbox settings
//   snap:<stamp>:<userId> daily backup of a user's data before the first change of the day
//   inbox:<day>           number of form requests per day (spam brake)
import { activeUsers, loadUsers, publicUsers } from "./auth.js";

const DAY = 86_400_000;
export const LIMITS = { projects: 2000, requests: 2000, team: 300, audit: 400, snapshotDays: 30, inboxPerDay: 40 };
const PHASE_LABEL = { intake: "Aufnahme", analyse: "Discovery", konzept: "Konzept", build: "Umsetzung", test: "Test", golive: "Go-live", hypercare: "Hypercare", done: "Abschluss" };
const HEALTH_LABEL = { green: "Im Plan", amber: "Gefährdet", red: "Kritisch", paused: "Pausiert" };
const isoDay = (d = new Date()) => d.toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();
const ID_OK = /^[A-Za-z0-9_-]{1,80}$/;

export function emptyDoc(user) {
  return { updatedAt: null, projects: [], requests: [], meta: { me: { name: user ? user.name : "", role: user ? user.role : "" }, team: [] } };
}
function normDoc(v, user) {
  const e = emptyDoc(user);
  if (!v || typeof v !== "object") return e;
  return {
    updatedAt: v.updatedAt || null,
    projects: Array.isArray(v.projects) ? v.projects.filter((p) => p && typeof p === "object" && ID_OK.test(String(p.id))) : [],
    requests: Array.isArray(v.requests) ? v.requests.filter((r) => r && typeof r === "object" && ID_OK.test(String(r.id))) : [],
    meta: v.meta && typeof v.meta === "object" ? { ...e.meta, ...v.meta } : e.meta,
  };
}

/* ---------- who sees what ---------- */
export function matchName(a, b) {
  const x = String(a || "").trim().toLowerCase();
  const y = String(b || "").trim().toLowerCase();
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const fx = x.split(/\s+/)[0];
  return fx.length > 1 && fx === y.split(/\s+/)[0];
}
/** Owner, people it is shared with, and anyone with an open task in their name. */
export function canSeeProject(p, user) {
  if (!user || !p) return false;
  if (p.ownerId === user.id) return true;
  if (Array.isArray(p.sharedWith) && p.sharedWith.includes(user.id)) return true;
  return (p.tasks || []).some((t) => t && t.status !== "erledigt" && matchName(t.owner, user.name));
}
export const canWriteProject = canSeeProject;

/* ---------- change marker ---------- */
let revCache = null;
export async function currentRev(kv, maxAge = 2000) {
  if (revCache && Date.now() - revCache.at < maxAge) return revCache.rev;
  const r = await kv.get("rev");
  revCache = { at: Date.now(), rev: r ? r.version : 0 };
  return revCache.rev;
}
async function bumpRev(kv) {
  const rev = await kv.put("rev", { at: nowISO() });
  revCache = { at: Date.now(), rev };
  return rev;
}
/** Tell all open apps to reload (e.g. after user changes). */
export const markChanged = (kv) => bumpRev(kv);
export function resetRadarCache() {
  revCache = null;
  snapDone.clear();
}

/* ---------- reading ---------- */
/** Everything one user sees. With `since` equal to the current marker only { unchanged: true } comes back. */
export async function viewFor(kv, user, { since } = {}) {
  const rev = await currentRev(kv);
  if (since !== undefined && since !== null && since !== "" && String(since) === String(rev)) return { unchanged: true, rev };
  const docs = await kv.list("doc:");
  const mineRec = docs.find((d) => d.key === `doc:${user.id}`);
  const mine = normDoc(mineRec && mineRec.value, user);
  const projects = mine.projects.map((p) => ({ ...p, ownerId: user.id }));
  const seen = new Set(projects.map((p) => p.id));
  for (const d of docs) {
    if (d === mineRec) continue;
    const owner = d.key.slice(4);
    for (const p of normDoc(d.value).projects) {
      if (seen.has(p.id)) continue;
      const q = { ...p, ownerId: p.ownerId || owner };
      if (canSeeProject(q, user)) {
        projects.push(q);
        seen.add(p.id);
      }
    }
  }
  return {
    rev,
    base: mineRec ? mineRec.version : null,
    updatedAt: mine.updatedAt,
    projects,
    requests: mine.requests,
    meta: user.local ? mine.meta : { ...mine.meta, me: { name: user.name, role: user.role } },
    users: publicUsers(await loadUsers(kv)),
    ...(user.local ? { local: true } : { user: { id: user.id, name: user.name, role: user.role, admin: !!user.admin } }),
  };
}

/* ---------- saving ---------- */
function cleanList(list, max) {
  if (!Array.isArray(list) || list.length > max) return null;
  return list.filter((x) => x && typeof x === "object" && ID_OK.test(String(x.id)));
}
const cleanMe = (me) => (me && typeof me === "object" ? { name: String(me.name || "").slice(0, 80), role: String(me.role || "").slice(0, 80) } : null);
const cleanIds = (ids) => (Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && ID_OK.test(id)).slice(0, 20) : []);

/**
 * Save one user's stand. body: { base, projects, requests, meta } (older apps send `rev` instead of `base`).
 * → { ok } | { conflict } | { error }
 */
export async function saveState(kv, user, body) {
  const projects = cleanList(body.projects, LIMITS.projects);
  const requests = cleanList(body.requests, LIMITS.requests);
  if (!projects || !requests) return { error: "Der Stand hat nicht die erwartete Form." };
  const key = `doc:${user.id}`;
  const cur = await kv.get(key);
  if (Object.prototype.hasOwnProperty.call(body, "base")) {
    if (String(body.base ?? "") !== String(cur ? cur.version : "")) return { conflict: true };
  } else if (String(body.rev) !== String(await currentRev(kv, 0))) {
    return { conflict: true };
  }
  const prev = normDoc(cur && cur.value, user);
  const doc = {
    updatedAt: nowISO(),
    projects: projects.filter((p) => !p.ownerId || p.ownerId === user.id).map((p) => ({ ...p, ownerId: user.id, sharedWith: cleanIds(p.sharedWith) })),
    requests: requests.filter((r) => !r.ownerId || r.ownerId === user.id).map((r) => ({ ...r, ownerId: user.id })),
    meta: {
      ...prev.meta,
      me: user.local ? cleanMe(body.meta && body.meta.me) || prev.meta.me : { name: user.name, role: user.role },
      team: body.meta && Array.isArray(body.meta.team) ? body.meta.team.filter((m) => m && typeof m === "object").slice(0, LIMITS.team) : prev.meta.team || [],
    },
  };
  await quietly(() => snapshot(kv, user.id, cur));
  try {
    await kv.put(key, doc, { version: cur ? cur.version : null });
  } catch (e) {
    if (e.conflict) return { conflict: true };
    throw e;
  }
  const byOwner = new Map();
  for (const p of projects) {
    if (!p.ownerId || p.ownerId === user.id) continue;
    if (!byOwner.has(p.ownerId)) byOwner.set(p.ownerId, []);
    byOwner.get(p.ownerId).push(p);
  }
  const foreign = [];
  for (const [owner, list] of byOwner) foreign.push(...(await writeForeign(kv, owner, list, user)));
  await quietly(() => logChanges(kv, user, prev, doc, foreign));
  await bumpRev(kv);
  return { ok: true };
}

/** Changes to someone else's project land in the owner's data, if this user may edit it and the copy is newer. */
async function writeForeign(kv, owner, list, user) {
  if (!ID_OK.test(owner)) return [];
  for (let i = 0; i < 5; i++) {
    const rec = await kv.get(`doc:${owner}`);
    if (!rec) return [];
    const map = new Map(normDoc(rec.value).projects.map((p) => [p.id, p]));
    const changed = [];
    for (const p of list) {
      const ex = map.get(p.id);
      if (!ex || !canWriteProject({ ...ex, ownerId: owner }, user)) continue;
      if (!(String(p.updatedAt || "") > String(ex.updatedAt || ""))) continue;
      const next = { ...p, ownerId: owner, sharedWith: ex.sharedWith || [] };
      map.set(p.id, next);
      changed.push({ before: ex, after: next, owner });
    }
    if (!changed.length) return [];
    try {
      await kv.put(`doc:${owner}`, { ...rec.value, updatedAt: nowISO(), projects: [...map.values()] }, { version: rec.version });
      return changed;
    } catch (e) {
      if (!e.conflict) throw e;
    }
  }
  return [];
}

async function quietly(fn) {
  try {
    await fn();
  } catch (e) {
    console.error("radar: Nebenaufgabe fehlgeschlagen", e && e.message);
  }
}

/* ---------- activity log ---------- */
const label = (p) => [p.code, p.title].filter(Boolean).join(" ") || "Projekt";
export function describeChanges(prev, next) {
  const out = [];
  const before = new Map(prev.projects.map((p) => [p.id, p]));
  const after = new Map(next.projects.map((p) => [p.id, p]));
  for (const p of next.projects) {
    const b = before.get(p.id);
    if (!b) { out.push({ projectId: p.id, text: `Projekt angelegt: ${label(p)}` }); continue; }
    if (b.phase !== p.phase && PHASE_LABEL[p.phase]) out.push({ projectId: p.id, text: `${label(p)}: Phase ${PHASE_LABEL[p.phase]}` });
    if (b.health !== p.health && HEALTH_LABEL[p.health]) out.push({ projectId: p.id, text: `${label(p)}: Status ${HEALTH_LABEL[p.health]}` });
    if ((b.nextStep || "") !== (p.nextStep || "") && p.nextStep) out.push({ projectId: p.id, text: `${label(p)}: Nächster Schritt „${String(p.nextStep).slice(0, 120)}“` });
    const wasDone = new Set((b.tasks || []).filter((t) => t && t.status === "erledigt").map((t) => t.id));
    const done = (p.tasks || []).filter((t) => t && t.status === "erledigt" && !wasDone.has(t.id));
    done.slice(0, 3).forEach((t) => out.push({ projectId: p.id, text: `${label(p)}: Erledigt „${String(t.text || "").slice(0, 120)}“` }));
    if (done.length > 3) out.push({ projectId: p.id, text: `${label(p)}: ${done.length - 3} weitere Aufgaben erledigt` });
  }
  for (const b of prev.projects) if (!after.has(b.id)) out.push({ projectId: b.id, text: `Projekt gelöscht: ${label(b)}` });
  const oldReq = new Set(prev.requests.map((r) => r.id));
  next.requests.filter((r) => !oldReq.has(r.id)).slice(0, 5).forEach((r) => out.push({ text: `Anfrage erfasst: ${String(r.title || r.code || "").slice(0, 120)}` }));
  return out;
}
async function logChanges(kv, user, prev, doc, foreign) {
  const items = describeChanges(prev, doc);
  for (const f of foreign) {
    const d = describeChanges({ projects: [f.before], requests: [] }, { projects: [f.after], requests: [] });
    items.push(...(d.length ? d : [{ projectId: f.after.id, text: `${label(f.after)}: bearbeitet` }]));
  }
  if (items.length) await appendAudit(kv, user, items);
}
export async function appendAudit(kv, user, items) {
  const at = nowISO();
  const add = items.slice(0, 20).map((x) => ({ at, userId: user ? user.id : "", name: user ? user.name : "Formular", text: x.text, projectId: x.projectId || "" }));
  for (let i = 0; i < 5; i++) {
    const rec = await kv.get("audit");
    const list = add.concat(rec && Array.isArray(rec.value.items) ? rec.value.items : []).slice(0, LIMITS.audit);
    try {
      await kv.put("audit", { items: list }, { version: rec ? rec.version : null });
      return;
    } catch (e) {
      if (!e.conflict) throw e;
    }
  }
}
export async function readAudit(kv, limit = 150) {
  const rec = await kv.get("audit");
  return rec && Array.isArray(rec.value.items) ? rec.value.items.slice(0, limit) : [];
}

/* ---------- daily backups ---------- */
const snapDone = new Set();
let prunedOn = "";
async function snapshot(kv, userId, cur) {
  if (!cur) return;
  const key = `snap:${isoDay()}:${userId}`;
  if (snapDone.has(key)) return;
  try {
    await kv.put(key, { ...cur.value, snapshotAt: nowISO() }, { version: null });
  } catch (e) {
    if (!e.conflict) throw e;
  }
  snapDone.add(key);
  if (prunedOn !== isoDay()) {
    prunedOn = isoDay();
    const oldest = isoDay(new Date(Date.now() - LIMITS.snapshotDays * DAY));
    for (const k of await kv.keys("snap:")) if (k.split(":")[1].slice(0, 10) < oldest) await kv.del(k);
  }
}
export async function listSnapshots(kv) {
  return (await kv.keys("snap:")).map((k) => { const [, stamp, userId] = k.split(":"); return { stamp, userId }; })
    .sort((a, b) => b.stamp.localeCompare(a.stamp) || a.userId.localeCompare(b.userId));
}
export async function readSnapshot(kv, stamp, userId) {
  if (!/^[0-9T-]{10,16}$/.test(stamp) || !ID_OK.test(userId)) return null;
  const rec = await kv.get(`snap:${stamp}:${userId}`);
  return rec ? rec.value : null;
}
/** Put a backup back. The current stand is kept as its own backup first, so the restore can be undone. */
export async function restoreSnapshot(kv, admin, stamp, userId) {
  const snap = await readSnapshot(kv, stamp, userId);
  if (!snap) return { error: "Diese Sicherung gibt es nicht mehr." };
  for (let i = 0; i < 5; i++) {
    const cur = await kv.get(`doc:${userId}`);
    if (cur) {
      const t = new Date().toISOString().slice(0, 16).replace(/:/g, "");
      try { await kv.put(`snap:${t}:${userId}`, { ...cur.value, snapshotAt: nowISO(), beforeRestore: stamp }, { version: null }); } catch (e) { if (!e.conflict) throw e; }
    }
    const { snapshotAt, beforeRestore, ...doc } = snap;
    try {
      await kv.put(`doc:${userId}`, { ...doc, updatedAt: nowISO() }, { version: cur ? cur.version : null });
      await bumpRev(kv);
      await quietly(() => appendAudit(kv, admin, [{ text: `Sicherung vom ${stamp.slice(0, 10)} für ${userId} wiederhergestellt` }]));
      return { ok: true };
    } catch (e) {
      if (!e.conflict) throw e;
    }
  }
  return { error: "Gerade wird gespeichert. Bitte noch einmal versuchen." };
}

/* ---------- settings ---------- */
export const DEFAULT_SETTINGS = { contactName: "", contactEmail: "", bookingUrl: "", meetingMinutes: 30, formOpen: true, requestOwner: "" };
export async function getSettings(kv) {
  const rec = await kv.get("settings");
  return { ...DEFAULT_SETTINGS, ...(rec ? rec.value : {}) };
}
export function cleanSettings(s, users) {
  const str = (v, n) => String(v ?? "").trim().slice(0, n);
  const url = str(s.bookingUrl, 500);
  const email = str(s.contactEmail, 200);
  const owner = str(s.requestOwner, 40);
  return {
    contactName: str(s.contactName, 120),
    contactEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
    bookingUrl: /^https:\/\/[^\s"<>]+$/i.test(url) ? url : "",
    meetingMinutes: Math.min(120, Math.max(15, Math.round(+s.meetingMinutes || 30))),
    formOpen: s.formOpen !== false,
    requestOwner: users.some((u) => u.id === owner) ? owner : "",
  };
}

/* ---------- request inbox (public form) ---------- */
const RQ = {
  type: ["workflow", "automatisierung", "agent", "unklar"],
  urgency: ["niedrig", "mittel", "hoch"],
  yn: ["ja", "teilweise", "nein", "unklar"],
  affects: ["kunden", "mitarbeitende", "bewerber", "niemand", "unklar"],
  decides: ["vorschlag", "entscheidung", "unklar"],
  sensitiveUse: ["keine", "bewerbung", "leistung", "kredit", "ueberwachung", "unklar"],
};
export function cleanRequest(r) {
  if (!r || typeof r !== "object") return { error: "Die Anfrage ist leer." };
  const str = (v, n = 4000) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, n);
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const x = {
    title: str(r.title, 200), department: str(r.department, 200), site: str(r.site, 200),
    requester: str(r.requester, 200), requesterEmail: str(r.requesterEmail, 200),
    problem: str(r.problem), idea: str(r.idea), goal: str(r.goal), systems: str(r.systems, 1000), notes: str(r.notes),
    type: pick(r.type, RQ.type, "unklar"), urgency: pick(r.urgency, RQ.urgency, "mittel"),
    dataAvailable: pick(r.dataAvailable, RQ.yn, "unklar"), personalData: pick(r.personalData, RQ.yn, "unklar"),
    affects: pick(r.affects, RQ.affects, "unklar"), decides: pick(r.decides, RQ.decides, "unklar"), sensitiveUse: pick(r.sensitiveUse, RQ.sensitiveUse, "unklar"),
    volume: Number.isFinite(+r.volume) && r.volume !== "" && +r.volume >= 0 ? String(Math.round(+r.volume)) : "",
    minutes: Number.isFinite(+r.minutes) && r.minutes !== "" && +r.minutes >= 0 ? String(Math.round(+r.minutes)) : "",
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(r.deadline || "") ? r.deadline : "",
    meetingAt: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(r.meetingAt || "") ? r.meetingAt : "",
  };
  const missing = [];
  if (!x.title) missing.push("Titel");
  if (!x.problem) missing.push("Ausgangslage");
  if (!x.goal) missing.push("Ziel");
  if (!x.department) missing.push("Bereich");
  if (!x.requester) missing.push("Name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.requesterEmail)) missing.push("E-Mail");
  if (missing.length) return { error: `Bitte noch ausfüllen: ${missing.join(", ")}.` };
  return { request: x };
}

/** A request from the public form goes straight into the inbox of the responsible user. */
export async function submitRequest(kv, raw) {
  const settings = await getSettings(kv);
  if (!settings.formOpen) return { error: "Das Formular nimmt gerade keine Anfragen an. Bitte direkt per E-Mail melden.", status: 403 };
  const { request, error } = cleanRequest(raw);
  if (error) return { error, status: 400 };
  const users = activeUsers(await loadUsers(kv));
  const owner = users.find((u) => u.id === settings.requestOwner) || users.find((u) => u.admin) || users[0];
  if (!owner) return { error: "Im Radar ist noch kein Konto eingerichtet.", status: 503 };
  const dayKey = `inbox:${isoDay()}`;
  for (let i = 0; i < 5; i++) {
    const c = await kv.get(dayKey);
    const n = c ? +c.value.n || 0 : 0;
    if (n >= LIMITS.inboxPerDay) return { error: "Heute sind schon sehr viele Anfragen eingegangen. Bitte morgen noch einmal senden oder per E-Mail melden.", status: 429 };
    try { await kv.put(dayKey, { n: n + 1 }, { version: c ? c.version : null }); break; } catch (e) { if (!e.conflict) throw e; }
  }
  for (let i = 0; i < 5; i++) {
    const rec = await kv.get(`doc:${owner.id}`);
    const doc = normDoc(rec && rec.value, owner);
    if (doc.requests.length >= LIMITS.requests) return { error: "Der Eingang ist voll. Bitte per E-Mail melden.", status: 507 };
    const nums = doc.requests.map((r) => parseInt(String(r.code || "").replace(/\D/g, ""), 10)).filter((n) => !Number.isNaN(n));
    const code = `REQ-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
    const at = nowISO();
    const item = { ...request, id: `rq${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, code, status: "neu", complexity: "", projectId: "", source: "formular", createdAt: at, updatedAt: at, ownerId: owner.id };
    try {
      await kv.put(`doc:${owner.id}`, { ...doc, updatedAt: at, requests: [...doc.requests, item] }, { version: rec ? rec.version : null });
      await bumpRev(kv);
      await quietly(() => appendAudit(kv, null, [{ text: `Neue Projektanfrage ${code}: ${request.title} (${request.department})` }]));
      return { ok: true, code };
    } catch (e) {
      if (!e.conflict) throw e;
    }
  }
  return { error: "Gerade ist viel los. Bitte noch einmal senden.", status: 503 };
}

/* ---------- overview for the admin ---------- */
export async function systemInfo(kv) {
  const docs = await kv.list("doc:");
  const projects = docs.reduce((n, d) => n + normDoc(d.value).projects.length, 0);
  const requests = docs.reduce((n, d) => n + normDoc(d.value).requests.length, 0);
  const last = docs.map((d) => d.value && d.value.updatedAt).filter(Boolean).sort().pop() || null;
  return { driver: kv.name, rev: await currentRev(kv, 0), docs: docs.length, projects, requests, lastSave: last, bytes: JSON.stringify(docs.map((d) => d.value)).length };
}
export async function exportAll(kv) {
  const docs = await kv.list("doc:");
  return { app: "cws-ai-projekt-radar", version: 2, exportedAt: nowISO(), users: docs.map((d) => ({ userId: d.key.slice(4), ...normDoc(d.value) })) };
}
