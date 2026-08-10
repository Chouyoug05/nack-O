(function (global) {
  var deferredPrompt = null;
  var bannerEl = null;

  function isStandalone() {
    try {
      return window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;
    } catch (e) { return false; }
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent || "");
  }

  function dismissed() {
    try { return localStorage.getItem("pwa-install-dismissed") === "true"; } catch (e) { return false; }
  }

  function dismiss() {
    try { localStorage.setItem("pwa-install-dismissed", "true"); } catch (e) {}
    hideBanner();
  }

  function hideBanner() {
    if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
    bannerEl = null;
  }

  function showBanner(html) {
    hideBanner();
    bannerEl = document.createElement("div");
    bannerEl.className = "lg-pwa-banner";
    bannerEl.innerHTML = html;
    document.body.appendChild(bannerEl);
    var close = bannerEl.querySelector("[data-pwa-dismiss]");
    if (close) close.onclick = dismiss;
    var install = bannerEl.querySelector("[data-pwa-install]");
    if (install) install.onclick = promptInstall;
  }

  function promptInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () {
      deferredPrompt = null;
      hideBanner();
    }).catch(function () {});
  }

  function paintIOS() {
    showBanner(
      '<div class="lg-pwa-inner">' +
        '<div><strong>Installer NACK</strong><p>Ajoutez NACK à l\'écran d\'accueil : Partager → Sur l\'écran d\'accueil</p></div>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-pwa-dismiss>Plus tard</button></div>'
    );
  }

  function paintChrome() {
    showBanner(
      '<div class="lg-pwa-inner">' +
        '<div><strong>Installer NACK</strong><p>Installez l\'app pour un accès rapide et hors ligne</p></div>' +
        '<div class="lg-row-actions">' +
          '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-pwa-install">Installer</button>' +
          '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-pwa-dismiss>Plus tard</button>' +
        '</div></div>'
    );
  }

  function init() {
    if (isStandalone() || dismissed()) return;

    var link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      link.href = "manifest.json";
      document.head.appendChild(link);
    }

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      paintChrome();
    });

    window.addEventListener("appinstalled", hideBanner);

    if (isIOS() && !deferredPrompt) paintIOS();
  }

  global.NACK_LIGHT.pwa = { init: init, dismiss: dismiss };
})(window);
