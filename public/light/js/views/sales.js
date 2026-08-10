(function (global) {
  var ui, api, state, icon;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    icon = global.NACK_LIGHT.icon;
    var prev = state || {};
    state = {
      ctx: ctx,
      products: [],
      orders: [],
      sales: [],
      cart: prev.cart || {},
      tab: prev.tab || "caisse",
      tableNumber: prev.tableNumber || "",
      editingOrderId: prev.editingOrderId || null,
      query: "",
      category: "all"
    };

    root.innerHTML =
      '<div class="lg-tabs lg-sales-tabs">' +
        '<button type="button" class="lg-tab' + (state.tab === "caisse" ? " active" : "") + '" data-action="sales-tab" data-arg="caisse">Caisse</button>' +
        '<button type="button" class="lg-tab' + (state.tab === "orders" ? " active" : "") + '" data-action="sales-tab" data-arg="orders" id="sales-orders-tab">' +
          'Commandes<span class="lg-tab-badge" id="orders-badge" style="display:none">0</span></button>' +
        '<button type="button" class="lg-tab' + (state.tab === "recent" ? " active" : "") + '" data-action="sales-tab" data-arg="recent">Dernières ventes</button>' +
      '</div>' +
      '<div id="sales-panel"></div>';

    if (state.tab === "orders") paintOrdersPanel();
    else if (state.tab === "recent") paintRecentPanel();
    else paintCaissePanel();
    loadProducts();
    loadOrders();
    loadRecentSales();
  }

  function productsPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/products"; }
  function salesPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/sales"; }
  function ordersPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/orders"; }

  function setTab(tab) {
    state.tab = tab;
    var tabs = document.querySelectorAll(".lg-tab");
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var arg = t.getAttribute("data-arg");
      t.className = "lg-tab" + (arg === tab ? " active" : "");
    }
    if (tab === "orders") paintOrdersPanel();
    else if (tab === "recent") paintRecentPanel();
    else paintCaissePanel();
  }

  function buildCategoryTabs() {
    var cats = { all: true };
    for (var i = 0; i < state.products.length; i++) {
      cats[state.products[i].category || "Autre"] = true;
    }
    var keys = ["all"];
    var sorted = Object.keys(cats).sort();
    for (var j = 0; j < sorted.length; j++) if (sorted[j] !== "all") keys.push(sorted[j]);
    var html = '<div class="lg-chip-row">';
    for (var k = 0; k < keys.length; k++) {
      var c = keys[k];
      html += '<button type="button" class="lg-chip' + (state.category === c ? " active" : "") +
        '" data-action="sales-cat" data-arg="' + ui.escapeHtml(c) + '">' + ui.escapeHtml(c === "all" ? "Toutes" : c) + '</button>';
    }
    return html + '</div>';
  }

  function paintCaissePanel() {
    var panel = ui.$("sales-panel");
    if (!panel) return;
    panel.innerHTML =
      '<div class="lg-search"><input class="lg-input" id="sales-search" type="search" placeholder="Rechercher un produit…"></div>' +
      '<div id="sales-cats"></div>' +
      '<div class="lg-field" style="margin-bottom:12px">' +
        '<label class="lg-label" for="sales-table">Table / Zone (commande en cours)</label>' +
        '<input class="lg-input" id="sales-table" placeholder="Ex: Table 5, Terrasse…" value="' + ui.escapeHtml(state.tableNumber) + '">' +
      '</div>' +
      '<div id="sales-cart-panel"></div>' +
      '<div id="sales-grid" class="lg-loading">Chargement…</div>' +
      '<div id="sales-last" class="lg-card lg-sales-last" style="margin-top:16px;display:none"></div>' +
      '<div id="sales-float" class="lg-sales-float lg-hidden" style="display:none"></div>';

    ui.$("sales-search").oninput = function () {
      state.query = String(ui.$("sales-search").value || "").toLowerCase();
      paintGrid();
    };
    ui.$("sales-table").oninput = function () {
      state.tableNumber = String(ui.$("sales-table").value || "");
    };
    var catsEl = ui.$("sales-cats");
    if (catsEl) catsEl.innerHTML = buildCategoryTabs();
    paintCartPanel();
    paintGrid();
    paintFloatBar();
    paintLastSales();
  }

  function paintRecentPanel() {
    var panel = ui.$("sales-panel");
    if (!panel) return;
    panel.innerHTML = '<div id="sales-last" class="lg-card lg-sales-last"></div>';
    paintLastSales(true);
  }

  function setCategory(cat) {
    state.category = cat || "all";
    var catsEl = ui.$("sales-cats");
    if (catsEl) catsEl.innerHTML = buildCategoryTabs();
    paintGrid();
  }

  function paintOrdersPanel() {
    var panel = ui.$("sales-panel");
    if (!panel) return;
    panel.innerHTML = '<div id="orders-list" class="lg-loading">Chargement des commandes…</div>';
    paintOrdersList();
  }

  function loadProducts() {
    api.listDocs(productsPath(), 200).then(function (docs) {
      state.products = docs || [];
      if (state.tab === "caisse") {
        var catsEl = ui.$("sales-cats");
        if (catsEl) catsEl.innerHTML = buildCategoryTabs();
        paintGrid();
      }
    }).catch(function (err) {
      var el = ui.$("sales-grid");
      if (el) el.innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message) + '</div>';
    });
  }

  function loadOrders() {
    api.listDocs(ordersPath(), 100).then(function (docs) {
      state.orders = docs || [];
      state.orders.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      updateOrdersBadge();
      if (state.tab === "orders") paintOrdersList();
    }).catch(function () { updateOrdersBadge(); });
  }

  function loadRecentSales() {
    api.listDocs(salesPath(), 40).then(function (docs) {
      state.sales = docs || [];
      state.sales.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      if (state.tab === "recent") paintLastSales(true);
      else paintLastSales(false);
    }).catch(function () {});
  }

  function paintLastSales(forceShow) {
    var el = ui.$("sales-last");
    if (!el) return;
    if (!state.sales.length) {
      if (forceShow) el.innerHTML = '<div class="lg-empty">Aucune vente récente</div>';
      else ui.hideEl(el);
      return;
    }
    ui.showEl(el);
    var limit = forceShow ? 20 : 5;
    var html = '<div class="lg-card-title">Dernières ventes</div>';
    for (var i = 0; i < state.sales.length && i < limit; i++) {
      var s = state.sales[i];
      html +=
        '<div class="lg-list-item" style="padding:8px 0;border-bottom:1px solid #eee">' +
          '<div class="lg-list-item-main">' +
            '<div class="lg-list-item-title">' + ui.escapeHtml(ui.formatMoney(s.total)) + '</div>' +
            '<div class="lg-list-item-meta">' + ui.escapeHtml(ui.formatDate(s.createdAt)) + '</div>' +
          '</div>' +
          '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" data-action="sales-print" data-arg="' + ui.escapeHtml(s.id) + '">Reçu</button>' +
        '</div>';
    }
    el.innerHTML = html;
  }

  function printReceipt(saleId) {
    var sale = null;
    for (var i = 0; i < state.sales.length; i++) if (state.sales[i].id === saleId) sale = state.sales[i];
    if (!sale) return;
    var p = state.ctx.profile || {};
    var items = sale.items || [];
    var lines = "";
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      lines += "<tr><td>" + ui.escapeHtml(it.name) + " ×" + (it.quantity || 1) + "</td><td style='text-align:right'>" + ui.escapeHtml(ui.formatMoney((it.price || 0) * (it.quantity || 1))) + "</td></tr>";
    }
    var w = window.open("", "_blank", "width=320,height=600");
    if (!w) { ui.toast("Autorisez les popups pour imprimer", "error"); return; }
    w.document.write(
      "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Reçu</title>" +
      "<style>body{font-family:monospace;font-size:12px;padding:12px}table{width:100%}h2{text-align:center;margin:0}</style></head><body>" +
      "<h2>" + ui.escapeHtml(p.establishmentName || "NACK") + "</h2>" +
      "<p style='text-align:center'>" + ui.escapeHtml(ui.formatDate(sale.createdAt)) + "</p>" +
      "<table>" + lines + "</table>" +
      "<p style='text-align:right;font-weight:bold'>Total : " + ui.escapeHtml(ui.formatMoney(sale.total)) + "</p>" +
      (p.customMessage ? "<p style='text-align:center'>" + ui.escapeHtml(p.customMessage) + "</p>" : "") +
      "</body></html>"
    );
    w.document.close();
    w.focus();
    w.print();
  }

  function pendingOrders() {
    var out = [];
    for (var i = 0; i < state.orders.length; i++) {
      if ((state.orders[i].status || "pending") === "pending") out.push(state.orders[i]);
    }
    return out;
  }

  function updateOrdersBadge() {
    var n = pendingOrders().length;
    var badge = ui.$("orders-badge");
    var nav = ui.$("nav-sales");
    if (badge) {
      if (n > 0) { badge.style.display = "inline-block"; badge.textContent = String(n); }
      else badge.style.display = "none";
    }
    if (nav) {
      var old = nav.querySelector(".lg-nav-badge");
      if (old) old.parentNode.removeChild(old);
      if (n > 0) {
        var b = document.createElement("span");
        b.className = "lg-nav-badge";
        b.textContent = String(n);
        nav.appendChild(b);
      }
    }
    if (global.NACK_LIGHT.setPendingOrdersCount) global.NACK_LIGHT.setPendingOrdersCount(n);
  }

  function paintGrid() {
    var el = ui.$("sales-grid");
    if (!el) return;
    var q = state.query || "", html = '<div class="lg-grid lg-product-grid">', count = 0;
    for (var i = 0; i < state.products.length; i++) {
      var p = state.products[i];
      if ((Number(p.quantity) || 0) <= 0) continue;
      if (state.category !== "all" && (p.category || "Autre") !== state.category) continue;
      var hay = ((p.name || "") + " " + (p.category || "")).toLowerCase();
      if (q && hay.indexOf(q) === -1) continue;
      count++;
      var img = p.imageUrl || p.photoUrl || p.image || "";
      var imgHtml = img
        ? '<img class="lg-product-img" src="' + ui.escapeHtml(img) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
        : '<div class="lg-product-img lg-product-img-ph">' + ui.escapeHtml(((p.name || "?").charAt(0) || "?").toUpperCase()) + '</div>';
      html +=
        '<div><div class="lg-product-tile" data-action="add-cart" data-arg="' + ui.escapeHtml(p.id) + '" role="button">' +
          imgHtml +
          '<div style="font-weight:700;font-size:0.9rem">' + ui.escapeHtml(p.name || "") + '</div>' +
          '<div class="lg-list-item-meta">Stock ' + (Number(p.quantity) || 0) + '</div>' +
          '<div class="price">' + ui.escapeHtml(ui.formatMoney(p.price)) + '</div></div></div>';
    }
    html += '</div>';
    el.innerHTML = count ? html : '<div class="lg-empty">Aucun produit disponible</div>';
  }

  function findProduct(id) {
    for (var i = 0; i < state.products.length; i++) if (state.products[i].id === id) return state.products[i];
    return null;
  }

  function cartItems() {
    var items = [];
    for (var id in state.cart) if (Object.prototype.hasOwnProperty.call(state.cart, id)) items.push(state.cart[id]);
    return items;
  }

  function cartTotal() {
    var items = cartItems(), t = 0;
    for (var i = 0; i < items.length; i++) t += items[i].price * items[i].quantity;
    return t;
  }

  function addToCart(id) {
    var p = findProduct(id);
    if (!p) return;
    var line = state.cart[id];
    var qty = line ? line.quantity + 1 : 1;
    if (qty > (Number(p.quantity) || 0)) { ui.toast("Stock insuffisant", "error"); return; }
    state.cart[id] = { id: p.id, name: p.name, price: Number(p.price) || 0, quantity: qty, category: p.category || "" };
    paintCartPanel();
    paintFloatBar();
  }

  function decCart(id) {
    if (!state.cart[id]) return;
    if (state.cart[id].quantity <= 1) delete state.cart[id];
    else state.cart[id].quantity -= 1;
    paintCartPanel();
    paintFloatBar();
  }

  function removeCart(id) {
    delete state.cart[id];
    paintCartPanel();
    paintFloatBar();
  }

  function clearCart() {
    state.cart = {};
    state.editingOrderId = null;
    paintCartPanel();
    paintFloatBar();
  }

  function paintCartPanel() {
    var panel = ui.$("sales-cart-panel");
    if (!panel) return;
    var items = cartItems();
    if (!items.length) { panel.innerHTML = ""; return; }
    var html = '<div class="lg-cart-panel"><div class="lg-cart-panel-title">Panier</div>';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html +=
        '<div class="lg-cart-line">' +
          '<div class="lg-list-item-main">' +
            '<div class="lg-list-item-title">' + ui.escapeHtml(it.name) + '</div>' +
            '<div class="lg-list-item-meta">' + ui.escapeHtml(ui.formatMoney(it.price)) + '</div>' +
          '</div>' +
          '<div class="lg-qty">' +
            '<button type="button" class="lg-btn-icon-only" data-action="cart-dec" data-arg="' + ui.escapeHtml(it.id) + '">' + icon("minus", 18) + '</button>' +
            '<span style="min-width:24px;text-align:center;font-weight:700">' + it.quantity + '</span>' +
            '<button type="button" class="lg-btn-icon-only" data-action="cart-inc" data-arg="' + ui.escapeHtml(it.id) + '">' + icon("plus", 18) + '</button>' +
            '<button type="button" class="lg-btn-icon-only" data-action="cart-remove" data-arg="' + ui.escapeHtml(it.id) + '" title="Supprimer">' + icon("trash", 18) + '</button>' +
          '</div></div>';
    }
    html +=
      '<div class="lg-cart-total-row"><span>Total</span><span>' + ui.escapeHtml(ui.formatMoney(cartTotal())) + '</span></div>' +
      '<div class="lg-row-actions" style="margin-top:12px">' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-block" data-action="hold-order">Mettre en attente</button>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" data-action="open-cart">Encaisser</button>' +
      '</div></div>';
    panel.innerHTML = html;
  }

  function paintFloatBar() {
    var bar = ui.$("sales-float");
    if (!bar) return;
    var items = cartItems(), n = 0;
    for (var i = 0; i < items.length; i++) n += items[i].quantity;
    if (!n) { ui.hideEl(bar); return; }
    ui.showEl(bar);
    bar.style.display = "flex";
    bar.innerHTML =
      '<button type="button" class="lg-btn-icon-only" data-action="cart-clear" title="Vider">' + icon("trash", 22) + '</button>' +
      '<div class="lg-sales-float-total">' + ui.escapeHtml(ui.formatMoney(cartTotal())) + '</div>' +
      '<button type="button" class="lg-btn-icon-only lg-pay-btn" data-action="open-cart" title="Encaisser">' + icon("credit", 22) + '</button>';
  }

  function openCartModal() {
    var items = cartItems();
    if (!items.length) { ui.toast("Panier vide", "error"); return; }
    var body = ui.$("cart-body");
    if (!body) return;
    var html = "";
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html +=
        '<div class="lg-list-item">' +
          '<div class="lg-list-item-main">' +
            '<div class="lg-list-item-title">' + ui.escapeHtml(it.name) + ' × ' + it.quantity + '</div>' +
            '<div class="lg-list-item-meta">' + ui.escapeHtml(ui.formatMoney(it.price * it.quantity)) + '</div>' +
          '</div></div>';
    }
    if (state.tableNumber) {
      html += '<p class="lg-card-desc" style="margin-top:8px">Table : <strong>' + ui.escapeHtml(state.tableNumber) + '</strong></p>';
    }
    html +=
      '<div class="lg-cart-total-row"><span>Total</span><span>' + ui.escapeHtml(ui.formatMoney(cartTotal())) + '</span></div>' +
      '<div class="lg-section-title">Mode de paiement</div>' +
      '<div class="lg-pay-options">' +
        '<label><input type="radio" name="pay-method" value="cash" checked> Espèces</label>' +
        '<label><input type="radio" name="pay-method" value="mobile"> Mobile</label>' +
        '<label><input type="radio" name="pay-method" value="card"> Carte</label>' +
      '</div>';
    body.innerHTML = html;
    ui.openModal("modal-cart");
  }

  function selectedPayMethod() {
    var radios = document.getElementsByName("pay-method");
    for (var i = 0; i < radios.length; i++) if (radios[i].checked) return radios[i].value;
    return "cash";
  }

  function holdOrder() {
    var items = cartItems();
    if (!items.length) { ui.toast("Panier vide", "error"); return; }
    var table = state.tableNumber || (ui.$("sales-table") && ui.$("sales-table").value || "").trim();
    if (!table) { ui.toast("Indiquez une table ou zone", "error"); return; }
    var payload = {
      orderNumber: Math.floor(Date.now() % 100000),
      tableNumber: table,
      items: items,
      total: cartTotal(),
      status: "pending",
      createdAt: Date.now(),
      agentCode: "caisse-light",
      agentName: (state.ctx.profile && state.ctx.profile.ownerName) || "Gérant"
    };
    var chain = state.editingOrderId
      ? api.patchDoc(ordersPath() + "/" + state.editingOrderId, payload, ["tableNumber", "items", "total", "status", "createdAt"])
      : api.createDoc(ordersPath(), payload);
    chain.then(function () {
      state.cart = {};
      state.editingOrderId = null;
      state.tableNumber = table;
      paintCartPanel();
      paintFloatBar();
      loadOrders();
      ui.toast("Commande en attente — Table " + table, "ok");
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  function checkout() {
    var items = cartItems();
    if (!items.length) { ui.toast("Panier vide", "error"); return; }
    var method = selectedPayMethod();
    var btn = ui.$("cart-pay");
    ui.setLoading(btn, true);
    var table = state.tableNumber || "";
    var sale = {
      items: items, total: cartTotal(), paymentMethod: method,
      createdAt: Date.now(), tableZone: table || "Caisse"
    };
    var saleId = null;
    api.createDoc(salesPath(), sale).then(function (doc) {
      saleId = doc && doc.id;
      sale.id = saleId;
      var chain = Promise.resolve();
      for (var i = 0; i < items.length; i++) {
        (function (it) {
          chain = chain.then(function () {
            var p = findProduct(it.id);
            if (!p) return;
            var nextQty = Math.max(0, (Number(p.quantity) || 0) - it.quantity);
            return api.patchDoc(productsPath() + "/" + it.id, { quantity: nextQty, updatedAt: Date.now() }, ["quantity", "updatedAt"]);
          });
        })(items[i]);
      }
      if (state.editingOrderId) {
        chain = chain.then(function () {
          return api.patchDoc(ordersPath() + "/" + state.editingOrderId, { status: "sent", updatedAt: Date.now() }, ["status", "updatedAt"]);
        });
      }
      return chain;
    }).then(function () {
      state.cart = {};
      state.editingOrderId = null;
      ui.closeModal("modal-cart");
      ui.toast("Vente enregistrée", "ok");
      loadProducts();
      loadOrders();
      loadRecentSales();
      paintCartPanel();
      paintFloatBar();
      if (state.ctx.refreshStats) state.ctx.refreshStats();
      if (saleId) printReceipt(saleId);
    }).catch(function (err) { ui.toast(err.message || "Erreur vente", "error"); })
      .then(function () { ui.setLoading(btn, false); });
  }

  function paintOrdersList() {
    var el = ui.$("orders-list");
    if (!el) return;
    var pending = pendingOrders();
    if (!pending.length) {
      el.innerHTML = '<div class="lg-empty">Aucune commande en cours</div>';
      return;
    }
    var html = "";
    for (var i = 0; i < pending.length; i++) {
      var o = pending[i];
      var items = o.items || [];
      var names = [];
      for (var j = 0; j < items.length && j < 4; j++) {
        names.push((items[j].name || "") + " ×" + (items[j].quantity || 1));
      }
      html +=
        '<div class="lg-card">' +
          '<div class="lg-card-title">Table ' + ui.escapeHtml(o.tableNumber || "—") + '</div>' +
          '<div class="lg-card-desc">' + ui.escapeHtml(names.join(", ")) + '</div>' +
          '<div style="margin-top:8px;font-weight:700;color:#dc2626">' + ui.escapeHtml(ui.formatMoney(o.total)) + '</div>' +
          '<div class="lg-row-actions" style="margin-top:10px">' +
            '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" data-action="edit-order" data-arg="' + ui.escapeHtml(o.id) + '">Modifier</button>' +
            '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-action="pay-order" data-arg="' + ui.escapeHtml(o.id) + '">Encaisser</button>' +
            '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="cancel-order" data-arg="' + ui.escapeHtml(o.id) + '">Annuler</button>' +
          '</div></div>';
    }
    el.innerHTML = html;
  }

  function loadOrderToCart(id) {
    var order = null;
    for (var i = 0; i < state.orders.length; i++) if (state.orders[i].id === id) order = state.orders[i];
    if (!order) return;
    state.cart = {};
    var items = order.items || [];
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var pid = it.id || it.name;
      state.cart[pid] = {
        id: pid, name: it.name, price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1, category: it.category || ""
      };
    }
    state.tableNumber = order.tableNumber || "";
    state.editingOrderId = id;
    setTab("caisse");
    ui.toast("Commande chargée — ajustez et encaissez", "ok");
  }

  function payOrder(id) { loadOrderToCart(id); openCartModal(); }

  function cancelOrder(id) {
    api.patchDoc(ordersPath() + "/" + id, { status: "cancelled", updatedAt: Date.now() }, ["status", "updatedAt"]).then(function () {
      loadOrders();
      ui.toast("Commande annulée", "ok");
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.sales = {
    render: render, setTab: setTab, setCategory: setCategory,
    addToCart: addToCart, decCart: decCart, removeCart: removeCart, clearCart: clearCart,
    openCartModal: openCartModal, checkout: checkout, holdOrder: holdOrder,
    loadOrderToCart: loadOrderToCart, payOrder: payOrder, cancelOrder: cancelOrder,
    printReceipt: printReceipt, refreshOrders: loadOrders
  };
})(window);
