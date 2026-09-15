/* Lead form + reveal leve — sem carrossel/CDN */
(function () {
  document.querySelectorAll(".lead-form").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      var webhook = form.getAttribute("data-webhook");
      var obrigado = form.getAttribute("action") || "/imersao-uma-nova-identidade-v2/obrigado/";
      var dados = {
        nome: ((form.elements.nome && form.elements.nome.value) || "").trim(),
        email: ((form.elements.email && form.elements.email.value) || "").trim(),
        whatsapp: ((form.elements.whatsapp && form.elements.whatsapp.value) || "").trim(),
        origem: "imersao-uma-nova-identidade-v2",
        pagina: window.location.href
      };

      if (btn) {
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
      }

      function irParaObrigado() {
        window.location.href = obrigado;
      }

      if (!webhook) {
        irParaObrigado();
        return;
      }

      fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(dados),
        mode: "cors",
        keepalive: true
      })
        .catch(function () {})
        .then(irParaObrigado);
    });
  });

  if (!("IntersectionObserver" in window)) return;
  var els = Array.prototype.slice.call(
    document.querySelectorAll(".secao-topo, .card, .para-quem li, .bio-foto, .bio-texto, .uni-stat")
  );
  if (!els.length) return;
  els.forEach(function (el) {
    el.classList.add("reveal");
  });
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
  );
  els.forEach(function (el) {
    io.observe(el);
  });
})();
