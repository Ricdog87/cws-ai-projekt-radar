// Storage for the radar: one small key-value interface, several drivers.
//   postgres  DATABASE_URL / POSTGRES_URL (Neon, Supabase, Azure PostgreSQL …) – recommended
//   blob      BLOB_READ_WRITE_TOKEN (Vercel Blob; needs a paid plan for daily use)
//   sqlite    local server on this computer (server/server.mjs)
//   memory    tests
//
// Interface (every driver):
//   get(key)                      → { value, version } | null
//   put(key, value, { version })  → new version
//        version undefined: write unconditionally
//        version null:      create only (Conflict if the key exists)
//        version x:         only if the stored version is still x (Conflict otherwise)
//   list(prefix)                  → [{ key, value, version }]
//   keys(prefix)                  → [key]
//   del(key)
// Versions are compared for equality only (numbers or ETags).

export class Conflict extends Error {
  constructor() {
    super("Versionskonflikt");
    this.conflict = true;
  }
}

const KEY_OK = /^[a-z0-9][a-z0-9:._-]{0,150}$/i;
function checkKey(key) {
  if (!KEY_OK.test(String(key))) throw new Error(`Ungültiger Schlüssel: ${key}`);
  return String(key);
}
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export function databaseUrl(env = process.env) {
  return env.DATABASE_URL || env.POSTGRES_URL || env.POSTGRES_PRISMA_URL || "";
}

/** Which driver this environment uses ("" = none configured). */
export function driverName(env = process.env) {
  if (env.RADAR_STORE) return env.RADAR_STORE;
  if (databaseUrl(env)) return "postgres";
  if (env.BLOB_READ_WRITE_TOKEN) return "blob";
  return "";
}

/* ---------------- memory ---------------- */
export function memoryDriver() {
  const m = new Map();
  return {
    name: "memory",
    async get(key) {
      const r = m.get(checkKey(key));
      return r ? { value: clone(r.value), version: r.version } : null;
    },
    async put(key, value, { version } = {}) {
      checkKey(key);
      const cur = m.get(key);
      if (version === null && cur) throw new Conflict();
      if (version !== undefined && version !== null && (!cur || cur.version !== version)) throw new Conflict();
      const next = (cur ? cur.version : 0) + 1;
      m.set(key, { value: clone(value), version: next });
      return next;
    },
    async list(prefix = "") {
      return [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((k) => ({ key: k, value: clone(m.get(k).value), version: m.get(k).version }));
    },
    async keys(prefix = "") {
      return [...m.keys()].filter((k) => k.startsWith(prefix)).sort();
    },
    async del(key) {
      m.delete(checkKey(key));
    },
  };
}

/* ---------------- postgres ---------------- */
const SCHEMA = `create table if not exists radar_kv (
  key text primary key,
  value jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
)`;

/** `query(sql, params) → { rows }` comes from pg.Pool (or any compatible client in tests). */
export function sqlDriver(query, name = "postgres") {
  let ready = null;
  const init = () => (ready ||= query(SCHEMA).catch((e) => { ready = null; throw e; }));
  const like = (prefix) => prefix.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  return {
    name,
    async get(key) {
      await init();
      const { rows } = await query("select value, version from radar_kv where key = $1", [checkKey(key)]);
      return rows[0] ? { value: parse(rows[0].value), version: Number(rows[0].version) } : null;
    },
    async put(key, value, { version } = {}) {
      await init();
      checkKey(key);
      const json = JSON.stringify(value);
      let rows;
      if (version === undefined) {
        ({ rows } = await query(
          `insert into radar_kv (key, value) values ($1, $2::jsonb)
           on conflict (key) do update set value = excluded.value, version = radar_kv.version + 1, updated_at = now()
           returning version`, [key, json]));
      } else if (version === null) {
        ({ rows } = await query("insert into radar_kv (key, value) values ($1, $2::jsonb) on conflict (key) do nothing returning version", [key, json]));
      } else {
        ({ rows } = await query(
          "update radar_kv set value = $2::jsonb, version = version + 1, updated_at = now() where key = $1 and version = $3 returning version",
          [key, json, Number(version)]));
      }
      if (!rows[0]) throw new Conflict();
      return Number(rows[0].version);
    },
    async list(prefix = "") {
      await init();
      const { rows } = await query("select key, value, version from radar_kv where key like $1 escape '\\' order by key", [like(prefix)]);
      return rows.map((r) => ({ key: r.key, value: parse(r.value), version: Number(r.version) }));
    },
    async keys(prefix = "") {
      await init();
      const { rows } = await query("select key from radar_kv where key like $1 escape '\\' order by key", [like(prefix)]);
      return rows.map((r) => r.key);
    },
    async del(key) {
      await init();
      await query("delete from radar_kv where key = $1", [checkKey(key)]);
    },
  };
}
const parse = (v) => (typeof v === "string" ? JSON.parse(v) : v);

async function postgresDriver(env) {
  const { default: pg } = await import("pg");
  const url = new URL(databaseUrl(env));
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname) || url.searchParams.get("sslmode") === "disable";
  for (const k of ["sslmode", "sslrootcert", "sslcert", "sslkey", "channel_binding", "supa", "pgbouncer", "connection_limit"]) url.searchParams.delete(k);
  const pool = new pg.Pool({
    connectionString: url.toString(),
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    ssl: local ? false : { rejectUnauthorized: env.DATABASE_SSL_INSECURE !== "1" },
  });
  pool.on("error", () => { /* idle client dropped by the server; the next query reconnects */ });
  return sqlDriver((sql, params) => pool.query(sql, params), "postgres");
}

