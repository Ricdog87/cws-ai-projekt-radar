// Server für Azure App Service (Linux, Node.js 22 LTS). App Service startet ihn mit `npm start`.
// Speicher: PostgreSQL über DATABASE_URL (Azure Database for PostgreSQL). Den Port setzt App Service (PORT).
// Startbereitschaft: GET /api/ready antwortet 200 erst, wenn die Datenbank erreichbar ist. Darauf warten
// der Health Check und das Aufwärmen vor dem Slot-Tausch (WEBSITE_SWAP_WARMUP_PING_PATH).
import { createServer } from "node:http";
import { createApp } from "./app.mjs";
import { closeStore, driverName } from "../api/_lib/db.js";

if (process.env.RADAR_LOCAL) {
  // Lokal ist ohne Konten jeder automatisch angemeldet. Auf einem öffentlichen Server darf das nie passieren.
  console.error("RADAR_LOCAL ist nur für den lokalen Server gedacht. Bitte die Einstellung entfernen.");
  process.exit(1);
}
if (!driverName()) console.warn("Kein Speicher konfiguriert (DATABASE_URL fehlt). /api/ready meldet 503.");

const PORT = Number(process.env.PORT || 8080);
const handle = await createApp({ log: true, extraHeaders: { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } });
const server = createServer(handle);
// Länger offen halten als der Azure-Load-Balancer (4 Minuten), sonst entstehen sporadische 502-Fehler.
server.keepAliveTimeout = 241_000;
server.headersTimeout = 242_000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`KI-Projekt-Radar läuft auf Port ${PORT}${process.env.RADAR_SLOT ? ` (Slot ${process.env.RADAR_SLOT})` : ""}, Speicher: ${driverName() || "keiner"}`);
});

// Bei Neustart, Skalierung oder Slot-Tausch schickt App Service SIGTERM: laufende Anfragen fertig machen.
let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: fahre herunter`);
  server.close(async () => {
    await closeStore().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));
