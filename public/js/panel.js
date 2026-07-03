(function () {
  var RECONSTRUA = [
    { id: "rc-sem-vsl", label: "Reconstrua-se sem VSL", file: "vendas-rc-v3.html" },
    { id: "rc-vsl", label: "Reconstrua-se com VSL", file: "vendas-rc-v3-vsl.html" },
  ];

  var pagesEl = document.getElementById("panel-pages");
  var clonesEl = document.getElementById("panel-clones");
  var routesEl = document.getElementById("panel-routes");
  var statusEl = document.getElementById("panel-status");
  var previewEl = document.getElementById("panel-preview");
  var pages = [];

  function uid() {
    return "page-" + Math.random().toString(36).slice(2, 9);
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function showStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = "panel-msg " + (type || "ok");
  }

  function cardHtml(title, file, href, hrefLabel) {
    return (
      '<article class="page-card">' +
      '<h3 class="page-card-titulo">' + esc(title) + "</h3>" +
      '<p class="page-card-meta">Arquivo: <code>' + esc(file) + "</code></p>" +
      '<div class="page-card-acoes">' +
      '<a class="btn btn-prim" href="' + esc(href) + '" target="_blank" rel="noopener">' +
      esc(hrefLabel || "Abrir página") +
      "</a></div></article>"
    );
  }

  function renderPages() {
    pagesEl.innerHTML = RECONSTRUA.map(function (p) {
      return cardHtml(p.label, p.file, p.file, "Abrir página");
    }).join("");
  }

  function renderClones() {
    var clones = pages.filter(function (p) {
      return p.id !== "reconstrua-sem-vsl" && p.id !== "reconstrua-vsl";
    });
    if (!clones.length) {
      clonesEl.innerHTML =
        '<p class="page-card-meta">Nenhum clone configurado em <code>routes.json</code>.</p>';
      return;
    }
    clonesEl.innerHTML = clones
      .map(function (p) {
        var path = (p.path || "/").replace(/\/$/, "") || "/";
        var staticPath = p.file ? p.file.replace(/index\.html$/, "") : path.slice(1) + "/";
        return cardHtml(p.label, p.file, "/" + staticPath.replace(/^\//, ""), "Abrir página");
      })
      .join("");
  }

  function renderRoutes() {
    routesEl.innerHTML = "";
    pages.forEach(function (p, i) {
      var card = document.createElement("div");
      card.className = "route-card";
      card.innerHTML =
        '<div class="route-card-head">Rota ' + (i + 1) + "</div>" +
        '<label>Nome no painel</label><input data-k="label" data-i="' + i + '" value="' + esc(p.label) + '">' +
        '<label>Arquivo (em public/)</label><input data-k="file" data-i="' + i + '" value="' + esc(p.file) + '">' +
        '<label>URL pública</label><input data-k="path" data-i="' + i + '" value="' + esc(p.path) + '">' +
        '<button type="button" class="btn btn-danger" data-remove="' + i + '">Remover rota</button>';
      routesEl.appendChild(card);
    });

    routesEl.querySelectorAll("input").forEach(function (input) {
      input.addEventListener("input", function () {
        var idx = +input.dataset.i;
        pages[idx][input.dataset.k] = input.value;
        updatePreview();
        renderClones();
      });
    });

    routesEl.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        pages.splice(+btn.dataset.remove, 1);
        renderRoutes();
        renderClones();
      });
    });

    updatePreview();
  }

  function updatePreview() {
    previewEl.textContent = JSON.stringify({ pages: pages }, null, 2);
  }

  function load() {
    fetch("/data/routes.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        pages = (data.pages || []).map(function (p) {
          return {
            id: p.id || uid(),
            label: p.label || "",
            file: p.file || "",
            path: p.path || "/",
          };
        });
        renderPages();
        renderClones();
        renderRoutes();
        previewEl.hidden = false;
      })
      .catch(function (err) {
        showStatus("Erro ao carregar routes.json: " + err.message, "warn");
        renderPages();
      });
  }

  document.getElementById("add-route").addEventListener("click", function () {
    pages.push({ id: uid(), label: "Nova página", file: "pagina.html", path: "/nova-pagina" });
    renderRoutes();
    renderClones();
  });

  document.getElementById("export-routes").addEventListener("click", function () {
    var json = JSON.stringify({ pages: pages }, null, 2) + "\n";
    var blob = new Blob([json], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "routes.json";
    a.click();
    URL.revokeObjectURL(a.href);
    showStatus("routes.json exportado. Substitua public/data/routes.json e faça deploy.", "ok");
  });

  document.getElementById("reload-routes").addEventListener("click", load);

  var logoutBtn = document.getElementById("panel-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      fetch("/api/admin/logout", { method: "POST" }).finally(function () {
        window.location.href = "/xp-pan-adm/login.html";
      });
    });
  }

  load();
})();
