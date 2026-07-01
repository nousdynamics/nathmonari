(function () {
  var pagesEl = document.getElementById("pages");
  var statusEl = document.getElementById("status");
  var previewEl = document.getElementById("preview");
  var pages = [];

  function uid() {
    return "page-" + Math.random().toString(36).slice(2, 9);
  }

  function showStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = "msg " + (type || "ok");
  }

  function render() {
    pagesEl.innerHTML = "";
    pages.forEach(function (p, i) {
      var card = document.createElement("div");
      card.className = "card";
      card.innerHTML =
        '<div class="row-head">Página ' + (i + 1) + "</div>" +
        '<label>Nome (painel)</label><input data-k="label" data-i="' + i + '" value="' + esc(p.label) + '">' +
        '<label>Arquivo (em public/)</label><input data-k="file" data-i="' + i + '" value="' + esc(p.file) + '">' +
        '<label>Rota pública (path)</label><input data-k="path" data-i="' + i + '" value="' + esc(p.path) + '">' +
        '<button type="button" class="btn-danger" data-remove="' + i + '">Remover</button>';
      pagesEl.appendChild(card);
    });

    pagesEl.querySelectorAll("input").forEach(function (input) {
      input.addEventListener("input", function () {
        var idx = +input.dataset.i;
        var key = input.dataset.k;
        pages[idx][key] = input.value;
        updatePreview();
      });
    });

    pagesEl.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        pages.splice(+btn.dataset.remove, 1);
        render();
      });
    });

    updatePreview();
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
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
        render();
        previewEl.hidden = false;
      })
      .catch(function (err) {
        showStatus("Erro ao carregar routes.json: " + err.message, "warn");
      });
  }

  document.getElementById("add").addEventListener("click", function () {
    pages.push({ id: uid(), label: "Nova página", file: "pagina.html", path: "/nova-pagina" });
    render();
  });

  document.getElementById("export").addEventListener("click", function () {
    var json = JSON.stringify({ pages: pages }, null, 2) + "\n";
    var blob = new Blob([json], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "routes.json";
    a.click();
    URL.revokeObjectURL(a.href);
    showStatus("Arquivo routes.json exportado. Substitua public/data/routes.json e faça deploy.", "ok");
  });

  document.getElementById("reload").addEventListener("click", load);

  load();
})();
