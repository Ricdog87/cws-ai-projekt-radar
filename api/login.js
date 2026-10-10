import { issueToken, loadUsers, login, mutateUsers, publicUser, publicUsers } from "./_lib/auth.js";
import { clientIp, endpoint, fail, limited, needStore, readJson, send } from "./_lib/http.js";

// GET: names for the login list. POST { user, code }: check the access code, answer with a session token.
export default endpoint(async (req, res, kv) => {
  needStore(kv);
  if (req.method === "GET") {
    send(res, 200, { users: publicUsers(await loadUsers(kv)) });
    return;
  }
  if (req.method !== "POST") throw fail(405, "Nur Anmelden.");
  const body = await readJson(req, 10_000);
  const userId = String(body.user || req.headers["x-radar-user"] || "");
  const code = String(body.code || req.headers["x-radar-key"] || "");
  if (limited(`ip:${clientIp(req)}`, 20, 15 * 60_000) || limited(`user:${userId}`, 10, 15 * 60_000)) {
    throw fail(429, "Zu viele Versuche. Bitte in 15 Minuten noch einmal.");
  }
  if (!userId || !code) throw fail(400, "Bitte Konto wählen und Zugangscode eingeben.");
  const u = await login(kv, userId, code);
  if (!u) throw fail(401, "Zugangscode passt nicht.");
  try {
    await mutateUsers(kv, (v) => { const x = v.list.find((y) => y.id === u.id); if (x) x.lastLoginAt = new Date().toISOString(); });
  } catch { /* the login works even if the timestamp cannot be written */ }
  send(res, 200, { token: await issueToken(kv, u), user: publicUser(u), users: publicUsers(await loadUsers(kv)) });
});