/* ---------------- blob ---------------- */
async function blobDriver() {
  const sdk = await import("@vercel/blob");
  const path = (key) => `radar/kv/${checkKey(key).replace(/:/g, "/")}.json`;
  const keyOf = (pathname) => pathname.replace(/^radar\/kv\//, "").replace(/\.json$/, "").replace(/\//g, ":");
  const cache = new Map(); // pathname → { etag, value }: unchanged blobs answer 304 instead of a full download
  const opts = { access: "private", addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 };
  const isConflict = (e) => e instanceof sdk.BlobPreconditionFailedError || /already exists|precondition|412/i.test(String(e && e.message));
  async function read(pathname) {
    const c = cache.get(pathname);
    let r;
    try {
      r = await sdk.get(pathname, { access: "private", useCache: false, ...(c ? { ifNoneMatch: c.etag } : {}) });
    } catch (e) {
      if (e instanceof sdk.BlobNotFoundError || /not found|404/i.test(String(e && e.message))) { cache.delete(pathname); return null; }
      throw e;
    }
    if (!r) { cache.delete(pathname); return null; }
    if (r.statusCode === 304 && c) return { value: clone(c.value), version: c.etag };
    const value = JSON.parse(await new Response(r.stream).text());
    cache.set(pathname, { etag: r.blob.etag, value });
    return { value: clone(value), version: r.blob.etag };
  }
  async function listAll(prefix) {
    const out = [];
    let cursor;
    do {
      const page = await sdk.list({ prefix, limit: 1000, cursor });
      out.push(...(page.blobs || []));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  }
  const blobPrefix = (prefix) => `radar/kv/${prefix.replace(/:/g, "/")}`;
  return {
    name: "blob",
    get: (key) => read(path(key)),
    async put(key, value, { version } = {}) {
      const pathname = path(key);
      try {
        const r = await sdk.put(pathname, JSON.stringify(value), {
          ...opts,
          allowOverwrite: version !== null,
          ...(version !== undefined && version !== null ? { ifMatch: version } : {}),
        });
        cache.set(pathname, { etag: r.etag, value: clone(value) });
        return r.etag;
      } catch (e) {
        if (isConflict(e)) { cache.delete(pathname); throw new Conflict(); }
        throw e;
      }
    },
    async list(prefix = "") {
      const blobs = await listAll(blobPrefix(prefix));
      const out = [];
      for (const b of blobs) {
        const r = await read(b.pathname);
        if (r) out.push({ key: keyOf(b.pathname), ...r });
      }
      return out.sort((a, b) => a.key.localeCompare(b.key));
    },
    async keys(prefix = "") {
      return (await listAll(blobPrefix(prefix))).map((b) => keyOf(b.pathname)).sort();
    },
    async del(key) {
      const pathname = path(key);
      cache.delete(pathname);
      await sdk.del(pathname);
    },
  };
}

/* ---------------- sqlite (local server) ---------------- */
/** Uses node:sqlite's DatabaseSync; same semantics as postgres. */
export function sqliteDriver(dbFile) {
  return import("node:sqlite").then(({ DatabaseSync }) => {
    const db = new DatabaseSync(dbFile);
    db.exec("pragma journal_mode = WAL");
    db.exec("create table if not exists radar_kv (key text primary key, value text not null, version integer not null default 1, updated_at text not null)");
    const q = (sql) => db.prepare(sql);
    const like = (prefix) => prefix.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
    return {
      name: "sqlite",
      raw: db,
      async get(key) {
        const r = q("select value, version from radar_kv where key = ?").get(checkKey(key));
        return r ? { value: JSON.parse(r.value), version: Number(r.version) } : null;
      },
      async put(key, value, { version } = {}) {
        checkKey(key);
        const json = JSON.stringify(value), now = new Date().toISOString();
        let r;
        if (version === undefined) {
          r = q("insert into radar_kv (key, value, version, updated_at) values (?, ?, 1, ?) on conflict (key) do update set value = excluded.value, version = radar_kv.version + 1, updated_at = excluded.updated_at returning version").get(key, json, now);
        } else if (version === null) {
          r = q("insert into radar_kv (key, value, version, updated_at) values (?, ?, 1, ?) on conflict (key) do nothing returning version").get(key, json, now);
        } else {
          r = q("update radar_kv set value = ?, version = version + 1, updated_at = ? where key = ? and version = ? returning version").get(json, now, key, Number(version));
        }
        if (!r) throw new Conflict();
        return Number(r.version);
      },
      async list(prefix = "") {
        return q("select key, value, version from radar_kv where key like ? escape '\\' order by key").all(like(prefix)).map((r) => ({ key: r.key, value: JSON.parse(r.value), version: Number(r.version) }));
      },
      async keys(prefix = "") {
        return q("select key from radar_kv where key like ? escape '\\' order by key").all(like(prefix)).map((r) => r.key);
      },
      async del(key) {
        q("delete from radar_kv where key = ?").run(checkKey(key));
      },
    };
  });
}

/* ---------------- selection ---------------- */
let instance = null;
let pending = null;

/** The storage of this environment, or null when none is configured. */
export async function store(env = process.env) {
  if (instance) return instance;
  const name = driverName(env);
  if (!name) return null;
  pending ||= (async () => {
    if (name === "postgres") return postgresDriver(env);
    if (name === "blob") return blobDriver();
    if (name === "memory") return memoryDriver();
    throw new Error(`Unbekannter Speicher: ${name}`);
  })();
  try {
    instance = await pending;
  } finally {
    pending = null;
  }
  return instance;
}

/** Tests and the local server set the storage themselves. */
export function useStore(driver) {
  instance = driver;
}
