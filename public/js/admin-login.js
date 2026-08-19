(function () {
  /* ------------------------------------------------------------------
   * Dissuasor de inspeção.
   *
   * ATENÇÃO — isto NÃO é uma camada de segurança e não deve ser tratado
   * como tal. Devtools abre antes da página carregar, `view-source:` não
   * executa JS e curl nem roda script. Serve só para desencorajar quem
   * abriria o inspetor por curiosidade.
   *
   * A proteção de verdade está no servidor: as senhas nunca chegam ao
   * navegador — só o hash PBKDF2 existe, e ele fica no Worker.
   * ------------------------------------------------------------------ */
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });

  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase();
    var bloquearSozinho = e.key === "F12";
    var bloquearCtrlShift = (e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].indexOf(k) !== -1;
    var bloquearCtrlU = (e.ctrlKey || e.metaKey) && !e.shiftKey && k === "u";
    if (bloquearSozinho || bloquearCtrlShift || bloquearCtrlU) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  /* ----------------------------------------------------------- login */

  var form = document.getElementById("login-form");
  var erroEl = document.getElementById("login-erro");
  var btn = document.getElementById("login-submit");

  function mostrarErro(msg) {
    erroEl.textContent = msg;
    erroEl.hidden = false;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    erroEl.hidden = true;
    erroEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Entrando…";

    var dados = {
      username: form.username.value,
      password: form.password.value,
    };

    fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (r) {
        if (r.ok && r.data.ok) {
          window.location.replace("/xp-pan-adm/");
          return;
        }
        form.password.value = "";
        mostrarErro(r.data.message || "Usuário ou senha incorretos.");
      })
      .catch(function () {
        mostrarErro("Não foi possível conectar. Tente novamente.");
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Entrar";
      });
  });
})();
