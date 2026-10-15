// Backend-Tests über die echten Endpunkte (ohne Netzwerk, ohne Browser).
//   npm test                                    → Speicher im Arbeitsspeicher
//   RADAR_TEST_DATABASE_URL=postgres://… npm test → echte PostgreSQL (die Tabelle radar_kv wird geleert!)
// Nie gegen eine Datenbank mit echten Daten laufen lassen. DATABASE_URL wird bewusst ignoriert.
import { Readable } from "node:stream";
const PG = process.env.RADAR_TEST_DATABASE_URL || "";
const DRV = PG ? "postgres" : "memory";
for (const k of ["DATABASE_URL", "POSTGRES_URL", "BLOB_READ_WRITE_TOKEN", "RADAR_STORE", "RADAR_LOCAL", "RADAR_SECRET"]) delete process.env[k];
process.env.RADAR_USERS = JSON.stringify([
  { id: "lea", name: "Lea Beispiel", role: "AI Teamlead", code: "lea-code-1" },
  { id: "jonas", name: "Jonas Beispiel", role: "Salesforce Owner", code: "jonas-code-2" },
]);
if (DRV === "memory") process.env.RADAR_STORE = "memory";
else {
  process.env.DATABASE_URL = PG;
  const { default: pg } = await import("pg");
  const c = new pg.Client({ connectionString: PG });
  await c.connect();
  await c.query("drop table if exists radar_kv");
  await c.end();
}
const H = {};
for (const n of ["health", "ready", "login", "state", "admin", "public"]) H[n] = (await import(`../api/${n}.js`)).default;

async function call(name, { method = "GET", url = "/", headers = {}, body } = {}) {
  const raw = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  Object.assign(req, { method, url: `/api/${name}${url}`, headers: { "x-forwarded-for": "10.0.0.1", ...headers } });
  const res = { statusCode: 200, headers: {}, headersSent: false, body: "",
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(s) { this.body = s || ""; this.headersSent = true; } };
  await H[name](req, res);
  let json = null; try { json = JSON.parse(res.body); } catch {}
  return { status: res.statusCode, json, headers: res.headers };
}
let pass = 0, failN = 0;
const ok = (name, cond, extra) => { if (cond) pass++; else failN++; console.log(`${cond ? "OK  " : "FAIL"} ${name}${!cond && extra !== undefined ? " → " + JSON.stringify(extra).slice(0, 400) : ""}`); };
const auth = (t) => ({ authorization: `Bearer ${t}` });
const P = (id, extra = {}) => ({ id, code: "AI-" + id.slice(-3), title: "Projekt " + id, phase: "intake", health: "green", tasks: [], updatedAt: new Date().toISOString(), ...extra });

let r = await call("health");
ok("health: storage + auth", r.json.storage === true && r.json.auth === true && r.json.driver === DRV, r.json);
r = await call("ready");
ok("ready: 200 with reachable storage", r.status === 200 && r.json.ready === true && r.json.driver === DRV && r.headers["cache-control"] === "no-store", r);
r = await call("login");
ok("login list without codes", r.json.users.length === 2 && !JSON.stringify(r.json).includes("code"), r.json);
r = await call("login", { method: "POST", body: { user: "lea", code: "falsch" } });
ok("wrong code → 401", r.status === 401 && /passt nicht/.test(r.json.error), r);
r = await call("login", { method: "POST", body: { user: "lea", code: "lea-code-1" } });
const lea = r.json.token;
ok("login → token, Lea is admin", !!lea && r.json.user.admin === true, r.json);
r = await call("login", { method: "POST", body: { user: "jonas", code: "jonas-code-2" } });
const jonas = r.json.token;
ok("Jonas login, no admin", !!jonas && r.json.user.admin === false);
r = await call("state", { headers: { authorization: "Bearer kaputt.token" } });
ok("forged token → 401", r.status === 401);

r = await call("state", { headers: auth(lea) });
ok("empty view", r.status === 200 && r.json.base === null && r.json.projects.length === 0 && r.json.users.length === 2, r.json);
let rev = r.json.rev;
r = await call("state", { url: `?since=${encodeURIComponent(rev)}`, headers: auth(lea) });
ok("poll unchanged", r.json.unchanged === true, r.json);

const p1 = P("p-001", { tasks: [{ id: "t1", text: "Salesforce-Feld anlegen", owner: "Jonas Beispiel", status: "offen" }] });
const p2 = P("p-002");
r = await call("state", { method: "PUT", headers: auth(lea), body: { base: null, rev, projects: [p1, p2], requests: [], meta: { team: [{ id: "m1", name: "Jonas Beispiel", skills: "Salesforce, CRM", kind: "kontakt" }], extra: "x" } } });
ok("first save", r.status === 200 && r.json.projects.length === 2 && r.json.base !== null, r);
const base1 = r.json.base;
ok("team fields kept", r.json.meta.team[0].skills === "Salesforce, CRM" && r.json.meta.team[0].kind === "kontakt");
ok("rev moved", String(r.json.rev) !== String(rev));
r = await call("state", { url: `?since=${encodeURIComponent(rev)}`, headers: auth(lea) });
ok("poll after change → full view", !r.json.unchanged && r.json.projects.length === 2);
r = await call("state", { method: "PUT", headers: auth(lea), body: { base: null, projects: [p1], requests: [], meta: {} } });
ok("stale base → 409 with current view", r.status === 409 && r.json.projects.length === 2, r.status);

