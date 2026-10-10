import { authenticate, hashCode, loadUsers, mutateUsers, newCode, slugId } from "./_lib/auth.js";
import { endpoint, fail, needStore, readJson, send } from "./_lib/http.js";
import {
  appendAudit, cleanSettings, exportAll, getSettings, listSnapshots, markChanged, readAudit, readSnapshot, restoreSnapshot, systemInfo,
} from "./_lib/radar.js";

// Administration for admins: users and access codes, request form, backups, activity log.
const userRow = (u) => ({
  id: u.id, name: u.name, role: u.role || "", admin: !!u.admin, active: u.active !== false,
  source: u.source || "app", envCode: !u.hash, createdAt: u.createdAt || null, lastLoginAt: u.lastLoginAt || null,
});
const str = (v, n) => String(v ?? "").trim().slice(0, n);

export default endpoint(async (req, res, kv) => {
  needStore(kv);
  const me = await authenticate(kv, req);
  if (!me) throw fail(401, "Bitte neu anmelden.");
  if (!me.admin) throw fail(403, "Nur für Admins.");
  const q = new URL(req.url || "/", "http://x").searchParams;

  if (req.method === "GET") {
    if (q.get("export") === "alle") {
      send(res, 200, await exportAll(kv), { "content-disposition": `attachment; filename="CWS-AI-Radar_Gesamtsicherung_${new Date().toISOString().slice(0, 10)}.json"` });
      return;
    }
    if (q.get("snapshot")) {
      const snap = await readSnapshot(kv, q.get("snapshot"), q.get("user") || "");
      if (!snap) throw fail(404, "Diese Sicherung gibt es nicht mehr.");
      send(res, 200, { app: "cws-ai-projekt-radar", version: 1, exportedAt: snap.snapshotAt || null, projects: snap.projects || [], requests: snap.requests || [], meta: snap.meta || {} });
      return;
    }
    const users = await loadUsers(kv, { fresh: true });
    send(res, 200, {
      users: users.list.map(userRow),
      settings: await getSettings(kv),
      snapshots: await listSnapshots(kv),
      audit: await readAudit(kv),
      system: await systemInfo(kv),
    });
    return;
  }
  if (req.method !== "POST") throw fail(405, "Nur Lesen und Ändern.");

  const body = await readJson(req, 50_000);
  const action = String(body.action || "");
  const audit = async (text) => { await appendAudit(kv, me, [{ text }]).catch(() => {}); await markChanged(kv); };

  if (action === "user-create") {
    const name = str(body.name, 80);
    if (name.length < 2) throw fail(400, "Bitte einen Namen eingeben.");
    const code = newCode();
    const user = await mutateUsers(kv, (v) => {
      if (v.list.some((u) => u.name.toLowerCase() === name.toLowerCase())) throw fail(400, `${name} gibt es schon.`);
      const id = slugId(name, new Set([...v.list.map((u) => u.id), ...v.removed]));
      const u = { id, name, role: str(body.role, 80), admin: body.admin === true, active: true, ver: 1, source: "app", createdAt: new Date().toISOString(), ...hashCode(code) };
      v.list.push(u);
      return u;
    });
    await audit(`Benutzer angelegt: ${user.name}`);
    send(res, 200, { user: userRow(user), code });
    return;
  }

  const id = str(body.id, 40);
  if (action === "user-update") {
    const user = await mutateUsers(kv, (v) => {
      const u = v.list.find((x) => x.id === id);
      if (!u) throw fail(404, "Diesen Benutzer gibt es nicht.");
      if (body.name !== undefined) { const n = str(body.name, 80); if (n.length < 2) throw fail(400, "Bitte einen Namen eingeben."); u.name = n; }
      if (body.role !== undefined) u.role = str(body.role, 80);
      if (body.admin !== undefined) u.admin = body.admin === true;
      if (body.active !== undefined) {
        if (id === me.id && body.active === false) throw fail(400, "Du kannst dich nicht selbst deaktivieren.");
        if ((u.active !== false) !== (body.active === true)) u.ver = (u.ver || 1) + 1; // ends open sessions
        u.active = body.active === true;
      }
      return u;
    });
    await audit(`Benutzer geändert: ${user.name}${user.active ? "" : " (deaktiviert)"}`);
    send(res, 200, { user: userRow(user) });
    return;
  }
  if (action === "user-code") {
    const code = newCode();
    const user = await mutateUsers(kv, (v) => {
      const u = v.list.find((x) => x.id === id);
      if (!u) throw fail(404, "Diesen Benutzer gibt es nicht.");
      Object.assign(u, hashCode(code), { ver: (u.ver || 1) + 1 });
      return u;
    });
    await audit(`Neuer Zugangscode für ${user.name}`);
    send(res, 200, { user: userRow(user), code });
    return;
  }
  if (action === "user-delete") {
    if (id === me.id) throw fail(400, "Du kannst dich nicht selbst löschen.");
    const to = str(body.transferTo, 40) || me.id;
    const users = await loadUsers(kv, { fresh: true });
    if (!users.list.some((u) => u.id === to && u.active !== false)) throw fail(400, "Bitte eine aktive Person wählen, die die Projekte übernimmt.");
    const gone = users.list.find((u) => u.id === id);
    if (!gone) throw fail(404, "Diesen Benutzer gibt es nicht.");
    const moved = await transferData(kv, id, to);
    await mutateUsers(kv, (v) => {
      v.list = v.list.filter((u) => u.id !== id);
      if (!v.removed.includes(id)) v.removed.push(id);
    });
    await audit(`Benutzer gelöscht: ${gone.name}. ${moved} Projekte und Anfragen an ${users.list.find((u) => u.id === to).name} übergeben`);
    send(res, 200, { ok: true, moved });
    return;
  }
  if (action === "settings") {
    const users = await loadUsers(kv, { fresh: true });
    const settings = cleanSettings(body.settings || {}, users.list.filter((u) => u.active !== false));
    await kv.put("settings", settings);
    await audit("Einstellungen zum Anfrageformular gespeichert");
    send(res, 200, { settings });
    return;
  }
  if (action === "restore") {
    const r = await restoreSnapshot(kv, me, str(body.stamp, 20), str(body.user, 40));
    if (r.error) throw fail(409, r.error);
    send(res, 200, { ok: true });
    return;
  }
  throw fail(400, "Unbekannte Aktion.");
});

