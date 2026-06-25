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

// Carrossel infinito de depoimentos (1 imagem por vez, loop sem emenda)
document.querySelectorAll("[data-carrossel]").forEach(function (root) {
  var track = root.querySelector(".carrossel-track");
  if (!track) return;
  var slides = Array.prototype.slice.call(track.children);
  var total = slides.length;
  var statusEl = root.querySelector("[data-status]");
  var prevBtn = root.querySelector("[data-prev]");
  var nextBtn = root.querySelector("[data-next]");

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function setStatus(real) {
    if (statusEl) statusEl.textContent = pad(real + 1) + " / " + pad(total);
  }

  // 1 slide só: sem loop, sem botões
  if (total <= 1) {
    setStatus(0);
    if (prevBtn) prevBtn.style.display = "none";
    if (nextBtn) nextBtn.style.display = "none";
    return;
  }

  // Clona primeiro e último para o loop infinito sem "rebobinar"
  var firstClone = slides[0].cloneNode(true);
  var lastClone = slides[total - 1].cloneNode(true);
  firstClone.setAttribute("aria-hidden", "true");
  lastClone.setAttribute("aria-hidden", "true");
  track.insertBefore(lastClone, slides[0]);
  track.appendChild(firstClone);

  var index = 1; // primeiro slide real (depois do clone do último)
  var locked = false;

  function jump() {
    track.style.transition = "none";
    track.style.transform = "translateX(" + -index * 100 + "%)";
  }
  jump();
  setStatus(0);

  function go(dir) {
    if (locked) return;
    locked = true;
    index += dir;
    track.style.transition = "transform .55s cubic-bezier(.4,0,.2,1)";
    track.style.transform = "translateX(" + -index * 100 + "%)";
    var real = ((index - 1) % total + total) % total;
    setStatus(real);
  }

  track.addEventListener("transitionend", function () {
    if (index === 0) { index = total; jump(); }
    else if (index === total + 1) { index = 1; jump(); }
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
