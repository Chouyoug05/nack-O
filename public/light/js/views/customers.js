(function (global) {
  var ui, api, state, icon;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    icon = global.NACK_LIGHT.icon;
    state = { ctx: ctx, customers: [], query: "", editingId: null };
    ensureModal();
    root.innerHTML =
      '<div class="lg-row-actions">' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm lg-btn-icon" data-action="cust-add-open">' + icon("plus", 16) + ' Nouveau client</button>' +
      '</div>' +
      '<div class="lg-search"><input class="lg-input" id="cust-search" type="search" placeholder="Rechercher un client…"></div>' +
      '<div id="cust-summary" class="lg-stats"></div>' +
      '<div id="cust-list" class="lg-loading">Chargement des clients…</div>';
    var search = ui.$("cust-search");
    if (search) {
      search.oninput = function () {
        state.query = String(search.value || "").toLowerCase();
        paint();
      };
    }
    load();
  }

  function ensureModal() {
    if (ui.$("modal-customer")) return;
    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<div id="modal-customer-overlay" class="lg-modal-overlay lg-hidden" data-action="close-modal" data-arg="modal-customer" style="display:none"></div>' +
      '<div id="modal-customer" class="lg-modal lg-hidden" style="display:none">' +
        '<button type="button" class="lg-modal-close" data-action="close-modal" data-arg="modal-customer">×</button>' +
        '<h2 id="cust-modal-title">Nouveau client</h2>' +
        '<form id="customer-form" action="javascript:void(0)">' +
          '<input type="hidden" id="cust-form-id" value="">' +
          '<div class="lg-field"><label class="lg-label">Nom *</label><input class="lg-input" id="cust-name" required></div>' +
          '<div class="lg-field"><label class="lg-label">Téléphone</label><input class="lg-input" id="cust-phone"></div>' +
          '<div class="lg-field"><label class="lg-label">Email</label><input class="lg-input" id="cust-email" type="email"></div>' +
          '<div class="lg-field"><label class="lg-label">Type fidélité</label><select class="lg-select" id="cust-loyalty"><option value="standard">Standard</option><option value="vip">VIP</option><option value="gold">Gold</option></select></div>' +
          '<div class="lg-field"><label class="lg-label">Points</label><input class="lg-input" id="cust-points" type="number" min="0" value="0"></div>' +
          '<div class="lg-modal-actions"><button type="button" class="lg-btn lg-btn-secondary" data-action="close-modal" data-arg="modal-customer">Annuler</button>' +
          '<button type="submit" class="lg-btn lg-btn-nack" id="cust-save">Enregistrer</button></div>' +
        '</form></div>';
    document.body.appendChild(wrap);
    var form = document.getElementById("customer-form");
    if (form && form.getAttribute("data-bound") !== "1") {
      form.setAttribute("data-bound", "1");
      form.addEventListener("submit", function (e) {
        if (e.preventDefault) e.preventDefault();
        saveCustomer();
      }, false);
    }
  }

  function customersPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/customers"; }

  function load() {
    api.listDocs(customersPath(), 200).then(function (docs) {
      state.customers = docs || [];
      state.customers.sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
      paint();
    }).catch(function (err) {
      var el = ui.$("cust-list");
      if (el) el.innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message) + '</div>';
    });
  }

  function paint() {
    var q = state.query || "";
    var filtered = [];
    var pointsTotal = 0;
    for (var i = 0; i < state.customers.length; i++) {
      var c = state.customers[i];
      pointsTotal += Number(c.points) || 0;
      var hay = ((c.name || "") + " " + (c.phone || "") + " " + (c.email || "")).toLowerCase();
      if (!q || hay.indexOf(q) !== -1) filtered.push(c);
    }
    var sum = ui.$("cust-summary");
    if (sum) {
      sum.innerHTML =
        '<div class="lg-stat"><div class="lg-stat-label">Clients</div><div class="lg-stat-value">' + state.customers.length + '</div></div>' +
        '<div class="lg-stat"><div class="lg-stat-label">Points fidélité</div><div class="lg-stat-value">' + pointsTotal + '</div></div>';
    }
    var list = ui.$("cust-list");
    if (!list) return;
    if (!filtered.length) {
      list.innerHTML = '<div class="lg-empty">Aucun client</div>';
      return;
    }
    var html = "";
    for (var j = 0; j < filtered.length; j++) {
      var cust = filtered[j];
      html +=
        '<div class="lg-list-item" data-action="cust-detail" data-arg="' + ui.escapeHtml(cust.id) + '" role="button">' +
          '<div class="lg-list-item-main">' +
            '<div class="lg-list-item-title">' + ui.escapeHtml(cust.name || "Client") + '</div>' +
            '<div class="lg-list-item-meta">' + ui.escapeHtml(cust.phone || "—") +
              (cust.loyaltyType ? " · " + ui.escapeHtml(cust.loyaltyType) : "") +
            '</div>' +
          '</div>' +
          '<span class="lg-badge lg-badge-ok">' + (Number(cust.points) || 0) + ' pts</span>' +
        '</div>' +
        '<div class="lg-row-actions" style="margin:-8px 0 12px 0;padding-left:12px">' +
          '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" data-action="cust-edit" data-arg="' + ui.escapeHtml(cust.id) + '">Modifier</button>' +
          '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="cust-del" data-arg="' + ui.escapeHtml(cust.id) + '">Supprimer</button>' +
        '</div>';
    }
    list.innerHTML = html;
  }

  function openAdd() {
    state.editingId = null;
    ui.$("cust-modal-title").textContent = "Nouveau client";
    ui.$("cust-form-id").value = "";
    ui.$("cust-name").value = "";
    ui.$("cust-phone").value = "";
    ui.$("cust-email").value = "";
    ui.$("cust-loyalty").value = "standard";
    ui.$("cust-points").value = "0";
    ui.openModal("modal-customer");
  }

  function openEdit(id) {
    var c = null;
    for (var i = 0; i < state.customers.length; i++) if (state.customers[i].id === id) c = state.customers[i];
    if (!c) return;
    state.editingId = id;
    ui.$("cust-modal-title").textContent = "Modifier le client";
    ui.$("cust-form-id").value = id;
    ui.$("cust-name").value = c.name || "";
    ui.$("cust-phone").value = c.phone || "";
    ui.$("cust-email").value = c.email || "";
    ui.$("cust-loyalty").value = c.loyaltyType || "standard";
    ui.$("cust-points").value = String(Number(c.points) || 0);
    ui.openModal("modal-customer");
  }

  function saveCustomer() {
    var data = {
      name: (ui.$("cust-name").value || "").trim(),
      phone: (ui.$("cust-phone").value || "").trim(),
      email: (ui.$("cust-email").value || "").trim(),
      loyaltyType: (ui.$("cust-loyalty").value || "standard"),
      points: Number(ui.$("cust-points").value) || 0,
      updatedAt: Date.now()
    };
    if (!data.name) { ui.toast("Nom requis", "error"); return; }
    var btn = ui.$("cust-save");
    ui.setLoading(btn, true);
    var id = state.editingId || (ui.$("cust-form-id").value || "");
    var chain = id
      ? api.patchDoc(customersPath() + "/" + id, data, ["name", "phone", "email", "loyaltyType", "points", "updatedAt"])
      : api.createDoc(customersPath(), Object.assign({ createdAt: Date.now() }, data));
    chain.then(function () {
      ui.closeModal("modal-customer");
      ui.toast(id ? "Client modifié" : "Client ajouté", "ok");
      load();
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); })
      .then(function () { ui.setLoading(btn, false); });
  }

  function deleteCustomer(id) {
    if (!confirm("Supprimer ce client ?")) return;
    api.deleteDoc(customersPath() + "/" + id).then(function () {
      ui.toast("Client supprimé", "ok");
      load();
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  function openDetail(id) {
    global.NACK_LIGHT._selectedCustomerId = id;
    if (state.ctx.onNavigate) state.ctx.onNavigate("customer-detail");
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.customers = {
    render: render, openAdd: openAdd, openEdit: openEdit,
    saveCustomer: saveCustomer, deleteCustomer: deleteCustomer, openDetail: openDetail
  };
})(window);
