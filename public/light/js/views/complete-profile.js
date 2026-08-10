(function (global) {
  var ui, api, state;

  var ESTABLISHMENT_TYPES = [
    { value: "bar", label: "Bar" },
    { value: "restaurant", label: "Restaurant" },
    { value: "snack", label: "Snack Bar" },
    { value: "nightclub", label: "Boîte de nuit" },
    { value: "boutique", label: "Boutique" },
    { value: "commerce", label: "Commerce" },
    { value: "services", label: "Services" },
    { value: "other", label: "Autre" }
  ];

  function isComplete(profile) {
    if (global.NACK_LIGHT.profileIncomplete) return !global.NACK_LIGHT.profileIncomplete(profile);
    if (!profile) return false;
    return !!(String(profile.establishmentName || "").trim() && String(profile.ownerName || "").trim());
  }

  function goApp(hash) {
    window.location.href = api.lightHref(hash || "");
  }

  function render(root) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    var session = api.getSession();
    state = {
      uid: session.uid,
      email: session.email,
      form: {
        establishmentName: "", establishmentType: "", ownerName: "",
        phone: "", whatsapp: "", address: "", logoUrl: ""
      },
      terms: false
    };
    if (!session.idToken) {
      goApp("");
      return;
    }
    api.getProfile(session.uid).then(function (p) {
      if (isComplete(p)) {
        goApp("");
        return;
      }
      if (p) {
        state.form.establishmentName = p.establishmentName || "";
        state.form.establishmentType = p.establishmentType || "";
        state.form.ownerName = p.ownerName || "";
        state.form.phone = p.phone || "";
        state.form.whatsapp = p.whatsapp || "";
        state.form.address = p.address || "";
        state.form.logoUrl = p.logoUrl || "";
        state.form.email = p.email || session.email || "";
      }
      paint(root);
    }).catch(function () { paint(root); });
  }

  function paint(root) {
    var f = state.form;
    var types = "";
    for (var i = 0; i < ESTABLISHMENT_TYPES.length; i++) {
      var t = ESTABLISHMENT_TYPES[i];
      types += '<option value="' + t.value + '"' + (f.establishmentType === t.value ? " selected" : "") + '>' + ui.escapeHtml(t.label) + '</option>';
    }
    root.innerHTML =
      '<div class="lg-login"><div class="lg-login-box" style="max-width:520px">' +
        '<img class="lg-login-logo-img" src="../Design%20sans%20titre.svg" alt="NACK!" onerror="this.src=\'../icons/icon-192x192.png\';this.className=\'lg-login-logo-img lg-login-logo-fallback\';">' +
        '<h1>Complétez votre profil</h1>' +
        '<p class="subtitle">Quelques informations pour configurer votre établissement</p>' +
        '<form id="complete-profile-form" action="javascript:void(0)">' +
          '<div class="lg-field"><label class="lg-label">Nom établissement *</label><input class="lg-input" id="cp-est-name" required value="' + ui.escapeHtml(f.establishmentName) + '"></div>' +
          '<div class="lg-field"><label class="lg-label">Type *</label><select class="lg-select" id="cp-est-type" required><option value="">Choisir…</option>' + types + '</select></div>' +
          '<div class="lg-field"><label class="lg-label">Gérant *</label><input class="lg-input" id="cp-owner" required value="' + ui.escapeHtml(f.ownerName) + '"></div>' +
          '<div class="lg-field"><label class="lg-label">Téléphone</label><input class="lg-input" id="cp-phone" value="' + ui.escapeHtml(f.phone) + '"></div>' +
          '<div class="lg-field"><label class="lg-label">WhatsApp *</label><input class="lg-input" id="cp-whatsapp" required placeholder="+241..." value="' + ui.escapeHtml(f.whatsapp) + '"></div>' +
          '<div class="lg-field"><label class="lg-label">Adresse</label><input class="lg-input" id="cp-address" value="' + ui.escapeHtml(f.address) + '"></div>' +
          '<div class="lg-field"><label class="lg-label">Logo (URL)</label><input class="lg-input" id="cp-logo" value="' + ui.escapeHtml(f.logoUrl) + '"></div>' +
          '<label class="lg-check"><input type="checkbox" id="cp-terms"> J\'accepte les conditions d\'utilisation de NACK!</label>' +
          '<button type="submit" class="lg-btn lg-btn-nack lg-btn-block" id="cp-submit" style="margin-top:12px">Enregistrer et continuer</button>' +
        '</form>' +
      '</div></div>';
    var form = ui.$("complete-profile-form");
    if (form && form.getAttribute("data-bound") !== "1") {
      form.setAttribute("data-bound", "1");
      form.addEventListener("submit", function (e) {
        if (e.preventDefault) e.preventDefault();
        submit();
      }, false);
    }
  }

  function submit() {
    if (!ui.$("cp-terms") || !ui.$("cp-terms").checked) {
      ui.toast("Acceptez les conditions d'utilisation", "error");
      return;
    }
    var data = {
      establishmentName: (ui.$("cp-est-name").value || "").trim(),
      establishmentType: (ui.$("cp-est-type").value || "").trim(),
      ownerName: (ui.$("cp-owner").value || "").trim(),
      phone: (ui.$("cp-phone").value || "").trim(),
      whatsapp: (ui.$("cp-whatsapp").value || "").trim(),
      address: (ui.$("cp-address").value || "").trim(),
      logoUrl: (ui.$("cp-logo").value || "").trim(),
      email: state.email,
      updatedAt: Date.now()
    };
    if (!data.establishmentName || !data.establishmentType || !data.ownerName || !data.whatsapp) {
      ui.toast("Remplissez les champs obligatoires", "error");
      return;
    }
    var btn = ui.$("cp-submit");
    ui.setLoading(btn, true);
    var uid = state.uid;
    var now = Date.now();
    api.patchProfile(uid, data, ["establishmentName", "establishmentType", "ownerName", "phone", "whatsapp", "address", "logoUrl", "email", "updatedAt"]).then(function () {
      // Sync établissement : ne doit pas bloquer la sortie du formulaire
      return api.setDoc("establishments/" + uid, {
        id: uid,
        ownerUid: uid,
        name: data.establishmentName,
        type: data.establishmentType,
        ownerName: data.ownerName,
        phone: data.phone,
        whatsapp: data.whatsapp,
        email: data.email || "",
        updatedAt: now,
        createdAt: now
      }, false).catch(function () { return null; });
    }).then(function () {
      ui.toast("Profil enregistré", "ok");
      goApp("#/configure-tickets");
    }).catch(function (err) {
      ui.toast(err.message || "Erreur", "error");
    }).then(function () { ui.setLoading(btn, false); });
  }

  function init() {
    if (document.body.getAttribute("data-nack-page") !== "complete-profile") return;
    var root = document.getElementById("auth-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "auth-root";
      document.body.appendChild(root);
    }
    render(root);
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views["complete-profile"] = { render: render, submit: submit, init: init };

  if (document.body && document.body.getAttribute("data-nack-page") === "complete-profile") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, false);
    else init();
  }
})(window);
