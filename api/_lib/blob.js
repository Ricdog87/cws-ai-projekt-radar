import { del, get, put } from "@vercel/blob";

const STATE = "radar/state.json";
const HISTORY = "radar/history";
const KEEP = 40;

export function emptyDoc() {
  return {
    rev: 0,
    updatedAt: null,
    projects: [],
    requests: [],
    meta: { me: { name: "", role: "" }, team: [] },
  };
}

export async function readDoc() {
  try {
    const result = await get(STATE, { access: "private", abortCache: true });
    if (!result || result.statusCode === 404 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    const doc = JSON.parse(text);
    if (!doc || typeof doc !== "object" || !Array.isArray(doc.projects)) return null;
    return {
      rev: Number(doc.rev) || 0,
      updatedAt: doc.updatedAt || null,
      projects: Array.isArray(doc.projects) ? doc.projects : [],
      requests: Array.isArray(doc.requests) ? doc.requests : [],
      meta: doc.meta && typeof doc.meta === "object" ? doc.meta : emptyDoc().meta,
    };
  } catch (err) {
    const code = err && (err.statusCode || err.status);
    const msg = String((err && err.message) || err || "");
    if (code === 404 || /not found|404/i.test(msg)) return null;
    throw err;
  }
}

export async function writeDoc(doc) {
  const body = JSON.stringify(doc);
  await put(STATE, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
  const name = `${HISTORY}/${String(doc.rev).padStart(6, "0")}.json`;
  try {
    await put(name, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    if (doc.rev > KEEP) await del(`${HISTORY}/${String(doc.rev - KEEP).padStart(6, "0")}.json`);
  } catch {
    /* history is best-effort */
  }
}