r = await call("state", { headers: auth(jonas) });
ok("Jonas sees only the project with his task", r.json.projects.length === 1 && r.json.projects[0].id === "p-001" && r.json.projects[0].ownerId === "lea", r.json.projects);
ok("Jonas gets no team/requests of Lea", (r.json.meta.team || []).length === 0 && r.json.requests.length === 0);
const jp = { ...r.json.projects[0], tasks: [{ ...r.json.projects[0].tasks[0], status: "erledigt" }], updatedAt: new Date(Date.now() + 1000).toISOString() };
r = await call("state", { method: "PUT", headers: auth(jonas), body: { base: r.json.base, projects: [jp], requests: [], meta: { team: [] } } });
ok("Jonas saves Lea's project", r.status === 200, r);
r = await call("state", { headers: auth(lea) });
ok("Lea sees Jonas' change", r.json.projects.find((p) => p.id === "p-001").tasks[0].status === "erledigt");
const staleCopy = { ...p1, ownerId: "lea", title: "alt", updatedAt: "2000-01-01T00:00:00.000Z" };
r = await call("state", { headers: auth(jonas) });
await call("state", { method: "PUT", headers: auth(jonas), body: { base: r.json.base, projects: [staleCopy], requests: [], meta: {} } });
r = await call("state", { headers: auth(lea) });
ok("older copy does not overwrite", r.json.projects.find((p) => p.id === "p-001").title === "Projekt p-001");

r = await call("state", { headers: { "x-radar-user": "lea", "x-radar-key": "lea-code-1" } });
ok("older app login (headers) still works and gets a token", r.status === 200 && !!r.json.token);
r = await call("admin", { headers: auth(jonas) });
ok("admin only for admins", r.status === 403);
r = await call("admin", { headers: auth(lea) });
ok("admin overview", r.status === 200 && r.json.users.length === 2 && r.json.system.projects === 2 && r.json.audit.length > 0, r.json && r.json.system);
ok("activity log readable", r.json.audit.some((a) => /Erledigt „Salesforce-Feld anlegen“/.test(a.text) && a.name === "Jonas Beispiel"), r.json.audit.map((a) => a.text));

r = await call("admin", { method: "POST", headers: auth(lea), body: { action: "user-create", name: "Max Müller", role: "AI Automation Expert" } });
const maxCode = r.json.code;
ok("user created with code", r.status === 200 && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(maxCode) && r.json.user.id === "max-mueller", r.json);
r = await call("login", { method: "POST", body: { user: "max-mueller", code: maxCode.toLowerCase().replace("-", " ") } });
ok("code is forgiving (case, separator)", r.status === 200);
const maxTok = r.json.token;
r = await call("admin", { method: "POST", headers: auth(lea), body: { action: "user-create", name: "max müller" } });
ok("duplicate name refused", r.status === 400);
r = await call("admin", { method: "POST", headers: auth(lea), body: { action: "user-code", id: "max-mueller" } });
const max2 = r.json.code;
r = await call("state", { headers: auth(maxTok) });
ok("new code ends old sessions", r.status === 401);
r = await call("login", { method: "POST", body: { user: "max-mueller", code: max2 } });
ok("new code works", r.status === 200);
r = await call("admin", { method: "POST", headers: auth(lea), body: { action: "user-update", id: "max-mueller", active: false } });
r = await call("login", { method: "POST", body: { user: "max-mueller", code: max2 } });
ok("deactivated user cannot log in", r.status === 401);
r = await call("admin", { method: "POST", headers: auth(lea), body: { action: "user-update", id: "lea", admin: false } });
ok("last admin cannot be removed", r.status === 400 && /Admin/.test(r.json.error), r.json);
r = await call("admin", { method: "POST", headers: auth(lea), body: { action: "user-update", id: "lea", active: false } });
ok("no self-deactivation", r.status === 400);

