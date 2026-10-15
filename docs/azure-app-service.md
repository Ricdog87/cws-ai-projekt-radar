# CWS KI-Projekt-Radar on Azure App Service with deployment slots

Runbook for CWS IT and the BPM & AI team. It covers the one-time setup, the release flow, rollback and operations.
Everything described here is in the repository: `infra/main.bicep` (infrastructure), `.github/workflows/azure-app-service.yml` (pipeline), `server/azure.mjs` (start-up on App Service).

The release flow follows Microsoft's App Service deployment best practices, section *Use deployment slots*: deploy to a staging slot, validate it there, then swap it into production. A rollback is a swap back.

## 1. Overview

```
GitHub (main)
  │  push → tests (in memory + PostgreSQL 16) → package → start test of the package
  ▼
Slot "staging"     https://<app>-staging.azurewebsites.net    database radar_staging
  │  smoke test → approval in the GitHub environment "production" → swap
  ▼
Slot "production"  https://<app>.azurewebsites.net            database radar
```

- **App:** Node.js 22 LTS on App Service for Linux. One web page (`index.html`), the request form (`request.html`) and a small JSON API under `/api`. No build on the server; the package already contains `node_modules`.
- **Data:** Azure Database for PostgreSQL Flexible Server 16, one table `radar_kv` that the app creates itself. Production and staging use separate databases on the same server.
- **Secrets:** in Key Vault. Both slots read them through Key Vault references with their own managed identity. Nothing secret is in the repository or in GitHub.
- **Region:** Germany West Central (Frankfurt). All data stays in Germany.

## 2. How the setup follows the best practices

| Recommendation | Implementation |
|---|---|
| Deploy to a staging slot, not to production | Job `staging` deploys with `azure/webapps-deploy@v3`, `slot-name: staging` |
| Validate before going live | `.github/scripts/smoke.sh`: `/api/ready` (database reachable, expected commit), dashboard, request form, `/api/health`, security headers |
| Warm up before the swap | `WEBSITE_SWAP_WARMUP_PING_PATH=/api/ready`, `WEBSITE_SWAP_WARMUP_PING_STATUSES=200`. During the swap App Service applies the production settings to the new code, restarts it and only switches traffic once `/api/ready` answers 200 with the **production** database. If it never does, the swap is aborted and production stays as it was |
| Keep environment settings with the slot | Sticky slot settings (`slotConfigNames`): `DATABASE_URL`, `RADAR_USERS`, `RADAR_SECRET`, `RADAR_SLOT` |
| Controlled go-live | Job `swap` runs in the GitHub environment `production` with required reviewers |
| Fast rollback | The previous release is in the staging slot after every swap. Swap again (section 6). The pipeline swaps back on its own when the production check fails |
| Run from package, no build on the server | `WEBSITE_RUN_FROM_PACKAGE=1`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, `node_modules` from `npm ci --omit=dev` in the package |
| Always On, health check | `alwaysOn: true`, `healthCheckPath: /api/ready` |
| No session affinity | `clientAffinityEnabled: false` (the app keeps no state in memory) |
| Clean restarts | `server/azure.mjs` finishes running requests on `SIGTERM`, closes the database pool, and keeps connections open longer than the Azure load balancer (no sporadic 502) |
| No publishing passwords | FTP and SCM basic authentication disabled; GitHub signs in via OpenID Connect to a user-assigned managed identity with *Website Contributor* on this app only |

## 3. What `infra/main.bicep` creates

| Resource | Name | Notes |
|---|---|---|
| App Service plan (Linux) | `asp-<app>` | Default `P0v3`. Slots need Standard or Premium |
| Web app + slot `staging` | `<app>`, `<app>/staging` | Node 22 LTS, HTTPS only, TLS 1.2+, FTPS off, HTTP/2, system-assigned identity per slot |
| PostgreSQL Flexible Server 16 | `psql-<app>-<suffix>` | `Standard_B1ms` (Burstable), 32 GB with auto-grow, backups 14 days, databases `radar` and `radar_staging` |
| Key Vault (RBAC) | `kv<app><suffix>` | Secrets `database-url`, `database-url-staging`, `radar-users`; soft delete and purge protection |
| Virtual network | `vnet-<app>` | With `privateNetwork=true` (default): app subnet for VNet integration, delegated subnet for PostgreSQL, private DNS zone. PostgreSQL has no public endpoint |
| Log Analytics + Application Insights | `log-<app>`, `appi-<app>` | Console, HTTP and platform logs; requests and dependencies |
| Managed identity for GitHub | `id-<app>-deploy` | Federated credentials for the GitHub environments `staging` and `production` |

Rough monthly cost at list prices in Germany West Central, without reservations: App Service P0v3 around 60–70 €, PostgreSQL B1ms with 32 GB around 20–25 €, monitoring, Key Vault and network a few euros. The staging slot runs on the same plan and costs nothing extra. Please confirm with the Azure pricing calculator.

