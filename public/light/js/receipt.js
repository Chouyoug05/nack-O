(function (global) {
  function buildReceiptHtml(profile, sale, ui) {
    var p = profile || {};
    var items = sale.items || [];
    var lines = "";
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      lines +=
        "<tr><td>" + ui.escapeHtml(it.name) + " ×" + (it.quantity || 1) +
        "</td><td style='text-align:right'>" +
        ui.escapeHtml(ui.formatMoney((it.price || 0) * (it.quantity || 1))) +
        "</td></tr>";
    }
    return (
      "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Reçu NACK</title>" +
      "<style>body{font-family:monospace;font-size:13px;padding:16px;max-width:320px;margin:0 auto}" +
      "table{width:100%;border-collapse:collapse}h2{text-align:center;margin:0 0 8px}" +
      ".meta{text-align:center;color:#555;margin-bottom:12px}.total{text-align:right;font-weight:bold;margin-top:12px;font-size:15px}" +
      ".foot{text-align:center;margin-top:16px;color:#666}@media print{body{padding:0}}</style></head><body>" +
      "<h2>" + ui.escapeHtml(p.establishmentName || p.companyName || "NACK") + "</h2>" +
      (p.fullAddress ? "<p class='meta'>" + ui.escapeHtml(p.fullAddress) + "</p>" : "") +
      (p.businessPhone || p.phone ? "<p class='meta'>" + ui.escapeHtml(p.businessPhone || p.phone) + "</p>" : "") +
      "<p class='meta'>" + ui.escapeHtml(ui.formatDate(sale.createdAt)) + "</p>" +
      "<table>" + lines + "</table>" +
      "<p class='total'>Total : " + ui.escapeHtml(ui.formatMoney(sale.total)) + "</p>" +
      (p.customMessage || p.ticketFooterMessage
        ? "<p class='foot'>" + ui.escapeHtml(p.ticketFooterMessage || p.customMessage) + "</p>"
        : "<p class='foot'>Merci de votre visite</p>") +
      "</body></html>"
    );
  }

  /** Téléchargement sans quitter l'app (évite blob: qui bloque le retour tablette). */
  function downloadHtml(html, filename) {
    try {
      var blob = new Blob([html], { type: "application/octet-stream" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename || "recu-nack.html";
      a.rel = "noopener";
      a.target = "_blank";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {}
      }, 800);
      return true;
    } catch (e) { return false; }
  }

  /** Impression via iframe invisible — ne crée pas d'onglet ni d'entrée d'historique. */
  function openPrint(html) {
    try {
      var iframe = document.getElementById("lg-print-frame");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "lg-print-frame";
        iframe.setAttribute("aria-hidden", "true");
        iframe.title = "Impression reçu";
        iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
        document.body.appendChild(iframe);
      }
      var win = iframe.contentWindow;
      if (!win) return false;
      var doc = win.document;
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(function () {
        try {
          win.focus();
          win.print();
        } catch (e) {}
      }, 350);
      return true;
    } catch (e) {
      return false;
    }
  }

  function downloadReceipt(profile, sale, opts) {
    var ui = global.NACK_LIGHT.ui;
    if (!sale) return false;
    opts = opts || {};
    var html = buildReceiptHtml(profile, sale, ui);
    var name = "recu-" + (sale.id || Date.now()) + ".html";
    var ok = downloadHtml(html, name);
    if (opts.print !== false) {
      openPrint(html);
    }
    if (ok) ui.toast("Reçu enregistré", "ok");
    else if (opts.print !== false) ui.toast("Impression du reçu…", "ok");
    else ui.toast("Impossible d'enregistrer le reçu", "error");
    return true;
  }

  global.NACK_LIGHT.receipt = {
    buildReceiptHtml: buildReceiptHtml,
    downloadHtml: downloadHtml,
    openPrint: openPrint,
    downloadReceipt: downloadReceipt
  };
})(window);
