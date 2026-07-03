(function () {
  var listEl = document.getElementById("bio-links");

  var LINKS = [
    {
      label: "Evoluto",
      href: "/vendas-evoluto-2-0/?utm_source=instagram&utm_medium=bio&utm_campaign=evoluto&utm_term=organico",
    },
    {
      label: "Reconstrua-se",
      href: "/reconstrua-se/vsl?utm_source=instagram&utm_medium=bio&utm_campaign=reconstruase&utm_term=organico",
    },
    {
      label: "Canal do YouTube",
      href: "https://youtube.com/@nathmonari?si=FcE8pJG3-fm6abHq",
      external: true,
    },
    {
      label: "Siga-me no TikTok",
      href: "https://www.tiktok.com/@nathmonari",
      external: true,
    },
  ];

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  listEl.innerHTML = LINKS.map(function (link) {
    var attrs =
      'class="bio-link' +
      (link.external ? " bio-link--external" : "") +
      '" href="' +
      esc(link.href) +
      '"';
    if (link.external) {
      attrs += ' target="_blank" rel="noopener noreferrer"';
    }
    return "<li><a " + attrs + ">" + esc(link.label) + "</a></li>";
  }).join("");
})();
