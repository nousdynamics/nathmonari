// Protocolo RC — interações da landing page

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

// Rolagem suave para a seção de preço
document.querySelectorAll('a[href="#preco"]').forEach(function (a) {
  a.addEventListener("click", function (e) {
    e.preventDefault();
    document.querySelector("#preco").scrollIntoView({ behavior: "smooth" });
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
    track.style.transition = "transform .55s cubic-bezier(.4,0,.2,1)";
    track.style.transform = "translateX(" + -index * stepPct + "%)";
    setStatus(((index - pv) % total + total) % total);
  }

  track.addEventListener("transitionend", function () {
    if (index >= total + pv) { index -= total; place(); }
    else if (index < pv) { index += total; place(); }
    locked = false;
  });

  // Autoplay suave; pausa ao interagir/hover
  var timer = null;
  function start() { timer = setInterval(function () { go(1); }, 5000); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function restart() { stop(); start(); }

  if (prevBtn) prevBtn.addEventListener("click", function () { go(-1); restart(); });
  if (nextBtn) nextBtn.addEventListener("click", function () { go(1); restart(); });
  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  start();
});
