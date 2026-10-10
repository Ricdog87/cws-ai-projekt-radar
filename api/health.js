import { activeUsers, envUsers, loadUsers } from "./_lib/auth.js";
import { driverName } from "./_lib/db.js";
import { VERSION, endpoint, send, storageMessage, withTimeout } from "./_lib/http.js";

// Is a storage connected and reachable, and is a login needed?
export default endpoint(async (_req, res, kv) => {
  const out = { ok: true, version: VERSION, driver: kv ? kv.name : driverName(), storage: false, auth: envUsers().length > 0 };
  if (kv) {
    try {
      await withTimeout(kv.get("rev"), 8000);
      out.storage = true;
      out.auth = activeUsers(await loadUsers(kv)).length > 0;
    } catch (e) {
      out.storageError = storageMessage(e);
    }
  }
  send(res, 200, out);
});
