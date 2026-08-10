(function (global) {
  var ui, api, state, icon;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    icon = global.NACK_LIGHT.icon;
    var id = global.NACK_LIGHT._selectedCustomerId;
    state = { ctx: ctx, customer: null, sales: [], id: id };
    if (!id) {
      root.innerHTML = '<div class="lg-empty">Client introuvable</div>';
      return;
    }
    root.innerHTML = '<div class="lg-loading">Chargement du client…</div>';
    load();
  }

  function customersPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/customers"; }
  function salesPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/sales"; }

  function load() {
    Promise.all([
      api.getDoc(customersPath() + "/" + state.id),
      api.listDocs(salesPath(), 100).catch(function () { return []; })
    ]).then(function (res) {
      state.customer = res[0];
      state.sales = res[1] || [];
      if (!state.customer) {
        ui.$("view-root").innerHTML = '<div class="lg-empty">Client introuvable</div>';
        return;
      }
      paint(ui.$("view-root") || document.getElementById("view-root"));
    }).catch(function (err) {
      var root = document.getElementById("view-root");
      if (root) root.innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message) + '</div>';
    });
  }

  function relatedSales() {
    var c = state.customer;
    if (!c) return [];
    var phone = (c.phone || "").replace(/\s/g, "");
    var email = (c.email || "").toLowerCase();
    var out = [];
    for (var i = 0; i < state.sales.length; i++) {
      var s = state.sales[i];
      var custName = (s.customerName || "").toLowerCase();
      if (custName && c.name && custName.indexOf(c.name.toLowerCase()) >= 0) out.push(s);
      else if (s.customerPhone && phone && String(s.customerPhone).replace(/\s/g, "") === phone) out.push(s);
      else if (s.customerEmail && email && String(s.customerEmail).toLowerCase() === email) out.push(s);
    }
    return out.slice(0, 10);
  }

  function paint(root) {
    if (!root) return;
    var c = state.customer;
    var loyalty = c.loyaltyType || "standard";
    var pts = Number(c.points) || 0;
    var sales = relatedSales();
    var salesHtml = "";
    for (var i = 0; i < sales.length; i++) {
      salesHtml += '<div class="lg-list-item"><div class="lg-list-item-main"><div class="lg-list-item-title">' +
        ui.escapeHtml(ui.formatMoney(sales[i].total)) + '</div><div class="lg-list-item-meta">' +
        ui.escapeHtml(ui.formatDate(sales[i].createdAt)) + '</div></div></div>';
    }
    if (!salesHtml) salesHtml = '<div class="lg-card-desc">Aucun achat lié</div>';

    root.innerHTML =
      '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="nav" data-arg="customers" style="margin-bottom:12px">← Retour aux clients</button>' +
      '<div class="lg-card" style="text-align:center">' +
        '<div class="lg-avatar" style="width:72px;height:72px;margin:0 auto 10px;font-size:1.5rem;border-radius:16px">' +
          ui.escapeHtml((c.name || "C").charAt(0).toUpperCase()) + '</div>' +
        '<div class="lg-card-title">' + ui.escapeHtml(c.name || "Client") + '</div>' +
        '<span class="lg-badge lg-badge-ok" style="margin-top:8px">' + pts + ' points · ' + ui.escapeHtml(loyalty) + '</span>' +
      '</div>' +
      '<div class="lg-card">' +
        row("Téléphone", c.phone) + row("Email", c.email) +
        row("Visites", c.visitCount || "—") + row("Dépenses totales", c.totalSpent ? ui.formatMoney(c.totalSpent) : "—") +
      '</div>' +
      '<div class="lg-section-title">Programme fidélité</div>' +
      '<div class="lg-card">' +
        '<p class="lg-card-desc">Attribuez ou retirez des points de fidélité.</p>' +
        '<div class="lg-row-actions">' +
          '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-action="cust-pts-add" data-arg="10">+10 pts</button>' +
          '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="cust-pts-add" data-arg="-10">-10 pts</button>' +
          '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" data-action="cust-edit" data-arg="' + ui.escapeHtml(c.id) + '">Modifier</button>' +
        '</div></div>' +
      '<div class="lg-section-title">Historique achats</div>' + salesHtml;
  }

  function row(label, value) {
    return '<div class="lg-profile-row"><span>' + ui.escapeHtml(label) + '</span><span>' + ui.escapeHtml(value || "—") + '</span></div>';
  }

  function adjustPoints(delta) {
    if (!state.customer) return;
    var next = Math.max(0, (Number(state.customer.points) || 0) + delta);
    api.patchDoc(customersPath() + "/" + state.id, { points: next, updatedAt: Date.now() }, ["points", "updatedAt"]).then(function () {
      state.customer.points = next;
      paint(document.getElementById("view-root"));
      ui.toast("Points mis à jour", "ok");
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views["customer-detail"] = { render: render, adjustPoints: adjustPoints };
})(window);
