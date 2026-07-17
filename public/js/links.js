(function () {
  var listEl = document.getElementById("bio-links");

  var LINKS = [
    { label: "Evoluto", href: "/vendas-evoluto-2-0/" },
    { label: "Reconstrua-se", href: "/vendas-rc-v3" },
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

  function hrefWithUtms(href) {
    if (/^https?:\/\//.test(href)) return href;
    var qs = window.location.search;
    if (!qs) return href;
    return href + (href.indexOf("?") === -1 ? qs : "&" + qs.slice(1));
  }

  listEl.innerHTML = LINKS.map(function (link) {
    var attrs =
      'class="bio-link' +
      (link.external ? " bio-link--external" : "") +
      '" href="' +
      esc(hrefWithUtms(link.href)) +
      '"';
    if (link.external) {
      attrs += ' target="_blank" rel="noopener noreferrer"';
    }
    return "<li><a " + attrs + ">" + esc(link.label) + "</a></li>";
  }).join("");
})();
