(function (global) {
  var ui, api, icon;
  var affiliate = null;

  function init() {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    icon = global.NACK_LIGHT.icon;
    ui.paintNavIcons();
    paintLoginTypeTabs("manager");
    var sessionCode = null;
    try { sessionCode = localStorage.getItem(global.NACK_LIGHT.STORAGE_KEYS.affiliateSession); } catch (e) {}
    if (sessionCode) loadAffiliateDashboard(sessionCode);
  }

  function paintLoginTypeTabs(active) {
    var tabs = document.querySelectorAll("[data-action='login-type']");
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var arg = t.getAttribute("data-arg");
      t.className = "lg-login-type" + (arg === active ? " active" : "");
    }
    var panels = ["manager", "team", "affiliate"];
    for (var j = 0; j < panels.length; j++) {
      var p = ui.$("login-panel-" + panels[j]);
      if (p) p.style.display = panels[j] === active ? "block" : "none";
    }
    var title = ui.$("login-type-title");
    if (title) {
      if (active === "manager") title.textContent = "Se connecter";
      else if (active === "team") title.textContent = "Connexion équipe";
      else title.textContent = "Espace affilié";
    }
  }

  function setLoginType(type) {
    paintLoginTypeTabs(type || "manager");
  }

  function doTeamLogin() {
    var role = ui.$("team-role") && ui.$("team-role").value;
    var code = (ui.$("team-code") && ui.$("team-code").value || "").trim().toUpperCase();
    if (!role || !code) { ui.toast("Rôle et code d'agent requis", "error"); return; }
    var btn = ui.$("team-login-submit");
    ui.setLoading(btn, true);
    api.findAgentByCode(code, role).then(function (token) {
      if (!token) { ui.toast("Code ou rôle incorrect", "error"); return; }
      var hash = role === "serveur" ? "#/serveur/" : role === "caissier" ? "#/caisse/" :
        role === "cuisinier" ? "#/cuisine/" : "#/agent-event/";
      window.location.href = api.lightHref(hash + token);
    }).catch(function (err) {
      ui.toast(err.message || "Erreur connexion équipe", "error");
    }).then(function () { ui.setLoading(btn, false); });
  }

  function doAffiliateLogin() {
    var id = (ui.$("aff-id") && ui.$("aff-id").value || "").trim();
    var pass = (ui.$("aff-pass") && ui.$("aff-pass").value || "").trim();
    if (!id || !pass) { ui.toast("Code et mot de passe requis", "error"); return; }
    var btn = ui.$("aff-submit");
    ui.setLoading(btn, true);
    api.loginAffiliate(id, pass).then(function (doc) {
      try { localStorage.setItem(global.NACK_LIGHT.STORAGE_KEYS.affiliateSession, doc.id || doc.code); } catch (e) {}
      loadAffiliateDashboard(doc.id || doc.code);
    }).catch(function (err) {
      ui.toast(err.message || "Connexion affilié échouée", "error");
    }).then(function () { ui.setLoading(btn, false); });
  }

  function loadAffiliateDashboard(code) {
    api.getPublicDoc("affiliates/" + String(code).toUpperCase()).then(function (doc) {
      if (!doc || !doc.id) {
        ui.toast("Session affilié invalide", "error");
        affiliateLogout();
        return;
      }
      affiliate = doc;
      ui.hideEl(ui.$("screen-login"));
      ui.showEl(ui.$("screen-affiliate"));
      return api.queryReferrals(doc.code || doc.id);
    }).then(function (referrals) {
      if (!affiliate) return;
      paintAffiliateDashboard(referrals || []);
    }).catch(function () {
      ui.toast("Impossible de charger l'espace affilié", "error");
    });
  }

  function paintAffiliateDashboard(referrals) {
    var root = ui.$("affiliate-root");
    if (!root || !affiliate) return;
    var code = affiliate.code || affiliate.id;
    var totalEarned = Number(affiliate.totalEarned) || 0;
    var paid = Number(affiliate.paidEarnings) || 0;
    var balance = totalEarned - paid;
    var registerUrl = api.publicBase() + "/register?ref=" + encodeURIComponent(code);
    var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(registerUrl);

    var listHtml = "";
    for (var i = 0; i < referrals.length; i++) {
      var r = referrals[i];
      listHtml +=
        '<div class="lg-list-item"><div class="lg-list-item-main">' +
          '<div class="lg-list-item-title">' + ui.escapeHtml(r.establishmentName || "Établissement") + '</div>' +
          '<div class="lg-card-desc">' + ui.escapeHtml(r.ownerName || r.email || "—") + '</div>' +
        '</div></div>';
    }
    if (!listHtml) listHtml = '<div class="lg-empty">Aucun parrainage pour le moment</div>';

    root.innerHTML =
      '<div class="lg-affiliate-header">' +
        '<img class="lg-nack-logo" src="../icons/icon-192x192.png" alt="NACK" style="width:40px;height:40px;border-radius:10px">' +
        '<span>Espace affilié</span>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="aff-logout">Déconnexion</button>' +
      '</div>' +
      '<div class="lg-card">' +
        '<div class="lg-card-title">' + ui.escapeHtml(affiliate.name || "Partenaire") + '</div>' +
        '<div class="lg-card-desc">Code : <strong>' + ui.escapeHtml(code) + '</strong></div>' +
        '<div class="lg-stats" style="margin-top:12px">' +
          '<div class="lg-stat"><div class="lg-stat-label">Parrainages</div><div class="lg-stat-value">' + (referrals.length || affiliate.referralCount || 0) + '</div></div>' +
          '<div class="lg-stat"><div class="lg-stat-label">Total cumulé</div><div class="lg-stat-value">' + ui.escapeHtml(ui.formatMoney(totalEarned)) + '</div></div>' +
          '<div class="lg-stat"><div class="lg-stat-label">Solde</div><div class="lg-stat-value">' + ui.escapeHtml(ui.formatMoney(balance)) + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="lg-card">' +
        '<div class="lg-card-title">Lien de parrainage</div>' +
        '<div class="lg-qr-box"><img src="' + ui.escapeHtml(qrUrl) + '" alt="QR parrainage"></div>' +
        '<div class="lg-link-box">' + ui.escapeHtml(registerUrl) + '</div>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block lg-btn-icon" data-action="copy-text" data-arg="' + ui.escapeHtml(registerUrl) + '">' +
          icon("copy", 18) + ' Copier le lien</button>' +
      '</div>' +
      '<div class="lg-section-title">Établissements parrainés</div>' + listHtml +
      '<a class="lg-btn lg-btn-outline lg-btn-block" style="margin-top:12px;text-align:center;display:block" href="https://wa.me/24104746847?text=' +
        encodeURIComponent("Bonjour, je souhaite récupérer mes commissions Nack!\nCode : " + code + "\nSolde : " + balance + " XAF") +
        '" target="_blank" rel="noopener">Récupérer mes commissions (WhatsApp)</a>';
  }

  function affiliateLogout() {
    affiliate = null;
    try { localStorage.removeItem(global.NACK_LIGHT.STORAGE_KEYS.affiliateSession); } catch (e) {}
    ui.hideEl(ui.$("screen-affiliate"));
    ui.showEl(ui.$("screen-login"));
  }

  global.NACK_LIGHT.login = {
    init: init, setLoginType: setLoginType,
    doTeamLogin: doTeamLogin, doAffiliateLogin: doAffiliateLogin,
    affiliateLogout: affiliateLogout
  };
})(window);
