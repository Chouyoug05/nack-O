(function (global) {
  var ui, api;

  var SLIDES = [
    {
      title: "Gérez votre établissement",
      desc: "Contrôlez facilement votre bar, snack ou boîte de nuit avec une interface moderne et intuitive.",
      img: "../Manufacturing Process-rafiki.svg"
    },
    {
      title: "Suivez votre stock",
      desc: "Gardez un œil sur vos boissons et produits en temps réel. Fini les ruptures de stock !",
      img: "../Supermarket workers-pana.svg"
    },
    {
      title: "Analysez vos performances",
      desc: "Accédez à des rapports détaillés pour optimiser votre business et maximiser vos profits.",
      img: "../Revenue-pana.svg"
    }
  ];

  var state = { step: 0 };

  function loginUrl() {
    api = global.NACK_LIGHT.api;
    return api.lightHref("");
  }

  function render(root) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    state.step = 0;
    root.innerHTML =
      '<div class="lg-onboarding">' +
        '<div class="lg-onboarding-header">' +
          '<img class="lg-nack-logo lg-lg" src="../icons/icon-192x192.png" alt="NACK!" onerror="this.style.display=\'none\'">' +
        '</div>' +
        '<div id="onboarding-body"></div>' +
        '<div class="lg-onboarding-dots" id="onboarding-dots"></div>' +
        '<div class="lg-onboarding-actions">' +
          '<button type="button" class="lg-btn lg-btn-secondary" id="onb-skip" data-action="onb-skip">Passer</button>' +
          '<button type="button" class="lg-btn lg-btn-nack" id="onb-next" data-action="onb-next">Suivant</button>' +
        '</div>' +
      '</div>';
    paint();
  }

  function paint() {
    var slide = SLIDES[state.step];
    var body = ui.$("onboarding-body");
    var dots = ui.$("onboarding-dots");
    var nextBtn = ui.$("onb-next");
    if (!body || !slide) return;
    body.innerHTML =
      '<div class="lg-onboarding-slide">' +
        '<img class="lg-onboarding-img" src="' + ui.escapeHtml(slide.img) + '" alt="" onerror="this.style.display=\'none\'">' +
        '<h2>' + ui.escapeHtml(slide.title) + '</h2>' +
        '<p class="lg-card-desc">' + ui.escapeHtml(slide.desc) + '</p>' +
      '</div>';
    if (dots) {
      var dhtml = "";
      for (var i = 0; i < SLIDES.length; i++) {
        dhtml += '<span class="lg-dot' + (i === state.step ? " active" : "") + '"></span>';
      }
      dots.innerHTML = dhtml;
    }
    if (nextBtn) {
      nextBtn.textContent = state.step >= SLIDES.length - 1 ? "Commencer" : "Suivant";
    }
  }

  function next() {
    if (state.step < SLIDES.length - 1) {
      state.step++;
      paint();
    } else {
      window.location.href = loginUrl();
    }
  }

  function loginUrl() {
    return api.lightHref("");
  }

  function skip() {
    window.location.href = api.lightHref("#/login") || loginUrl();
  }

  function init() {
    if (document.body.getAttribute("data-nack-page") !== "onboarding") return;
    var root = ui && ui.$("auth-root") ? ui.$("auth-root") : document.getElementById("auth-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "auth-root";
      document.body.appendChild(root);
    }
    render(root);
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.onboarding = { render: render, next: next, skip: skip, init: init };

  if (document.body && document.body.getAttribute("data-nack-page") === "onboarding") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, false);
    else init();
  }
})(window);
