(function (global) {
  function render(root, ctx) {
    var ui = global.NACK_LIGHT.ui;
    var api = global.NACK_LIGHT.api;
    var icon = global.NACK_LIGHT.icon;
    var uid = ctx.uid || "";
    var url = api.publicBase() + "/commande/" + uid;
    var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + encodeURIComponent(url);
    var est = (ctx.profile && ctx.profile.establishmentName) || "votre établissement";

    root.innerHTML =
      '<div class="lg-card">' +
        '<div class="lg-card-title lg-btn-icon">' + icon("qrcode", 20) + ' Menu Digital</div>' +
        '<div class="lg-card-desc">Un seul QR Code pour tout ' + ui.escapeHtml(est) + '. Vos clients commandent depuis n\'importe quelle table.</div>' +
        '<div class="lg-steps">' +
          '<div class="lg-step"><span class="lg-step-num">1</span><span>Scannez ou affichez le QR Code sur chaque table</span></div>' +
          '<div class="lg-step"><span class="lg-step-num">2</span><span>Copiez le lien et partagez-le à vos clients</span></div>' +
          '<div class="lg-step"><span class="lg-step-num">3</span><span>Les commandes apparaissent dans Commandes en cours (Vente)</span></div>' +
        '</div>' +
        '<div class="lg-qr-box">' +
          '<img id="menu-qr-img" src="' + ui.escapeHtml(qrUrl) + '" alt="QR Code menu digital">' +
          '<p class="lg-card-desc" style="margin-top:8px">QR Code unique — ' + ui.escapeHtml(est) + '</p>' +
        '</div>' +
        '<div class="lg-link-box" id="menu-url">' + ui.escapeHtml(url) + '</div>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block lg-btn-icon" data-action="copy-text" data-arg="' + ui.escapeHtml(url) + '">' + icon("copy", 18) + ' Copier le lien</button>' +
        '<a class="lg-btn lg-btn-outline lg-btn-block lg-btn-icon" style="margin-top:8px;display:block;text-align:center" href="' + ui.escapeHtml(url) + '" target="_blank" rel="noopener">' + icon("external", 18) + ' Ouvrir le menu</a>' +
      '</div>';
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.menu = { render: render };
})(window);
