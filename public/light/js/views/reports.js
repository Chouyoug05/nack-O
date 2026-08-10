(function (global) {
  var ui, api, state;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    state = { ctx: ctx, sales: [], period: "today" };
    root.innerHTML =
      '<div class="lg-row-actions">' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="reports-period" data-arg="today">Aujourd\'hui</button>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="reports-period" data-arg="week">7 jours</button>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="reports-period" data-arg="month">30 jours</button>' +
      '</div>' +
      '<div id="reports-summary" class="lg-stats"></div>' +
      '<div id="reports-list" class="lg-loading">Chargement du rapport…</div>';
    load();
  }

  function salesPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/sales"; }

  function periodStart(period) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === "week") d.setDate(d.getDate() - 6);
    else if (period === "month") d.setDate(d.getDate() - 29);
    return d.getTime();
  }

  function setPeriod(period) {
    if (!state) return;
    state.period = period || "today";
    paint();
  }

  function load() {
    api.listDocs(salesPath(), 200).then(function (docs) {
      state.sales = docs || [];
      state.sales.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      paint();
    }).catch(function (err) {
      var el = ui.$("reports-list");
      if (el) el.innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message) + '</div>';
    });
  }

  function paint() {
    var start = periodStart(state.period);
    var filtered = [];
    var total = 0;
    for (var i = 0; i < state.sales.length; i++) {
      var s = state.sales[i];
      if ((Number(s.createdAt) || 0) >= start) {
        filtered.push(s);
        total += Number(s.total) || 0;
      }
    }
    var sum = ui.$("reports-summary");
    if (sum) {
      sum.innerHTML =
        '<div class="lg-stat"><div class="lg-stat-label">CA période</div><div class="lg-stat-value">' + ui.escapeHtml(ui.formatMoney(total)) + '</div></div>' +
        '<div class="lg-stat"><div class="lg-stat-label">Nb ventes</div><div class="lg-stat-value">' + filtered.length + '</div></div>' +
        '<div class="lg-stat"><div class="lg-stat-label">Panier moy.</div><div class="lg-stat-value">' +
          ui.escapeHtml(ui.formatMoney(filtered.length ? total / filtered.length : 0)) + '</div></div>';
    }
    var list = ui.$("reports-list");
    if (!list) return;
    if (!filtered.length) { list.innerHTML = '<div class="lg-empty">Aucune vente sur la période</div>'; return; }
    var html = "";
    for (var j = 0; j < filtered.length; j++) {
      var sale = filtered[j];
      var items = sale.items || [];
      var names = [];
      for (var k = 0; k < items.length && k < 3; k++) names.push((items[k].name || "") + "×" + (items[k].quantity || 1));
      html +=
        '<div class="lg-list-item">' +
          '<div class="lg-list-item-main">' +
            '<div class="lg-list-item-title">' + ui.escapeHtml(ui.formatMoney(sale.total)) + '</div>' +
            '<div class="lg-list-item-meta">' + ui.escapeHtml(ui.formatDate(sale.createdAt)) +
              " · " + ui.escapeHtml(sale.paymentMethod || "cash") +
              (names.length ? "<br>" + ui.escapeHtml(names.join(", ")) : "") +
            '</div>' +
          '</div>' +
        '</div>';
    }
    list.innerHTML = html;
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.reports = { render: render, setPeriod: setPeriod };
})(window);
