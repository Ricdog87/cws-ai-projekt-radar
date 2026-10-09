import { authEnabled } from "./_lib/users.js";

export default function handler(_req, res) {
  res.setHeader("cache-control", "no-store");
  res.status(200).json({
    ok: true,
    storage: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    auth: authEnabled(),
  });
}
