// Evoluto Day — FAQ e reveal ao rolar

document.querySelectorAll(".faq-pergunta").forEach(function (pergunta) {
  pergunta.addEventListener("click", function () {
    var item = this.closest(".faq-item");
    var aberto = item.classList.contains("open");
    document.querySelectorAll(".faq-item").forEach(function (i) {
      i.classList.remove("open");
      i.querySelector(".faq-pergunta").setAttribute("aria-expanded", "false");
    });
    if (!aberto) {
      item.classList.add("open");
      this.setAttribute("aria-expanded", "true");
    }
  });
});

// Carrossel infinito: roda sozinho; pausa só durante interação e retoma depois
(function () {
  var root = document.querySelector("[data-provas]");
  if (!root) return;

  var track = root.querySelector(".provas-track");
  if (!track) return;

  var originais = Array.prototype.slice.call(track.children);
  var total = originais.length;
  if (total < 2) return;

  originais.forEach(function (slide) {
    var clone = slide.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("img").forEach(function (img) {
      img.loading = "lazy";
      img.decoding = "async";
    });
    track.appendChild(clone);
  });

  var indice = 0;
  var pausado = false;
  var resumeTimer = null;
  var visivel = true;
  var INTERVALO_MS = 3200;
  var RETOMAR_MS = 1800;
  var reduzMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function largura() {
    return track.children[0].getBoundingClientRect().width;
  }

  function irPara(i, animar) {
    track.style.transition = animar && !reduzMotion ? "" : "none";
    track.style.transform = "translateX(" + (-i * largura()) + "px)";
  }

  track.addEventListener("transitionend", function (e) {
    if (e.target !== track) return;
    if (indice >= total) {
      indice -= total;
      irPara(indice, false);
      void track.offsetWidth;
      track.style.transition = "";
    }
  });

  function avancar() {
    indice += 1;
    irPara(indice, true);
  }

  function voltar() {
    if (indice <= 0) {
      indice = total;
      irPara(indice, false);
      void track.offsetWidth;
      track.style.transition = "";
    }
    indice -= 1;
    irPara(indice, true);
  }

  function pausarPorInteracao() {
    pausado = true;
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(function () {
      pausado = false;
    }, RETOMAR_MS);
  }

  var btnPrev = root.querySelector(".provas-seta--prev");
  var btnNext = root.querySelector(".provas-seta--next");
  if (btnPrev) {
    btnPrev.addEventListener("click", function () {
      pausarPorInteracao();
      voltar();
    });
  }
  if (btnNext) {
    btnNext.addEventListener("click", function () {
      pausarPorInteracao();
      avancar();
    });
  }

  ["pointerdown", "touchstart", "wheel"].forEach(function (ev) {
    root.addEventListener(ev, pausarPorInteracao, { passive: true });
  });

  if ("IntersectionObserver" in window) {
    visivel = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visivel = entry.isIntersecting;
      });
    }, { threshold: 0.2 });
    io.observe(root);
  }

  if (!reduzMotion) {
    setInterval(function () {
      if (pausado || document.hidden || !visivel) return;
      avancar();
    }, INTERVALO_MS);
  }

  window.addEventListener("resize", function () {
    irPara(indice, false);
  });
})();

(function () {
  if (!("IntersectionObserver" in window)) return;
  var sel = ".secao-topo, .abertura-inner > *, .card, .cronograma-info, .dia, .para-quem li, .paraquem-card, .saida-lista li, .prova, .bio-foto, .bio-texto, .oferta-box, .garantia, .faq-item, .fechamento > *, .faq-cta";
  var els = Array.prototype.slice.call(document.querySelectorAll(sel));
  if (!els.length) return;
  els.forEach(function (el) { el.classList.add("reveal"); });

  document.querySelectorAll(".grid-3, .provas, .para-quem, .cronograma-dias, .saida-lista").forEach(function (grupo) {
    Array.prototype.forEach.call(grupo.children, function (filho, i) {
      filho.style.transitionDelay = Math.min(i * 55, 240) + "ms";
    });
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  els.forEach(function (el) { io.observe(el); });
})();
