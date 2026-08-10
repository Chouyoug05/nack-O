(function (global) {
  var ui, api, state;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    var now = new Date();
    state = {
      ctx: ctx,
      sales: [],
      products: [],
      losses: [],
      period: "day",
      calYear: now.getFullYear(),
      calMonth: now.getMonth()
    };
    root.innerHTML =
      '<div class="lg-row-actions lg-reports-actions">' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="reports-period" data-arg="day">Jour</button>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="reports-period" data-arg="week">Semaine</button>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="reports-period" data-arg="month">Mois</button>' +
      '</div>' +
      '<div class="lg-row-actions lg-reports-actions" style="margin-top:8px">' +
        '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" data-action="reports-export-csv">Export CSV</button>' +
        '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" data-action="reports-export-pdf">Export PDF</button>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-action="reports-receipts">Télécharger reçus</button>' +
      '</div>' +
      '<div id="reports-summary" class="lg-stats"></div>' +
      '<div id="reports-top" class="lg-card" style="margin:12px 0"></div>' +
      '<div id="reports-calendar" class="lg-card" style="margin-bottom:12px"></div>' +
      '<div id="reports-list" class="lg-loading">Chargement du rapport…</div>';
    load();
  }

  function dataRoot() { return api.dataRoot(state.ctx.profile, state.ctx.uid); }
  function salesPath() { return dataRoot() + "/sales"; }
  function productsPath() { return dataRoot() + "/products"; }
  function lossesPath() { return dataRoot() + "/losses"; }

  function periodStart(period) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === "week") d.setDate(d.getDate() - 6);
    else if (period === "month") d.setDate(1);
    return d.getTime();
  }

  function setPeriod(period) {
    if (!state) return;
    state.period = period || "day";
    paint();
  }

  function calPrev() {
    state.calMonth--;
    if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
    paintCalendar();
  }

  function calNext() {
    state.calMonth++;
    if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
    paintCalendar();
  }

  function load() {
    Promise.all([
      api.listDocs(salesPath(), 300).catch(function () { return []; }),
      api.listDocs(productsPath(), 200).catch(function () { return []; }),
      api.listDocs(lossesPath(), 200).catch(function () { return []; })
    ]).then(function (res) {
      state.sales = res[0] || [];
      state.products = res[1] || [];
      state.losses = res[2] || [];
      state.sales.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      paint();
    }).catch(function (err) {
      var el = ui.$("reports-list");
      if (el) el.innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message) + '</div>';
    });
  }

  function filteredSales() {
    var start = periodStart(state.period);
    var out = [];
    for (var i = 0; i < state.sales.length; i++) {
      if ((Number(state.sales[i].createdAt) || 0) >= start) out.push(state.sales[i]);
    }
    return out;
  }

  function topProducts(salesList) {
    var map = {};
    for (var i = 0; i < salesList.length; i++) {
      var items = salesList[i].items || [];
      for (var j = 0; j < items.length; j++) {
        var it = items[j];
        var key = it.name || it.id || "?";
        if (!map[key]) map[key] = { name: key, qty: 0, revenue: 0 };
        map[key].qty += Number(it.quantity) || 1;
        map[key].revenue += (Number(it.price) || 0) * (Number(it.quantity) || 1);
      }
    }
    var arr = [];
    for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) arr.push(map[k]);
    arr.sort(function (a, b) { return b.revenue - a.revenue; });
    return arr.slice(0, 5);
  }

  function estimateProfit(salesList) {
    var revenue = 0, cost = 0;
    var priceMap = {};
    for (var i = 0; i < state.products.length; i++) {
      priceMap[state.products[i].id] = Number(state.products[i].costPrice) || Number(state.products[i].price) * 0.6 || 0;
    }
    for (var s = 0; s < salesList.length; s++) {
      revenue += Number(salesList[s].total) || 0;
      var items = salesList[s].items || [];
      for (var j = 0; j < items.length; j++) {
        var it = items[j];
        cost += (priceMap[it.id] || (Number(it.price) || 0) * 0.6) * (Number(it.quantity) || 1);
      }
    }
    for (var l = 0; l < state.losses.length; l++) {
      var loss = state.losses[l];
      if ((Number(loss.createdAt) || 0) >= periodStart(state.period)) {
        cost += (Number(loss.quantity) || 0) * (priceMap[loss.productId] || 0);
      }
    }
    return { revenue: revenue, cost: cost, profit: revenue - cost };
  }

  function paintCalendar() {
    var el = ui.$("reports-calendar");
    if (!el) return;
    var y = state.calYear, m = state.calMonth;
    var first = new Date(y, m, 1);
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var startDow = (first.getDay() + 6) % 7;
    var dayTotals = {};
    for (var i = 0; i < state.sales.length; i++) {
      var s = state.sales[i];
      var d = new Date(Number(s.createdAt) || 0);
      if (d.getFullYear() === y && d.getMonth() === m) {
        var key = d.getDate();
        dayTotals[key] = (dayTotals[key] || 0) + (Number(s.total) || 0);
      }
    }
    var months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    var html =
      '<div class="lg-row-actions" style="justify-content:space-between;align-items:center">' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="reports-cal-prev">←</button>' +
        '<strong>' + months[m] + ' ' + y + '</strong>' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="reports-cal-next">→</button>' +
      '</div><div class="lg-cal-grid">';
    var d;
    for (d = 0; d < startDow; d++) html += '<div class="lg-cal-day empty"></div>';
    for (d = 1; d <= daysInMonth; d++) {
      var tot = dayTotals[d] || 0;
      html += '<div class="lg-cal-day' + (tot > 0 ? " has-sales" : "") + '"><span class="lg-cal-num">' + d + '</span>' +
        (tot > 0 ? '<span class="lg-cal-amt">' + Math.round(tot / 1000) + 'k</span>' : '') + '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  function paint() {
    var filtered = filteredSales();
    var total = 0;
    for (var i = 0; i < filtered.length; i++) total += Number(filtered[i].total) || 0;
    var profit = estimateProfit(filtered);
    var sum = ui.$("reports-summary");
    if (sum) {
      sum.innerHTML =
        '<div class="lg-stat"><div class="lg-stat-label">CA période</div><div class="lg-stat-value">' + ui.escapeHtml(ui.formatMoney(total)) + '</div></div>' +
        '<div class="lg-stat"><div class="lg-stat-label">Nb ventes</div><div class="lg-stat-value">' + filtered.length + '</div></div>' +
        '<div class="lg-stat"><div class="lg-stat-label">Bénéfice est.</div><div class="lg-stat-value">' + ui.escapeHtml(ui.formatMoney(profit.profit)) + '</div></div>' +
        '<div class="lg-stat"><div class="lg-stat-label">Panier moy.</div><div class="lg-stat-value">' +
          ui.escapeHtml(ui.formatMoney(filtered.length ? total / filtered.length : 0)) + '</div></div>';
    }
    var topEl = ui.$("reports-top");
    if (topEl) {
      var top = topProducts(filtered);
      var th = '<div class="lg-card-title">Top 5 produits</div>';
      if (!top.length) th += '<div class="lg-card-desc">Aucune vente</div>';
      else {
        for (var t = 0; t < top.length; t++) {
          th += '<div class="lg-list-item"><div class="lg-list-item-main"><div class="lg-list-item-title">' +
            (t + 1) + '. ' + ui.escapeHtml(top[t].name) + '</div><div class="lg-list-item-meta">' +
            top[t].qty + ' vendus</div></div><span>' + ui.escapeHtml(ui.formatMoney(top[t].revenue)) + '</span></div>';
        }
      }
      topEl.innerHTML = th;
    }
    paintCalendar();
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
        '<div class="lg-list-item lg-sale-row" data-action="reports-print-one" data-arg="' + ui.escapeHtml(sale.id) + '" role="button">' +
          '<div class="lg-list-item-main">' +
            '<div class="lg-list-item-title">' + ui.escapeHtml(ui.formatMoney(sale.total)) + '</div>' +
            '<div class="lg-list-item-meta">' + ui.escapeHtml(ui.formatDate(sale.createdAt)) +
              " · " + ui.escapeHtml(sale.paymentMethod || "cash") +
              (names.length ? "<br>" + ui.escapeHtml(names.join(", ")) : "") +
            '</div>' +
          '</div>' +
          '<span class="lg-sale-receipt-btn">' + (global.NACK_LIGHT.icon ? global.NACK_LIGHT.icon("download", 16) : "") + ' Reçu</span>' +
        '</div>';
    }
    list.innerHTML = html;
  }

  function printOneReceipt(saleId) {
    var sale = null;
    for (var i = 0; i < state.sales.length; i++) if (state.sales[i].id === saleId) sale = state.sales[i];
    if (!sale) { ui.toast("Vente introuvable", "error"); return; }
    if (global.NACK_LIGHT.receipt && global.NACK_LIGHT.receipt.downloadReceipt) {
      global.NACK_LIGHT.receipt.downloadReceipt(state.ctx.profile, sale, { print: true });
      return;
    }
    openReceiptWindow([sale], false);
  }

  function downloadReceipts() {
    var filtered = filteredSales();
    if (!filtered.length) { ui.toast("Aucune vente sur cette période", "error"); return; }
    openReceiptWindow(filtered.slice(0, 50), true);
  }

  function openReceiptWindow(salesList, multi) {
    var p = state.ctx.profile || {};
    var blocks = "";
    for (var i = 0; i < salesList.length; i++) {
      var sale = salesList[i];
      var items = sale.items || [];
      var lines = "";
      for (var j = 0; j < items.length; j++) {
        var it = items[j];
        lines += "<tr><td>" + ui.escapeHtml(it.name) + " ×" + (it.quantity || 1) + "</td><td style='text-align:right'>" +
          ui.escapeHtml(ui.formatMoney((it.price || 0) * (it.quantity || 1))) + "</td></tr>";
      }
      blocks +=
        "<div class='receipt'>" +
          "<h2>" + ui.escapeHtml(p.establishmentName || "NACK") + "</h2>" +
          "<p style='text-align:center'>" + ui.escapeHtml(ui.formatDate(sale.createdAt)) + "</p>" +
          "<table>" + lines + "</table>" +
          "<p style='text-align:right;font-weight:bold'>Total : " + ui.escapeHtml(ui.formatMoney(sale.total)) + "</p>" +
          (p.customMessage ? "<p style='text-align:center'>" + ui.escapeHtml(p.customMessage) + "</p>" : "") +
        "</div>";
    }
    var w = window.open("", "_blank", multi ? "width=420,height=700" : "width=320,height=600");
    if (!w) { ui.toast("Autorisez les popups pour télécharger les reçus", "error"); return; }
    w.document.write(
      "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Reçus NACK</title>" +
      "<style>body{font-family:monospace;font-size:12px;padding:12px}" +
      ".receipt{max-width:280px;margin:0 auto 24px;padding-bottom:16px;border-bottom:1px dashed #999;page-break-after:always}" +
      "table{width:100%}h2{text-align:center;margin:0}" +
      "@media print{.receipt{border:none}}</style></head><body>" +
      blocks +
      "<script>window.onload=function(){try{window.print();}catch(e){}}<\/script>" +
      "</body></html>"
    );
    w.document.close();
    w.focus();
    ui.toast(multi ? "Reçus prêts à imprimer / enregistrer en PDF" : "Reçu ouvert", "ok");
  }

  function exportCsv() {
    var filtered = filteredSales();
    var rows = [["date", "total", "paiement", "articles"]];
    for (var i = 0; i < filtered.length; i++) {
      var s = filtered[i];
      var names = [];
      var items = s.items || [];
      for (var j = 0; j < items.length; j++) names.push((items[j].name || "") + " x" + (items[j].quantity || 1));
      rows.push([ui.formatDate(s.createdAt), s.total, s.paymentMethod || "cash", names.join("; ")]);
    }
    api.exportCsv("rapport_" + state.period + ".csv", rows);
    ui.toast("Export CSV lancé", "ok");
  }

  function exportPdf() {
    var filtered = filteredSales();
    var profit = estimateProfit(filtered);
    var total = 0;
    for (var i = 0; i < filtered.length; i++) total += Number(filtered[i].total) || 0;
    var w = window.open("", "_blank");
    if (!w) { ui.toast("Autorisez les popups", "error"); return; }
    var rows = "";
    for (var j = 0; j < filtered.length; j++) {
      rows += "<tr><td>" + ui.escapeHtml(ui.formatDate(filtered[j].createdAt)) + "</td><td>" + ui.escapeHtml(ui.formatMoney(filtered[j].total)) + "</td></tr>";
    }
    w.document.write(
      "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Rapport NACK</title>" +
      "<style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px}</style></head><body>" +
      "<h1>Rapport " + state.period + "</h1>" +
      "<p>CA : " + ui.escapeHtml(ui.formatMoney(total)) + " — Bénéfice est. : " + ui.escapeHtml(ui.formatMoney(profit.profit)) + "</p>" +
      "<table><tr><th>Date</th><th>Total</th></tr>" + rows + "</table></body></html>"
    );
    w.document.close();
    w.print();
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.reports = {
    render: render, setPeriod: setPeriod, calPrev: calPrev, calNext: calNext,
    exportCsv: exportCsv, exportPdf: exportPdf,
    downloadReceipts: downloadReceipts, printOneReceipt: printOneReceipt
  };
})(window);
