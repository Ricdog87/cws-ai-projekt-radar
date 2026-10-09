import { migrateLegacyIfNeeded, readUserDoc, totalRev, writeUserDoc } from "./_lib/blob.js";
import { authenticate, authEnabled, canSeeProject, canWriteProject, configuredUsers, publicUsers } from "./_lib/users.js";

function cleanList(list, max) {
  if (!Array.isArray(list) || list.length > max) return null;
  return list.filter((x) => x && typeof x === "object" && typeof x.id === "string" && x.id.length <= 80);
}

async function viewFor(user, mineOverride = null) {
  await migrateLegacyIfNeeded();
  const mine = mineOverride || (await readUserDoc(user.id));
  const projects = [...(mine.projects || [])];
  const seen = new Set(projects.map((p) => p.id));
  let rev = mine.rev || 0;
  for (const u of configuredUsers()) {
    if (u.id === user.id) continue;
    const other = await readUserDoc(u.id);
    rev += other.rev || 0;
    for (const p of other.projects) {
      if (!p || seen.has(p.id) || !canSeeProject(p, user)) continue;
      projects.push(p);
      seen.add(p.id);
    }
  }
  return {
    rev,
    updatedAt: mine.updatedAt || null,
    projects,
    requests: mine.requests || [],
    meta: mine.meta || { me: { name: user.name, role: user.role }, team: [] },
    users: publicUsers(),
    user,
  };
}

async function applyPut(body, user) {
  const incomingProjects = cleanList(body.projects, 2000);
  const incomingRequests = cleanList(body.requests, 2000);
  if (!incomingProjects || !incomingRequests) return { error: 400 };

  const currentRev = await totalRev();
  const clientRev = Number(body.rev);
  if (!Number.isInteger(clientRev) || clientRev !== currentRev) {
    return { conflict: true };
  }

  const mineProjects = incomingProjects
    .filter((p) => !p.ownerId || p.ownerId === user.id)
    .map((p) => ({
      ...p,
      ownerId: user.id,
      sharedWith: Array.isArray(p.sharedWith) ? p.sharedWith.filter((id) => typeof id === "string").slice(0, 20) : [],
    }));
  const mineRequests = incomingRequests
    .filter((r) => !r.ownerId || r.ownerId === user.id)
    .map((r) => ({ ...r, ownerId: user.id }));

  const prev = await readUserDoc(user.id);
  const mineDoc = {
    rev: (prev.rev || 0) + 1,
    updatedAt: new Date().toISOString(),
    projects: mineProjects,
    requests: mineRequests,
    meta:
      body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? {
            ...prev.meta,
            me: { name: user.name, role: user.role },
            team: Array.isArray(body.meta.team) ? body.meta.team : prev.meta?.team || [],
          }
        : { ...(prev.meta || {}), me: { name: user.name, role: user.role } },
  };
  await writeUserDoc(user.id, mineDoc);

  // Collaborators may update projects they can see but do not own.
  const byOwner = new Map();
  for (const p of incomingProjects) {
    if (!p.ownerId || p.ownerId === user.id) continue;
    if (!byOwner.has(p.ownerId)) byOwner.set(p.ownerId, []);
    byOwner.get(p.ownerId).push(p);
  }
  for (const [ownerId, list] of byOwner) {
    const ownerDoc = await readUserDoc(ownerId);
    let changed = false;
    const map = new Map(ownerDoc.projects.map((p) => [p.id, p]));
    for (const p of list) {
      const existing = map.get(p.id);
      if (!existing || !canWriteProject(existing, user)) continue;
      map.set(p.id, { ...p, ownerId });
      changed = true;
    }
    if (!changed) continue;
    await writeUserDoc(ownerId, {
      ...ownerDoc,
      rev: (ownerDoc.rev || 0) + 1,
      updatedAt: new Date().toISOString(),
      projects: [...map.values()],
    });
  }

  return { ok: true, mineDoc };
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(503).json({ error: "Speicher ist nicht verbunden." });
    return;
  }
  if (!authEnabled()) {
    res.status(503).json({ error: "Kein Benutzerkonto ist eingerichtet." });
    return;
  }
  const user = authenticate(req);
  if (!user) {
    res.status(401).json({ error: "Zugangscode fehlt oder passt nicht." });
    return;
  }

  if (req.method === "GET") {
    res.status(200).json(await viewFor(user));
    return;
  }

  if (req.method === "PUT") {
    const result = await applyPut(req.body || {}, user);
    if (result.error) {
      res.status(400).json({ error: "Der Stand hat nicht die erwartete Form." });
      return;
    }
    if (result.conflict) {
      res.status(409).json(await viewFor(user));
      return;
    }
    res.status(200).json(await viewFor(user, result.mineDoc));
    return;
  }

  res.setHeader("allow", "GET, PUT");
  res.status(405).json({ error: "Nur Lesen und Speichern." });
}
