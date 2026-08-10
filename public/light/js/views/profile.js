(function (global) {
  function render(root, ctx) {
    var ui = global.NACK_LIGHT.ui;
    var p = ctx.profile || {};
    var est = p.establishmentName || "—";
    var type = p.establishmentType || "—";
    var owner = p.ownerName || "—";
    var email = p.email || ctx.email || "—";
    var phone = p.phone || "—";
    var eid = p.activeEstablishmentId || ctx.uid || "—";

    root.innerHTML =
      '<div class="lg-card" style="text-align:center">' +
        (p.logoUrl
          ? '<img src="' + ui.escapeHtml(p.logoUrl) + '" alt="" style="width:72px;height:72px;border-radius:16px;margin:0 auto 10px;object-fit:cover">'
          : '<div class="lg-avatar" style="width:72px;height:72px;margin:0 auto 10px;font-size:1.5rem;border-radius:16px">' +
              ui.escapeHtml((est.charAt(0) || "N").toUpperCase()) + '</div>') +
        '<div class="lg-card-title">' + ui.escapeHtml(est) + '</div>' +
        '<div class="lg-card-desc">' + ui.escapeHtml(type) + '</div>' +
      '</div>' +
      '<div class="lg-section-title">Établissement</div>' +
      '<div class="lg-card">' +
        row("Gérant", owner) + row("Email", email) + row("Téléphone", phone) +
        row("WhatsApp", p.whatsapp || "—") +
        row("Adresse", p.address || p.fullAddress || "—") +
        row("PIN gérant", p.managerPinHash ? "Configuré" : "Non configuré") +
        row("ID établissement", eid) +
      '</div>' +
      '<div class="lg-section-title">Abonnement</div>' +
      '<div class="lg-card">' +
        row("Plan", p.plan || "—") +
        row("Type", p.subscriptionType || "—") +
        (p.subscriptionEndsAt ? row("Expire", formatDate(p.subscriptionEndsAt)) : "") +
        (p.trialEndsAt ? row("Fin essai", formatDate(p.trialEndsAt)) : "") +
      '</div>' +
      '<p class="lg-card-desc" style="margin-top:12px;text-align:center">Mode léger : réglages avancés sur un appareil récent.</p>' +
      '<button type="button" class="lg-btn lg-btn-outline lg-btn-block" data-action="logout" style="margin-top:12px">Déconnexion</button>';

    function row(label, value) {
      return '<div class="lg-profile-row"><span>' + ui.escapeHtml(label) + '</span><span>' + ui.escapeHtml(value) + '</span></div>';
    }
    function formatDate(ts) {
      try { return new Date(Number(ts)).toLocaleDateString("fr-FR"); }
      catch (e) { return String(ts); }
    }
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.profile = { render: render };
})(window);
