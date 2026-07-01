/**
 * Worker: rewrites de rotas amigáveis → arquivos HTML em public/
 * Config: /data/routes.json (editável pelo painel em /admin/)
 */

const ROUTES_CACHE_TTL_MS = 30_000;
let routesCache = { loadedAt: 0, pages: [] };

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pages = await loadRoutes(env);

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return env.ASSETS.fetch(new URL("/admin/index.html", url.origin));
    }

    if (url.pathname === "/api/routes" && request.method === "GET") {
      return Response.json({ pages });
    }

    if (url.pathname === "/api/routes" && request.method === "PUT") {
      return Response.json(
        { ok: false, message: "Salve routes.json no repositório e faça deploy. Use o painel para exportar o JSON." },
        { status: 501 }
      );
    }

    const match = findRoute(pages, url.pathname);
    if (match?.file) {
      const assetUrl = new URL("/" + match.file.replace(/^\//, ""), url.origin);
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    return env.ASSETS.fetch(request);
  },
};
