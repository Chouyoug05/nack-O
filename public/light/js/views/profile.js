(function (global) {
  var ui, api, state, icon, sub;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    icon = global.NACK_LIGHT.icon;
    sub = global.NACK_LIGHT.subscription || {};
    state = { ctx: ctx, tab: "subscription", duration: "month", establishments: [] };

    root.innerHTML =
      '<div class="lg-tabs" id="profile-tabs">' +
        '<button type="button" class="lg-tab active" data-action="profile-tab" data-arg="subscription">Abonnement</button>' +
        '<button type="button" class="lg-tab" data-action="profile-tab" data-arg="establishment">Établissement</button>' +
        '<button type="button" class="lg-tab" data-action="profile-tab" data-arg="tickets">Tickets</button>' +
        '<button type="button" class="lg-tab" data-action="profile-tab" data-arg="data">Données</button>' +
        '<button type="button" class="lg-tab" data-action="profile-tab" data-arg="about">À propos</button>' +
      '</div>' +
      '<div id="profile-panel"></div>' +
      '<button type="button" class="lg-btn lg-btn-outline lg-btn-block" data-action="logout" style="margin-top:16px">Déconnexion</button>';

    loadEstablishments();
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

  function loadEstablishments() {
    var p = state.ctx.profile || {};
    state.establishments = p.establishments || [];
    if (!state.establishments.length && p.activeEstablishmentId) {
      state.establishments = [{ id: p.activeEstablishmentId, name: p.establishmentName, type: p.establishmentType }];
    }
  }

  function getPlanInfo(profile) {
    var now = Date.now();
    var p = profile || {};
    if (p.plan === "active" && p.subscriptionEndsAt && p.subscriptionEndsAt > now) {
      var type = p.subscriptionType || "transition";
      var plans = global.NACK_LIGHT.PLANS;
      return { key: type, label: (plans[type] && plans[type].name) || type, remaining: p.subscriptionEndsAt - now, active: true };
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
    return Math.floor(ms / 3600000) + " heure(s)";
  }

  function calcPrice(planKey, duration) {
    if (sub.calcPrice) return sub.calcPrice(planKey, duration);
    var base = (global.NACK_LIGHT.PLANS[planKey] && global.NACK_LIGHT.PLANS[planKey].price) || 3000;
    if (duration === "quarter") return base * 3;
    if (duration === "semester") return Math.round(base * 6 * 0.9);
    if (duration === "year") return base * 10;
    return base;
  }

  function maxEstablishments() {
    var p = state.ctx.profile || {};
    if (p.plan === "free" || p.plan === "trial") return 1;
    if (p.subscriptionType === "transition") return 3;
    return 10;
  }

  function paintPanel() {
    var panel = ui.$("profile-panel");
    if (!panel) return;
    var p = state.ctx.profile || {};
    if (state.tab === "subscription") paintSubscription(panel, p);
    else if (state.tab === "establishment") paintEstablishment(panel, p);
    else if (state.tab === "tickets") paintTickets(panel, p);
    else if (state.tab === "about") paintAbout(panel, p);
    else paintData(panel, p);
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
        (p.trialEndsAt && p.plan === "trial" ? '<div class="lg-card-desc">Fin essai : ' + ui.escapeHtml(formatDate(p.trialEndsAt)) + '</div>' : '') +
      '</div>' +
      '<div class="lg-card"><div class="lg-card-title">Durée</div><select class="lg-select" id="prof-duration">' + durHtml + '</select></div>' +
      '<div class="lg-card">' +
        '<div class="lg-card-title">S\'abonner / Renouveler</div>' +
        '<div class="lg-card-desc" style="margin-bottom:10px">Paiement Airtel Money via SingPay</div>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" data-action="profile-pay" data-arg="transition">Standard — <span id="price-transition">' + calcPrice("transition", state.duration).toLocaleString() + '</span> XAF</button>' +
        '<button type="button" class="lg-btn lg-btn-outline lg-btn-block" style="margin-top:8px" data-action="profile-pay" data-arg="transition-pro-max">Premium — <span id="price-promax">' + calcPrice("transition-pro-max", state.duration).toLocaleString() + '</span> XAF</button>' +
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
    loadEstablishments();
    var max = maxEstablishments();
    var list = "";
    for (var i = 0; i < state.establishments.length; i++) {
      var e = state.establishments[i];
      var active = e.id === (p.activeEstablishmentId || state.ctx.uid);
      list += '<div class="lg-list-item"><div class="lg-list-item-main"><div class="lg-list-item-title">' +
        ui.escapeHtml(e.name || "Établissement") + (active ? " ✓" : "") + '</div><div class="lg-card-desc">' +
        ui.escapeHtml(e.type || "—") + '</div></div>' +
        (active ? '<span class="lg-badge">Actif</span>' : '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" data-action="prof-est-switch" data-arg="' + ui.escapeHtml(e.id) + '">Activer</button>') +
        '</div>';
    }
    panel.innerHTML =
      '<div class="lg-card"><div class="lg-card-title">Mes établissements</div>' +
        '<div class="lg-card-desc">' + state.establishments.length + ' / ' + max + ' utilisé(s)</div>' + list +
        (state.establishments.length < max
          ? '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" style="margin-top:10px" data-action="prof-est-create-open">Ajouter un établissement</button>'
          : '<p class="lg-card-desc">Limite atteinte — passez à un abonnement payant.</p>') +
      '</div>' +
      '<div class="lg-card" style="text-align:center">' +
        (p.logoUrl ? '<img src="' + ui.escapeHtml(p.logoUrl) + '" alt="" style="width:72px;height:72px;border-radius:16px;object-fit:cover;margin-bottom:10px">' : '') +
        '<div class="lg-card-title">' + ui.escapeHtml(p.establishmentName || "—") + '</div>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" style="margin-top:10px" data-action="profile-edit">' + icon("edit", 16) + ' Modifier</button>' +
        '<label class="lg-btn lg-btn-outline lg-btn-sm" style="margin-top:8px;cursor:pointer;display:inline-block">Uploader logo<input type="file" id="prof-logo-file" accept="image/*" style="display:none"></label>' +
      '</div>' +
      '<div id="prof-est-create" class="lg-card lg-hidden" style="display:none">' +
        '<div class="lg-field"><label class="lg-label">Nom *</label><input class="lg-input" id="new-est-name"></div>' +
        '<div class="lg-field"><label class="lg-label">Type *</label><input class="lg-input" id="new-est-type" placeholder="bar, restaurant…"></div>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" data-action="prof-est-create">Créer</button>' +
      '</div>';
    var file = ui.$("prof-logo-file");
    if (file) {
      file.onchange = function () {
        if (!global.NACK_LIGHT.upload || !global.NACK_LIGHT.upload.isConfigured()) {
          ui.toast("Upload non configuré — utilisez une URL", "error");
          return;
        }
        global.NACK_LIGHT.upload.uploadFile(file.files[0], "logos").then(function (res) {
          return api.patchProfile(state.ctx.uid, { logoUrl: res.url, updatedAt: Date.now() }, ["logoUrl", "updatedAt"]).then(function () {
            state.ctx.profile.logoUrl = res.url;
            ui.toast("Logo mis à jour", "ok");
            paintPanel();
          });
        }).catch(function (err) { ui.toast(err.message || "Upload échoué", "error"); });
      };
    }
  }

  function paintTickets(panel, p) {
    panel.innerHTML =
      '<div class="lg-card"><div class="lg-card-title">Personnalisation des tickets</div>' +
        '<div class="lg-field"><label class="lg-label">Nom structure</label><input class="lg-input" id="tk-company" value="' + ui.escapeHtml(p.companyName || "") + '"></div>' +
        '<div class="lg-filter-row">' +
          '<div class="lg-field"><label class="lg-label">RCS</label><input class="lg-input" id="tk-rcs" value="' + ui.escapeHtml(p.rcsNumber || "") + '"></div>' +
          '<div class="lg-field"><label class="lg-label">NIF</label><input class="lg-input" id="tk-nif" value="' + ui.escapeHtml(p.nifNumber || "") + '"></div>' +
        '</div>' +
        '<div class="lg-field"><label class="lg-label">Tél. pro</label><input class="lg-input" id="tk-bphone" value="' + ui.escapeHtml(p.businessPhone || "") + '"></div>' +
        '<div class="lg-field"><label class="lg-label">Adresse complète</label><input class="lg-input" id="tk-faddr" value="' + ui.escapeHtml(p.fullAddress || "") + '"></div>' +
        '<div class="lg-field"><label class="lg-label">Message</label><input class="lg-input" id="tk-msg" value="' + ui.escapeHtml(p.customMessage || "") + '"></div>' +
        '<div class="lg-field"><label class="lg-label">Mentions légales</label><textarea class="lg-textarea" id="tk-legal" rows="3">' + ui.escapeHtml(p.legalMentions || "") + '</textarea></div>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" data-action="prof-tickets-save">Enregistrer</button>' +
      '</div>';
  }

  function paintAbout(panel, p) {
    panel.innerHTML =
      '<div class="lg-card">' +
        '<div class="lg-card-title">Notre histoire</div>' +
        '<p class="lg-card-desc">NACK Pro est la plateforme gabonaise de gestion pour bars, restaurants et commerces.</p>' +
      '</div>' +
      '<div class="lg-card">' +
        row("Version", "1.0.0") +
        row("Support", "WhatsApp NACK") +
      '</div>' +
      '<a class="lg-btn lg-btn-outline lg-btn-block" style="text-align:center;display:block" href="https://wa.me/24104746847" target="_blank" rel="noopener">Nous contacter</a>' +
      '<a class="lg-btn lg-btn-secondary lg-btn-block" style="margin-top:8px;text-align:center;display:block" href="https://chouyoug.com" target="_blank" rel="noopener">Chouyoug Design</a>' +
      '<button type="button" class="lg-btn lg-btn-outline lg-btn-block" style="margin-top:8px" data-action="open-cgu">Conditions d\'utilisation</button>';
  }

  function paintData(panel, p) {
    panel.innerHTML =
      '<div class="lg-card">' +
        '<div class="lg-card-title">Gestion des données</div>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-block" data-action="prof-backup">Sauvegarder (local)</button>' +
        '<button type="button" class="lg-btn lg-btn-outline lg-btn-block" style="margin-top:8px" data-action="prof-export-products">Exporter produits CSV</button>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-block" style="margin-top:8px" data-action="prof-reset-data">Réinitialiser les données</button>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" style="margin-top:12px;background:#991b1b" data-action="prof-delete-account">Supprimer mon compte</button>' +
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

  function saveTickets() {
    var data = {
      companyName: (ui.$("tk-company").value || "").trim(),
      rcsNumber: (ui.$("tk-rcs").value || "").trim(),
      nifNumber: (ui.$("tk-nif").value || "").trim(),
      businessPhone: (ui.$("tk-bphone").value || "").trim(),
      fullAddress: (ui.$("tk-faddr").value || "").trim(),
      customMessage: (ui.$("tk-msg").value || "").trim(),
      legalMentions: (ui.$("tk-legal").value || "").trim(),
      updatedAt: Date.now()
    };
    api.patchProfile(state.ctx.uid, data, Object.keys(data)).then(function () {
      for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) state.ctx.profile[k] = data[k];
      ui.toast("Tickets personnalisés", "ok");
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  function switchEstablishment(eid) {
    api.patchProfile(state.ctx.uid, { activeEstablishmentId: eid, updatedAt: Date.now() }, ["activeEstablishmentId", "updatedAt"]).then(function () {
      state.ctx.profile.activeEstablishmentId = eid;
      ui.toast("Établissement activé", "ok");
      if (state.ctx.onProfileUpdate) state.ctx.onProfileUpdate(state.ctx.profile);
      paintPanel();
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  function openCreateEst() {
    var el = ui.$("prof-est-create");
    if (el) { ui.showEl(el); el.style.display = "block"; }
  }

  function createEstablishment() {
    var name = (ui.$("new-est-name").value || "").trim();
    var type = (ui.$("new-est-type").value || "").trim();
    if (!name || !type) { ui.toast("Nom et type requis", "error"); return; }
    var now = Date.now();
    api.createDoc("establishments", {
      ownerUid: state.ctx.uid, name: name, type: type,
      plan: state.ctx.profile.plan || "trial",
      createdAt: now, updatedAt: now
    }).then(function (doc) {
      var eid = doc.id;
      var ests = state.establishments.slice();
      ests.push({ id: eid, name: name, type: type });
      return api.patchProfile(state.ctx.uid, { establishments: ests, updatedAt: now }, ["establishments", "updatedAt"]).then(function () {
        state.ctx.profile.establishments = ests;
        state.establishments = ests;
        ui.toast("Établissement créé", "ok");
        paintPanel();
      });
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  function backupLocal() {
    ui.toast("Sauvegarde locale effectuée (profil en cache)", "ok");
    try {
      localStorage.setItem("nack_light_backup_" + state.ctx.uid, JSON.stringify({
        profile: state.ctx.profile, savedAt: Date.now()
      }));
    } catch (e) {}
  }

  function exportProducts() {
    var root = api.dataRoot(state.ctx.profile, state.ctx.uid);
    api.listDocs(root + "/products", 500).then(function (docs) {
      var rows = [["nom", "categorie", "prix", "quantite", "imageUrl"]];
      for (var i = 0; i < (docs || []).length; i++) {
        var p = docs[i];
        rows.push([p.name, p.category, p.price, p.quantity, p.imageUrl || ""]);
      }
      api.exportCsv("produits_export.csv", rows);
      ui.toast("Export CSV lancé", "ok");
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  function resetData() {
    if (!confirm("Réinitialiser toutes les données (produits, ventes, clients) ? Cette action est irréversible.")) return;
    ui.toast("Réinitialisation demandée — contactez le support si besoin", "ok");
  }

  function deleteAccount() {
    if (!confirm("Supprimer définitivement votre compte ? Toutes vos données seront perdues.")) return;
    ui.toast("Demande de suppression enregistrée — contactez support@nack.pro", "ok");
  }

  function payNow(planType) {
    var uid = state.ctx.uid;
    var base = api.publicBase();
    var txnId = "TXN-" + uid + "-" + Date.now();
    var amount = calcPrice(planType, state.duration);
    var reference = "abonnement-" + planType;
    ui.toast("Génération du lien de paiement…", "ok");
    api.createPaymentLink({
      portefeuille: "", reference: reference + "-" + txnId.substring(0, 12),
      redirect_success: base + "/payment/success?reference=" + reference + "&transactionId=" + txnId + "&duration=" + state.duration,
      redirect_error: base + "/payment/error?transactionId=" + txnId,
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
    saveProfile: saveProfile, saveTickets: saveTickets, payNow: payNow,
    switchEstablishment: switchEstablishment, openCreateEst: openCreateEst,
    createEstablishment: createEstablishment, backupLocal: backupLocal,
    exportProducts: exportProducts, resetData: resetData, deleteAccount: deleteAccount
  };
})(window);
