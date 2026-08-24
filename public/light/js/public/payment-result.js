(function (global) {
  var ui, api;

  function netlifyFn(name) {
    var host = String(window.location.hostname || "").toLowerCase();
    if (host === "nack.pro" || host === "www.nack.pro") {
      return "/.netlify/functions/" + name;
    }
    return "https://nack.pro/.netlify/functions/" + name;
  }

  function formatMoney(n) {
    return (ui && ui.formatMoney) ? ui.formatMoney(n) : Number(n || 0).toLocaleString("fr-FR");
  }

  function escapeHtml(s) {
    return (ui && ui.escapeHtml) ? ui.escapeHtml(s) : String(s || "").replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function getStoredOrder(ref) {
    if (!ref) return null;
    try {
      var raw = localStorage.getItem('nack_last_order_' + ref);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function printReceipt(storedOrder) {
    if (!storedOrder || !storedOrder.orderData) {
      alert('Aucune commande à imprimer');
      return;
    }
    var order = storedOrder.orderData;
    var estName = storedOrder.establishmentName || 'Établissement';

    var itemsHtml = (order.items || []).map(function (item) {
      var total = item.price * item.quantity;
      return '<tr><td>' + escapeHtml(item.name) + '</td><td style="text-align:right">' + item.quantity + '</td><td style="text-align:right">' + formatMoney(item.price) + ' XAF</td><td style="text-align:right">' + formatMoney(total) + ' XAF</td></tr>';
    }).join('');

    var receiptHtml =
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reçu - Commande ' + escapeHtml(String(order.orderNumber || '')) + '</title>' +
      '<style>' +
      'body{font-family:Arial,sans-serif;max-width:400px;margin:20px auto;padding:20px;font-size:14px}' +
      'h1{font-size:20px;text-align:center;margin-bottom:5px}' +
      'h2{font-size:16px;text-align:center;color:#666;margin-top:0}' +
      '.info{margin:15px 0;line-height:1.6}' +
      'table{width:100%;border-collapse:collapse;margin:15px 0}' +
      'th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd}' +
      'th{background:#f5f5f5;font-weight:bold}' +
      '.total{font-size:18px;font-weight:bold;margin-top:15px;padding-top:15px;border-top:2px solid #333}' +
      '.footer{margin-top:30px;text-align:center;font-size:12px;color:#666}' +
      '@media print{body{margin:0}}' +
      '</style></head><body>' +
      '<h1>' + escapeHtml(estName) + '</h1>' +
      '<h2>Reçu de commande</h2>' +
      '<div class="info">' +
      '<p><strong>Commande N°</strong> ' + escapeHtml(String(order.orderNumber || '')) + '</p>' +
      (order.tableNumber ? '<p><strong>Table</strong> ' + escapeHtml(String(order.tableNumber)) + '</p>' : '') +
      '<p><strong>Date</strong> ' + new Date(order.createdAt).toLocaleString('fr-FR') + '</p>' +
      '<p><strong>Référence</strong> ' + escapeHtml(order.paymentReference || '') + '</p>' +
      '<p><strong>Paiement</strong> ' + escapeHtml(order.paymentMethod || 'mobile') + '</p>' +
      '</div>' +
      '<table><thead><tr><th>Article</th><th>Qté</th><th>Prix</th><th>Total</th></tr></thead><tbody>' + itemsHtml + '</tbody></table>' +
      '<div class="info">' +
      '<p><strong>Sous-total</strong> ' + formatMoney(order.subtotal) + ' XAF</p>' +
      (order.deliveryPrice > 0 ? '<p><strong>Livraison</strong> ' + formatMoney(order.deliveryPrice) + ' XAF</p>' : '') +
      '</div>' +
      '<div class="total">TOTAL: ' + formatMoney(order.total) + ' XAF</div>' +
      '<div class="footer"><p>Merci pour votre commande !</p></div>' +
      '</body></html>';

    var printWindow = window.open('', '_blank', 'width=500,height=600');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(function () { printWindow.print(); }, 250);
    }
  }

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    var params = ctx.query ? parseQuery(ctx.query) : {};
    var status = ctx.status || params.status || params.result || "success";
    var isError = status === "error" || status === "failed" || (ctx.route || "").indexOf("payment-error") !== -1;
    var estId = params.establishmentId || params.uid || "";
    var reference = params.reference || "";
    var transactionId = params.transactionId || "";
    var tx = transactionId || reference;
    var storedOrder = getStoredOrder(reference);

    var receiptBtn = storedOrder
      ? '<button class="lg-btn lg-btn-nack lg-btn-block" style="margin-top:12px;display:block;text-align:center;width:100%" id="btn-receipt">Télécharger le reçu</button>'
      : '';

    root.innerHTML =
      '<div class="lg-card" style="text-align:center;margin-top:2rem;padding:24px">' +
        '<div style="font-size:3rem;margin-bottom:12px">' + (isError ? "✕" : "...") + '</div>' +
        '<div class="lg-card-title">' + (isError ? "Paiement échoué" : "Vérification du paiement") + '</div>' +
        '<div class="lg-card-desc" style="margin-top:8px">' +
          (isError
            ? "Le paiement n'a pas pu être effectué. Vous pouvez réessayer ou commander sans paiement."
            : "Nous confirmons votre paiement auprès de SingPay…") +
        '</div>' +
        (reference ? '<div class="lg-card-desc">Réf: ' + escapeHtml(reference) + '</div>' : '') +
        '<div id="pay-result-extra"></div>' +
        receiptBtn +
        '<a class="lg-btn lg-btn-nack lg-btn-block" style="margin-top:20px;display:block;text-align:center" href="' + escapeHtml(menuHref(estId)) + '">Retour au menu</a>' +
      '</div>';

    var receiptBtnEl = document.getElementById('btn-receipt');
    if (receiptBtnEl && storedOrder) {
      receiptBtnEl.addEventListener('click', function () { printReceipt(storedOrder); });
    }

    if (tx && tx.length >= 8) {
      fetch(netlifyFn("complete-public-payment"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: tx })
      }).then(function (res) { return res.json(); }).then(function (data) {
        var extra = document.getElementById("pay-result-extra");
        if (data && data.success) {
          if (extra) {
            extra.innerHTML = '<div class="lg-card-desc" style="margin-top:8px;color:#16a34a">Paiement confirmé. Votre commande est en préparation.</div>';
          }
          var icon = root.querySelector("div");
          if (icon) icon.textContent = "✓";
          var title = root.querySelector(".lg-card-title");
          if (title) title.textContent = "Paiement réussi";
        } else if (data && data.error && extra) {
          extra.innerHTML = '<div class="lg-card-desc" style="margin-top:8px;color:#b91c1c">' + escapeHtml(data.error) + '</div>';
        }
      }).catch(function () {});
    }

    try {
      if (reference) localStorage.removeItem('nack_last_order_' + reference);
    } catch (e) {}
  }

  function menuHref(estId) {
    return api.lightHref(estId ? "menu/" + estId : "");
  }

  function parseQuery(qs) {
    var out = {};
    String(qs || "").split("&").forEach(function (pair) {
      if (!pair) return;
      var kv = pair.split("=");
      out[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || "").replace(/\+/g, " "));
    });
    return out;
  }

  global.NACK_LIGHT.public = global.NACK_LIGHT.public || {};
  global.NACK_LIGHT.public.paymentResult = { render: render };
})(window);
