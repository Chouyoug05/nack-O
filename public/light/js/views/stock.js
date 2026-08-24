(function (global) {
  var ui, api, state, icon, sub;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    icon = global.NACK_LIGHT.icon;
    sub = global.NACK_LIGHT.subscription || {};
    state = {
      ctx: ctx, products: [], query: "", category: "all",
      sortBy: "name", showZero: false, root: root,
      addStep: 1, editingId: null, draft: {}
    };
    ensureModals();
    root.innerHTML =
      '<div id="stock-stats" class="lg-stats"></div>' +
      '<div class="lg-search"><input class="lg-input" id="stock-search" type="search" placeholder="Rechercher un produit…"></div>' +
      '<div class="lg-filter-row">' +
        '<select class="lg-select" id="stock-category"><option value="all">Toutes les catégories</option></select>' +
        '<select class="lg-select" id="stock-sort">' +
          '<option value="name">Tri : Nom</option>' +
          '<option value="category">Tri : Catégorie</option>' +
          '<option value="price">Tri : Prix</option>' +
        '</select>' +
      '</div>' +
      '<div class="lg-row-actions">' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="stock-toggle-zero" id="stock-zero-btn">Masquer stock 0</button>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="stock-export">Export CSV</button>' +
        '<label class="lg-btn lg-btn-secondary lg-btn-sm" style="cursor:pointer">Import CSV<input type="file" id="stock-import-file" accept=".csv,text/csv" style="display:none"></label>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="stock-entry-open">Entrée stock</button>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="stock-exit-open">Sortie stock</button>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="stock-pin-open">Code gérant</button>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm lg-btn-icon" data-action="stock-add-open">' + icon("plus", 16) + ' Produit</button>' +
      '</div>' +
      '<div id="stock-limit-msg" class="lg-card-desc" style="margin:8px 0"></div>' +
      '<div id="stock-list" class="lg-loading">Chargement du stock…</div>' +
      '<button type="button" class="lg-fab" data-action="stock-add-open" aria-label="Ajouter">' + icon("plus", 28) + '</button>';

    ui.$("stock-search").oninput = function () {
      state.query = String(ui.$("stock-search").value || "").toLowerCase();
      paintList();
    };
    ui.$("stock-category").onchange = function () {
      state.category = ui.$("stock-category").value;
      paintList();
    };
    ui.$("stock-sort").onchange = function () {
      state.sortBy = ui.$("stock-sort").value;
      sortProducts();
      paintList();
    };
    var imp = ui.$("stock-import-file");
    if (imp) imp.onchange = function () { importCsv(imp); };
    loadProducts();
  }

  function ensureModals() {
    if (ui.$("modal-stock-add")) return;
    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<div id="modal-stock-add-overlay" class="lg-modal-overlay lg-hidden" data-action="close-modal" data-arg="modal-stock-add" style="display:none"></div>' +
      '<div id="modal-stock-add" class="lg-modal lg-hidden" style="display:none"><button type="button" class="lg-modal-close" data-action="close-modal" data-arg="modal-stock-add">×</button>' +
        '<h2 id="stock-add-title">Ajouter un produit</h2><div id="stock-add-body"></div></div>' +
      '<div id="modal-stock-entry-overlay" class="lg-modal-overlay lg-hidden" data-action="close-modal" data-arg="modal-stock-entry" style="display:none"></div>' +
      '<div id="modal-stock-entry" class="lg-modal lg-hidden" style="display:none"><button type="button" class="lg-modal-close" data-action="close-modal" data-arg="modal-stock-entry">×</button>' +
        '<h2>Entrée de stock</h2><div id="stock-entry-body"></div></div>' +
      '<div id="modal-stock-exit-overlay" class="lg-modal-overlay lg-hidden" data-action="close-modal" data-arg="modal-stock-exit" style="display:none"></div>' +
      '<div id="modal-stock-exit" class="lg-modal lg-hidden" style="display:none"><button type="button" class="lg-modal-close" data-action="close-modal" data-arg="modal-stock-exit">×</button>' +
        '<h2>Sortie de stock</h2><div id="stock-exit-body"></div></div>' +
      '<div id="modal-stock-pin-overlay" class="lg-modal-overlay lg-hidden" data-action="close-modal" data-arg="modal-stock-pin" style="display:none"></div>' +
      '<div id="modal-stock-pin" class="lg-modal lg-hidden" style="display:none"><button type="button" class="lg-modal-close" data-action="close-modal" data-arg="modal-stock-pin">×</button>' +
        '<h2>Code gérant</h2><p class="lg-modal-desc">Protégez les modifications de stock avec un code PIN.</p>' +
        '<div class="lg-field"><label class="lg-label">Nouveau code</label><input class="lg-input" id="stock-pin-input" type="password" inputmode="numeric"></div>' +
        '<div class="lg-modal-actions"><button type="button" class="lg-btn lg-btn-secondary" data-action="close-modal" data-arg="modal-stock-pin">Annuler</button>' +
        '<button type="button" class="lg-btn lg-btn-nack" data-action="stock-pin-save">Enregistrer</button></div></div>';
    document.body.appendChild(wrap);
  }

  function colPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/products"; }

  function productLimit() {
    var plan = sub.getCurrentPlan ? sub.getCurrentPlan(state.ctx.profile) : "free";
    var pf = (sub.PLANS && sub.PLANS[plan]) || (sub.PLANS && sub.PLANS.free);
    return (pf && pf.features && pf.features.productLimit) || (plan === "free" ? 10 : Infinity);
  }

  function canAddProduct() {
    var limit = productLimit();
    if (limit === Infinity) return true;
    return state.products.length < limit;
  }

  function loadProducts() {
    var listEl = ui.$("stock-list");
    api.listDocs(colPath(), 200).then(function (docs) {
      state.products = docs || [];
      buildCategories();
      sortProducts();
      paintStats();
      paintLimitMsg();
      paintList();
      if (state.ctx.onStats) state.ctx.onStats({ productsCount: state.products.length });
      var fromCache = state.products.length && state.products[0] && state.products[0]._fromCache;
      if (fromCache) {
        ui.toast("Stock affiché avec les dernières données enregistrées", "ok");
        var bar = document.getElementById("lg-offline-bar");
        if (bar && (!navigator.onLine)) {
          bar.style.display = "block";
          bar.textContent = "Mode sans internet — stock disponible";
        }
      }
    }).catch(function (err) {
      if (listEl) {
        listEl.innerHTML =
          '<div class="lg-empty">Impossible de charger le stock.<br>' +
          ui.escapeHtml(err.message || "Erreur") +
          '<br><br><span class="lg-card-desc">Connectez-vous une fois à internet pour enregistrer vos produits sur cet appareil.</span></div>';
      }
    });
  }

  function paintStats() {
    var el = ui.$("stock-stats");
    if (!el) return;
    var totalVal = 0, low = 0;
    for (var i = 0; i < state.products.length; i++) {
      var p = state.products[i];
      var q = Number(p.quantity) || 0;
      totalVal += q * (Number(p.price) || 0);
      if (q > 0 && q < 5) low++;
    }
    el.innerHTML =
      '<div class="lg-stat"><div class="lg-stat-label">Produits</div><div class="lg-stat-value">' + state.products.length + '</div></div>' +
      '<div class="lg-stat"><div class="lg-stat-label">Valeur stock</div><div class="lg-stat-value">' + ui.escapeHtml(ui.formatMoney(totalVal)) + '</div></div>' +
      '<div class="lg-stat"><div class="lg-stat-label">Stock bas</div><div class="lg-stat-value">' + low + '</div></div>';
  }

  function paintLimitMsg() {
    var el = ui.$("stock-limit-msg");
    if (!el) return;
    var limit = productLimit();
    if (limit === Infinity) { el.innerHTML = ""; return; }
    el.innerHTML = 'Plan gratuit : ' + state.products.length + ' / ' + limit + ' produits';
  }

  function buildCategories() {
    var sel = ui.$("stock-category");
    if (!sel) return;
    var cats = {}, html = '<option value="all">Toutes les catégories</option>';
    for (var i = 0; i < state.products.length; i++) {
      var c = state.products[i].category || "Autre";
      cats[c] = true;
    }
    var keys = Object.keys(cats).sort();
    for (var j = 0; j < keys.length; j++) {
      html += '<option value="' + ui.escapeHtml(keys[j]) + '">' + ui.escapeHtml(keys[j]) + '</option>';
    }
    sel.innerHTML = html;
    sel.value = state.category;
  }

  function sortProducts() {
    var by = state.sortBy;
    state.products.sort(function (a, b) {
      if (by === "category") {
        var c = String(a.category || "").localeCompare(String(b.category || ""));
        return c !== 0 ? c : String(a.name || "").localeCompare(String(b.name || ""));
      }
      if (by === "price") return (Number(a.price) || 0) - (Number(b.price) || 0);
      return String(a.name || "").localeCompare(String(b.name || ""));
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
      if (!state.showZero && qty <= 0) continue;
      if (state.category !== "all" && (p.category || "Autre") !== state.category) continue;
      var hay = ((p.name || "") + " " + (p.category || "")).toLowerCase();
      if (q && hay.indexOf(q) === -1) continue;
      filtered.push(p);
    }
    var btn = ui.$("stock-zero-btn");
    if (btn) btn.textContent = state.showZero ? "Masquer stock 0" : "Afficher stock 0";

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
            '<div class="lg-list-item-meta">' + ui.escapeHtml(item.category || "—") + " · " + ui.escapeHtml(ui.formatMoney(item.price)) +
          '</div>' +
          '<div style="text-align:right;min-width:110px">' +
            '<div class="lg-badge ' + badge + '" style="margin-bottom:6px">Stock ' + qn + '</div>' +
            '<div class="lg-qty">' +
              '<button type="button" class="lg-btn-icon-only" data-action="stock-dec" data-arg="' + ui.escapeHtml(item.id) + '">' + icon("minus", 18) + '</button>' +
              '<button type="button" class="lg-btn-icon-only" data-action="stock-inc" data-arg="' + ui.escapeHtml(item.id) + '">' + icon("plus", 18) + '</button>' +
            '</div>' +
            '<div class="lg-row-actions" style="margin-top:6px;justify-content:flex-end">' +
              '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" data-action="stock-edit" data-arg="' + ui.escapeHtml(item.id) + '">Modifier</button>' +
              '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="stock-dup" data-arg="' + ui.escapeHtml(item.id) + '">Dupliquer</button>' +
              '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="stock-del" data-arg="' + ui.escapeHtml(item.id) + '">Suppr.</button>' +
            '</div></div></div>';
    }
    list.innerHTML = html;
  }

  function findProduct(id) {
    for (var i = 0; i < state.products.length; i++) if (state.products[i].id === id) return state.products[i];
    return null;
  }

  function adjustStock(id, delta) {
    ui.requireManagerAuth(state.ctx.profile, function () {
      var p = findProduct(id);
      if (!p) return;
      var next = Math.max(0, (Number(p.quantity) || 0) + delta);
      api.patchDoc(colPath() + "/" + id, { quantity: next, updatedAt: Date.now() }, ["quantity", "updatedAt"]).then(function () {
        p.quantity = next;
        paintStats();
        paintList();
        ui.toast("Stock mis à jour", "ok");
      }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
    });
  }

  function toggleZero() { state.showZero = !state.showZero; paintList(); }

  function openAddModal(editId) {
    state.editingId = editId || null;
    state.addStep = 1;
    state.draft = editId ? JSON.parse(JSON.stringify(findProduct(editId) || {})) : { category: "", name: "", imageUrl: "", price: 0, quantity: 0 };
    if (!editId && !canAddProduct()) {
      ui.toast("Limite de " + productLimit() + " produits (plan gratuit)", "error");
      return;
    }
    ui.$("stock-add-title").textContent = editId ? "Modifier le produit" : "Ajouter un produit";
    paintAddStep();
    ui.openModal("modal-stock-add");
  }

  function paintAddStep() {
    var body = ui.$("stock-add-body");
    if (!body) return;
    var d = state.draft;
    if (state.addStep === 1) {
      body.innerHTML =
        '<p class="lg-modal-desc">Étape 1/3 — Catégorie</p>' +
        '<div class="lg-field"><label class="lg-label">Catégorie</label><input class="lg-input" id="add-cat" value="' + ui.escapeHtml(d.category || "") + '" placeholder="Bière, Snack…"></div>' +
        '<div class="lg-modal-actions"><button type="button" class="lg-btn lg-btn-secondary" data-action="close-modal" data-arg="modal-stock-add">Annuler</button>' +
        '<button type="button" class="lg-btn lg-btn-nack" data-action="stock-add-next">Suivant</button></div>';
    } else if (state.addStep === 2) {
      body.innerHTML =
        '<p class="lg-modal-desc">Étape 2/3 — Détails</p>' +
        '<div class="lg-field"><label class="lg-label">Nom</label><input class="lg-input" id="add-name" value="' + ui.escapeHtml(d.name || "") + '"></div>' +
        '<div class="lg-field"><label class="lg-label">Image (URL)</label><input class="lg-input" id="add-img" value="' + ui.escapeHtml(d.imageUrl || "") + '"></div>' +
        '<div class="lg-modal-actions"><button type="button" class="lg-btn lg-btn-secondary" data-action="stock-add-prev">Précédent</button>' +
        '<button type="button" class="lg-btn lg-btn-nack" data-action="stock-add-next">Suivant</button></div>';
    } else {
      body.innerHTML =
        '<p class="lg-modal-desc">Étape 3/3 — Prix et quantité</p>' +
        '<div class="lg-field"><label class="lg-label">Prix (XAF)</label><input class="lg-input" id="add-price" type="number" min="0" value="' + (Number(d.price) || 0) + '"></div>' +
        '<div class="lg-field"><label class="lg-label">Quantité</label><input class="lg-input" id="add-qty" type="number" min="0" value="' + (Number(d.quantity) || 0) + '"></div>' +
        '<div class="lg-modal-actions"><button type="button" class="lg-btn lg-btn-secondary" data-action="stock-add-prev">Précédent</button>' +
        '<button type="button" class="lg-btn lg-btn-nack" data-action="stock-add-save">' + (state.editingId ? "Enregistrer" : "Ajouter") + '</button></div>';
    }
  }

  function readAddStep() {
    var d = state.draft;
    if (state.addStep === 1) d.category = (ui.$("add-cat") && ui.$("add-cat").value || "").trim();
    else if (state.addStep === 2) {
      d.name = (ui.$("add-name") && ui.$("add-name").value || "").trim();
      d.imageUrl = (ui.$("add-img") && ui.$("add-img").value || "").trim();
    } else {
      d.price = Number(ui.$("add-price") && ui.$("add-price").value);
      d.quantity = Number(ui.$("add-qty") && ui.$("add-qty").value);
    }
  }

  function addNext() {
    readAddStep();
    if (state.addStep === 1 && !state.draft.category) { ui.toast("Catégorie requise", "error"); return; }
    if (state.addStep === 2 && !state.draft.name) { ui.toast("Nom requis", "error"); return; }
    state.addStep++;
    paintAddStep();
  }

  function addPrev() { readAddStep(); state.addStep = Math.max(1, state.addStep - 1); paintAddStep(); }

  function addSave() {
    readAddStep();
    var d = state.draft;
    if (!d.category || !d.name || isNaN(d.price) || isNaN(d.quantity)) {
      ui.toast("Remplissez tous les champs", "error"); return;
    }
    var payload = {
      name: d.name, category: d.category, price: d.price, quantity: d.quantity,
      imageUrl: d.imageUrl || "",
      updatedAt: Date.now()
    };
    var chain;
    if (state.editingId) {
      chain = api.patchDoc(colPath() + "/" + state.editingId, payload, ["name", "category", "price", "quantity", "imageUrl", "updatedAt"]);
    } else {
      payload.createdAt = Date.now();
      chain = api.createDoc(colPath(), payload);
    }
    chain.then(function () {
      ui.closeModal("modal-stock-add");
      ui.toast(state.editingId ? "Produit modifié" : "Produit ajouté", "ok");
      loadProducts();
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  function deleteProduct(id) {
    ui.requireManagerAuth(state.ctx.profile, function () {
      if (!confirm("Supprimer ce produit ?")) return;
      api.deleteDoc(colPath() + "/" + id).then(function () {
        ui.toast("Produit supprimé", "ok");
        loadProducts();
      }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
    });
  }

  function duplicateProduct(id) {
    if (!canAddProduct()) { ui.toast("Limite produits atteinte", "error"); return; }
    var p = findProduct(id);
    if (!p) return;
    api.createDoc(colPath(), {
      name: (p.name || "") + " (copie)",
      category: p.category || "Autre",
      price: Number(p.price) || 0,
      quantity: 0,
      imageUrl: p.imageUrl || "",
      createdAt: Date.now(),
      updatedAt: Date.now()
    }).then(function () {
      ui.toast("Produit dupliqué", "ok");
      loadProducts();
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  function exportCsv() {
    var rows = [["nom", "categorie", "prix", "quantite", "imageUrl"]];
    for (var i = 0; i < state.products.length; i++) {
      var p = state.products[i];
      rows.push([p.name, p.category, p.price, p.quantity, p.imageUrl || ""]);
    }
    api.exportCsv("stock_" + new Date().toISOString().split("T")[0] + ".csv", rows);
    ui.toast("Export CSV lancé", "ok");
  }

  function importCsv(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || "");
      var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
      if (lines.length < 2) { ui.toast("CSV vide", "error"); return; }
      var headers = lines[0].toLowerCase().split(",").map(function (h) { return h.replace(/"/g, "").trim(); });
      var ni = headers.indexOf("nom") >= 0 ? headers.indexOf("nom") : 0;
      var ci = headers.indexOf("categorie") >= 0 ? headers.indexOf("categorie") : 1;
      var pi = headers.indexOf("prix") >= 0 ? headers.indexOf("prix") : 2;
      var qi = headers.indexOf("quantite") >= 0 ? headers.indexOf("quantite") : headers.indexOf("quantity");
      if (qi < 0) qi = 3;
      var chain = Promise.resolve();
      var count = 0;
      for (var i = 1; i < lines.length; i++) {
        (function (line) {
          chain = chain.then(function () {
            if (!canAddProduct()) return;
            var cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
            var clean = cols.map(function (c) { return c.replace(/^"|"$/g, "").replace(/""/g, '"').trim(); });
            return api.createDoc(colPath(), {
              name: clean[ni] || "Produit",
              category: clean[ci] || "Autre",
              price: Number(clean[pi]) || 0,
              quantity: Number(clean[qi]) || 0,
              createdAt: Date.now(),
              updatedAt: Date.now()
            }).then(function () { count++; });
          });
        })(lines[i]);
      }
      chain.then(function () {
        input.value = "";
        ui.toast(count + " produit(s) importé(s)", "ok");
        loadProducts();
      }).catch(function (err) { ui.toast(err.message || "Import échoué", "error"); });
    };
    reader.readAsText(file);
  }

  function productOptions(selected) {
    var html = '<option value="">Choisir un produit</option>';
    for (var i = 0; i < state.products.length; i++) {
      var p = state.products[i];
      html += '<option value="' + ui.escapeHtml(p.id) + '"' + (selected === p.id ? " selected" : "") + '>' + ui.escapeHtml(p.name) + ' (stock ' + (Number(p.quantity) || 0) + ')</option>';
    }
    return html;
  }

  function openEntryModal() {
    ui.$("stock-entry-body").innerHTML =
      '<div class="lg-field"><label class="lg-label">Produit</label><select class="lg-select" id="entry-prod">' + productOptions("") + '</select></div>' +
      '<div class="lg-field"><label class="lg-label">Quantité</label><input class="lg-input" id="entry-qty" type="number" min="1" value="1"></div>' +
      '<div class="lg-modal-actions"><button type="button" class="lg-btn lg-btn-secondary" data-action="close-modal" data-arg="modal-stock-entry">Annuler</button>' +
      '<button type="button" class="lg-btn lg-btn-nack" data-action="stock-entry-save">Ajouter au stock</button></div>';
    ui.openModal("modal-stock-entry");
  }

  function openExitModal() {
    ui.$("stock-exit-body").innerHTML =
      '<div class="lg-field"><label class="lg-label">Produit</label><select class="lg-select" id="exit-prod">' + productOptions("") + '</select></div>' +
      '<div class="lg-field"><label class="lg-label">Quantité perdue</label><input class="lg-input" id="exit-qty" type="number" min="1" value="1"></div>' +
      '<div class="lg-modal-actions"><button type="button" class="lg-btn lg-btn-secondary" data-action="close-modal" data-arg="modal-stock-exit">Annuler</button>' +
      '<button type="button" class="lg-btn lg-btn-nack" data-action="stock-exit-save">Retirer du stock</button></div>';
    ui.openModal("modal-stock-exit");
  }

  function saveEntry() {
    var id = ui.$("entry-prod") && ui.$("entry-prod").value;
    var qty = Number(ui.$("entry-qty") && ui.$("entry-qty").value);
    if (!id || !qty || qty < 1) { ui.toast("Sélectionnez un produit et une quantité", "error"); return; }
    ui.requireManagerAuth(state.ctx.profile, function () {
      var p = findProduct(id);
      if (!p) return;
      var next = (Number(p.quantity) || 0) + qty;
      api.patchDoc(colPath() + "/" + id, { quantity: next, updatedAt: Date.now() }, ["quantity", "updatedAt"]).then(function () {
        ui.closeModal("modal-stock-entry");
        ui.toast(qty + " unité(s) ajoutée(s)", "ok");
        loadProducts();
      }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
    });
  }

  function saveExit() {
    var id = ui.$("exit-prod") && ui.$("exit-prod").value;
    var qty = Number(ui.$("exit-qty") && ui.$("exit-qty").value);
    if (!id || !qty || qty < 1) { ui.toast("Sélectionnez un produit et une quantité", "error"); return; }
    ui.requireManagerAuth(state.ctx.profile, function () {
      var p = findProduct(id);
      if (!p) return;
      if (qty > (Number(p.quantity) || 0)) { ui.toast("Quantité insuffisante", "error"); return; }
      var next = Math.max(0, (Number(p.quantity) || 0) - qty);
      var root = api.dataRoot(state.ctx.profile, state.ctx.uid);
      api.patchDoc(colPath() + "/" + id, { quantity: next, updatedAt: Date.now() }, ["quantity", "updatedAt"]).then(function () {
        return api.createDoc(root + "/losses", {
          productId: id, productName: p.name, quantity: qty,
          reason: "sortie-manuelle", createdAt: Date.now()
        });
      }).then(function () {
        ui.closeModal("modal-stock-exit");
        ui.toast("Sortie enregistrée", "ok");
        loadProducts();
      }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
    });
  }

  function openPinModal() {
    var input = ui.$("stock-pin-input");
    if (input) input.value = "";
    ui.openModal("modal-stock-pin");
  }

  function savePin() {
    var code = (ui.$("stock-pin-input") && ui.$("stock-pin-input").value || "").trim();
    if (!code || code.length < 4) { ui.toast("Code min. 4 chiffres", "error"); return; }
    var hash = global.NACK_LIGHT.sha256Hex(code);
    api.patchProfile(state.ctx.uid, { managerPinHash: hash, updatedAt: Date.now() }, ["managerPinHash", "updatedAt"]).then(function () {
      state.ctx.profile.managerPinHash = hash;
      ui.closeModal("modal-stock-pin");
      ui.toast("Code gérant configuré", "ok");
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  function submitAddProduct() { openAddModal(); }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.stock = {
    render: render, submitAddProduct: submitAddProduct,
    adjustStock: adjustStock, toggleZero: toggleZero,
    openAddModal: openAddModal, addNext: addNext, addPrev: addPrev, addSave: addSave,
    deleteProduct: deleteProduct, duplicateProduct: duplicateProduct,
    exportCsv: exportCsv,
    openEntryModal: openEntryModal, openExitModal: openExitModal,
    saveEntry: saveEntry, saveExit: saveExit, openPinModal: openPinModal, savePin: savePin
  };
})(window);
