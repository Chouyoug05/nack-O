(function (global) {
  var ui, api, icon, state, pollId;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    icon = global.NACK_LIGHT.icon;
    state = { token: ctx.token, agent: null, profile: null, root: root, orders: [], payMethods: {} };

    root.innerHTML = '<div class="lg-loading">Connexion caisse…</div>';
    api.resolveAgentToken(ctx.token).then(function (agent) {
      if (!agent) { root.innerHTML = '<div class="lg-empty">Lien caisse invalide</div>'; return; }
      state.agent = agent;
      return api.getPublicProfile(agent.ownerUid).then(function (p) { state.profile = p; });
    }).then(function () {
      if (!state.agent) return;
      paintShell();
      loadOrders();
      if (pollId) api.stopPolling(pollId);
      pollId = api.startPolling(loadOrders, 8000);
    }).catch(function (err) {
      root.innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message || "Erreur") + '</div>';
    });
  }

  function dataRoot() {
    return api.ownerDataRoot(state.agent.ownerUid, state.profile);
  }

  function paintShell() {
    state.root.innerHTML =
      '<div class="lg-team-header">' +
        '<div><div class="lg-card-title">' + ui.escapeHtml(state.agent.agentName) + '</div>' +
        '<div class="lg-card-desc">Interface Caisse</div></div>' +
        '<a class="lg-btn lg-btn-secondary lg-btn-sm" href="' + ui.escapeHtml(api.lightHref("")) + '">Accueil</a>' +
      '</div>' +
      '<div class="lg-section-title">Commandes à encaisser</div>' +
      '<div id="cs-list" class="lg-loading">Chargement…</div>';
  }

  function loadOrders() {
    api.publicListDocs(dataRoot() + "/orders", 100).then(function (docs) {
      var pending = [];
      for (var i = 0; i < (docs || []).length; i++) {
        if ((docs[i].status || "pending") === "pending") pending.push(docs[i]);
      }
      pending.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      state.orders = pending;
      paintList();
    }).catch(function () {
      var el = state.root.querySelector("#cs-list");
      if (el) el.innerHTML = '<div class="lg-empty">Impossible de charger</div>';
    });
  }

  function paintList() {
    var el = state.root.querySelector("#cs-list");
    if (!el) return;
    if (!state.orders.length) {
      el.innerHTML = '<div class="lg-empty">Aucune commande en attente</div>';
      return;
    }
    var html = "";
    for (var i = 0; i < state.orders.length; i++) {
      var o = state.orders[i];
      var pay = state.payMethods[o.id] || "cash";
      var items = o.items || [], names = [];
      for (var j = 0; j < items.length && j < 5; j++) {
        names.push((items[j].name || "") + " ×" + (items[j].quantity || 1));
      }
      html +=
        '<div class="lg-card" data-oid="' + ui.escapeHtml(o.id) + '">' +
          '<div class="lg-card-title">#' + ui.escapeHtml(String(o.orderNumber || o.id)) + ' — Table ' + ui.escapeHtml(o.tableNumber || "—") + '</div>' +
          (o.agentName ? '<div class="lg-card-desc">Serveur: ' + ui.escapeHtml(o.agentName) + '</div>' : '') +
          '<div class="lg-card-desc">' + ui.escapeHtml(names.join(", ")) + '</div>' +
          '<div style="font-weight:700;color:#dc2626;margin:8px 0">' + ui.escapeHtml(ui.formatMoney(o.total)) + '</div>' +
          '<div class="lg-pay-options">' +
            '<label><input type="radio" name="pay-' + ui.escapeHtml(o.id) + '" value="cash"' + (pay === "cash" ? " checked" : "") + '> Espèces</label>' +
            '<label><input type="radio" name="pay-' + ui.escapeHtml(o.id) + '" value="mobile"' + (pay === "mobile" ? " checked" : "") + '> Mobile</label>' +
            '<label><input type="radio" name="pay-' + ui.escapeHtml(o.id) + '" value="card"' + (pay === "card" ? " checked" : "") + '> Carte</label>' +
          '</div>' +
          '<div class="lg-row-actions" style="margin-top:10px">' +
            '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-encash="' + ui.escapeHtml(o.id) + '">Encaisser</button>' +
            '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-cancel="' + ui.escapeHtml(o.id) + '">Annuler</button>' +
          '</div></div>';
    }
    el.innerHTML = html;
    var enc = el.querySelectorAll("[data-encash]");
    for (var k = 0; k < enc.length; k++) {
      enc[k].onclick = function () { encash(this.getAttribute("data-encash")); };
    }
    var can = el.querySelectorAll("[data-cancel]");
    for (var m = 0; m < can.length; m++) {
      can[m].onclick = function () { cancelOrder(this.getAttribute("data-cancel")); };
    }
    var radios = el.querySelectorAll('input[type="radio"]');
    for (var n = 0; n < radios.length; n++) {
      radios[n].onchange = function () {
        var nm = this.name.replace("pay-", "");
        state.payMethods[nm] = this.value;
      };
    }
  }

  function findOrder(id) {
    for (var i = 0; i < state.orders.length; i++) if (state.orders[i].id === id) return state.orders[i];
    return null;
  }

  function encash(id) {
    var o = findOrder(id);
    if (!o) return;
    var method = state.payMethods[id] || "cash";
    api.publicPatchDoc(dataRoot() + "/orders/" + id, {
      status: "sent",
      paymentMethod: method,
      paidAt: Date.now(),
      agentToken: state.agent.agentToken,
      updatedAt: Date.now()
    }, ["status", "paymentMethod", "paidAt", "agentToken", "updatedAt"]).then(function () {
      ui.toast("Commande #" + (o.orderNumber || id) + " encaissée", "ok");
      loadOrders();
    }).catch(function (err) { ui.toast(err.message || "Erreur encaissement", "error"); });
  }

  function cancelOrder(id) {
    var o = findOrder(id);
    if (!o) return;
    if (!window.confirm("Annuler la commande #" + (o.orderNumber || id) + " ?")) return;
    api.publicPatchDoc(dataRoot() + "/orders/" + id, {
      status: "cancelled",
      agentToken: state.agent.agentToken,
      updatedAt: Date.now()
    }, ["status", "agentToken", "updatedAt"]).then(function () {
      ui.toast("Commande annulée", "ok");
      loadOrders();
    }).catch(function (err) { ui.toast(err.message || "Erreur annulation", "error"); });
  }

  global.NACK_LIGHT.interfaces = global.NACK_LIGHT.interfaces || {};
  global.NACK_LIGHT.interfaces.caisse = { render: render };
})(window);
