(function (global) {
  var ui, api, state, icon;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    icon = global.NACK_LIGHT.icon;
    state = { ctx: ctx, tab: "subscription", duration: "month" };

    root.innerHTML =
      '<div class="lg-tabs" id="profile-tabs">' +
        '<button type="button" class="lg-tab active" data-action="profile-tab" data-arg="subscription">Abonnement</button>' +
        '<button type="button" class="lg-tab" data-action="profile-tab" data-arg="establishment">Établissement</button>' +
        '<button type="button" class="lg-tab" data-action="profile-tab" data-arg="account">Compte</button>' +
      '</div>' +
      '<div id="profile-panel"></div>' +
      '<button type="button" class="lg-btn lg-btn-outline lg-btn-block" data-action="logout" style="margin-top:16px">Déconnexion</button>';

    paintPanel();
  }

  function setTab(tab) {
    state.tab = tab;
    var tabs = document.querySelectorAll("#profile-tabs .lg-tab");
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      t.className = "lg-tab" + (t.getAttribute("data-arg") === tab ? " active" : "");
    }
    paintPanel();
  }

  function getPlanInfo(profile) {
    var now = Date.now();
    var p = profile || {};
    if (p.plan === "active" && p.subscriptionEndsAt && p.subscriptionEndsAt > now) {
      var type = p.subscriptionType || "transition";
      var plans = global.NACK_LIGHT.PLANS;
      return {
        key: type, label: (plans[type] && plans[type].name) || type,
        remaining: p.subscriptionEndsAt - now, active: true
      };
    }
    if (p.plan === "trial" && p.trialEndsAt && p.trialEndsAt > now) {
      return { key: "trial", label: "Essai gratuit", remaining: p.trialEndsAt - now, active: true };
    }
    return { key: "free", label: "Gratuit / Expiré", remaining: 0, active: false };
  }

  function formatRemaining(ms) {
    if (!ms || ms <= 0) return "Expiré";
    var d = Math.floor(ms / 86400000);
    if (d >= 1) return d + " jour(s)";
    var h = Math.floor(ms / 3600000);
    return h + " heure(s)";
  }

  function calcPrice(planKey, duration) {
    var base = (global.NACK_LIGHT.PLANS[planKey] && global.NACK_LIGHT.PLANS[planKey].price) || 3000;
    if (duration === "quarter") return base * 3;
    if (duration === "semester") return Math.round(base * 6 * 0.9);
    if (duration === "year") return base * 10;
    return base;
  }

  function paintPanel() {
    var panel = ui.$("profile-panel");
    if (!panel) return;
    var p = state.ctx.profile || {};
    if (state.tab === "subscription") paintSubscription(panel, p);
    else if (state.tab === "establishment") paintEstablishment(panel, p);
    else paintAccount(panel, p);
  }

  function paintSubscription(panel, p) {
    var plan = getPlanInfo(p);
    var durations = global.NACK_LIGHT.DURATIONS || [];
    var durHtml = "";
    for (var i = 0; i < durations.length; i++) {
      var d = durations[i];
      durHtml += '<option value="' + d.value + '"' + (state.duration === d.value ? " selected" : "") + '>' + d.label + '</option>';
    }
    panel.innerHTML =
      '<div class="lg-card">' +
        '<div class="lg-card-title">Plan actuel</div>' +
        '<div style="font-size:1.25rem;font-weight:800;color:#dc2626;margin:8px 0">' + ui.escapeHtml(plan.label) + '</div>' +
        '<div class="lg-card-desc">Temps restant : ' + ui.escapeHtml(formatRemaining(plan.remaining)) + '</div>' +
        (p.subscriptionEndsAt ? '<div class="lg-card-desc">Expire le : ' + ui.escapeHtml(formatDate(p.subscriptionEndsAt)) + '</div>' : '') +
      '</div>' +
      '<div class="lg-card">' +
        '<div class="lg-card-title">Durée</div>' +
        '<select class="lg-select" id="prof-duration" data-action-ignore="1">' + durHtml + '</select>' +
      '</div>' +
      '<div class="lg-card">' +
        '<div class="lg-card-title">S\'abonner / Renouveler</div>' +
        '<div class="lg-card-desc" style="margin-bottom:10px">Paiement Airtel Money via SingPay</div>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" data-action="profile-pay" data-arg="transition">' +
          'Standard — <span id="price-transition">' + calcPrice("transition", state.duration).toLocaleString() + '</span> XAF</button>' +
        '<button type="button" class="lg-btn lg-btn-outline lg-btn-block" style="margin-top:8px" data-action="profile-pay" data-arg="transition-pro-max">' +
          'Premium — <span id="price-promax">' + calcPrice("transition-pro-max", state.duration).toLocaleString() + '</span> XAF</button>' +
      '</div>' +
      (p.lastPaymentAt ? '<div class="lg-card"><div class="lg-card-desc">Dernier paiement : ' + ui.escapeHtml(formatDate(p.lastPaymentAt)) + '</div></div>' : '');

    var sel = ui.$("prof-duration");
    if (sel) {
      sel.onchange = function () {
        state.duration = sel.value;
        var pt = ui.$("price-transition");
        var pp = ui.$("price-promax");
        if (pt) pt.textContent = calcPrice("transition", state.duration).toLocaleString();
        if (pp) pp.textContent = calcPrice("transition-pro-max", state.duration).toLocaleString();
      };
    }
  }

  function paintEstablishment(panel, p) {
    var est = p.establishmentName || "—";
    panel.innerHTML =
      '<div class="lg-card" style="text-align:center">' +
        (p.logoUrl
          ? '<img src="' + ui.escapeHtml(p.logoUrl) + '" alt="" style="width:72px;height:72px;border-radius:16px;margin:0 auto 10px;object-fit:cover">'
          : '<div class="lg-avatar" style="width:72px;height:72px;margin:0 auto 10px;font-size:1.5rem;border-radius:16px">' +
              ui.escapeHtml((est.charAt(0) || "N").toUpperCase()) + '</div>') +
        '<div class="lg-card-title">' + ui.escapeHtml(est) + '</div>' +
        '<div class="lg-card-desc">' + ui.escapeHtml(p.establishmentType || "—") + '</div>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm lg-btn-icon" style="margin-top:12px" data-action="profile-edit">' +
          icon("edit", 16) + ' Modifier</button>' +
      '</div>' +
      '<div class="lg-card">' +
        row("Gérant", p.ownerName) + row("Email", p.email || state.ctx.email) +
        row("Téléphone", p.phone) + row("WhatsApp", p.whatsapp) +
        row("Adresse", p.address || p.fullAddress) +
      '</div>';
  }

  function paintAccount(panel, p) {
    panel.innerHTML =
      '<div class="lg-card">' +
        row("Plan Firestore", p.plan || "—") +
        row("Type abonnement", p.subscriptionType || "—") +
        row("PIN gérant", p.managerPinHash ? "Configuré" : "Non configuré") +
        row("ID établissement", p.activeEstablishmentId || state.ctx.uid) +
      '</div>' +
      '<div class="lg-card">' +
        '<div class="lg-card-desc">NACK Pro — Version simplifiée pour votre appareil. Toutes les fonctionnalités essentielles sont disponibles.</div>' +
      '</div>';
  }

  function row(label, value) {
    return '<div class="lg-profile-row"><span>' + ui.escapeHtml(label) + '</span><span>' + ui.escapeHtml(value || "—") + '</span></div>';
  }

  function formatDate(ts) {
    try { return new Date(Number(ts)).toLocaleDateString("fr-FR"); }
    catch (e) { return String(ts || "—"); }
  }

  function openEditModal() {
    var p = state.ctx.profile || {};
    ui.$("prof-est-name").value = p.establishmentName || "";
    ui.$("prof-est-type").value = p.establishmentType || "";
    ui.$("prof-owner").value = p.ownerName || "";
    ui.$("prof-phone").value = p.phone || "";
    ui.$("prof-whatsapp").value = p.whatsapp || "";
    ui.$("prof-address").value = p.address || p.fullAddress || "";
    ui.$("prof-logo").value = p.logoUrl || "";
    ui.openModal("modal-profile");
  }

  function saveProfile() {
    var uid = state.ctx.uid;
    var data = {
      establishmentName: (ui.$("prof-est-name").value || "").trim(),
      establishmentType: (ui.$("prof-est-type").value || "").trim(),
      ownerName: (ui.$("prof-owner").value || "").trim(),
      phone: (ui.$("prof-phone").value || "").trim(),
      whatsapp: (ui.$("prof-whatsapp").value || "").trim(),
      address: (ui.$("prof-address").value || "").trim(),
      logoUrl: (ui.$("prof-logo").value || "").trim(),
      updatedAt: Date.now()
    };
    if (!data.establishmentName || !data.ownerName) {
      ui.toast("Nom établissement et gérant requis", "error");
      return;
    }
    var btn = ui.$("prof-save");
    ui.setLoading(btn, true);
    api.patchProfile(uid, data, ["establishmentName", "establishmentType", "ownerName", "phone", "whatsapp", "address", "logoUrl", "updatedAt"]).then(function () {
      for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) state.ctx.profile[k] = data[k];
      ui.closeModal("modal-profile");
      ui.toast("Profil mis à jour", "ok");
      if (state.ctx.onProfileUpdate) state.ctx.onProfileUpdate(state.ctx.profile);
      paintPanel();
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); })
      .then(function () { ui.setLoading(btn, false); });
  }

  function payNow(planType) {
    var uid = state.ctx.uid;
    var base = api.publicBase();
    var txnId = "TXN-" + uid + "-" + Date.now();
    var amount = calcPrice(planType, state.duration);
    var reference = "abonnement-" + planType;
    var redirectSuccess = base + "/payment/success?reference=" + reference + "&transactionId=" + txnId + "&duration=" + state.duration;
    var redirectError = base + "/payment/error?transactionId=" + txnId;
    ui.toast("Génération du lien de paiement…", "ok");
    api.createPaymentLink({
      portefeuille: "", reference: reference + "-" + txnId.substring(0, 12),
      redirect_success: redirectSuccess, redirect_error: redirectError,
      amount: amount, logoURL: base + "/favicon.png", isTransfer: false
    }).then(function (link) {
      window.location.href = link;
    }).catch(function (err) {
      ui.toast(err.message || "Paiement indisponible", "error");
    });
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.profile = {
    render: render, setTab: setTab, openEditModal: openEditModal,
    saveProfile: saveProfile, payNow: payNow
  };
})(window);