/** Move all projects and requests of a leaving user to someone else. */
async function transferData(kv, fromId, toId) {
  const from = await kv.get(`doc:${fromId}`);
  if (!from) return 0;
  const projects = (from.value.projects || []).map((p) => ({ ...p, ownerId: toId, updatedAt: new Date().toISOString() }));
  const requests = (from.value.requests || []).map((r) => ({ ...r, ownerId: toId }));
  for (let i = 0; i < 5; i++) {
    const to = await kv.get(`doc:${toId}`);
    const doc = to ? to.value : { updatedAt: null, projects: [], requests: [], meta: { team: [] } };
    const ids = new Set((doc.projects || []).map((p) => p.id));
    const rids = new Set((doc.requests || []).map((r) => r.id));
    const next = {
      ...doc,
      updatedAt: new Date().toISOString(),
      projects: [...(doc.projects || []), ...projects.filter((p) => !ids.has(p.id))],
      requests: [...(doc.requests || []), ...requests.filter((r) => !rids.has(r.id))],
    };
    try {
      await kv.put(`doc:${toId}`, next, { version: to ? to.version : null });
      await kv.put(`snap:${new Date().toISOString().slice(0, 16).replace(/:/g, "")}:${fromId}`, { ...from.value, snapshotAt: new Date().toISOString() });
      await kv.del(`doc:${fromId}`);
      return projects.length + requests.length;
    } catch (e) {
      if (!e.conflict) throw e;
    }
  }
  throw fail(409, "Gerade wird gespeichert. Bitte noch einmal versuchen.");
}
