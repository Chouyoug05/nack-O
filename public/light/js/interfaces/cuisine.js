(function (global) {
  var ui, api, state, pollId;
  var FOOD_CATS = ["plat", "repas", "snack", "dessert", "entrée", "entree", "pizza", "sandwich"];
  var STATUSES = ["en-attente", "en-preparation", "pret", "termine"];
  var STATUS_LABELS = {
    "en-attente": "En attente",
    "en-preparation": "En préparation",
    pret: "Prêt",
    termine: "Terminé"
  };
  var NEXT = { "en-attente": "en-preparation", "en-preparation": "pret", pret: "termine" };

  function isFoodCategory(cat) {
    var c = String(cat || "").toLowerCase();
    for (var i = 0; i < FOOD_CATS.length; i++) if (c.indexOf(FOOD_CATS[i]) !== -1) return true;
    return false;
  }

  function hasFood(order) {
    var items = order.items || [];
    for (var i = 0; i < items.length; i++) if (isFoodCategory(items[i].category)) return true;
    return !!(order.foodItems && order.foodItems.length);
  }

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    state = { token: ctx.token, agent: null, profile: null, root: root, orders: [] };

    root.innerHTML = '<div class="lg-loading">Connexion cuisine…</div>';
    api.resolveAgentToken(ctx.token).then(function (agent) {
      if (!agent) { root.innerHTML = '<div class="lg-empty">Lien cuisine invalide</div>'; return; }
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
        '<div class="lg-card-desc">Interface Cuisine</div></div>' +
        '<a class="lg-btn lg-btn-secondary lg-btn-sm" href="' + ui.escapeHtml(api.lightHref("")) + '">Accueil</a>' +
      '</div><div id="cu-board"></div>';
  }

  function loadOrders() {
    api.publicListDocs(dataRoot() + "/orders", 100).then(function (docs) {
      var food = [];
      for (var i = 0; i < (docs || []).length; i++) {
        var o = docs[i];
        if ((o.status || "") === "cancelled") continue;
        if (hasFood(o)) food.push(o);
      }
      food.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      state.orders = food;
      paintBoard();
    }).catch(function () {});
  }

  function foodItems(order) {
    var items = order.items || [], out = [];
    for (var i = 0; i < items.length; i++) {
      if (isFoodCategory(items[i].category)) out.push(items[i]);
    }
    return out.length ? out : (order.foodItems || items);
  }

  function paintBoard() {
    var el = state.root.querySelector("#cu-board");
    if (!el) return;
    if (!state.orders.length) {
      el.innerHTML = '<div class="lg-empty">Aucune commande alimentaire</div>';
      return;
    }
    var html = "";
    for (var s = 0; s < STATUSES.length; s++) {
      var st = STATUSES[s];
      var group = [];
      for (var i = 0; i < state.orders.length; i++) {
        var ks = state.orders[i].kitchenStatus || "en-attente";
        if (ks === st) group.push(state.orders[i]);
      }
      if (!group.length) continue;
      html += '<div class="lg-section-title">' + STATUS_LABELS[st] + ' (' + group.length + ')</div>';
      for (var j = 0; j < group.length; j++) {
        var o = group[j];
        var foods = foodItems(o), names = [];
        for (var k = 0; k < foods.length; k++) names.push(foods[k].name + " ×" + (foods[k].quantity || 1));
        html +=
          '<div class="lg-card">' +
            '<div class="lg-card-title">#' + ui.escapeHtml(String(o.orderNumber || o.id)) + ' — Table ' + ui.escapeHtml(o.tableNumber || "—") + '</div>' +
            '<div class="lg-card-desc">' + ui.escapeHtml(names.join(", ")) + '</div>' +
            (o.agentName ? '<div class="lg-card-desc">Serveur: ' + ui.escapeHtml(o.agentName) + '</div>' : '') +
            '<div class="lg-row-actions" style="margin-top:10px">';
        if (NEXT[st]) {
          html += '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-adv="' + ui.escapeHtml(o.id) + '" data-next="' + ui.escapeHtml(NEXT[st]) + '">' +
            ui.escapeHtml(STATUS_LABELS[NEXT[st]]) + '</button>';
        }
        if (st !== "en-attente") {
          html += '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-back="' + ui.escapeHtml(o.id) + '">Retour</button>';
        }
        html += '</div></div>';
      }
    }
    el.innerHTML = html;
    var adv = el.querySelectorAll("[data-adv]");
    for (var a = 0; a < adv.length; a++) {
      adv[a].onclick = function () { setStatus(this.getAttribute("data-adv"), this.getAttribute("data-next")); };
    }
    var backs = el.querySelectorAll("[data-back]");
    for (var b = 0; b < backs.length; b++) {
      backs[b].onclick = function () {
        var id = this.getAttribute("data-back");
        var order = null;
        for (var x = 0; x < state.orders.length; x++) if (state.orders[x].id === id) order = state.orders[x];
        var prev = order && order.kitchenStatus === "pret" ? "en-preparation" : "en-attente";
        setStatus(id, prev);
      };
    }
  }

  function setStatus(id, kitchenStatus) {
    api.publicPatchDoc(dataRoot() + "/orders/" + id, {
      kitchenStatus: kitchenStatus,
      agentToken: state.agent.agentToken,
      updatedAt: Date.now()
    }, ["kitchenStatus", "agentToken", "updatedAt"]).then(function () {
      ui.toast("Statut: " + (STATUS_LABELS[kitchenStatus] || kitchenStatus), "ok");
      loadOrders();
    }).catch(function (err) { ui.toast(err.message || "Erreur mise à jour", "error"); });
  }

  global.NACK_LIGHT.interfaces = global.NACK_LIGHT.interfaces || {};
  global.NACK_LIGHT.interfaces.cuisine = { render: render };
})(window);
