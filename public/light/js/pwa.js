(function (global) {
  var deferredPrompt = null;
  var bannerEl = null;
  var swReady = false;

  function isStandalone() {
    try {
      return window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;
    } catch (e) { return false; }
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function dismissed() {
    try {
      if (sessionStorage.getItem("pwa-install-dismissed-session") === "1") return true;
      return localStorage.getItem("pwa-install-dismissed") === "true";
    } catch (e) { return false; }
  }

  function dismiss(permanent) {
    try {
      if (permanent) localStorage.setItem("pwa-install-dismissed", "true");
      else sessionStorage.setItem("pwa-install-dismissed-session", "1");
    } catch (e) {}
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
    if (close) close.onclick = function () { dismiss(false); };
    var never = bannerEl.querySelector("[data-pwa-never]");
    if (never) never.onclick = function () { dismiss(true); };
    var install = bannerEl.querySelector("[data-pwa-install]");
    if (install) install.onclick = function (e) {
      if (e) e.preventDefault();
      promptInstall();
    };
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return Promise.resolve(false);
    }
    // SW racine (même origine) pour activer beforeinstallprompt sur /light/
    return navigator.serviceWorker.register("/firebase-messaging-sw.js").then(function (reg) {
      swReady = true;
      return reg;
    }).catch(function () {
      // Fallback : SW local light si présent
      return navigator.serviceWorker.register("./sw.js").then(function (reg) {
        swReady = true;
        return reg;
      }).catch(function () {
        return null;
      });
    });
  }

  function promptInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        deferredPrompt = null;
        hideBanner();
        if (choice && choice.outcome === "accepted") {
          try { localStorage.setItem("pwa-install-dismissed", "true"); } catch (e) {}
          var ui = global.NACK_LIGHT.ui;
          if (ui) ui.toast("Installation lancée", "ok");
        }
      }).catch(function () {});
      return;
    }
    if (isIOS()) {
      paintIOS();
      return;
    }
    var ui = global.NACK_LIGHT.ui;
    if (ui) {
      ui.toast(
        swReady
          ? "Ouvrez le menu du navigateur → Installer l'application"
          : "Installation indisponible ici. Réessayez en HTTPS (Chrome / Edge).",
        "ok"
      );
    }
    paintManual();
  }

  function paintIOS() {
    showBanner(
      '<div class="lg-pwa-inner">' +
        '<div class="lg-pwa-ico" aria-hidden="true"></div>' +
        '<div class="lg-pwa-text">' +
          '<strong>Installer NACK</strong>' +
          '<p>1. Appuyez sur <b>Partager</b><br>2. « Sur l\'écran d\'accueil »<br>3. « Ajouter »</p>' +
        '</div>' +
        '<div class="lg-pwa-actions">' +
          '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-pwa-dismiss>Plus tard</button>' +
        '</div></div>'
    );
  }

  function paintChrome() {
    showBanner(
      '<div class="lg-pwa-inner">' +
        '<div class="lg-pwa-ico" aria-hidden="true"></div>' +
        '<div class="lg-pwa-text">' +
          '<strong>Installer NACK</strong>' +
          '<p>Accès rapide + hors ligne sur tablette</p>' +
        '</div>' +
        '<div class="lg-pwa-actions">' +
          '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-pwa-install>Installer</button>' +
          '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-pwa-dismiss>Plus tard</button>' +
        '</div></div>'
    );
  }

  function paintManual() {
    showBanner(
      '<div class="lg-pwa-inner">' +
        '<div class="lg-pwa-ico" aria-hidden="true"></div>' +
        '<div class="lg-pwa-text">' +
          '<strong>Installer NACK</strong>' +
          '<p>Menu navigateur → « Installer l\'application » ou « Ajouter à l\'écran d\'accueil »</p>' +
        '</div>' +
        '<div class="lg-pwa-actions">' +
          '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-pwa-install>Réessayer</button>' +
          '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-pwa-dismiss>Plus tard</button>' +
        '</div></div>'
    );
  }

  function canShow() {
    return !isStandalone() && !dismissed();
  }

  function ensureManifest() {
    var link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      link.href = "manifest.json";
      document.head.appendChild(link);
    } else if (!link.getAttribute("href")) {
      link.href = "manifest.json";
    }
  }

  function init() {
    ensureManifest();

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (canShow()) paintChrome();
    });

    window.addEventListener("appinstalled", function () {
      hideBanner();
      deferredPrompt = null;
      try { localStorage.setItem("pwa-install-dismissed", "true"); } catch (e) {}
      var ui = global.NACK_LIGHT.ui;
      if (ui) ui.toast("NACK installé", "ok");
    });

    registerServiceWorker().then(function () {
      if (!canShow()) return;
      if (isIOS()) {
        setTimeout(function () { if (canShow() && !deferredPrompt) paintIOS(); }, 1200);
        return;
      }
      setTimeout(function () {
        if (canShow() && !deferredPrompt && !bannerEl) paintManual();
      }, 4500);
    });
  }

  function openInstallHelp() {
    if (isStandalone()) {
      var ui = global.NACK_LIGHT.ui;
      if (ui) ui.toast("NACK est déjà installé", "ok");
      return;
    }
    try { sessionStorage.removeItem("pwa-install-dismissed-session"); } catch (e) {}
    if (deferredPrompt) {
      paintChrome();
      promptInstall();
      return;
    }
    if (isIOS()) paintIOS();
    else paintManual();
  }

  global.NACK_LIGHT.pwa = {
    init: init,
    dismiss: dismiss,
    promptInstall: promptInstall,
    openInstallHelp: openInstallHelp,
    isStandalone: isStandalone
  };
})(window);
