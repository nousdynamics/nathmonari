// Protocolo RC — interações da landing page

var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

// Acordeão do FAQ: abre um, fecha os demais
document.querySelectorAll(".faq-pergunta").forEach(function (pergunta) {
  pergunta.addEventListener("click", function () {
    var item = this.closest(".faq-item");
    var aberto = item.classList.contains("open");
    document.querySelectorAll(".faq-item").forEach(function (i) {
      i.classList.remove("open");
    });
    if (!aberto) item.classList.add("open");
  });
});

// Rolagem interna suave, com fallback imediato para movimento reduzido
document.querySelectorAll('a[href^="#"]').forEach(function (a) {
  a.addEventListener("click", function (e) {
    var target = document.querySelector(this.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: motionQuery.matches ? "auto" : "smooth", block: "start" });
  });
});

// Carrossel infinito de depoimentos
// Mostra N imagens por vez (CSS var --pv), avança 1 por clique, loop sem emenda.
document.querySelectorAll("[data-carrossel]").forEach(function (root) {
  var track = root.querySelector(".carrossel-track");
  if (!track) return;
  var reals = Array.prototype.slice.call(track.children);
  var total = reals.length;
  var statusEl = root.querySelector("[data-status]");
  var prevBtn = root.querySelector("[data-prev]");
  var nextBtn = root.querySelector("[data-next]");

  // quantos slides visíveis por vez (definido no CSS: .carrossel{--pv:3})
  var pv = parseInt(getComputedStyle(root).getPropertyValue("--pv"), 10) || 1;
  if (pv < 1) pv = 1;
  if (pv > total) pv = total;
  var stepPct = 100 / pv;
  var carrosselDur = getComputedStyle(root).getPropertyValue("--carrossel-dur").trim() || ".3s";
  var carrosselEase = "cubic-bezier(.4,0,.2,1)";

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function setStatus(real) {
    if (statusEl) statusEl.textContent = pad(real + 1) + " / " + pad(total);
  }

  // Sem movimento se tudo já cabe na tela e só há um conjunto
  if (total <= 1) {
    setStatus(0);
    if (prevBtn) prevBtn.style.display = "none";
    if (nextBtn) nextBtn.style.display = "none";
    return;
  }

  // Clona `pv` slides em cada ponta para o loop sem "rebobinar"
  var lead = document.createDocumentFragment();
  for (var i = total - pv; i < total; i++) {
    var cl = reals[i].cloneNode(true);
    cl.setAttribute("aria-hidden", "true");
    lead.appendChild(cl);
  }
  track.insertBefore(lead, reals[0]);
  var trail = document.createDocumentFragment();
  for (var j = 0; j < pv; j++) {
    var ct = reals[j].cloneNode(true);
    ct.setAttribute("aria-hidden", "true");
    trail.appendChild(ct);
  }
  track.appendChild(trail);

  var index = pv; // primeiro slide real (depois dos clones iniciais)
  var locked = false;

  function place() {
    track.style.transition = "none";
    track.style.transform = "translateX(" + -index * stepPct + "%)";
  }
  place();
  setStatus(0);

  function go(dir) {
    if (locked) return;
    locked = true;
    index += dir;
    track.style.transition = motionQuery.matches ? "none" : "transform " + carrosselDur + " " + carrosselEase;
    track.style.transform = "translateX(" + -index * stepPct + "%)";
    setStatus(((index - pv) % total + total) % total);
    if (motionQuery.matches) {
      if (index >= total + pv) index -= total;
      else if (index < pv) index += total;
      place();
      locked = false;
    }
  }

  track.addEventListener("transitionend", function () {
    if (index >= total + pv) { index -= total; place(); }
    else if (index < pv) { index += total; place(); }
    locked = false;
  });

  // Autoplay suave; pausa em interação e retoma após 2s sem atividade
  var timer = null;
  var interactTimer = null;
  var isVisible = false;
  var isHovering = false;
  var isFocused = false;
  var isPausedByInteraction = false;
  var INTERACT_RESUME_MS = 2000;

  function canAutoPlay() {
    return !motionQuery.matches && isVisible && !document.hidden && !isHovering && !isFocused && !isPausedByInteraction;
  }
  function start() {
    if (timer || !canAutoPlay()) return;
    timer = setInterval(function () { go(1); }, 5000);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function syncAutoPlay() { stop(); start(); }

  function pauseForInteraction() {
    isPausedByInteraction = true;
    stop();
    if (interactTimer) clearTimeout(interactTimer);
    interactTimer = setTimeout(function () {
      interactTimer = null;
      isPausedByInteraction = false;
      syncAutoPlay();
    }, INTERACT_RESUME_MS);
  }

  if (prevBtn) prevBtn.addEventListener("click", function () { go(-1); pauseForInteraction(); });
  if (nextBtn) nextBtn.addEventListener("click", function () { go(1); pauseForInteraction(); });
  root.addEventListener("pointerdown", pauseForInteraction);
  root.addEventListener("touchstart", pauseForInteraction, { passive: true });
  root.addEventListener("mouseenter", function () { isHovering = true; syncAutoPlay(); });
  root.addEventListener("mouseleave", function () { isHovering = false; syncAutoPlay(); });
  root.addEventListener("focusin", function () { isFocused = true; syncAutoPlay(); });
  root.addEventListener("focusout", function () { isFocused = false; syncAutoPlay(); });
  document.addEventListener("visibilitychange", syncAutoPlay);
  if (motionQuery.addEventListener) motionQuery.addEventListener("change", syncAutoPlay);

  if ("IntersectionObserver" in window) {
    var visibilityObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        isVisible = entry.isIntersecting;
        syncAutoPlay();
      });
    }, { threshold: 0.15 });
    visibilityObserver.observe(root);
  } else {
    isVisible = true;
    syncAutoPlay();
  }
});

// Reveal ao rolar — IntersectionObserver (leve, não bloqueia o carregamento)
(function () {
  if (!("IntersectionObserver" in window)) return;
  var sel = ".secao-label,.prova-abertura .carrossel,.identificacao-item," +
    ".agitacao-inner > *,.reframe-esq,.reframe-dir,.historia-texto,.historia-story," +
    ".mecanismo-item,.dia-item,.modulo-card,.bonus-row,.prova-densa .carrossel," +
    ".stack-item,.stack-total,.para-quem-item,.objecao-item,.futuro-img-wrap," +
    ".futuro-cenario,.preco-box,.garantia-inner,.cta-section-inner,.faq-item,.ps-final > *";
  var els = Array.prototype.slice.call(document.querySelectorAll(sel));
  if (!els.length) return;
  els.forEach(function (el) { el.classList.add("reveal"); });

  document.querySelectorAll(".reframe-esq,.historia-texto,.futuro-img-wrap,.para-quem > div:first-child").forEach(function (el) {
    el.classList.add("reveal--left");
  });
  document.querySelectorAll(".reframe-dir,.historia-story,.futuro-inner,.para-quem > div:nth-child(2)").forEach(function (el) {
    el.classList.add("reveal--right");
  });

  document.querySelectorAll(".identificacao-lista,.mecanismo-grid,.dias-grid,.modulos-grid,.bonus-list,.stack-lista,.objecao-itens,.futuro-cenarios,.faq-inner").forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (child, index) {
      if (child.classList.contains("reveal")) {
        child.style.setProperty("--reveal-delay", Math.min(index * 55, 240) + "ms");
      }
    });
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  els.forEach(function (el) { io.observe(el); });
})();
