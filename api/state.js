import { authenticate, issueToken } from "./_lib/auth.js";
import { endpoint, fail, needStore, readJson, send } from "./_lib/http.js";
import { saveState, viewFor } from "./_lib/radar.js";

// GET ?since=<rev>: the user's view (or { unchanged: true }). PUT: save the user's stand.
export default endpoint(async (req, res, kv) => {
  needStore(kv);
  const user = await authenticate(kv, req);
  if (!user) throw fail(401, "Bitte neu anmelden.");
  const withToken = async (view) => (user.renew && !view.unchanged ? { ...view, token: await issueToken(kv, user) } : view);

  if (req.method === "GET") {
    const since = new URL(req.url || "/", "http://x").searchParams.get("since");
    send(res, 200, await withToken(await viewFor(kv, user, { since })));
    return;
  }
  if (req.method === "PUT") {
    const result = await saveState(kv, user, await readJson(req));
    if (result.error) throw fail(400, result.error);
    send(res, result.conflict ? 409 : 200, await withToken(await viewFor(kv, user)));
    return;
  }
  throw fail(405, "Nur Lesen und Speichern.");
});
