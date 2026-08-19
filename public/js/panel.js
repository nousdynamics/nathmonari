(function () {
  var gridEl = document.getElementById("panel-pages");
  var contagemEl = document.getElementById("panel-contagem");
  var statusEl = document.getElementById("panel-status");
  var buscaEl = document.getElementById("filtro-busca");
  var ordemEl = document.getElementById("filtro-ordem");

  var pages = [];
  var editando = null; // id da página aberta para edição (não índice: a lista reordena)
  var busca = "";
  var ordem = "url-asc";

  var GEAR =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="3"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
    "</svg>";

  var FECHAR =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function uid() {
    return "page-" + Math.random().toString(36).slice(2, 9);
  }

  function showStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = "panel-msg " + (type || "ok");
  }

  /** Normaliza para uma URL pública: sempre começa com "/", sem barra final. */
  function normalizePath(value) {
    var p = String(value || "").trim();
    if (!p) return "/";
    if (p.charAt(0) !== "/") p = "/" + p;
    p = p.replace(/\s+/g, "-");
    if (p.length > 1) p = p.replace(/\/+$/, "");
    return p || "/";
  }

  function byId(id) {
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].id === id) return pages[i];
    }
    return null;
  }

  /** Lista que vai pra tela: filtrada e ordenada. Não altera `pages`. */
  function visiveis() {
    var termo = busca.trim().toLowerCase();
    var lista = pages.filter(function (p) {
      if (!termo) return true;
      return (
        normalizePath(p.path).toLowerCase().indexOf(termo) !== -1 ||
        String(p.file).toLowerCase().indexOf(termo) !== -1
      );
    });

    var cmp = {
      "url-asc": function (a, b) {
        return normalizePath(a.path).localeCompare(normalizePath(b.path), "pt-BR");
      },
      "url-desc": function (a, b) {
        return normalizePath(b.path).localeCompare(normalizePath(a.path), "pt-BR");
      },
      "arquivo-asc": function (a, b) {
        return String(a.file).localeCompare(String(b.file), "pt-BR");
      },
    }[ordem];

    return cmp ? lista.slice().sort(cmp) : lista;
  }

  function cardHtml(page) {
    var path = normalizePath(page.path);
    return (
      '<article class="page-card">' +
      '<button type="button" class="page-card-gear" data-edit="' + esc(page.id) + '" ' +
      'aria-label="Mudar a URL de ' + esc(path) + '">' + GEAR + "</button>" +
      '<div class="page-card-id">' +
      '<span class="page-card-dominio">' + esc(location.host) + "</span>" +
      '<h3 class="page-card-slug">' + esc(path) + "</h3>" +
      "</div>" +
      '<p class="page-card-arquivo"><span>Arquivo</span>' + esc(page.file) + "</p>" +
      '<div class="page-card-acoes">' +
      '<a class="btn btn-prim" href="' + esc(path) + '" target="_blank" rel="noopener">Abrir página</a>' +
      "</div></article>"
    );
  }

  function formHtml(page) {
    var path = normalizePath(page.path);
    return (
      '<article class="page-card is-editando">' +
      '<button type="button" class="page-card-gear" data-fechar="' + esc(page.id) + '" ' +
      'aria-label="Fechar edição">' + FECHAR + "</button>" +
      '<div class="page-card-id">' +
      '<span class="page-card-dominio">' + esc(location.host) + "</span>" +
      '<h3 class="page-card-slug">' + esc(path) + "</h3>" +
      "</div>" +
      '<div class="page-card-form">' +
      '<div class="campo">' +
      '<label for="url-' + esc(page.id) + '">URL pública</label>' +
      '<input id="url-' + esc(page.id) + '" type="text" data-id="' + esc(page.id) + '" ' +
      'value="' + esc(path) + '" spellcheck="false" autocapitalize="off" autocomplete="off">' +
      '<p class="campo-dica">O nome do card acompanha esta URL.</p>' +
      "</div>" +
      '<div class="campo">' +
      "<label>Arquivo que responde</label>" +
      '<div class="campo-fixo">' + esc(page.file) + "</div>" +
      "</div>" +
      "</div>" +
      '<div class="page-card-acoes">' +
      '<button type="button" class="btn btn-prim" data-fechar="' + esc(page.id) + '">Concluir</button>' +
      '<button type="button" class="btn btn-danger" data-remove="' + esc(page.id) + '">Remover</button>' +
      "</div></article>"
    );
  }

  function atualizaContagem(mostrando) {
    var total = pages.length;
    if (mostrando === total) {
      contagemEl.textContent = total + (total === 1 ? " endereço" : " endereços");
    } else {
      contagemEl.textContent = mostrando + " de " + total;
    }
  }

  function render() {
    var lista = visiveis();
    atualizaContagem(lista.length);

    if (!pages.length) {
      gridEl.innerHTML = '<p class="panel-vazio">Nenhuma página em <code>routes.json</code>.</p>';
      return;
    }
    if (!lista.length) {
      gridEl.innerHTML =
        '<p class="panel-vazio">Nenhum card corresponde a “' + esc(busca.trim()) + "”.</p>";
      return;
    }

    gridEl.innerHTML = lista
      .map(function (p) {
        return p.id === editando ? formHtml(p) : cardHtml(p);
      })
      .join("");

    gridEl.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        editando = btn.dataset.edit;
        render();
        var input = gridEl.querySelector("input[data-id]");
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      });
    });

    gridEl.querySelectorAll("[data-fechar]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        editando = null;
        render();
      });
    });

    gridEl.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.remove;
        pages = pages.filter(function (p) {
          return p.id !== id;
        });
        editando = null;
        render();
      });
    });

    gridEl.querySelectorAll("input[data-id]").forEach(function (input) {
      input.addEventListener("input", function () {
        var page = byId(input.dataset.id);
        if (!page) return;
        page.path = input.value;
        page.label = normalizePath(input.value);
        var slug = gridEl.querySelector(".is-editando .page-card-slug");
        if (slug) slug.textContent = normalizePath(input.value);
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          editando = null;
          render();
        }
      });
    });
  }

  /** Exporta sempre a lista completa, na ordem original — filtro é só de tela. */
  function saida() {
    return {
      pages: pages.map(function (p) {
        var path = normalizePath(p.path);
        return { id: p.id, label: path, file: p.file, path: path };
      }),
    };
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
            label: normalizePath(p.path),
            file: p.file || "",
            path: normalizePath(p.path),
          };
        });
        editando = null;
        render();
      })
      .catch(function (err) {
        showStatus("Não foi possível carregar routes.json: " + err.message, "warn");
      });
  }

  buscaEl.addEventListener("input", function () {
    busca = buscaEl.value;
    editando = null;
    render();
  });

  ordemEl.addEventListener("change", function () {
    ordem = ordemEl.value;
    render();
  });

  document.getElementById("export-routes").addEventListener("click", function () {
    var json = JSON.stringify(saida(), null, 2) + "\n";
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
  var userEl = document.getElementById("panel-user");

  fetch("/api/admin/me")
    .then(function (res) {
      if (res.status === 401) {
        window.location.replace("/xp-pan-adm/login.html");
        return null;
      }
      return res.json();
    })
    .then(function (data) {
      if (!data || !data.ok) return;
      if (userEl) userEl.textContent = data.user || "";
    })
    .catch(function () {});

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      fetch("/api/admin/logout", { method: "POST" }).finally(function () {
        window.location.replace("/xp-pan-adm/login.html");
      });
    });
  }

  load();
})();
