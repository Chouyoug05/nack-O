(function (global) {
  var ui, api, state;
  var estLib = function () { return global.NACK_LIGHT.establishment || {}; };

  function getMainCategories() { return estLib().MAIN_CATEGORIES || []; }
  function getEstTypes() { return estLib().ESTABLISHMENT_TYPES || []; }

  function routeRoot() { return ui.$("route-root"); }

  function isShopFlow() {
    return state.mainCategory === "boutique" || state.mainCategory === "commerce";
  }

  function applyRegisterTheme() {
    if (estLib().applyTheme) {
      estLib().applyTheme({ establishmentType: state.form.establishmentType || (isShopFlow() ? "boutique" : "restaurant") });
    }
  }

  function parseHashParams() {
    var out = {};
    var hash = window.location.hash || "";
    var search = window.location.search || "";
    var parts = (hash.indexOf("?") >= 0 ? hash.split("?")[1] : search.replace(/^\?/, "")).split("&");
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split("=");
      if (kv[0]) out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
    }
    if (hash.indexOf("mode=affiliate") >= 0) out.mode = "affiliate";
    return out;
  }

  function getRefCode() {
    var p = parseHashParams();
    return p.ref || "";
  }

  function isAffiliateMode() {
    var p = parseHashParams();
    if (p.mode === "affiliate") return true;
    var hash = window.location.hash || "";
    return hash.indexOf("mode=affiliate") >= 0;
  }

  function defaultForm() {
    return {
      establishmentName: "", establishmentType: "", ownerName: "",
      email: "", phone: "", whatsapp: "", password: "", confirmPassword: "",
      logoUrl: "", address: "", latitude: null, longitude: null
    };
  }

  function render(root) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    state = {
      form: defaultForm(),
      step: 1,
      mainCategory: null,
      affiliateStep: 1,
      affiliateCode: "",
      terms: false,
      isAffiliate: isAffiliateMode()
    };
    paint(root);
  }

  function paint(root) {
    if (state.isAffiliate) paintAffiliate(root);
    else paintManager(root);
  }

  function progressBar() {
    var html = '<div class="lg-progress-steps">';
    for (var s = 1; s <= 5; s++) {
      html += '<div class="lg-progress-step' + (state.step >= s ? " done" : "") + '"></div>';
    }
    return html + '</div>';
  }

  function paintManager(root) {
    applyRegisterTheme();
    var shop = isShopFlow();
    var html =
      '<div class="lg-login"><div class="lg-login-box" style="max-width:520px">' +
        '<img class="lg-login-logo-img" src="../Design%20sans%20titre.svg" alt="NACK!" onerror="this.src=\'../icons/icon-192x192.png\';this.className=\'lg-login-logo-img lg-login-logo-fallback\';">' +
        '<h1>' + (shop ? "Créer ma boutique" : "Créer un compte") + '</h1>' +
        '<p class="subtitle">Étape ' + state.step + ' sur 5</p>' +
        progressBar() +
        '<div id="reg-step-panel"></div>' +
        '<div class="lg-row-actions" style="margin-top:16px">' +
          (state.step > 1 ? '<button type="button" class="lg-btn lg-btn-secondary" data-action="reg-prev">Précédent</button>' : '<span></span>') +
          (state.step < 5 ? '<button type="button" class="lg-btn lg-btn-nack" data-action="reg-next">Suivant</button>' : '') +
        '</div>' +
        '<p class="lg-field-hint" style="text-align:center;margin-top:12px">Déjà un compte ? <a href="#/" data-action="route-nav" data-arg="">Se connecter</a></p>' +
      '</div></div>';
    root.innerHTML = html;
    paintManagerStep();
  }

  function paintManagerStep() {
    var panel = ui.$("reg-step-panel");
    if (!panel) return;
    var f = state.form;
    if (state.step === 1) {
      if (!state.mainCategory) {
        var cats = "";
        var MAIN_CATEGORIES = getMainCategories();
        for (var i = 0; i < MAIN_CATEGORIES.length; i++) {
          var c = MAIN_CATEGORIES[i];
          cats += '<button type="button" class="lg-type-card" data-action="reg-main-cat" data-arg="' + c.id + '">' +
            '<strong>' + ui.escapeHtml(c.label) + '</strong><span class="lg-card-desc">' + ui.escapeHtml(c.desc) + '</span></button>';
        }
        panel.innerHTML = '<p class="lg-label">Quelle est votre activité ? *</p><div class="lg-type-grid">' + cats + '</div>';
      } else {
        var types = "";
        var ESTABLISHMENT_TYPES = getEstTypes();
        for (var j = 0; j < ESTABLISHMENT_TYPES.length; j++) {
          var t = ESTABLISHMENT_TYPES[j];
          if (t.main !== state.mainCategory) continue;
          types += '<button type="button" class="lg-type-card' + (f.establishmentType === t.value ? " active" : "") +
            '" data-action="reg-est-type" data-arg="' + t.value + '">' + ui.escapeHtml(t.label) + '</button>';
        }
        var typeLabel = isShopFlow() ? "Type de boutique *" : "Type d'établissement *";
        panel.innerHTML =
          '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="reg-main-back">← Retour</button>' +
          '<p class="lg-label" style="margin-top:12px">' + typeLabel + '</p><div class="lg-type-grid">' + types + '</div>';
      }
    } else if (state.step === 2) {
      var nameLabel = isShopFlow() ? "Nom de la boutique *" : "Nom de l'établissement *";
      panel.innerHTML =
        '<div class="lg-field"><label class="lg-label">' + nameLabel + '</label><input class="lg-input" id="reg-est-name" value="' + ui.escapeHtml(f.establishmentName) + '"></div>' +
        '<div class="lg-field"><label class="lg-label">Nom complet du gérant *</label><input class="lg-input" id="reg-owner" value="' + ui.escapeHtml(f.ownerName) + '"></div>';
    } else if (state.step === 3) {
      panel.innerHTML =
        '<div class="lg-field"><label class="lg-label">Email *</label><input class="lg-input" id="reg-email" type="email" value="' + ui.escapeHtml(f.email) + '"></div>' +
        '<div class="lg-field"><label class="lg-label">WhatsApp *</label><input class="lg-input" id="reg-whatsapp" placeholder="+241..." value="' + ui.escapeHtml(f.whatsapp) + '"></div>' +
        '<div class="lg-field"><label class="lg-label">Téléphone</label><input class="lg-input" id="reg-phone" value="' + ui.escapeHtml(f.phone) + '"></div>';
    } else if (state.step === 4) {
      panel.innerHTML =
        '<div class="lg-field"><label class="lg-label">Adresse *</label><input class="lg-input" id="reg-address" value="' + ui.escapeHtml(f.address) + '"></div>' +
        '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" data-action="reg-geo">Utiliser ma position</button>';
    } else if (state.step === 5) {
      panel.innerHTML =
        '<div class="lg-field"><label class="lg-label">Mot de passe *</label><input class="lg-input" id="reg-pass" type="password" value="' + ui.escapeHtml(f.password) + '"></div>' +
        '<div class="lg-field"><label class="lg-label">Confirmer *</label><input class="lg-input" id="reg-pass2" type="password" value="' + ui.escapeHtml(f.confirmPassword) + '"></div>' +
        '<label class="lg-check"><input type="checkbox" id="reg-terms"' + (state.terms ? " checked" : "") + '> J\'accepte les conditions d\'utilisation de NACK!</label>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" style="margin-top:12px" data-action="reg-submit" id="reg-submit">Créer mon compte</button>';
    }
  }

  function paintAffiliate(root) {
    if (state.affiliateStep === 2) {
      root.innerHTML =
        '<div class="lg-login"><div class="lg-login-box" style="text-align:center">' +
          '<h1>Félicitations !</h1>' +
          '<p class="subtitle">Votre compte affilié a été créé. Notez votre code :</p>' +
          '<div class="lg-code-box">' + ui.escapeHtml(state.affiliateCode) + '</div>' +
          '<a class="lg-btn lg-btn-nack lg-btn-block" href="' + ui.escapeHtml(api.lightHref("")) + '">Accéder à mon espace</a>' +
        '</div></div>';
      return;
    }
    var f = state.form;
    root.innerHTML =
      '<div class="lg-login"><div class="lg-login-box">' +
        '<h1>Devenir Affilié Nack</h1>' +
        '<p class="subtitle">Gagnez des revenus en parrainant des établissements.</p>' +
        '<div class="lg-field"><input class="lg-input" id="aff-reg-name" placeholder="Nom complet" value="' + ui.escapeHtml(f.ownerName) + '"></div>' +
        '<div class="lg-field"><input class="lg-input" id="aff-reg-email" type="email" placeholder="Email" value="' + ui.escapeHtml(f.email) + '"></div>' +
        '<div class="lg-field"><input class="lg-input" id="aff-reg-wa" placeholder="WhatsApp (+241...)" value="' + ui.escapeHtml(f.whatsapp) + '"></div>' +
        '<div class="lg-filter-row"><input class="lg-input" id="aff-reg-pass" type="password" placeholder="Mot de passe">' +
        '<input class="lg-input" id="aff-reg-pass2" type="password" placeholder="Confirmer"></div>' +
        '<label class="lg-check"><input type="checkbox" id="aff-reg-terms"' + (state.terms ? " checked" : "") + '> J\'accepte les conditions d\'utilisation</label>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" data-action="aff-reg-submit" id="aff-reg-submit">Créer mon compte partenaire</button>' +
        '<a class="lg-btn lg-btn-outline lg-btn-block" style="margin-top:10px;text-align:center;display:block" href="' + ui.escapeHtml(api.lightHref("")) + '">Annuler</a>' +
      '</div></div>';
  }

  function readStepFields() {
    var f = state.form;
    if (state.step === 2) {
      var est = ui.$("reg-est-name");
      if (est) f.establishmentName = est.value.trim();
      f.ownerName = (ui.$("reg-owner") && ui.$("reg-owner").value || "").trim();
    } else if (state.step === 3) {
      f.email = (ui.$("reg-email") && ui.$("reg-email").value || "").trim();
      f.whatsapp = (ui.$("reg-whatsapp") && ui.$("reg-whatsapp").value || "").trim();
      f.phone = (ui.$("reg-phone") && ui.$("reg-phone").value || "").trim();
    } else if (state.step === 4) {
      f.address = (ui.$("reg-address") && ui.$("reg-address").value || "").trim();
    } else if (state.step === 5) {
      f.password = (ui.$("reg-pass") && ui.$("reg-pass").value || "");
      f.confirmPassword = (ui.$("reg-pass2") && ui.$("reg-pass2").value || "");
      state.terms = !!(ui.$("reg-terms") && ui.$("reg-terms").checked);
    }
  }

  function validateStep() {
    var f = state.form;
    if (state.step === 1) return !!f.establishmentType;
    if (state.step === 2) return !!(f.establishmentName && f.ownerName);
    if (state.step === 3) return !!(f.email && f.whatsapp);
    if (state.step === 4) return !!f.address;
    if (state.step === 5) {
      return !!(f.password && f.password.length >= 6 && f.password === f.confirmPassword && state.terms);
    }
    return true;
  }

  function next() {
    readStepFields();
    if (!validateStep()) { ui.toast("Veuillez remplir les champs requis", "error"); return; }
    state.step++;
    var root = routeRoot();
    if (root) paint(root);
  }

  function prev() {
    readStepFields();
    state.step = Math.max(1, state.step - 1);
    var root = routeRoot();
    if (root) paint(root);
  }

  function setMainCategory(id) {
    state.mainCategory = id || null;
    state.form.establishmentType = "";
    applyRegisterTheme();
    paintManagerStep();
  }

  function setEstType(val) {
    state.form.establishmentType = val;
    applyRegisterTheme();
    paintManagerStep();
  }

  function useGeo() {
    if (!navigator.geolocation) { ui.toast("Géolocalisation non supportée", "error"); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      state.form.latitude = pos.coords.latitude;
      state.form.longitude = pos.coords.longitude;
      var addr = state.form.latitude.toFixed(6) + ", " + state.form.longitude.toFixed(6);
      state.form.address = addr;
      var input = ui.$("reg-address");
      if (input) input.value = addr;
      ui.toast("Position enregistrée", "ok");
    }, function () {
      ui.toast("Erreur de géolocalisation", "error");
    }, { enableHighAccuracy: true, timeout: 10000 });
  }

  function submitManager() {
    readStepFields();
    if (!validateStep()) { ui.toast("Vérifiez le formulaire", "error"); return; }
    var f = state.form;
    var btn = ui.$("reg-submit");
    ui.setLoading(btn, true);
    var now = Date.now();
    var sevenDays = 7 * 24 * 60 * 60 * 1000;
    var refCode = getRefCode();
    api.signUp(f.email, f.password).then(function (res) {
      var uid = res.localId;
      var profile = {
        uid: uid,
        establishmentName: f.establishmentName || f.ownerName,
        establishmentType: f.establishmentType,
        ownerName: f.ownerName,
        email: f.email,
        phone: f.phone || "",
        whatsapp: f.whatsapp,
        logoUrl: f.logoUrl || "",
        address: f.address,
        latitude: f.latitude,
        longitude: f.longitude,
        locationAsked: true,
        referredBy: refCode || null,
        plan: "trial",
        trialEndsAt: now + sevenDays,
        activeEstablishmentId: uid,
        establishments: [{ id: uid, name: f.establishmentName || f.ownerName, type: f.establishmentType }],
        createdAt: now,
        updatedAt: now
      };
      return api.setDoc("profiles/" + uid, profile, false).then(function () {
        return api.setDoc("establishments/" + uid, {
          id: uid,
          ownerUid: uid,
          name: profile.establishmentName,
          type: f.establishmentType,
          ownerName: f.ownerName,
          email: f.email,
          phone: f.phone || "",
          plan: "trial",
          trialEndsAt: now + sevenDays,
          createdAt: now,
          updatedAt: now
        }, false);
      });
    }).then(function () {
      ui.toast("Inscription réussie !", "ok");
      window.location.href = api.lightHref("#/configure-tickets");
    }).catch(function (err) {
      ui.toast(err.message || "Erreur inscription", "error");
    }).then(function () { ui.setLoading(btn, false); });
  }

  function submitAffiliate() {
    var f = state.form;
    f.ownerName = (ui.$("aff-reg-name") && ui.$("aff-reg-name").value || "").trim();
    f.email = (ui.$("aff-reg-email") && ui.$("aff-reg-email").value || "").trim();
    f.whatsapp = (ui.$("aff-reg-wa") && ui.$("aff-reg-wa").value || "").trim();
    f.password = (ui.$("aff-reg-pass") && ui.$("aff-reg-pass").value || "");
    f.confirmPassword = (ui.$("aff-reg-pass2") && ui.$("aff-reg-pass2").value || "");
    state.terms = !!(ui.$("aff-reg-terms") && ui.$("aff-reg-terms").checked);
    if (!f.ownerName || !f.email || !f.whatsapp || !f.password) {
      ui.toast("Champs manquants", "error"); return;
    }
    if (f.password !== f.confirmPassword) { ui.toast("Mots de passe différents", "error"); return; }
    if (!state.terms) { ui.toast("Acceptez les conditions", "error"); return; }
    var btn = ui.$("aff-reg-submit");
    ui.setLoading(btn, true);
    var code = "AFF-" + Math.random().toString(36).substring(2, 6).toUpperCase();
    api.setDoc("affiliates/" + code, {
      code: code,
      name: f.ownerName,
      email: f.email,
      whatsapp: f.whatsapp,
      password: f.password,
      referralCount: 0,
      totalEarned: 0,
      createdAt: Date.now(),
      createdBy: "self-registration"
    }, true).then(function () {
      state.affiliateCode = code;
      state.affiliateStep = 2;
      var root = routeRoot();
      if (root) paint(root);
      ui.toast("Compte créé !", "ok");
    }).catch(function (err) {
      ui.toast(err.message || "Erreur", "error");
    }).then(function () { ui.setLoading(btn, false); });
  }

  function init() {
    if (document.body.getAttribute("data-nack-page") !== "register") return;
    var root = document.getElementById("auth-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "auth-root";
      document.body.appendChild(root);
    }
    render(root);
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.register = {
    render: render, next: next, prev: prev, submitManager: submitManager,
    submitAffiliate: submitAffiliate, setMainCategory: setMainCategory,
    setEstType: setEstType, useGeo: useGeo, init: init
  };

  if (document.body && document.body.getAttribute("data-nack-page") === "register") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, false);
    else init();
  }
})(window);
