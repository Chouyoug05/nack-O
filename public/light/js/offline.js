(function (global) {
  function init() {
    var bar = document.getElementById("lg-offline-bar");
    var auth = document.getElementById("lg-offline-auth");
    var retry = document.getElementById("offline-auth-retry");
    function upd() {
      var offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (bar) {
        if (offline) {
          bar.style.display = "block";
          bar.textContent = "Hors ligne — certaines actions seront limitées";
        } else {
          bar.style.display = "none";
        }
      }
      if (auth) {
        var app = document.getElementById("screen-app");
        var aff = document.getElementById("screen-affiliate");
        var appVisible = app && app.style.display !== "none" && !app.classList.contains("lg-hidden");
        var affVisible = aff && aff.style.display !== "none" && !aff.classList.contains("lg-hidden");
        if (offline && !appVisible && !affVisible) {
          auth.style.display = "flex";
          auth.classList.remove("lg-hidden");
        } else {
          auth.style.display = "none";
          auth.classList.add("lg-hidden");
        }
      }
    }
    upd();
    window.addEventListener("online", upd, false);
    window.addEventListener("offline", upd, false);
    if (retry) retry.onclick = function () { window.location.reload(); };
    global.NACK_LIGHT.offline.refresh = upd;
  }
  global.NACK_LIGHT.offline = global.NACK_LIGHT.offline || {};
  global.NACK_LIGHT.offline.init = init;
})(window);
