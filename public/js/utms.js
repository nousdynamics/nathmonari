(function () {
  var KIWIFY_PREFIX = ["https://pay.kiwify.com.br"];
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

  function kiwifySck() {
    var sck = "";
    var href = window.top.location.href;
    var url = new URL(href);
    if (url != null && href.indexOf("?") !== -1) {
      sck =
        "&sck=" +
        url.searchParams.get("utm_source") +
        "|" +
        url.searchParams.get("utm_medium") +
        "|" +
        url.searchParams.get("utm_campaign") +
        "|" +
        url.searchParams.get("utm_term") +
        "|" +
        url.searchParams.get("utm_content");
    }
    return sck;
  }

  function applyKiwifyUtms() {
    var params = new URLSearchParams(window.location.search);
    if (!params.toString()) return;

    document.querySelectorAll("a").forEach(function (anchor) {
      for (var i = 0; i < KIWIFY_PREFIX.length; i++) {
        if (anchor.href.indexOf(KIWIFY_PREFIX[i]) === -1) continue;
        if (anchor.href.indexOf("?") === -1) {
          anchor.href += "?" + params.toString() + kiwifySck();
        } else {
          anchor.href += "&" + params.toString() + kiwifySck();
        }
      }
    });
  }

  function applyGreennUtms() {
    var params = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach(function (key) {
      if (params.has(key)) localStorage.setItem(key, params.get(key));
    });

    function buildUtmString() {
      var query = [];
      UTM_KEYS.forEach(function (key) {
        var value = localStorage.getItem(key);
        if (value) query.push(key + "=" + encodeURIComponent(value));
      });
      return query.length ? "?" + query.join("&") : "";
    }

    document.querySelectorAll('a[href*="greenn.co"], a[href*="greenn.club"]').forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var baseUrl = link.getAttribute("href").split("?")[0];
        window.location.href = baseUrl + buildUtmString();
      });
    });
  }

  applyKiwifyUtms();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyGreennUtms);
  } else {
    applyGreennUtms();
  }
})();
