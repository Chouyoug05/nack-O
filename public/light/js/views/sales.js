(function (global) {
  var ui, api, state;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    var prevCart = (state && state.cart) ? state.cart : {};
    state = { ctx: ctx, products: [], cart: prevCart, root: root, query: "" };

    root.innerHTML =
      '<div class="lg-search"><input class="lg-input" id="sales-search" type="search" placeholder="Rechercher…"></div>' +
      '<div id="sales-grid" class="lg-loading">Chargement…</div>' +
      '<div id="sales-cart-bar" class="lg-cart-bar lg-hidden" data-action="open-cart" role="button" style="display:none">' +
        '<span id="cart-count">0 article(s)</span>' +
        '<span id="cart-total">0 XAF</span>' +
      '</div>';

    var search = ui.$("sales-search");
    if (search) {
      search.oninput = function () {
        state.query = String(search.value || "").toLowerCase();
        paintGrid();
      };
    }
    loadProducts();
  }

  function productsPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/products"; }
  function salesPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/sales"; }

  function loadProducts() {
    api.listDocs(productsPath(), 200).then(function (docs) {
      state.products = docs || [];
      paintGrid();
    }).catch(function (err) {
      var el = ui.$("sales-grid");
      if (el) el.innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message) + '</div>';
    });
  }

  function paintGrid() {
    var el = ui.$("sales-grid");
    if (!el) return;
    var q = state.query || "", html = '<div class="lg-grid">', count = 0;
    for (var i = 0; i < state.products.length; i++) {
      var p = state.products[i];
      if ((Number(p.quantity) || 0) <= 0) continue;
      var hay = ((p.name || "") + " " + (p.category || "")).toLowerCase();
      if (q && hay.indexOf(q) === -1) continue;
      count++;
      html +=
        '<div><div class="lg-product-tile" data-action="add-cart" data-arg="' + ui.escapeHtml(p.id) + '" role="button">' +
          '<div style="font-weight:700;font-size:0.9rem">' + ui.escapeHtml(p.name || "") + '</div>' +
          '<div class="lg-list-item-meta">Stock ' + (Number(p.quantity) || 0) + '</div>' +
          '<div class="price">' + ui.escapeHtml(ui.formatMoney(p.price)) + '</div>' +
        '</div></div>';
    }
    html += '</div>';
    el.innerHTML = count ? html : '<div class="lg-empty">Aucun produit disponible</div>';
    updateCartBar();
  }

  function findProduct(id) {
    for (var i = 0; i < state.products.length; i++) if (state.products[i].id === id) return state.products[i];
    return null;
  }

  function addToCart(id) {
    if (!state) return;
    var p = findProduct(id);
    if (!p) return;
    var line = state.cart[id];
    var qty = line ? line.quantity + 1 : 1;
    if (qty > (Number(p.quantity) || 0)) { ui.toast("Stock insuffisant", "error"); return; }
    state.cart[id] = { id: p.id, name: p.name, price: Number(p.price) || 0, quantity: qty };
    updateCartBar();
    ui.toast(p.name + " ajouté", "ok");
  }

  function decCart(id) {
    if (!state || !state.cart[id]) return;
    if (state.cart[id].quantity <= 1) delete state.cart[id];
    else state.cart[id].quantity -= 1;
    updateCartBar();
  }

  function cartItems() {
    var items = [];
    if (!state) return items;
    for (var id in state.cart) if (Object.prototype.hasOwnProperty.call(state.cart, id)) items.push(state.cart[id]);
    return items;
  }

  function cartTotal() {
    var items = cartItems(), t = 0;
    for (var i = 0; i < items.length; i++) t += items[i].price * items[i].quantity;
    return t;
  }

  function updateCartBar() {
    var bar = ui.$("sales-cart-bar");
    if (!bar) return;
    var items = cartItems(), n = 0;
    for (var i = 0; i < items.length; i++) n += items[i].quantity;
    if (!n) { ui.hideEl(bar); return; }
    ui.showEl(bar);
    bar.style.display = "flex";
    var c = ui.$("cart-count"), t = ui.$("cart-total");
    if (c) c.textContent = n + " article(s)";
    if (t) t.textContent = ui.formatMoney(cartTotal());
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
            '<div class="lg-list-item-title">' + ui.escapeHtml(it.name) + '</div>' +
            '<div class="lg-list-item-meta">' + ui.escapeHtml(ui.formatMoney(it.price * it.quantity)) + '</div>' +
          '</div>' +
          '<div class="lg-qty">' +
            '<button type="button" data-action="cart-dec" data-arg="' + ui.escapeHtml(it.id) + '">−</button>' +
            '<span>' + it.quantity + '</span>' +
            '<button type="button" data-action="cart-inc" data-arg="' + ui.escapeHtml(it.id) + '">+</button>' +
          '</div>' +
        '</div>';
    }
    html +=
      '<div style="margin-top:12px;font-weight:700;text-align:right">Total : ' + ui.escapeHtml(ui.formatMoney(cartTotal())) + '</div>' +
      '<div class="lg-section-title">Paiement</div>' +
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

  function checkout() {
    if (!state || !state.ctx) return;
    var items = cartItems();
    if (!items.length) { ui.toast("Panier vide", "error"); return; }
    var method = selectedPayMethod();
    var btn = ui.$("cart-pay");
    ui.setLoading(btn, true);
    var sale = { items: items, total: cartTotal(), paymentMethod: method, createdAt: Date.now() };
    api.createDoc(salesPath(), sale).then(function () {
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
      return chain;
    }).then(function () {
      state.cart = {};
      updateCartBar();
      ui.closeModal("modal-cart");
      ui.toast("Vente enregistrée", "ok");
      loadProducts();
      if (state.ctx.refreshStats) state.ctx.refreshStats();
    }).catch(function (err) {
      ui.toast(err.message || "Erreur vente", "error");
    }).then(function () { ui.setLoading(btn, false); });
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.sales = {
    render: render, checkout: checkout, addToCart: addToCart, decCart: decCart, openCartModal: openCartModal
  };
})(window);
