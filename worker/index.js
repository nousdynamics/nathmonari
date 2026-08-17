/**
 * Worker: rewrites de rotas amigáveis → arquivos HTML em public/
 * Config: /data/routes.json (editável pelo painel em /xp-pan-adm)
 *
 * Auth do painel: Cloudflare Access (Zero Trust).
 * O Access fica na frente da rota e injeta o header Cf-Access-Jwt-Assertion;
 * aqui o JWT é validado (assinatura + aud + iss + exp) e o e-mail é conferido
 * contra a allowlist. Veja docs/cloudflare-access.md para configurar.
 *
 * Vars (wrangler.jsonc): ACCESS_TEAM_DOMAIN, ACCESS_AUD,
 *                        ACCESS_ALLOWED_DOMAINS, ACCESS_ALLOWED_EMAILS
 * Local: copie .dev.vars.example → .dev.vars (ACCESS_DEV_BYPASS=1)
 */

const ADMIN_PATH = "/xp-pan-adm";

const ROUTES_CACHE_TTL_MS = 30_000;
let routesCache = { loadedAt: 0, pages: [] };

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;
const jwksCache = new Map(); // teamDomain -> { loadedAt, keys }

/* ---------------------------------------------------------------- config */

function teamDomain(env) {
  const raw = String(env.ACCESS_TEAM_DOMAIN || "").trim().toLowerCase();
  if (!raw) return null;
  return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/\.cloudflareaccess\.com$/, "");
}

function accessConfig(env) {
  const team = teamDomain(env);
  const aud = String(env.ACCESS_AUD || "").trim();
  if (!team || !aud) return null;
  return {
    team,
    aud,
    issuer: `https://${team}.cloudflareaccess.com`,
    certsUrl: `https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`,
    logoutUrl: `https://${team}.cloudflareaccess.com/cdn-cgi/access/logout`,
    domains: splitList(env.ACCESS_ALLOWED_DOMAINS),
    emails: splitList(env.ACCESS_ALLOWED_EMAILS),
  };
}

function splitList(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

function isDevBypass(env, url) {
  if (String(env.ACCESS_DEV_BYPASS || "") !== "1") return false;
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

/* ------------------------------------------------------------------ util */

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
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

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders({}))) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function base64UrlToBytes(input) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64UrlToJson(input) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(input)));
}

/* ----------------------------------------------------------- access auth */

async function loadJwks(config) {
  const now = Date.now();
  const cached = jwksCache.get(config.team);
  if (cached && now - cached.loadedAt < JWKS_CACHE_TTL_MS) return cached.keys;

  const res = await fetch(config.certsUrl, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) {
    if (cached) return cached.keys;
    throw new Error(`JWKS ${res.status}`);
  }
  const data = await res.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  jwksCache.set(config.team, { loadedAt: now, keys });
  return keys;
}

async function importJwk(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

/**
 * Valida o JWT do Access. Retorna o payload ou null.
 */
async function verifyAccessJwt(token, config) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let header;
  let payload;
  try {
    header = base64UrlToJson(parts[0]);
    payload = base64UrlToJson(parts[1]);
  } catch {
    return null;
  }
  if (header.alg !== "RS256") return null;

  let keys;
  try {
    keys = await loadJwks(config);
  } catch {
    return null;
  }
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;

  const signed = new TextEncoder().encode(parts[0] + "." + parts[1]);
  let key;
  try {
    key = await importJwk(jwk);
  } catch {
    return null;
  }
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlToBytes(parts[2]), signed);
  if (!valid) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || nowSec >= payload.exp) return null;
  if (typeof payload.nbf === "number" && nowSec + 60 < payload.nbf) return null;
  if (payload.iss !== config.issuer) return null;

  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(config.aud)) return null;

  return payload;
}

/**
 * Allowlist: domínios liberados + e-mails individuais.
 * Sem allowlist configurada, confia na policy do Access.
 */
function emailAllowed(email, config) {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  if (!config.domains.length && !config.emails.length) return true;
  if (config.emails.includes(normalized)) return true;
  const domain = normalized.split("@")[1];
  return Boolean(domain) && config.domains.includes(domain);
}

/**
 * → { ok: true, identity } | { ok: false, status, message }
 */
