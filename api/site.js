module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.statusCode = 405; res.setHeader("Allow", "GET"); return res.end(JSON.stringify({ error: "METHOD_NOT_ALLOWED" })); }
  const base = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!base || !token) { res.statusCode = 503; return res.end(JSON.stringify({ error: "STORAGE_NOT_CONFIGURED" })); }
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/get/site-config`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("KV");
    const data = await response.json();
    if (!data.result) return res.end(JSON.stringify({ config: null }));
    try { return res.end(JSON.stringify({ config: JSON.parse(data.result) })); }
    catch (_) { return res.end(JSON.stringify({ config: null })); }
  } catch (_) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "STORAGE_ERROR" }));
  }
};