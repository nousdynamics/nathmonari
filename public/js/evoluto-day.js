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

// Carrossel infinito de depoimentos: avança a cada 2s, pausa em interação
(function () {
  var root = document.querySelector("[data-provas]");
  if (!root) return;

  var track = root.querySelector(".provas-track");
  var originais = Array.prototype.slice.call(track.children);
  var total = originais.length;
  if (total < 2) return;

  // Clona os slides para o loop ser contínuo
  originais.forEach(function (slide) {
    track.appendChild(slide.cloneNode(true));
  });

  var indice = 0;
  var pausado = false;

  function largura() {
    return track.children[0].getBoundingClientRect().width;
  }

  function irPara(i, animar) {
    track.style.transition = animar ? "" : "none";
    track.style.transform = "translateX(" + -i * largura() + "px)";
  }

  track.addEventListener("transitionend", function () {
    if (indice >= total) {
      indice -= total;
      irPara(indice, false);
      // força reflow antes de reativar a transição
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
      // salta para o clone equivalente antes de animar para trás
      indice = total;
      irPara(indice, false);
      void track.offsetWidth;
      track.style.transition = "";
    }
    indice -= 1;
    irPara(indice, true);
  }

  var btnPrev = root.querySelector(".provas-seta--prev");
  var btnNext = root.querySelector(".provas-seta--next");
  if (btnPrev) btnPrev.addEventListener("click", voltar);
  if (btnNext) btnNext.addEventListener("click", avancar);

  // Pausa em qualquer interação; retoma quando ela termina
  ["mouseenter", "pointerdown", "touchstart", "focusin"].forEach(function (ev) {
    root.addEventListener(ev, function () { pausado = true; }, { passive: true });
  });
  ["mouseleave", "pointerup", "touchend", "focusout"].forEach(function (ev) {
    root.addEventListener(ev, function () { pausado = false; }, { passive: true });
  });

  var reduzMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduzMotion) {
    setInterval(function () {
      if (pausado || document.hidden) return;
      avancar();
    }, 2000);
  }

  window.addEventListener("resize", function () { irPara(indice, false); });
})();

(function () {
  if (!("IntersectionObserver" in window)) return;
  var sel = ".secao-topo, .abertura-inner > *, .card, .cronograma-info, .dia, .para-quem li, .prova, .bio-foto, .bio-texto, .oferta-box, .garantia, .faq-item, .fechamento > *";
  var els = Array.prototype.slice.call(document.querySelectorAll(sel));
  if (!els.length) return;
  els.forEach(function (el) { el.classList.add("reveal"); });

  document.querySelectorAll(".grid-3, .provas, .para-quem, .cronograma-dias").forEach(function (grupo) {
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
