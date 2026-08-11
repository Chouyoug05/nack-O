(function (global) {
  var ui, api, state;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    var uid = ctx.uid;
    state = { uid: uid, profile: null, products: [], tables: [], cart: {}, root: root, table: "", done: false, orderNum: "" };

    root.innerHTML = '<div class="lg-loading">Chargement du menu…</div>';
    Promise.all([
      api.getPublicDoc("publicProfiles/" + uid).catch(function () { return null; }),
      api.getPublicDoc("establishments/" + uid).catch(function () { return null; })
    ]).then(function (res) {
      var pub = res[0] && res[0].id ? res[0] : null;
      var est = res[1] && res[1].id ? res[1] : null;
      state.profile = pub || est || { id: uid, establishmentName: "Menu" };
      // Produits toujours sous profiles/{uid} (lecture publique)
      state.collectionBase = "profiles";
      return Promise.all([
        api.publicListDocs("profiles/" + uid + "/products", 200),
        api.publicListDocs("profiles/" + uid + "/tables", 50)
      ]);
    }).then(function (res) {
      var all = res[0] || [];
      var hasMenu = all.some(function (p) { return p.showOnMenuDigital === true; });
      state.products = all.filter(function (p) {
        var priceOk = Number(p.price || 0) > 0;
        if (!priceOk) return false;
        if (hasMenu) return p.showOnMenuDigital === true;
        return true;
      });
      state.tables = res[1] || [];
      paint();
    }).catch(function (err) {
      root.innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message || "Menu indisponible") + '</div>';
    });
  }

  function paint() {
    if (state.done) {
      state.root.innerHTML =
        '<div class="lg-card" style="text-align:center;margin-top:2rem">' +
          '<div class="lg-card-title">Commande validée !</div>' +
          '<div class="lg-card-desc">Merci pour votre commande #' + ui.escapeHtml(state.orderNum) + '</div>' +
          '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" style="margin-top:16px" id="po-new">Nouvelle commande</button></div>';
      ui.$("po-new").onclick = function () { state.done = false; state.cart = {}; paint(); };
      return;
    }
    var est = state.profile.establishmentName || "Menu";
    state.root.innerHTML =
      '<div class="lg-team-header"><div><div class="lg-card-title">' + ui.escapeHtml(est) + '</div>' +
      '<div class="lg-card-desc">Commander en ligne</div></div></div>' +
      '<div class="lg-field"><label class="lg-label">Table / Zone</label>' +
      '<select class="lg-select" id="po-table"><option value="">Choisir…</option></select></div>' +
      '<div id="po-grid" class="lg-grid"></div>' +
      '<div id="po-cart"></div>' +
      '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" id="po-submit" style="margin-top:12px">Commander</button>';

    var sel = ui.$("po-table");
    for (var i = 0; i < state.tables.length; i++) {
      var t = state.tables[i];
      var opt = document.createElement("option");
      opt.value = t.name || t.id;
      opt.textContent = t.name || t.id;
      sel.appendChild(opt);
    }
    if (!state.tables.length) {
      var inp = document.createElement("input");
      inp.className = "lg-input";
      inp.id = "po-table-text";
      inp.placeholder = "Ex: Table 3";
      sel.parentNode.replaceChild(inp, sel);
    }
    paintGrid();
    paintCart();
    ui.$("po-submit").onclick = submitOrder;
  }

  function paintGrid() {
    var el = ui.$("po-grid");
    if (!el) return;
    var html = "";
    for (var i = 0; i < state.products.length; i++) {
      var p = state.products[i];
      html += '<div><div class="lg-product-tile" data-pid="' + ui.escapeHtml(p.id) + '" role="button">' +
        '<div style="font-weight:700">' + ui.escapeHtml(p.name || "") + '</div>' +
        '<div class="price">' + ui.escapeHtml(ui.formatMoney(p.price)) + '</div></div></div>';
    }
    el.innerHTML = html || '<div class="lg-empty">Menu vide</div>';
    var tiles = el.querySelectorAll("[data-pid]");
    for (var j = 0; j < tiles.length; j++) {
      tiles[j].onclick = function () { addCart(this.getAttribute("data-pid")); };
    }
  }

  function addCart(id) {
    for (var i = 0; i < state.products.length; i++) {
      if (state.products[i].id !== id) continue;
      var p = state.products[i];
      var line = state.cart[id];
      state.cart[id] = {
        productId: id, name: p.name, price: Number(p.price) || 0,
        quantity: line ? line.quantity + 1 : 1
      };
      break;
    }
    paintCart();
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

  function paintCart() {
    var el = ui.$("po-cart");
    if (!el) return;
    var items = cartItems();
    if (!items.length) { el.innerHTML = ""; return; }
    var html = '<div class="lg-cart-panel"><div class="lg-cart-panel-title">Panier</div>';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html += '<div class="lg-list-item"><div class="lg-list-item-main"><div class="lg-list-item-title">' +
        ui.escapeHtml(it.name) + ' ×' + it.quantity + '</div></div><div>' + ui.escapeHtml(ui.formatMoney(it.price * it.quantity)) + '</div></div>';
    }
    html += '<div class="lg-cart-total-row"><span>Total</span><span>' + ui.escapeHtml(ui.formatMoney(cartTotal())) + '</span></div></div>';
    el.innerHTML = html;
  }

  function submitOrder() {
    var items = cartItems();
    if (!items.length) { ui.toast("Panier vide", "error"); return; }
    var tableEl = ui.$("po-table");
    var table = tableEl ? tableEl.value : (ui.$("po-table-text") && ui.$("po-table-text").value || "").trim();
    if (!table) { ui.toast("Choisissez une table", "error"); return; }
    var orderNum = String(Math.floor(Date.now() % 100000));
    var payload = {
      orderNumber: Number(orderNum),
      tableNumber: table,
      items: items.map(function (it) {
        return { id: it.productId, name: it.name, price: it.price, quantity: it.quantity };
      }),
      total: cartTotal(),
      status: "pending",
      source: "menu-digital",
      createdAt: Date.now()
    };
    var path = state.collectionBase + "/" + state.uid + "/barOrders";
    api.publicCreateDoc(path, payload).then(function () {
      state.done = true;
      state.orderNum = orderNum;
      state.cart = {};
      paint();
    }).catch(function (err) { ui.toast(err.message || "Erreur commande", "error"); });
  }

  global.NACK_LIGHT.public = global.NACK_LIGHT.public || {};
  global.NACK_LIGHT.public.ordering = { render: render };
})(window);
