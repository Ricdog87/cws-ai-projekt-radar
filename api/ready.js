import { readFileSync } from "node:fs";
import { VERSION, endpoint, send, storageMessage, withTimeout } from "./_lib/http.js";

// Stand des Pakets: build.json schreibt die Pipeline für Azure, auf Vercel kommt er aus der Umgebung.
const BUILD = (() => {
  try { return String(JSON.parse(readFileSync(new URL("../build.json", import.meta.url), "utf8")).commit || ""); }
  catch { return process.env.VERCEL_GIT_COMMIT_SHA || ""; }
})().slice(0, 12);

// Startbereitschaft für Health Checks und den Slot-Tausch: 200 nur, wenn die Datenbank antwortet.
export default endpoint(async (_req, res, kv) => {
  if (!kv) {
    send(res, 503, { ready: false, build: BUILD, error: "Kein Speicher konfiguriert." });
    return;
  }
  try {
    await withTimeout(kv.get("rev"), 5000);
    send(res, 200, { ready: true, version: VERSION, build: BUILD, driver: kv.name, slot: process.env.RADAR_SLOT || "" });
  } catch (e) {
    send(res, 503, { ready: false, build: BUILD, error: storageMessage(e) });
  }
});