async function authenticate(request, env, url) {
  if (isDevBypass(env, url)) {
    return { ok: true, identity: { email: "dev@localhost", dev: true } };
  }

  const config = accessConfig(env);
  if (!config) {
    return {
      ok: false,
      status: 503,
      message: "Painel não configurado. Defina ACCESS_TEAM_DOMAIN e ACCESS_AUD no wrangler.jsonc.",
    };
  }

  const token =
    request.headers.get("Cf-Access-Jwt-Assertion") || getCookie(request, "CF_Authorization");
  const payload = await verifyAccessJwt(token, config);
  if (!payload) {
    return {
      ok: false,
      status: 401,
      message: "Sessão do Cloudflare Access inválida ou expirada. Recarregue a página para entrar.",
      config,
    };
  }

  const email = payload.email || payload.common_name || "";
  if (!emailAllowed(email, config)) {
    return { ok: false, status: 403, message: `Conta ${email} sem permissão para este painel.`, config };
  }

  return { ok: true, identity: { email, sub: payload.sub, exp: payload.exp }, config };
}

function denyResponse(auth, url) {
  const body = {
    ok: false,
    message: auth.message,
    loginUrl: auth.config ? accessLoginUrl(auth.config, url) : null,
  };
  return Response.json(body, {
    status: auth.status,
    headers: securityHeaders({ "Content-Type": "application/json" }),
  });
}

function accessLoginUrl(config, url) {
  return `https://${config.team}.cloudflareaccess.com/cdn-cgi/access/login/${url.hostname}?redirect_url=${encodeURIComponent(url.pathname + url.search)}`;
}

/* ---------------------------------------------------------------- routes */

function isAdminProtectedPath(pathname) {
  const p = normalizePath(pathname);
  return p === ADMIN_PATH || p.startsWith(ADMIN_PATH + "/");
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

/**
 * Converte o "file" de routes.json no caminho que o asset layer aceita.
 * Com html_handling "auto-trailing-slash", pedir "/x.html" devolve um 307 para
 * "/x" — então normalizamos antes de buscar.
 */
function assetPathFor(file) {
  const path = "/" + String(file).replace(/^\/+/, "");
  if (path.endsWith("/index.html")) return path.slice(0, -"index.html".length);
  if (path.endsWith(".html")) return path.slice(0, -".html".length);
  return path;
}

/**
 * Busca um asset seguindo um eventual redirect interno do asset layer.
 */
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

/* ----------------------------------------------------------------- fetch */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return Response.redirect(new URL(ADMIN_PATH, url.origin), 302);
    }

    // Login/logout antigos: quem manda agora é o Access.
    if (url.pathname === "/api/admin/login" || url.pathname === "/api/admin/logout") {
      const config = accessConfig(env);
      return Response.json(
        {
          ok: false,
          message: "Login por senha foi removido. O acesso ao painel é pelo Cloudflare Access.",
          logoutUrl: config ? config.logoutUrl : null,
        },
        { status: 410, headers: securityHeaders({ "Content-Type": "application/json" }) }
      );
    }

    // Identidade do usuário logado (usada pelo painel no header/Sair).
    if (url.pathname === "/api/admin/me") {
      const auth = await authenticate(request, env, url);
      if (!auth.ok) return denyResponse(auth, url);
      return Response.json(
        { ok: true, email: auth.identity.email, logoutUrl: auth.config ? auth.config.logoutUrl : null },
        { headers: securityHeaders({ "Content-Type": "application/json" }) }
      );
    }

    if (isAdminProtectedPath(url.pathname)) {
      const auth = await authenticate(request, env, url);
      if (!auth.ok) {
        // Sem JWT válido: manda pro fluxo de login do Access em vez de JSON.
        if (auth.status === 401 && auth.config) {
          return Response.redirect(accessLoginUrl(auth.config, url), 302);
        }
        return new Response(auth.message, {
          status: auth.status,
          headers: securityHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
        });
      }

      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.ok) return withSecurityHeaders(assetRes);
      return assetRes;
    }

    const pages = await loadRoutes(env);

    if (url.pathname === "/api/routes" && request.method === "GET") {
      return Response.json({ pages });
    }

    if (url.pathname === "/api/routes" && request.method === "PUT") {
      const auth = await authenticate(request, env, url);
      if (!auth.ok) return denyResponse(auth, url);
      return Response.json(
        { ok: false, message: "Salve routes.json no repositório e faça deploy. Use o painel para exportar o JSON." },
        { status: 501, headers: securityHeaders({ "Content-Type": "application/json" }) }
      );
    }

    const match = findRoute(pages, url.pathname);
    if (match?.file) {
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

    // not_found_handling é "none", então o 404 amigável sai daqui.
    return notFoundResponse(env, url);
  },
};
