/**
 * Worker: rewrites de rotas amigáveis → arquivos HTML em public/
 * Config: /data/routes.json (visualizado pelo painel em /xp-pan-adm)
 *
 * Auth do painel: usuário + senha, validados no servidor.
 * As senhas NUNCA saem do Worker. O que fica guardado é só um hash
 * PBKDF2-SHA256 com salt por usuário — nem o secret store tem a senha.
 *
 * Secrets (produção):
 *   wrangler secret put PANEL_USERS     # user:iter:salt:hash;user2:...
 *   wrangler secret put SESSION_SECRET  # 64 hex aleatórios
 * Local: .dev.vars
 */

const ADMIN_PATH = "/xp-pan-adm";
const ADMIN_LOGIN_PATH = ADMIN_PATH + "/login.html";
const SESSION_COOKIE = "nm_painel";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 6;

const ROUTES_CACHE_TTL_MS = 30_000;
let routesCache = { loadedAt: 0, pages: [] };
const loginAttempts = new Map();

/* ------------------------------------------------------------------ util */

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function getClientIp(request) {
  var fwd = request.headers.get("X-Forwarded-For");
  return (
    request.headers.get("CF-Connecting-IP") ||
    (fwd ? fwd.split(",")[0].trim() : "") ||
    "unknown"
  );
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function cookieAttrs(url, maxAge) {
  const parts = ["Path=/", "HttpOnly", "SameSite=Strict"];
  parts.push("Max-Age=" + (maxAge === 0 ? "0" : String(Math.floor(maxAge / 1000))));
  if (url.protocol === "https:") parts.push("Secure");
  return parts.join("; ");
}

/** Cabeçalhos do painel: sem cache, sem indexação, sem embed de terceiros. */
function securityHeaders(extra) {
  return Object.assign(
    {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
      "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data:; style-src 'self'; " +
        "script-src 'self'; font-src 'self'; connect-src 'self'; " +
        "form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
    extra || {}
  );
}

function jsonResponse(body, status, extra) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: securityHeaders(Object.assign({ "Content-Type": "application/json" }, extra || {})),
  });
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function hexToBytes(hex) {
  const clean = String(hex || "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(buf) {
  const arr = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, "0");
  return s;
}

/* ----------------------------------------------------------- credenciais */

/** PANEL_USERS = "user:iteracoes:saltHex:hashHex;user2:..." */
function parseUsers(env) {
  const raw = String(env.PANEL_USERS || "").trim();
  if (!raw) return [];
  const out = [];
  raw.split(";").forEach(function (entry) {
    const parts = entry.trim().split(":");
    if (parts.length !== 4) return;
    if (!parts[0] || !parts[1] || !parts[2] || !parts[3]) return;
    out.push({ user: parts[0], iterations: Number(parts[1]), salt: parts[2], hash: parts[3] });
  });
  return out;
}

function panelConfig(env) {
  const users = parseUsers(env);
  const secret = String(env.SESSION_SECRET || "");
  if (!users.length || !secret) return null;
  return { users: users, secret: secret };
}

async function pbkdf2Hex(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: iterations, hash: "SHA-256" },
    key,
    256
  );
  return bytesToHex(bits);
}

/**
 * Confere usuário e senha. Sempre roda um PBKDF2, mesmo com usuário
 * inexistente, para não vazar quais logins existem pelo tempo de resposta.
 */
async function checkCredentials(username, password, config) {
  const nome = String(username || "");
  let alvo = null;
  for (let i = 0; i < config.users.length; i++) {
    if (config.users[i].user === nome) alvo = config.users[i];
  }
  const falso = {
    user: "",
    iterations: config.users[0].iterations,
    salt: config.users[0].salt,
    hash: "0".repeat(64),
  };
  const usado = alvo || falso;
  const derivado = await pbkdf2Hex(String(password || ""), usado.salt, usado.iterations);
  return timingSafeEqual(derivado, usado.hash) ? usado.user : null;
}

/* ------------------------------------------------------------ rate limit */

function isRateLimited(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 0, windowStart: now });
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
}

/* ---------------------------------------------------------------- sessão */

async function hmacSign(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToHex(sig);
}

async function createSession(user, secret) {
  const payload = user + ":" + (Date.now() + SESSION_TTL_MS);
  const sig = await hmacSign(payload, secret);
  return btoa(payload) + "." + sig;
}

async function readSession(token, secret) {
  if (!token || token.indexOf(".") === -1) return null;
  const dot = token.lastIndexOf(".");
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload;
  try {
    payload = atob(payloadB64);
  } catch (e) {
    return null;
  }
  const esperado = await hmacSign(payload, secret);
  if (!timingSafeEqual(sig, esperado)) return null;
  const sep = payload.lastIndexOf(":");
  const exp = Number(payload.slice(sep + 1));
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return payload.slice(0, sep);
}

async function currentUser(request, env) {
  const config = panelConfig(env);
  if (!config) return null;
  return readSession(getCookie(request, SESSION_COOKIE), config.secret);
}

/* ----------------------------------------------------------------- rotas */

