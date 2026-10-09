import { emptyDoc, readDoc, writeDoc } from "./_lib/blob.js";
import { authenticate, authEnabled, canSeeProject, canWriteProject, publicUsers } from "./_lib/users.js";

function cleanList(list, max) {
  if (!Array.isArray(list) || list.length > max) return null;
  return list.filter((x) => x && typeof x === "object" && typeof x.id === "string" && x.id.length <= 80);
}

function viewFor(doc, user) {
  return {
    rev: doc.rev || 0,
    updatedAt: doc.updatedAt || null,
    projects: (doc.projects || []).filter((p) => canSeeProject(p, user)),
    requests: (doc.requests || []).filter((r) => r && (r.ownerId === user.id || !r.ownerId)),
    meta: doc.meta || emptyDoc().meta,
    users: publicUsers(),
    user,
  };
}

function mergePut(current, body, user) {
  const incomingProjects = cleanList(body.projects, 2000);
  const incomingRequests = cleanList(body.requests, 2000);
  if (!incomingProjects || !incomingRequests) return { error: 400 };

  const others = (current.projects || []).filter((p) => p.ownerId && p.ownerId !== user.id);
  const otherMap = new Map(others.map((p) => [p.id, p]));
  for (const p of incomingProjects) {
    if (p.ownerId && p.ownerId !== user.id) {
      const existing = otherMap.get(p.id);
      if (existing && canWriteProject(existing, user)) otherMap.set(p.id, { ...p, ownerId: existing.ownerId });
      continue;
    }
  }
  const mine = incomingProjects
    .filter((p) => !p.ownerId || p.ownerId === user.id)
    .map((p) => ({
      ...p,
      ownerId: user.id,
      sharedWith: Array.isArray(p.sharedWith) ? p.sharedWith.filter((id) => typeof id === "string").slice(0, 20) : [],
    }));

  const otherReqs = (current.requests || []).filter((r) => r.ownerId && r.ownerId !== user.id);
  const myReqs = incomingRequests
    .filter((r) => !r.ownerId || r.ownerId === user.id)
    .map((r) => ({ ...r, ownerId: user.id }));

  const meta =
    body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
      ? {
          ...current.meta,
          me: { name: user.name, role: user.role },
          team: Array.isArray(body.meta.team) ? body.meta.team : current.meta?.team || [],
        }
      : { ...(current.meta || emptyDoc().meta), me: { name: user.name, role: user.role } };

  return {
    projects: [...otherMap.values(), ...mine],
    requests: [...otherReqs, ...myReqs],
    meta,
  };
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
    const doc = (await readDoc()) || emptyDoc();
    res.status(200).json(viewFor(doc, user));
    return;
  }

  if (req.method === "PUT") {
    const current = (await readDoc()) || emptyDoc();
    const clientRev = Number(req.body && req.body.rev);
    if (!Number.isInteger(clientRev) || clientRev !== (current.rev || 0)) {
      res.status(409).json(viewFor(current, user));
      return;
    }
    const merged = mergePut(current, req.body || {}, user);
    if (merged.error) {
      res.status(400).json({ error: "Der Stand hat nicht die erwartete Form." });
      return;
    }
    const saved = {
      rev: (current.rev || 0) + 1,
      updatedAt: new Date().toISOString(),
      projects: merged.projects,
      requests: merged.requests,
      meta: merged.meta,
    };
    await writeDoc(saved);
    res.status(200).json(viewFor(saved, user));
    return;
  }

  res.setHeader("allow", "GET, PUT");
  res.status(405).json({ error: "Nur Lesen und Speichern." });
}
