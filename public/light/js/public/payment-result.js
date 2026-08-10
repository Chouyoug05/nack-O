(function (global) {
  var ui, api;

  function parseParams(query) {
    var out = {};
    var q = String(query || "");
    if (q.charAt(0) === "?") q = q.slice(1);
    var parts = q.split("&");
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split("=");
      if (kv[0]) out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
    }
    return out;
  }

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    var params = parseParams(ctx.query || (typeof location !== "undefined" ? (location.search || "") : ""));
    var status = ctx.status || params.status || params.result || "success";
    var isError = status === "error" || status === "failed" || (ctx.route || "").indexOf("payment-error") !== -1;
    var estId = params.establishmentId || params.uid || "";
    var reference = params.reference || "";
    var transactionId = params.transactionId || "";

    if (transactionId && !isError) {
      updateTransaction(transactionId, "completed", reference);
    } else if (transactionId && isError) {
      updateTransaction(transactionId, "failed", reference);
    }

    var backHref = estId ? api.lightHref("#/commande/" + estId) : api.lightHref("");

    root.innerHTML =
      '<div class="lg-card" style="text-align:center;margin-top:2rem;padding:24px">' +
        '<div style="font-size:3rem;margin-bottom:12px">' + (isError ? "✕" : "✓") + '</div>' +
        '<div class="lg-card-title">' + (isError ? "Paiement échoué" : "Paiement réussi") + '</div>' +
        '<div class="lg-card-desc" style="margin-top:8px">' +
          (isError
            ? "Le paiement n'a pas pu être effectué. Vous pouvez réessayer ou commander sans paiement."
            : "Votre paiement a été confirmé. Merci !") +
        '</div>' +
        (reference ? '<div class="lg-card-desc">Réf: ' + ui.escapeHtml(reference) + '</div>' : '') +
        (transactionId ? '<div class="lg-card-desc">Transaction: ' + ui.escapeHtml(transactionId) + '</div>' : '') +
        '<a class="lg-btn lg-btn-nack lg-btn-block" style="margin-top:20px;display:block;text-align:center" href="' + ui.escapeHtml(backHref) + '">' +
          (estId ? "Retour au menu" : "Retour à l'accueil") + '</a></div>';
  }

  function updateTransaction(transactionId, status, reference) {
    api.runPublicQuery({
      from: [{ collectionId: "payments", allDescendants: true }],
      where: {
        fieldFilter: {
          field: { fieldPath: "transactionId" },
          op: "EQUAL",
          value: { stringValue: transactionId }
        }
      },
      limit: 1
    }).then(function (docs) {
      if (!docs.length || !docs[0]._path) return;
      var payload = { status: status, updatedAt: Date.now() };
      if (status === "completed") payload.paidAt = Date.now();
      return api.publicPatchDoc(docs[0]._path, payload, ["status", "updatedAt", "paidAt"]);
    }).catch(function () {});
  }

  global.NACK_LIGHT.public = global.NACK_LIGHT.public || {};
  global.NACK_LIGHT.public.paymentResult = { render: render };
})(window);
