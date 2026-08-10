(function (global) {
  var ui, api, state, icon;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    icon = global.NACK_LIGHT.icon;
    state = { ctx: ctx, tab: "qrcode", tables: [], orders: [], theme: {} };
    root.innerHTML =
      '<div class="lg-tabs" id="menu-tabs">' +
        tabBtn("qrcode", "QR Code") +
        tabBtn("tables", "Tables") +
        tabBtn("orders", "Commandes") +
        tabBtn("scanner", "Scanner") +
        tabBtn("settings", "Réglages") +
      '</div><div id="menu-panel"></div>';
    loadData();
    paintPanel();
  }

  function tabBtn(id, label) {
    return '<button type="button" class="lg-tab' + (state.tab === id ? " active" : "") + '" data-action="menu-tab" data-arg="' + id + '">' + label + '</button>';
  }

  function dataRoot() { return api.dataRoot(state.ctx.profile, state.ctx.uid); }

  function loadData() {
    api.listDocs(dataRoot() + "/tables", 100).then(function (d) { state.tables = d || []; if (state.tab === "tables") paintPanel(); }).catch(function () {});
    api.listDocs(dataRoot() + "/barOrders", 100).then(function (d) {
      state.orders = d || [];
      state.orders.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      if (state.tab === "orders") paintPanel();
    }).catch(function () {});
    api.getDoc(dataRoot() + "/menuDigital/theme").then(function (t) {
      state.theme = t || { primaryColor: "#dc2626", secondaryColor: "#181411", airtelEnabled: false, deliveryEnabled: false };
      if (state.tab === "settings") paintPanel();
    }).catch(function () {
      state.theme = { primaryColor: "#dc2626", secondaryColor: "#181411", airtelEnabled: false, deliveryEnabled: false };
    });
  }

  function setTab(tab) {
    state.tab = tab;
    var tabs = document.querySelectorAll("#menu-tabs .lg-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].className = "lg-tab" + (tabs[i].getAttribute("data-arg") === tab ? " active" : "");
    }
    paintPanel();
  }

  function publicUrl() {
    var uid = state.ctx.uid;
    var eid = state.ctx.profile && state.ctx.profile.activeEstablishmentId;
    return api.publicBase() + "/commande/" + (eid || uid);
  }

  function paintPanel() {
    var panel = ui.$("menu-panel");
    if (!panel) return;
    if (state.tab === "qrcode") paintQr(panel);
    else if (state.tab === "tables") paintTables(panel);
    else if (state.tab === "orders") paintOrders(panel);
    else if (state.tab === "scanner") paintScanner(panel);
    else paintSettings(panel);
  }

  function paintQr(panel) {
    var url = publicUrl();
    var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + encodeURIComponent(url);
    var est = (state.ctx.profile && state.ctx.profile.establishmentName) || "votre établissement";
    panel.innerHTML =
      '<div class="lg-card">' +
        '<div class="lg-card-title lg-btn-icon">' + icon("qrcode", 20) + ' Menu Digital</div>' +
        '<div class="lg-card-desc">QR Code unique pour ' + ui.escapeHtml(est) + '</div>' +
        '<div class="lg-qr-box"><img src="' + ui.escapeHtml(qrUrl) + '" alt="QR"></div>' +
        '<div class="lg-link-box">' + ui.escapeHtml(url) + '</div>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" data-action="copy-text" data-arg="' + ui.escapeHtml(url) + '">' + icon("copy", 18) + ' Copier le lien</button>' +
        '<a class="lg-btn lg-btn-outline lg-btn-block" style="margin-top:8px;text-align:center;display:block" href="' + ui.escapeHtml(url) + '" target="_blank" rel="noopener">Ouvrir le menu</a>' +
      '</div>';
  }

  function paintTables(panel) {
    var list = "";
    for (var i = 0; i < state.tables.length; i++) {
      var t = state.tables[i];
      list += '<div class="lg-list-item"><div class="lg-list-item-main"><div class="lg-list-item-title">' +
        ui.escapeHtml(t.name || "Table") + '</div><div class="lg-list-item-meta">' + ui.escapeHtml(t.type || "table") +
        (t.capacity ? " · " + t.capacity + " places" : "") + '</div></div>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="menu-del-table" data-arg="' + ui.escapeHtml(t.id) + '">Suppr.</button></div>';
    }
    if (!list) list = '<div class="lg-empty">Aucune table configurée</div>';
    panel.innerHTML =
      '<div class="lg-card">' +
        '<div class="lg-field"><label class="lg-label">Nom table/zone</label><input class="lg-input" id="menu-table-name" placeholder="Table 1"></div>' +
        '<div class="lg-filter-row">' +
          '<select class="lg-select" id="menu-table-type"><option value="table">Table</option><option value="zone">Zone</option></select>' +
          '<input class="lg-input" id="menu-table-cap" type="number" min="0" placeholder="Capacité">' +
        '</div>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" data-action="menu-add-table">Ajouter</button>' +
      '</div><div class="lg-section-title">Tables & zones</div>' + list;
  }

  function paintOrders(panel) {
    var pending = [];
    for (var i = 0; i < state.orders.length; i++) {
      var o = state.orders[i];
      if ((o.status || "pending") === "pending" || o.status === "confirmed") pending.push(o);
    }
    var html = "";
    for (var j = 0; j < pending.length; j++) {
      var ord = pending[j];
      html += '<div class="lg-card"><div class="lg-card-title">' + ui.escapeHtml(ord.tableZone || ord.tableNumber || "—") +
        '</div><div class="lg-card-desc">#' + ui.escapeHtml(String(ord.orderNumber || ord.id)) + ' — ' +
        ui.escapeHtml(ui.formatMoney(ord.total)) + '</div>' +
        '<div class="lg-row-actions" style="margin-top:8px">' +
          '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-action="menu-order-done" data-arg="' + ui.escapeHtml(ord.id) + '">Servie</button>' +
          '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="menu-order-cancel" data-arg="' + ui.escapeHtml(ord.id) + '">Annuler</button>' +
        '</div></div>';
    }
    if (!html) html = '<div class="lg-empty">Aucune commande bar</div>';
    panel.innerHTML = '<div class="lg-section-title">Commandes bar (' + pending.length + ')</div>' + html;
  }

  function paintScanner(panel) {
    panel.innerHTML =
      '<div class="lg-card">' +
        '<div class="lg-card-title">Scanner / code manuel</div>' +
        '<div class="lg-card-desc">Saisissez un code table ou commande pour l\'identifier.</div>' +
        '<div class="lg-field"><input class="lg-input" id="menu-scan-code" placeholder="Ex: TABLE-5 ou code commande"></div>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" data-action="menu-scan-submit">Valider le code</button>' +
        '<div id="menu-scan-result" style="margin-top:12px"></div>' +
      '</div>';
  }

  function paintSettings(panel) {
    var th = state.theme || {};
    panel.innerHTML =
      '<div class="lg-card">' +
        '<div class="lg-card-title">Thème du menu</div>' +
        '<div class="lg-field"><label class="lg-label">Couleur principale</label><input class="lg-input" id="menu-color-primary" type="color" value="' + ui.escapeHtml(th.primaryColor || "#dc2626") + '"></div>' +
        '<div class="lg-field"><label class="lg-label">Couleur secondaire</label><input class="lg-input" id="menu-color-secondary" type="color" value="' + ui.escapeHtml(th.secondaryColor || "#181411") + '"></div>' +
        '<label class="lg-check"><input type="checkbox" id="menu-airtel"' + (th.airtelEnabled ? " checked" : "") + '> Paiement Airtel Money</label>' +
        '<label class="lg-check"><input type="checkbox" id="menu-delivery"' + (th.deliveryEnabled ? " checked" : "") + '> Livraison activée</label>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" style="margin-top:12px" data-action="menu-save-theme">Enregistrer</button>' +
      '</div>';
  }

  function addTable() {
    var name = (ui.$("menu-table-name") && ui.$("menu-table-name").value || "").trim();
    if (!name) { ui.toast("Nom requis", "error"); return; }
    api.createDoc(dataRoot() + "/tables", {
      name: name,
      type: (ui.$("menu-table-type") && ui.$("menu-table-type").value) || "table",
      capacity: Number(ui.$("menu-table-cap") && ui.$("menu-table-cap").value) || 0,
      createdAt: Date.now()
    }).then(function () {
      ui.toast("Table ajoutée", "ok");
      loadData();
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  function delTable(id) {
    api.deleteDoc(dataRoot() + "/tables/" + id).then(function () {
      ui.toast("Table supprimée", "ok");
      loadData();
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  function orderDone(id) {
    api.patchDoc(dataRoot() + "/barOrders/" + id, { status: "served", updatedAt: Date.now() }, ["status", "updatedAt"]).then(function () {
      ui.toast("Commande servie", "ok");
      loadData();
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  function orderCancel(id) {
    api.patchDoc(dataRoot() + "/barOrders/" + id, { status: "cancelled", updatedAt: Date.now() }, ["status", "updatedAt"]).then(function () {
      ui.toast("Commande annulée", "ok");
      loadData();
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  function scanSubmit() {
    var code = (ui.$("menu-scan-code") && ui.$("menu-scan-code").value || "").trim().toUpperCase();
    var res = ui.$("menu-scan-result");
    if (!code) { ui.toast("Code requis", "error"); return; }
    var found = null;
    for (var i = 0; i < state.tables.length; i++) {
      if ((state.tables[i].name || "").toUpperCase() === code) found = state.tables[i];
    }
    for (var j = 0; j < state.orders.length; j++) {
      if (String(state.orders[j].orderNumber) === code || state.orders[j].id === code) found = state.orders[j];
    }
    if (!found) {
      if (res) res.innerHTML = '<div class="lg-empty">Code inconnu</div>';
      return;
    }
    if (res) res.innerHTML = '<div class="lg-card"><div class="lg-card-title">Code reconnu</div><div class="lg-card-desc">' + ui.escapeHtml(JSON.stringify(found.name || found.tableZone || found.id)) + '</div></div>';
    ui.toast("Code reconnu", "ok");
  }

  function saveTheme() {
    var data = {
      primaryColor: (ui.$("menu-color-primary") && ui.$("menu-color-primary").value) || "#dc2626",
      secondaryColor: (ui.$("menu-color-secondary") && ui.$("menu-color-secondary").value) || "#181411",
      airtelEnabled: !!(ui.$("menu-airtel") && ui.$("menu-airtel").checked),
      deliveryEnabled: !!(ui.$("menu-delivery") && ui.$("menu-delivery").checked),
      updatedAt: Date.now()
    };
    api.setDoc(dataRoot() + "/menuDigital/theme", data, false).then(function () {
      state.theme = data;
      ui.toast("Thème enregistré", "ok");
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.menu = {
    render: render, setTab: setTab, addTable: addTable, delTable: delTable,
    orderDone: orderDone, orderCancel: orderCancel, scanSubmit: scanSubmit, saveTheme: saveTheme
  };
})(window);