r = await call("admin", { method: "POST", headers: auth(lea), body: { action: "settings", settings: { contactName: "Lea Beispiel", contactEmail: "lea@example.com", bookingUrl: "https://example.com/termin", meetingMinutes: 45, requestOwner: "lea", formOpen: true } } });
ok("settings saved", r.status === 200 && r.json.settings.meetingMinutes === 45);
r = await call("admin", { method: "POST", headers: auth(lea), body: { action: "settings", settings: { bookingUrl: "javascript:alert(1)", contactEmail: "kaputt" } } });
ok("unsafe settings cleaned", r.json.settings.bookingUrl === "" && r.json.settings.contactEmail === "");
await call("admin", { method: "POST", headers: auth(lea), body: { action: "settings", settings: { contactName: "Lea Beispiel", contactEmail: "lea@example.com", bookingUrl: "https://example.com/termin", meetingMinutes: 45, requestOwner: "lea" } } });
r = await call("public");
ok("public settings", r.json.contactEmail === "lea@example.com" && r.json.formOpen === true && !("requestOwner" in r.json), r.json);
r = await call("public", { method: "POST", body: { request: { title: "Nur Titel" } } });
ok("incomplete request refused (German)", r.status === 400 && /Bitte noch ausfüllen/.test(r.json.error), r.json);
const req = { title: "Rechnungen automatisch prüfen", problem: "Manuell", goal: "Schneller", department: "Finanzen", site: "Köln", requester: "Erika Muster", requesterEmail: "erika@example.com", type: "automatisierung", volume: "400", minutes: "6", meetingAt: "2026-10-20T10:00", evil: "<script>" };
r = await call("public", { method: "POST", body: { request: req } });
ok("request accepted", r.status === 200 && r.json.code === "REQ-001", r.json);
r = await call("public", { method: "POST", body: { request: req, website: "spam" } });
ok("honeypot pretends success", r.status === 200);
r = await call("state", { headers: auth(lea) });
const inbox = r.json.requests;
ok("request lands in Lea's inbox once, cleaned", inbox.length === 1 && inbox[0].status === "neu" && inbox[0].source === "formular" && !("evil" in inbox[0]) && inbox[0].ownerId === "lea", inbox);
for (let i = 0; i < 5; i++) await call("public", { method: "POST", body: { request: req }, headers: { "x-forwarded-for": "10.9.9.9" } });
r = await call("public", { method: "POST", body: { request: req }, headers: { "x-forwarded-for": "10.9.9.9" } });
ok("rate limit per sender", r.status === 429, r.status);

// Backups: today's first save made a snapshot of the state before it
r = await call("state", { headers: auth(lea) });
r = await call("state", { method: "PUT", headers: auth(lea), body: { base: r.json.base, projects: [], requests: r.json.requests, meta: r.json.meta } });
ok("Lea deletes everything", r.status === 200 && r.json.projects.length === 0, r);
r = await call("admin", { headers: auth(lea) });
const snap = r.json.snapshots.find((s) => s.userId === "lea");
ok("daily backup exists", !!snap, r.json.snapshots);
r = await call("admin", { url: `?snapshot=${snap.stamp}&user=lea`, headers: auth(lea) });
ok("backup downloadable as import file", r.status === 200 && r.json.projects.length === 2, r.json && r.json.projects);
r = await call("admin", { method: "POST", headers: auth(lea), body: { action: "restore", stamp: snap.stamp, user: "lea" } });
ok("restore", r.status === 200, r.json);
r = await call("state", { headers: auth(lea) });
ok("projects back after restore", r.json.projects.length === 2, r.json.projects.length);
r = await call("admin", { headers: auth(lea) });
ok("state before restore kept as backup", r.json.snapshots.filter((s) => s.userId === "lea").length >= 2);

r = await call("admin", { method: "POST", headers: auth(lea), body: { action: "user-delete", id: "jonas", transferTo: "lea" } });
ok("delete Jonas", r.status === 200, r.json);
r = await call("login", { method: "POST", body: { user: "jonas", code: "jonas-code-2" } });
ok("deleted env user stays deleted", r.status === 401);
r = await call("admin", { url: "?export=alle", headers: auth(lea) });
ok("full export", r.status === 200 && /attachment/.test(r.headers["content-disposition"]) && r.json.users.length >= 1);

// Two saves with the same base at the same time: exactly one wins
r = await call("state", { headers: auth(lea) });
const b = r.json.base;
const [a1, a2] = await Promise.all([1, 2].map((i) => call("state", { method: "PUT", headers: auth(lea), body: { base: b, projects: r.json.projects.map((p) => ({ ...p, nextStep: "Parallel " + i, updatedAt: new Date().toISOString() })), requests: r.json.requests, meta: r.json.meta } })));
ok("parallel saves: one 200, one 409", [a1.status, a2.status].sort().join() === "200,409", [a1.status, a2.status]);
r = await call("state", { method: "PUT", headers: auth(lea), body: { base: b, projects: "kaputt", requests: [] } });
ok("bad body → 400", r.status === 400);
r = await call("state", { method: "PUT", headers: auth(lea), body: "{kaputt" });
ok("invalid JSON → 400", r.status === 400, r);

// Without storage the app is not ready: health checks and the slot swap must wait.
const { closeStore, useStore } = await import("../api/_lib/db.js");
await closeStore();
useStore({ name: "kaputt", get: async () => { throw new Error("connect ECONNREFUSED 127.0.0.1:5432"); } });
r = await call("ready");
ok("ready: 503 when the database does not answer", r.status === 503 && r.json.ready === false && !!r.json.error, r);

console.log(`\n${DRV}: ${pass} OK, ${failN} FAIL`);
process.exit(failN ? 1 : 0);
