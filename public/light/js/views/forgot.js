(function (global) {
  var ui, api, state;

  function loginUrl() {
    return "#/";
  }

  function render(root) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    state = { submitted: false, email: "" };
    paint(root);
  }

  function paint(root) {
    if (state.submitted) {
      root.innerHTML =
        '<div class="lg-login"><div class="lg-login-box">' +
          '<img class="lg-login-logo-img" src="../Design%20sans%20titre.svg" alt="NACK!" onerror="this.src=\'../icons/icon-192x192.png\';this.className=\'lg-login-logo-img lg-login-logo-fallback\';">' +
          '<h1>Email envoyé !</h1>' +
          '<p class="subtitle">Nous avons envoyé un lien de réinitialisation à<br><strong>' + ui.escapeHtml(state.email) + '</strong></p>' +
          '<p class="lg-card-desc">Vérifiez votre boîte de réception et cliquez sur le lien pour réinitialiser votre mot de passe.</p>' +
          '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" data-action="forgot-resend">Renvoyer l\'email</button>' +
          '<a class="lg-btn lg-btn-outline lg-btn-block" style="margin-top:10px;text-align:center;display:block" href="#/" data-action="route-nav" data-arg="">Retour à la connexion</a>' +
        '</div></div>';
      return;
    }
    root.innerHTML =
      '<div class="lg-login"><div class="lg-login-box">' +
        '<img class="lg-login-logo-img" src="../Design%20sans%20titre.svg" alt="NACK!" onerror="this.src=\'../icons/icon-192x192.png\';this.className=\'lg-login-logo-img lg-login-logo-fallback\';">' +
        '<h1>Mot de passe oublié</h1>' +
        '<p class="subtitle">Saisissez votre email pour recevoir un lien de réinitialisation</p>' +
        '<form id="forgot-form" action="javascript:void(0)">' +
          '<div class="lg-field"><label class="lg-label" for="forgot-email">Email</label>' +
          '<input class="lg-input" id="forgot-email" type="email" autocomplete="username" required /></div>' +
          '<button type="submit" class="lg-btn lg-btn-nack lg-btn-block" id="forgot-submit">Envoyer le lien</button>' +
        '</form>' +
        '<a class="lg-btn lg-btn-outline lg-btn-block" style="margin-top:10px;text-align:center;display:block" href="#/" data-action="route-nav" data-arg="">Retour à la connexion</a>' +
      '</div></div>';
    var form = ui.$("forgot-form");
    if (form && form.getAttribute("data-bound") !== "1") {
      form.setAttribute("data-bound", "1");
      form.addEventListener("submit", function (e) {
        if (e.preventDefault) e.preventDefault();
        submit();
      }, false);
    }
  }

  function submit() {
    var email = (ui.$("forgot-email") && ui.$("forgot-email").value || "").trim();
    if (!email) { ui.toast("Email requis", "error"); return; }
    var btn = ui.$("forgot-submit");
    ui.setLoading(btn, true);
    api.resetPassword(email).then(function () {
      state.email = email;
      state.submitted = true;
      var root = document.getElementById("auth-root") || document.body;
      paint(root);
      ui.toast("Email envoyé !", "ok");
    }).catch(function (err) {
      ui.toast(err.message || "Envoi échoué", "error");
    }).then(function () { ui.setLoading(btn, false); });
  }

  function resend() {
    if (!state.email) return;
    api.resetPassword(state.email).then(function () {
      ui.toast("Email renvoyé", "ok");
    }).catch(function (err) {
      ui.toast(err.message || "Erreur", "error");
    });
  }

  function init() {
    if (document.body.getAttribute("data-nack-page") !== "forgot") return;
    var root = document.getElementById("auth-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "auth-root";
      document.body.appendChild(root);
    }
    render(root);
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.forgot = { render: render, submit: submit, resend: resend, init: init };

  if (document.body && document.body.getAttribute("data-nack-page") === "forgot") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, false);
    else init();
  }
})(window);
