(function () {
  var form = document.getElementById("login-form");
  var erroEl = document.getElementById("login-erro");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    erroEl.hidden = true;
    erroEl.textContent = "";

    var fd = new FormData(form);
    var btn = form.querySelector(".login-submit");
    btn.disabled = true;
    btn.textContent = "Entrando…";

    fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: fd.get("username"),
        password: fd.get("password"),
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          window.location.href = "/xp-pan-adm/";
          return;
        }
        erroEl.textContent = result.data.message || "Usuário ou senha incorretos.";
        erroEl.hidden = false;
      })
      .catch(function () {
        erroEl.textContent = "Não foi possível conectar. Tente novamente.";
        erroEl.hidden = false;
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Entrar";
      });
  });
})();
