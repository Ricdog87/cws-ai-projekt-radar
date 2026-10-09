import { timingSafeEqual } from "node:crypto";

/** @returns {{ id: string, name: string, role: string, code: string }[]} */
export function configuredUsers() {
  const raw = process.env.RADAR_USERS || "";
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
      }));
  } catch {
    return [];
  }
}

export function publicUsers() {
  return configuredUsers().map(({ id, name, role }) => ({ id, name, role }));
}

export function authEnabled() {
  return configuredUsers().length > 0;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length || x.length === 0) return false;
  return timingSafeEqual(x, y);
}

/** @returns {{ id: string, name: string, role: string } | null} */
export function authenticate(req) {
  const users = configuredUsers();
  if (!users.length) return null;
  const id = String(req.headers["x-radar-user"] || "");
  const code = String(req.headers["x-radar-key"] || "");
  const u = users.find((x) => x.id === id);
  if (!u || !safeEqual(u.code, code)) return null;
  return { id: u.id, name: u.name, role: u.role };
}

export function matchName(a, b) {
  const x = String(a || "").trim().toLowerCase();
  const y = String(b || "").trim().toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  const fx = x.split(/\s+/)[0];
  const fy = y.split(/\s+/)[0];
  return fx.length > 1 && fx === fy;
}

export function canSeeProject(p, user) {
  if (!user || !p) return false;
  if (p.ownerId === user.id) return true;
  if (Array.isArray(p.sharedWith) && p.sharedWith.includes(user.id)) return true;
  return (p.tasks || []).some(
    (t) => t && t.status !== "erledigt" && matchName(t.owner, user.name),
  );
}

export function canWriteProject(p, user) {
  return canSeeProject(p, user);
}
