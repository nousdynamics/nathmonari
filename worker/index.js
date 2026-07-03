/**
 * Worker: rewrites de rotas amigáveis → arquivos HTML em public/
 * Config: /data/routes.json (editável pelo painel em /xp-pan-adm)
 *
 * Secrets (produção): wrangler secret put ADMIN_USER | ADMIN_PASS | SESSION_SECRET
 * Local: copie .dev.vars.example → .dev.vars
 */

const ADMIN_PATH = "/xp-pan-adm";
const ADMIN_LOGIN_PATH = `${ADMIN_PATH}/login.html`;
const SESSION_COOKIE = "nm_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

const ROUTES_CACHE_TTL_MS = 30_000;
let routesCache = { loadedAt: 0, pages: [] };
const loginAttempts = new Map();

function adminConfig(env) {
  const user = env.ADMIN_USER;
  const pass = env.ADMIN_PASS;
  const secret = env.SESSION_SECRET;
  if (!user || !pass || !secret) return null;
  return { user, pass, secret };
}

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function isLoginRateLimited(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 0, windowStart: now });
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function credentialsMatch(body, config) {
  return timingSafeEqual(String(body.username || ""), config.user) && timingSafeEqual(String(body.password || ""), config.pass);
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function cookieAttrs(url, maxAge) {
  const parts = ["Path=/", "HttpOnly", "SameSite=Strict"];
  if (maxAge === 0) {
    parts.push("Max-Age=0");
  } else {
    parts.push("Max-Age=" + String(Math.floor(maxAge / 1000)));
  }
  if (url.protocol === "https:") parts.push("Secure");
  return parts.join("; ");
}

function securityHeaders(extra) {
  return {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    ...extra,
  };
}

async function hmacSign(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createSession(user, secret) {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = user + ":" + exp;
  const sig = await hmacSign(payload, secret);
  return btoa(payload) + "." + sig;
}

async function verifySession(token, secret) {
  if (!token || !token.includes(".")) return false;
  const dot = token.lastIndexOf(".");
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload;
  try {
    payload = atob(payloadB64);
  } catch {
    return false;
  }
  const expected = await hmacSign(payload, secret);
  if (!timingSafeEqual(sig, expected)) return false;
  const parts = payload.split(":");
  const exp = Number(parts[parts.length - 1]);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

async function isAuthenticated(request, env) {
  const config = adminConfig(env);
  if (!config) return false;
  const token = getCookie(request, SESSION_COOKIE);
  return verifySession(token, config.secret);
}

function isAdminLoginPath(pathname) {
  const p = normalizePath(pathname);
  return p === normalizePath(ADMIN_LOGIN_PATH) || p === ADMIN_PATH + "/login";
}

function isAdminProtectedPath(pathname) {
  const p = normalizePath(pathname);
  if (p === ADMIN_PATH) return true;
  if (p.startsWith(ADMIN_PATH + "/") && !isAdminLoginPath(pathname)) return true;
  return false;
}

function redirectToLogin(url) {
  return Response.redirect(new URL(ADMIN_LOGIN_PATH, url.origin), 302);
}

function adminNotConfiguredResponse() {
  return Response.json(
    { ok: false, message: "Painel não configurado. Defina ADMIN_USER, ADMIN_PASS e SESSION_SECRET." },
    { status: 503, headers: securityHeaders({ "Content-Type": "application/json" }) }
  );
}

async function loadRoutes(env) {
  const now = Date.now();
  if (routesCache.pages.length && now - routesCache.loadedAt < ROUTES_CACHE_TTL_MS) {
    return routesCache.pages;
  }
  const res = await env.ASSETS.fetch(new URL("/data/routes.json", "https://assets.local/"));
  if (!res.ok) return routesCache.pages;
  const data = await res.json();
  routesCache = { loadedAt: now, pages: Array.isArray(data.pages) ? data.pages : [] };
  return routesCache.pages;
}

function findRoute(pages, pathname) {
  const path = normalizePath(pathname);
  return pages.find((p) => normalizePath(p.path) === path);
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders({}))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const config = adminConfig(env);

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return Response.redirect(new URL(ADMIN_PATH, url.origin), 302);
    }

    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      if (!config) return adminNotConfiguredResponse();

      const ip = getClientIp(request);
      if (isLoginRateLimited(ip)) {
        return Response.json(
          { ok: false, message: "Muitas tentativas. Aguarde alguns minutos." },
          { status: 429, headers: securityHeaders({ "Content-Type": "application/json", "Retry-After": "900" }) }
        );
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json(
          { ok: false, message: "JSON inválido." },
          { status: 400, headers: securityHeaders({ "Content-Type": "application/json" }) }
        );
      }

      if (!credentialsMatch(body, config)) {
        recordFailedLogin(ip);
        return Response.json(
          { ok: false, message: "Usuário ou senha incorretos." },
          { status: 401, headers: securityHeaders({ "Content-Type": "application/json" }) }
        );
      }

      clearLoginAttempts(ip);
      const token = await createSession(config.user, config.secret);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: securityHeaders({
          "Content-Type": "application/json",
          "Set-Cookie": SESSION_COOKIE + "=" + encodeURIComponent(token) + "; " + cookieAttrs(url, SESSION_TTL_MS),
        }),
      });
    }

    if (url.pathname === "/api/admin/logout" && request.method === "POST") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: securityHeaders({
          "Content-Type": "application/json",
          "Set-Cookie": SESSION_COOKIE + "=; " + cookieAttrs(url, 0),
        }),
      });
    }

    if (isAdminProtectedPath(url.pathname)) {
      if (!config) return adminNotConfiguredResponse();
      const authed = await isAuthenticated(request, env);
      if (!authed) return redirectToLogin(url);

      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.ok) return withSecurityHeaders(assetRes);
      return assetRes;
    }

    const pages = await loadRoutes(env);

    if (url.pathname === "/api/routes" && request.method === "GET") {
      return Response.json({ pages });
    }

    if (url.pathname === "/api/routes" && request.method === "PUT") {
      if (!config) return adminNotConfiguredResponse();
      const authed = await isAuthenticated(request, env);
      if (!authed) {
        return Response.json(
          { ok: false, message: "Não autorizado." },
          { status: 401, headers: securityHeaders({ "Content-Type": "application/json" }) }
        );
      }
      return Response.json(
        { ok: false, message: "Salve routes.json no repositório e faça deploy. Use o painel para exportar o JSON." },
        { status: 501, headers: securityHeaders({ "Content-Type": "application/json" }) }
      );
    }

    const match = findRoute(pages, url.pathname);
    if (match?.file) {
      const assetPath = "/" + match.file.replace(/^\//, "");
      const assetUrl = new URL(assetPath, url.origin);
      const res = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
      if (res.ok) return res;
    }

    const bare = normalizePath(url.pathname);
    if (bare !== "/") {
      const dirIndex = new URL(bare + "/index.html", url.origin);
      const dirRes = await env.ASSETS.fetch(new Request(dirIndex.toString(), request));
      if (dirRes.ok) return dirRes;
    }

    return env.ASSETS.fetch(request);
  },
};