function isAdminLoginPath(pathname) {
  const p = normalizePath(pathname);
  return p === normalizePath(ADMIN_LOGIN_PATH) || p === ADMIN_PATH + "/login";
}

function isAdminProtectedPath(pathname) {
  const p = normalizePath(pathname);
  if (isAdminLoginPath(pathname)) return false;
  return p === ADMIN_PATH || p.indexOf(ADMIN_PATH + "/") === 0;
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
  return pages.find(function (p) {
    return normalizePath(p.path) === path;
  });
}

/**
 * Converte o "file" de routes.json no caminho que o asset layer aceita.
 * Com html_handling "auto-trailing-slash", pedir "/x.html" devolve um 307.
 */
function assetPathFor(file) {
  const path = "/" + String(file).replace(/^\/+/, "");
  if (path.endsWith("/index.html")) return path.slice(0, -"index.html".length);
  if (path.endsWith(".html")) return path.slice(0, -".html".length);
  return path;
}

async function fetchAsset(env, request, origin, path) {
  const res = await env.ASSETS.fetch(new Request(new URL(path, origin).toString(), request));
  if (res.status < 300 || res.status >= 400) return res;
  const location = res.headers.get("Location");
  if (!location) return res;
  const next = new URL(location, origin);
  if (next.origin !== new URL(origin).origin) return res;
  return env.ASSETS.fetch(new Request(next.toString(), request));
}

async function notFoundResponse(env, url) {
  const res = await env.ASSETS.fetch(new URL("/404.html", url.origin));
  if (!res.ok) return new Response("Not found", { status: 404 });
  const headers = new Headers(res.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(res.body, { status: 404, headers });
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  const extra = securityHeaders({});
  Object.keys(extra).forEach(function (k) {
    headers.set(k, extra[k]);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers,
  });
}

function naoConfigurado() {
  return jsonResponse(
    { ok: false, message: "Painel não configurado. Defina PANEL_USERS e SESSION_SECRET." },
    503
  );
}

/* ----------------------------------------------------------------- fetch */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const config = panelConfig(env);

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return Response.redirect(new URL(ADMIN_PATH, url.origin), 302);
    }

    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      if (!config) return naoConfigurado();

      const ip = getClientIp(request);
      if (isRateLimited(ip)) {
        return jsonResponse({ ok: false, message: "Muitas tentativas. Aguarde 15 minutos." }, 429, {
          "Retry-After": "900",
        });
      }

      let body;
      try {
        body = await request.json();
      } catch (e) {
        return jsonResponse({ ok: false, message: "Requisição inválida." }, 400);
      }

      const user = await checkCredentials(body.username, body.password, config);
      if (!user) {
        recordFailure(ip);
        return jsonResponse({ ok: false, message: "Usuário ou senha incorretos." }, 401);
      }

      loginAttempts.delete(ip);
      const token = await createSession(user, config.secret);
      return jsonResponse({ ok: true }, 200, {
        "Set-Cookie":
          SESSION_COOKIE + "=" + encodeURIComponent(token) + "; " + cookieAttrs(url, SESSION_TTL_MS),
      });
    }

    if (url.pathname === "/api/admin/logout" && request.method === "POST") {
      return jsonResponse({ ok: true }, 200, {
        "Set-Cookie": SESSION_COOKIE + "=; " + cookieAttrs(url, 0),
      });
    }

    if (url.pathname === "/api/admin/me") {
      const user = await currentUser(request, env);
      if (!user) return jsonResponse({ ok: false, message: "Sessão expirada." }, 401);
      return jsonResponse({ ok: true, user: user }, 200);
    }

    if (isAdminLoginPath(url.pathname)) {
      if (await currentUser(request, env)) {
        return Response.redirect(new URL(ADMIN_PATH + "/", url.origin), 302);
      }
      const res = await fetchAsset(env, request, url.origin, ADMIN_LOGIN_PATH);
      return res.ok ? withSecurityHeaders(res) : res;
    }

    if (isAdminProtectedPath(url.pathname)) {
      if (!config) return naoConfigurado();
      const user = await currentUser(request, env);
      if (!user) return Response.redirect(new URL(ADMIN_LOGIN_PATH, url.origin), 302);
      const assetRes = await env.ASSETS.fetch(request);
      return assetRes.ok ? withSecurityHeaders(assetRes) : assetRes;
    }

    const pages = await loadRoutes(env);

    if (url.pathname === "/api/routes" && request.method === "GET") {
      const user = await currentUser(request, env);
      if (!user) return jsonResponse({ ok: false, message: "Não autorizado." }, 401);
      return jsonResponse({ pages: pages }, 200);
    }

    const match = findRoute(pages, url.pathname);
    if (match && match.file) {
      const res = await fetchAsset(env, request, url.origin, assetPathFor(match.file));
      if (res.ok) return res;
    }

    const bare = normalizePath(url.pathname);
    if (bare !== "/") {
      const dirRes = await fetchAsset(env, request, url.origin, bare + "/");
      if (dirRes.ok) return dirRes;
    }

    const assetRes = await env.ASSETS.fetch(request);
    if (assetRes.status !== 404) return assetRes;
    return notFoundResponse(env, url);
  },
};
