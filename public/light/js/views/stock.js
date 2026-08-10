(function (global) {
  var ui, api, state;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    state = { ctx: ctx, products: [], query: "", onlyZero: false, root: root };

    root.innerHTML =
      '<div class="lg-search"><input class="lg-input" id="stock-search" type="search" placeholder="Rechercher un produit…"></div>' +
      '<div class="lg-row-actions">' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="stock-filter-zero" id="stock-filter-btn">Stock à 0</button>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-action="add-product">+ Produit</button>' +
      '</div>' +
      '<div id="stock-list" class="lg-loading">Chargement du stock…</div>' +
      '<button type="button" class="lg-fab" data-action="add-product" aria-label="Ajouter">+</button>';

    var search = ui.$("stock-search");
    if (search) {
      search.oninput = function () {
        state.query = String(search.value || "").toLowerCase();
        paintList();
      };
    }
    loadProducts();
  }

  function colPath() {
    return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/products";
  }

  function loadProducts() {
    api.listDocs(colPath(), 200).then(function (docs) {
      state.products = docs || [];
      state.products.sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
      paintList();
      if (state.ctx.onStats) state.ctx.onStats({ productsCount: state.products.length });
    }).catch(function (err) {
      var list = ui.$("stock-list");
      if (list) list.innerHTML = '<div class="lg-empty">Impossible de charger le stock.<br>' + ui.escapeHtml(err.message) + '</div>';
    });
  }

  function paintList() {
    var list = ui.$("stock-list");
    if (!list) return;
    var q = state.query;
    var filtered = [];
    for (var i = 0; i < state.products.length; i++) {
      var p = state.products[i];
      var qty = Number(p.quantity) || 0;
      if (state.onlyZero && qty > 0) continue;
      var hay = ((p.name || "") + " " + (p.category || "")).toLowerCase();
      if (!q || hay.indexOf(q) !== -1) filtered.push(p);
    }
    var btn = ui.$("stock-filter-btn");
    if (btn) btn.textContent = state.onlyZero ? "Tous les stocks" : "Stock à 0";

    if (!filtered.length) {
      list.innerHTML = '<div class="lg-empty">Aucun produit</div>';
      return;
    }
    var html = "";
    for (var j = 0; j < filtered.length; j++) {
      var item = filtered[j];
      var qn = Number(item.quantity) || 0;
      var badge = qn <= 0 ? "lg-badge-danger" : qn < 5 ? "lg-badge-warn" : "lg-badge-ok";
      html +=
        '<div class="lg-list-item">' +
          '<div class="lg-list-item-main">' +
            '<div class="lg-list-item-title">' + ui.escapeHtml(item.name || "Sans nom") + '</div>' +
            '<div class="lg-list-item-meta">' + ui.escapeHtml(item.category || "—") + " · " + ui.escapeHtml(ui.formatMoney(item.price)) + '</div>' +
          '</div>' +
          '<div style="text-align:right">' +
            '<div class="lg-badge ' + badge + '" style="margin-bottom:6px">Stock ' + qn + '</div>' +
            '<div class="lg-qty">' +
              '<button type="button" data-action="stock-dec" data-arg="' + ui.escapeHtml(item.id) + '">−</button>' +
              '<button type="button" data-action="stock-inc" data-arg="' + ui.escapeHtml(item.id) + '">+</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }
    list.innerHTML = html;
  }

  function findProduct(id) {
    for (var i = 0; i < state.products.length; i++) {
      if (state.products[i].id === id) return state.products[i];
    }
    return null;
  }

  function adjustStock(id, delta) {
    if (!state) return;
    ui.requireManagerAuth(state.ctx.profile, function () {
      var p = findProduct(id);
      if (!p) return;
      var next = Math.max(0, (Number(p.quantity) || 0) + delta);
      api.patchDoc(colPath() + "/" + id, { quantity: next, updatedAt: Date.now() }, ["quantity", "updatedAt"]).then(function () {
        p.quantity = next;
        paintList();
        ui.toast("Stock mis à jour", "ok");
      }).catch(function (err) {
        ui.toast(err.message || "Erreur", "error");
      });
    });
  }

  function toggleZeroFilter() {
    if (!state) return;
    state.onlyZero = !state.onlyZero;
    paintList();
  }

  function submitAddProduct() {
    if (!state || !state.ctx) { ui.toast("Ouvrez d'abord Stock", "error"); return; }
    var name = (ui.$("prod-name") && ui.$("prod-name").value || "").trim();
    var category = (ui.$("prod-category") && ui.$("prod-category").value || "").trim();
    var price = Number(ui.$("prod-price") && ui.$("prod-price").value);
    var quantity = Number(ui.$("prod-qty") && ui.$("prod-qty").value);
    if (!name || !category || isNaN(price) || isNaN(quantity)) {
      ui.toast("Remplissez tous les champs", "error");
      return;
    }
    var btn = ui.$("prod-submit");
    ui.setLoading(btn, true);
    api.createDoc(colPath(), {
      name: name, category: category, price: price, quantity: quantity,
      createdAt: Date.now(), updatedAt: Date.now()
    }).then(function () {
      ui.closeModal("modal-product");
      ui.toast("Produit ajouté", "ok");
      loadProducts();
    }).catch(function (err) {
      ui.toast(err.message || "Erreur", "error");
    }).then(function () { ui.setLoading(btn, false); });
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.stock = {
    render: render,
    submitAddProduct: submitAddProduct,
    adjustStock: adjustStock,
    toggleZeroFilter: toggleZeroFilter
  };
})(window);
