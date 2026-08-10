(function (global) {
  var KEY = "nack_whatsapp_popup_last_shown";
  var INTERVAL = 5 * 60 * 60 * 1000;
  var URL = "https://whatsapp.com/channel/0029VbBeYoYDJ6GtVge5A409";
  var started = false;

  function shouldShow() {
    try {
      var last = Number(localStorage.getItem(KEY) || 0);
      return Date.now() - last > INTERVAL;
    } catch (e) { return true; }
  }

  function dismiss() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
    var el = document.getElementById("lg-wa-popup");
    if (el) el.style.display = "none";
  }

  function init() {
    if (started) return;
    started = true;
    if (!shouldShow()) return;
    if (document.getElementById("lg-wa-popup")) return;
    var el = document.createElement("div");
    el.id = "lg-wa-popup";
    el.className = "lg-wa-popup";
    el.innerHTML =
      '<div class="lg-wa-popup-inner">' +
        '<p><strong>Communauté NACK!</strong> Guides, conseils et cadeaux exclusifs.</p>' +
        '<a class="lg-btn lg-btn-nack lg-btn-sm" href="' + URL + '" target="_blank" rel="noopener">Rejoindre</a>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-wa-dismiss>Plus tard</button>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector("[data-wa-dismiss]").onclick = dismiss;
  }

  global.NACK_LIGHT.whatsapp = { init: init, dismiss: dismiss };
})(window);