The deploying account needs **Owner** (or *Contributor* plus *Role Based Access Control Administrator*) on the resource group, because the template assigns two roles: *Key Vault Secrets User* to both slots and *Website Contributor* to the GitHub identity.

## 4. One-time setup

### 4.1 Infrastructure

```bash
az group create -n rg-ki-projekt-radar -l germanywestcentral

# Never type secrets into a file in the repository.
read -rs -p "PostgreSQL admin password: " PGPASS; echo
read -rs -p "First accounts (JSON): " RADARUSERS; echo

az deployment group create -g rg-ki-projekt-radar \
  -f infra/main.bicep -p infra/main.parameters.json \
  -p postgresAdminPassword="$PGPASS" radarUsers="$RADARUSERS"
```

`radarUsers` seeds the first accounts once, in both databases. Format:

```json
[{"id":"ricardo","name":"<Name>","role":"AI Teamlead","code":"<long access code>","admin":true}]
```

All further people are created in the app (Verwaltung → Zugang anlegen). Codes created in the app are stored only as scrypt hashes in the database.

Parameters worth checking in `infra/main.parameters.json`:

- `appName`: becomes `<appName>.azurewebsites.net` and must be globally unique.
- `privateNetwork`: `true` keeps PostgreSQL private. For a quick pilot without VNet, `false` opens the PostgreSQL firewall to Azure services only.
- `vnetAddressPrefix`, `appSubnetPrefix`, `postgresSubnetPrefix`: adjust to the CWS address plan if the VNet will be peered with the hub.
- `deployPostgres=false` with `externalDatabaseUrl` and `externalStagingDatabaseUrl`: use an existing CWS PostgreSQL instead.
- `githubRepository`: the repository allowed to deploy (`owner/name`). If the repository moves, change it and deploy the template again.

The outputs contain the URLs, the Key Vault name and the values for GitHub (`githubClientId`, `githubTenantId`, `githubSubscriptionId`).

Notes:

- Until the first release (4.3) the app has no package and shows an error page. That is expected.
- Every later run of the template needs the same `postgresAdminPassword` again (it also writes the connection strings to Key Vault).
- Accounts from `radarUsers` sign in with the code from that setting until an admin issues a new code in the app. **Right after the first sign-in, issue yourself a new code** (Verwaltung → Neuer Code, in production and in staging): from then on the code exists only as a hash in the database, and later template runs can leave `radarUsers` empty. Without that step, every later run must pass the same `radarUsers` again, otherwise these accounts can no longer sign in.

### 4.2 GitHub

Repository → Settings:

1. **Secrets and variables → Actions → Secrets:** `AZURE_CLIENT_ID` (= output `githubClientId`), `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`. These are identifiers, not passwords.
2. **Variables:** `AZURE_WEBAPP_NAME` (= `appName`), `AZURE_RESOURCE_GROUP`. As long as `AZURE_WEBAPP_NAME` is empty, the workflow only runs the tests.
3. **Environments:** create `staging` and `production`. On `production` add **required reviewers** (BPM & AI lead and IT) and limit deployment branches to `main`.
   If the GitHub plan does not offer required reviewers for private repositories, set the variable `AZURE_SWAP_MODE=manual`: the pipeline then stops after staging, and IT swaps in the portal (section 6).

### 4.3 First release

Actions → *Azure App Service* → *Run workflow*. After the staging check, approve the `production` deployment. Then open `https://<app>.azurewebsites.net/api/ready`: it shows `"ready":true`, `"slot":"production"` and the commit.

### 4.4 Taking over data from the current web version

Browser data is bound to the address, so it does not move by itself. Each person, once:

1. In the current version (`cws-ai-projekt-radar.vercel.app`): **Sichern** (downloads a backup file).
2. In the Azure version: sign in, **Importieren**, choose the file. The data is saved to the database.

### 4.5 Optional

- **Own domain**, for example `projekt-radar.cws.com`: add it to the production slot only, with an App Service managed certificate.
- **Microsoft Entra ID sign-in** in front of the app (App Service Authentication) if access should be limited to CWS accounts. The app's own access codes keep working behind it.
- **Restrict the staging slot** to the CWS network (access restrictions on the slot).

## 5. Release flow (day to day)

1. Change is merged to `main`.
2. Workflow: tests → package → start test → deploy to `staging` → smoke test.
3. Reviewers check `https://<app>-staging.azurewebsites.net` if they want (it has its own database, so test entries never reach production) and approve `production`.
4. Swap with warm-up, smoke test in production. If that fails, the pipeline swaps back and the run is red.

Only one release runs at a time. A newer push waits until the previous run is approved or rejected; reject an outdated run so the newer one can continue.

What is live: `GET /api/ready` → `build` (commit) and `slot`.

## 6. Rollback

After every swap the previous release sits in the staging slot.

