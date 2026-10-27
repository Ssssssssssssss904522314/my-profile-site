const crypto = require("crypto");

function json(res, status, body, extra = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  Object.entries(extra).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body));
}
function cookieValue(req) {
  const raw = req.headers.cookie || "";
  const found = raw.split(";").map(s => s.trim()).find(s => s.startsWith("site_admin="));
  return found ? decodeURIComponent(found.slice("site_admin=".length)) : "";
}
function validSession(req) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const value = cookieValue(req);
  const [expires, sig] = value.split(".");
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  const expected = crypto.createHmac("sha256", secret).update(expires).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch (_) { return false; }
}
async function kv(command, key, value) {
  const base = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!base || !token) throw new Error("KV_NOT_CONFIGURED");
  const url = value === undefined
    ? `${base.replace(/\/$/, "")}/get/${encodeURIComponent(key)}`
    : `${base.replace(/\/$/, "")}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("KV_REQUEST_FAILED");
  const result = await response.json();
  return result.result;
}
function cleanConfig(input) {
  const url = value => {
    try { const u = new URL(String(value || "")); return ["https:", "http:"].includes(u.protocol) ? u.href : ""; }
    catch (_) { return ""; }
  };
  const projects = Array.isArray(input.projects) ? input.projects.slice(0, 12).map((p, i) => ({
    id: String(p.id || `custom-${i}`).slice(0, 40),
    title: String(p.title || "Новый проект").slice(0, 100),
    text: String(p.text || "").slice(0, 600),
    deleted: !!p.deleted
  })) : undefined;
  return {
    headline: String(input.headline || "Создаю идеи. Запускаю проекты.").slice(0, 120),
    intro: String(input.intro || "").slice(0, 600),
    telegram: url(input.telegram),
    github: url(input.github),
    aboutTitle: String(input.aboutTitle || "Люблю создавать новое").slice(0, 100),
    aboutText: String(input.aboutText || "").slice(0, 1000),
    quote: String(input.quote || "Большие проекты начинаются с маленькой идеи.").slice(0, 200),
    deleted: {
      about: !!(input.deleted && input.deleted.about),
      quote: !!(input.deleted && input.deleted.quote)
    },
    ...(projects ? { projects } : {})
  };
}
module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
  let body = {};
  try { body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}"); }
  catch (_) { return json(res, 400, { error: "INVALID_JSON" }); }

  if (body.action === "login") {
    if (!process.env.ADMIN_CODE || !process.env.ADMIN_SESSION_SECRET) {
      return json(res, 503, { error: "ADMIN_ENV_MISSING", message: "Добавь ADMIN_CODE и ADMIN_SESSION_SECRET в Vercel." });
    }
    const supplied = String(body.code || "");
    const expected = String(process.env.ADMIN_CODE);
    const a = Buffer.from(supplied), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return json(res, 401, { error: "BAD_CODE" });
    const expires = String(Date.now() + 2 * 60 * 60 * 1000);
    const sig = crypto.createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(expires).digest("hex");
    return json(res, 200, { ok: true }, { "Set-Cookie": `site_admin=${expires}.${sig}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=7200` });
  }

  if (!validSession(req)) return json(res, 401, { error: "UNAUTHORIZED" });
  try {
    if (body.action === "logout") {
      return json(res, 200, { ok: true }, { "Set-Cookie": "site_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" });
    }
    if (body.action === "reset") {
      const base = process.env.KV_REST_API_URL;
      const token = process.env.KV_REST_API_TOKEN;
      if (base && token) await fetch(`${base.replace(/\/$/, "")}/del/site-config`, { headers: { Authorization: `Bearer ${token}` } });
      return json(res, 200, { ok: true });
    }
    if (body.action === "save") {
      const config = cleanConfig(body.config || {});
      await kv("set", "site-config", JSON.stringify(config));
      return json(res, 200, { ok: true, config });
    }
    return json(res, 400, { error: "UNKNOWN_ACTION" });
  } catch (e) {
    const missing = e && e.message === "KV_NOT_CONFIGURED";
    return json(res, missing ? 503 : 500, { error: missing ? "KV_NOT_CONFIGURED" : "STORAGE_ERROR", message: missing ? "Добавь KV_REST_API_URL и KV_REST_API_TOKEN в Vercel." : "Не удалось обратиться к хранилищу." });
  }
};