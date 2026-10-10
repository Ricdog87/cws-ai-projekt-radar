import { clientIp, endpoint, fail, limited, needStore, readJson, send } from "./_lib/http.js";
import { getSettings, submitRequest } from "./_lib/radar.js";

// Public, no login: settings for the request form (GET) and sending a request (POST).
export default endpoint(async (req, res, kv) => {
  needStore(kv);
  if (req.method === "GET") {
    const s = await getSettings(kv);
    send(res, 200, { online: true, formOpen: s.formOpen, contactName: s.contactName, contactEmail: s.contactEmail, bookingUrl: s.bookingUrl, meetingMinutes: s.meetingMinutes });
    return;
  }
  if (req.method !== "POST") throw fail(405, "Nur Lesen und Senden.");
  if (limited(`form:${clientIp(req)}`, 5, 60 * 60_000)) throw fail(429, "Sie haben gerade schon mehrere Anfragen gesendet. Bitte später noch einmal.");
  const body = await readJson(req, 60_000);
  if (body.website) { send(res, 200, { ok: true, code: "REQ" }); return; } // filled by bots only
  const r = await submitRequest(kv, body.request || body);
  if (r.error) throw fail(r.status || 400, r.error);
  send(res, 200, { ok: true, code: r.code });
});