- **Portal:** Web app → Deployment slots → **Swap** → source `staging`, target `production`.
- **CLI:** `az webapp deployment slot swap -g <rg> -n <app> --slot staging --target-slot production`

Data is not rolled back by a swap (the database setting stays with the slot). For data there are three layers:

1. Daily snapshot per person in the app, 30 days (Verwaltung → Sicherungen → Wiederherstellen).
2. Full export for admins (Verwaltung → Gesamtsicherung).
3. PostgreSQL point-in-time restore, 14 days (restores into a new server).

## 7. Operations

- **Health:** `/api/ready` is 200 only when the database answers within 5 seconds, otherwise 503. App Service uses it as health check and as warm-up for swaps. `/api/health` shows storage and sign-in status.
- **Logs:** Web app → Log stream, or Log Analytics: `AppServiceConsoleLogs | order by TimeGenerated desc`. Request lines contain method, path, status and duration, never query strings or tokens. Successful `/api/ready` pings are not logged.
- **Scaling:** change the plan (`planSku`) or `instanceCount`. With 2 or more instances the health check replaces an unhealthy instance automatically.
- **Rotate the database password:** set the new password on the server, update the Key Vault secrets `database-url` and `database-url-staging`, restart both slots.
- **End all sessions:** delete the row `secret` in `radar_kv`; the app creates a new key and everyone signs in again. A single person: Verwaltung → Neuer Code.
- **Node.js updates:** `linuxFxVersion` in the template (`NODE|22-lts`). Test a new major version on staging first.
- **Key Vault references** show a green check under Web app → Environment variables. If they are red right after the first deployment, the role assignment was still propagating: restart the slot.

## 8. Security

- Secrets only in Key Vault; nothing secret in the repository or in GitHub.
- PostgreSQL without public endpoint (default), TLS enforced. The app verifies the server certificate.
- HTTPS only, TLS 1.2+, HSTS, Content Security Policy (the browser only talks to its own domain), `noindex`, no referrer, no third-party requests (no CDN, no tracking).
- Access codes only as scrypt hashes; signed session tokens (60 days), revocable per person.
- Deployments only through the GitHub identity with rights on this one app; no FTP, no publishing passwords.

Further hardening if required by CWS policy:

- Separate database login with minimal rights instead of the admin login:
  ```sql
  create role radar_app login password '<secret>';
  grant connect on database radar to radar_app;
  -- connected to database radar:
  grant usage, create on schema public to radar_app;
  ```
  Same for `radar_staging` with its own login, then update the Key Vault secrets.
- Private endpoint for Key Vault, Microsoft Defender for App Service, pin GitHub Actions to commit SHAs.

## 9. Configuration reference

| Setting | Slot-sticky | Source | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | Key Vault `database-url` / `database-url-staging` | PostgreSQL connection |
| `RADAR_USERS` | yes | Key Vault `radar-users` | First accounts; their code is valid until a new one is issued in the app |
| `RADAR_SECRET` | yes | optional | Own session key; otherwise created in the database |
| `RADAR_SLOT` | yes | template | `production` / `staging`, shown by `/api/ready` |
| `WEBSITE_RUN_FROM_PACKAGE` | no | template | `1`: run the deployed zip read-only |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | no | template | `false`: no build on the server |
| `WEBSITE_SWAP_WARMUP_PING_PATH` | no | template | `/api/ready` |
| `WEBSITE_SWAP_WARMUP_PING_STATUSES` | no | template | `200` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | no | template | Monitoring |
| `NODE_ENV` | no | template | `production` |

Never set `RADAR_LOCAL` on App Service: it signs everyone in automatically and is only meant for a single computer. `server/azure.mjs` refuses to start with it.

## 10. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Swap fails with a warm-up timeout | The new code cannot reach the production database. Check `DATABASE_URL` (Key Vault reference green?), VNet integration, firewall. Production is unchanged |
| `/api/ready` 503 "Kein Speicher konfiguriert" | `DATABASE_URL` missing or Key Vault reference not resolved |
| `/api/ready` 503 "Datenbank … nicht erreichbar" | Server stopped, network, password changed |
| `permission denied for schema public` | Login without create right: `grant usage, create on schema public to <login>` |
| Pipeline: staging smoke test waits 5 minutes and fails with an old build | The slot did not restart with the new package; check the deployment log of the slot |
| Nobody can sign in | No accounts in this database, or `RADAR_USERS` was removed before the first admin had a code from the app: pass `radarUsers` and run the template again, restart the slot, then issue new codes in Verwaltung |

## 11. Local checks before a change

```bash
npm ci
npm test                                                      # backend tests in memory
RADAR_TEST_DATABASE_URL=postgres://user@localhost/radar_test npm test   # against a throwaway PostgreSQL (the table is emptied)
DATABASE_URL=postgres://user@localhost/radar_dev PORT=8080 npm start   # runs exactly like on App Service
npm run start:local                                           # local server with SQLite on http://localhost:8765
```
