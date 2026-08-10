(function (global) {
  var ui, api, icon, state, pollId;

  var FOOD_CATS = ["plat", "repas", "snack", "dessert", "entrée", "entree", "pizza", "sandwich"];

  function isFoodCategory(cat) {
    var c = String(cat || "").toLowerCase();
    for (var i = 0; i < FOOD_CATS.length; i++) {
      if (c.indexOf(FOOD_CATS[i]) !== -1) return true;
    }
    return false;
  }

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    icon = global.NACK_LIGHT.icon;
    var token = ctx.token;
    state = { token: token, agent: null, profile: null, root: root, products: [], orders: [], cart: {}, tab: "products", tableNumber: "", query: "" };

    root.innerHTML = '<div class="lg-loading">Connexion serveur…</div>';
    api.resolveAgentToken(token).then(function (agent) {
      if (!agent) { root.innerHTML = '<div class="lg-empty">Lien serveur invalide</div>'; return; }
      state.agent = agent;
      return api.getPublicProfile(agent.ownerUid).then(function (p) { state.profile = p; });
    }).then(function () {
      if (!state.agent) return;
      paintShell();
      loadProducts();
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
    var a = state.agent;
    state.root.innerHTML =
      '<div class="lg-team-header">' +
        '<div><div class="lg-card-title">' + ui.escapeHtml(a.agentName) + '</div>' +
        '<div class="lg-card-desc">Interface Serveur</div></div>' +
        '<a class="lg-btn lg-btn-secondary lg-btn-sm" href="' + ui.escapeHtml(api.lightHref("")) + '">Accueil</a>' +
      '</div>' +
      '<div class="lg-tabs">' +
        '<button type="button" class="lg-tab active" data-if-tab="products">Produits</button>' +
        '<button type="button" class="lg-tab" data-if-tab="pending">En attente</button>' +
        '<button type="button" class="lg-tab" data-if-tab="sent">Envoyées</button>' +
      '</div>' +
      '<div id="if-panel"></div>';
    bindTabs();
    setTab("products");
  }

  function bindTabs() {
    var tabs = state.root.querySelectorAll("[data-if-tab]");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].onclick = function () { setTab(this.getAttribute("data-if-tab")); };
    }
  }

  function setTab(tab) {
    state.tab = tab;
    var tabs = state.root.querySelectorAll("[data-if-tab]");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].className = "lg-tab" + (tabs[i].getAttribute("data-if-tab") === tab ? " active" : "");
    }
    if (tab === "products") paintProducts();
    else paintOrders(tab === "pending" ? "pending" : "sent");
  }

  function loadProducts() {
    api.publicListDocs(dataRoot() + "/products", 200).then(function (docs) {
      state.products = docs || [];
      if (state.tab === "products") paintProducts();
    }).catch(function () {});
  }

  function loadOrders() {
    api.publicListDocs(dataRoot() + "/orders", 100).then(function (docs) {
      var mine = [];
      var code = state.agent.agentCode;
      var tok = state.agent.agentToken;
      for (var i = 0; i < (docs || []).length; i++) {
        var o = docs[i];
        if (o.agentCode === code || o.agentToken === tok || o.agentCode === tok) mine.push(o);
      }
      mine.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      state.orders = mine;
      if (state.tab !== "products") paintOrders(state.tab === "pending" ? "pending" : "sent");
    }).catch(function () {});
  }

  function paintProducts() {
    var panel = state.root.querySelector("#if-panel");
    if (!panel) return;
    panel.innerHTML =
      '<div class="lg-field"><label class="lg-label">Table / Zone</label>' +
      '<input class="lg-input" id="sv-table" placeholder="Ex: Table 5" value="' + ui.escapeHtml(state.tableNumber) + '"></div>' +
      '<div class="lg-search"><input class="lg-input" id="sv-search" type="search" placeholder="Rechercher…"></div>' +
      '<div id="sv-cart"></div><div id="sv-grid" class="lg-grid"></div>' +
      '<div class="lg-row-actions" style="margin-top:12px">' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-block" id="sv-hold">Mettre en attente</button>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" id="sv-send">Envoyer à la caisse</button>' +
      '</div>';
    ui.$("sv-table").oninput = function () { state.tableNumber = String(ui.$("sv-table").value || ""); };
    ui.$("sv-search").oninput = function () { state.query = String(ui.$("sv-search").value || "").toLowerCase(); paintGrid(); };
    ui.$("sv-hold").onclick = function () { sendOrder("pending"); };
    ui.$("sv-send").onclick = function () { sendOrder("sent"); };
    paintCart();
    paintGrid();
  }

  function paintGrid() {
    var el = ui.$("sv-grid");
    if (!el) return;
    var q = state.query || "", html = "", count = 0;
    for (var i = 0; i < state.products.length; i++) {
      var p = state.products[i];
      if (Number(p.price || 0) <= 0) continue;
      var hay = ((p.name || "") + " " + (p.category || "")).toLowerCase();
      if (q && hay.indexOf(q) === -1) continue;
      count++;
      html += '<div><div class="lg-product-tile" data-pid="' + ui.escapeHtml(p.id) + '" role="button">' +
        '<div style="font-weight:700">' + ui.escapeHtml(p.name || "") + '</div>' +
        '<div class="price">' + ui.escapeHtml(ui.formatMoney(p.price)) + '</div></div></div>';
    }
    el.innerHTML = count ? html : '<div class="lg-empty">Aucun produit</div>';
    var tiles = el.querySelectorAll("[data-pid]");
    for (var j = 0; j < tiles.length; j++) {
      tiles[j].onclick = function () { addCart(this.getAttribute("data-pid")); };
    }
  }

  function findProduct(id) {
    for (var i = 0; i < state.products.length; i++) if (state.products[i].id === id) return state.products[i];
    return null;
  }

  function cartItems() {
    var items = [];
    for (var k in state.cart) if (Object.prototype.hasOwnProperty.call(state.cart, k)) items.push(state.cart[k]);
    return items;
  }

  function cartTotal() {
    var t = 0, items = cartItems();
    for (var i = 0; i < items.length; i++) t += items[i].price * items[i].quantity;
    return t;
  }

  function addCart(id) {
    var p = findProduct(id);
    if (!p) return;
    var line = state.cart[id];
    var qty = line ? line.quantity + 1 : 1;
    if (!isFoodCategory(p.category) && qty > (Number(p.quantity) || 0)) {
      ui.toast("Stock insuffisant", "error"); return;
    }
    state.cart[id] = { id: p.id, name: p.name, price: Number(p.price) || 0, quantity: qty, category: p.category || "" };
    paintCart();
  }

  function paintCart() {
    var el = ui.$("sv-cart");
    if (!el) return;
    var items = cartItems();
    if (!items.length) { el.innerHTML = ""; return; }
    var html = '<div class="lg-cart-panel"><div class="lg-cart-panel-title">Panier</div>';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html += '<div class="lg-cart-line"><div class="lg-list-item-main"><div class="lg-list-item-title">' +
        ui.escapeHtml(it.name) + '</div><div class="lg-list-item-meta">' + ui.escapeHtml(ui.formatMoney(it.price * it.quantity)) + '</div></div>' +
        '<div class="lg-qty"><button type="button" class="lg-btn-icon-only" data-dec="' + ui.escapeHtml(it.id) + '">' + icon("minus", 16) + '</button>' +
        '<span>' + it.quantity + '</span><button type="button" class="lg-btn-icon-only" data-inc="' + ui.escapeHtml(it.id) + '">' + icon("plus", 16) + '</button></div></div>';
    }
    html += '<div class="lg-cart-total-row"><span>Total</span><span>' + ui.escapeHtml(ui.formatMoney(cartTotal())) + '</span></div></div>';
    el.innerHTML = html;
    var decs = el.querySelectorAll("[data-dec]");
    for (var j = 0; j < decs.length; j++) {
      decs[j].onclick = function () {
        var pid = this.getAttribute("data-dec");
        if (!state.cart[pid]) return;
        if (state.cart[pid].quantity <= 1) delete state.cart[pid]; else state.cart[pid].quantity -= 1;
        paintCart();
      };
    }
    var incs = el.querySelectorAll("[data-inc]");
    for (var k = 0; k < incs.length; k++) {
      incs[k].onclick = function () { addCart(this.getAttribute("data-inc")); };
    }
  }

  function sendOrder(status) {
    var items = cartItems();
    var table = state.tableNumber || (ui.$("sv-table") && ui.$("sv-table").value || "").trim();
    if (!items.length) { ui.toast("Panier vide", "error"); return; }
    if (!table) { ui.toast("Indiquez une table", "error"); return; }
    var payload = {
      orderNumber: Math.floor(Date.now() % 100000),
      tableNumber: table,
      items: items,
      total: cartTotal(),
      status: status,
      createdAt: Date.now(),
      agentCode: state.agent.agentCode,
      agentName: state.agent.agentName,
      agentToken: state.agent.agentToken,
      agentMemberId: state.agent.memberId || null
    };
    if (items.some(function (it) { return isFoodCategory(it.category); })) {
      payload.kitchenStatus = "en-attente";
    }
    api.publicCreateDoc(dataRoot() + "/orders", payload).then(function () {
      state.cart = {};
      state.tableNumber = table;
      ui.toast(status === "pending" ? "Commande en attente" : "Commande envoyée à la caisse", "ok");
      loadOrders();
      if (state.tab === "products") paintProducts();
    }).catch(function (err) { ui.toast(err.message || "Erreur envoi", "error"); });
  }

  function paintOrders(filterStatus) {
    var panel = state.root.querySelector("#if-panel");
    if (!panel) return;
    var list = [];
    for (var i = 0; i < state.orders.length; i++) {
      if ((state.orders[i].status || "pending") === filterStatus) list.push(state.orders[i]);
    }
    if (!list.length) {
      panel.innerHTML = '<div class="lg-empty">Aucune commande ' + (filterStatus === "pending" ? "en attente" : "envoyée") + '</div>';
      return;
    }
    var html = "";
    for (var j = 0; j < list.length; j++) {
      var o = list[j];
      html += '<div class="lg-card"><div class="lg-card-title">#' + ui.escapeHtml(String(o.orderNumber || o.id)) +
        ' — Table ' + ui.escapeHtml(o.tableNumber || "—") + '</div>' +
        '<div class="lg-card-desc">' + ui.escapeHtml(ui.formatMoney(o.total)) + ' • ' + ui.escapeHtml(ui.formatDate(o.createdAt)) + '</div></div>';
    }
    panel.innerHTML = html;
  }

  global.NACK_LIGHT.interfaces = global.NACK_LIGHT.interfaces || {};
  global.NACK_LIGHT.interfaces.serveur = { render: render };
})(window);
