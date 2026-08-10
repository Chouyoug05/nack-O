(function (global) {
  var ui, api, state;

  function render(root) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    var session = api.getSession();
    if (!session.idToken) {
      window.location.href = api.lightHref("");
      return;
    }
    state = { uid: session.uid, profile: null };
    api.getProfile(session.uid).then(function (p) {
      state.profile = p || {};
      paint(root);
    }).catch(function () { paint(root); });
  }

  function paint(root) {
    var p = state.profile || {};
    root.innerHTML =
      '<div class="lg-login"><div class="lg-login-box" style="max-width:560px">' +
        '<h1>Configuration des tickets</h1>' +
        '<p class="subtitle">Informations affichées sur vos tickets de paiement. <strong>Étape optionnelle</strong>.</p>' +
        '<form id="tickets-form" action="javascript:void(0)">' +
          '<div class="lg-field"><label class="lg-label">Nom structure / Entreprise</label><input class="lg-input" id="tk-company" value="' + ui.escapeHtml(p.companyName || "") + '"></div>' +
          '<div class="lg-filter-row">' +
            '<div class="lg-field"><label class="lg-label">N° RCS</label><input class="lg-input" id="tk-rcs" value="' + ui.escapeHtml(p.rcsNumber || "") + '"></div>' +
            '<div class="lg-field"><label class="lg-label">N° NIF</label><input class="lg-input" id="tk-nif" value="' + ui.escapeHtml(p.nifNumber || "") + '"></div>' +
          '</div>' +
          '<div class="lg-field"><label class="lg-label">Téléphone professionnel</label><input class="lg-input" id="tk-phone" value="' + ui.escapeHtml(p.businessPhone || "") + '"></div>' +
          '<div class="lg-field"><label class="lg-label">Adresse complète</label><input class="lg-input" id="tk-address" value="' + ui.escapeHtml(p.fullAddress || "") + '"></div>' +
          '<div class="lg-field"><label class="lg-label">Message personnalisé</label><input class="lg-input" id="tk-message" placeholder="Merci pour votre confiance" value="' + ui.escapeHtml(p.customMessage || "") + '"></div>' +
          '<div class="lg-field"><label class="lg-label">Mentions légales</label><textarea class="lg-textarea" id="tk-legal" rows="3">' + ui.escapeHtml(p.legalMentions || "") + '</textarea></div>' +
          '<div class="lg-row-actions" style="margin-top:12px">' +
            '<button type="button" class="lg-btn lg-btn-secondary lg-btn-block" data-action="tk-skip">Passer cette étape</button>' +
            '<button type="submit" class="lg-btn lg-btn-nack lg-btn-block" id="tk-save">Enregistrer et continuer</button>' +
          '</div>' +
        '</form>' +
      '</div></div>';
    var form = ui.$("tickets-form");
    if (form && form.getAttribute("data-bound") !== "1") {
      form.setAttribute("data-bound", "1");
      form.addEventListener("submit", function (e) {
        if (e.preventDefault) e.preventDefault();
        save();
      }, false);
    }
  }

  function ticketData() {
    return {
      companyName: (ui.$("tk-company") && ui.$("tk-company").value || "").trim(),
      rcsNumber: (ui.$("tk-rcs") && ui.$("tk-rcs").value || "").trim(),
      nifNumber: (ui.$("tk-nif") && ui.$("tk-nif").value || "").trim(),
      businessPhone: (ui.$("tk-phone") && ui.$("tk-phone").value || "").trim(),
      fullAddress: (ui.$("tk-address") && ui.$("tk-address").value || "").trim(),
      customMessage: (ui.$("tk-message") && ui.$("tk-message").value || "").trim(),
      legalMentions: (ui.$("tk-legal") && ui.$("tk-legal").value || "").trim(),
      updatedAt: Date.now()
    };
  }

  function save() {
    var btn = ui.$("tk-save");
    ui.setLoading(btn, true);
    var data = ticketData();
    api.patchProfile(state.uid, data, ["companyName", "rcsNumber", "nifNumber", "businessPhone", "fullAddress", "customMessage", "legalMentions", "updatedAt"]).then(function () {
      ui.toast("Configuration enregistrée", "ok");
      window.location.href = api.lightHref("");
    }).catch(function (err) {
      ui.toast(err.message || "Erreur", "error");
    }).then(function () { ui.setLoading(btn, false); });
  }

  function skip() {
    window.location.href = api.lightHref("");
  }

  function init() {
    if (document.body.getAttribute("data-nack-page") !== "configure-tickets") return;
    var root = document.getElementById("auth-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "auth-root";
      document.body.appendChild(root);
    }
    render(root);
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views["configure-tickets"] = { render: render, save: save, skip: skip, init: init };

  if (document.body && document.body.getAttribute("data-nack-page") === "configure-tickets") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, false);
    else init();
  }
})(window);
