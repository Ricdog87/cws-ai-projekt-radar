import { authenticate, authEnabled, publicUsers } from "./_lib/users.js";

export default function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (!authEnabled()) {
    res.status(503).json({ error: "Kein Benutzerkonto ist eingerichtet." });
    return;
  }
  if (req.method === "GET") {
    res.status(200).json({ users: publicUsers() });
    return;
  }
  if (req.method === "POST") {
    const user = authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Zugangscode fehlt oder passt nicht." });
      return;
    }
    res.status(200).json({ user, users: publicUsers() });
    return;
  }
  res.setHeader("allow", "GET, POST");
  res.status(405).json({ error: "Methode nicht erlaubt." });
}
