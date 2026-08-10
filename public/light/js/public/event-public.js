(function (global) {
  var ui, api, state;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    var eventId = ctx.eventId;
    state = { eventId: eventId, event: null, ownerUid: null, root: root };

    root.innerHTML = '<div class="lg-loading">Chargement événement…</div>';
    api.runPublicQuery({
      from: [{ collectionId: "events", allDescendants: true }],
      where: {
        fieldFilter: {
          field: { fieldPath: "eventId" },
          op: "EQUAL",
          value: { stringValue: eventId }
        }
      },
      limit: 1
    }).then(function (docs) {
      if (docs.length) return docs[0];
      return findEventByDocId(eventId);
    }).then(function (ev) {
      if (!ev) throw new Error("Événement introuvable");
      state.event = ev;
      state.ownerUid = ownerUidFromEventPath(ev._path);
      paint();
    }).catch(function (err) {
      root.innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message || "Événement indisponible") + '</div>';
    });
  }

  function ownerUidFromEventPath(path) {
    if (!path) return null;
    var m = String(path).match(/\/(?:profiles|establishments)\/([^/]+)\/events\//);
    return m ? m[1] : null;
  }

  function findEventByDocId(id) {
    return api.runPublicQuery({
      from: [{ collectionId: "events", allDescendants: true }],
      limit: 50
    }).then(function (docs) {
      for (var i = 0; i < docs.length; i++) if (docs[i].id === id) return docs[i];
      return null;
    });
  }

  function paint() {
    var e = state.event;
    var sold = Number(e.ticketsSold) || 0;
    var cap = Number(e.maxCapacity) || 0;
    var avail = cap - sold;
    var dateStr = e.date ? ui.formatDate(e.date) : "—";
    var price = ui.formatMoney(e.ticketPrice || 0);
    var wa = (e.organizerWhatsapp || "").replace(/\D/g, "");
    var waLink = wa ? "https://wa.me/" + encodeURIComponent(wa) + "?text=" +
      encodeURIComponent("Bonjour, je souhaite des billets pour " + (e.title || "") + " (" + dateStr + ")") : "";

    state.root.innerHTML =
      '<div class="lg-card">' +
        (e.imageUrl ? '<img src="' + ui.escapeHtml(e.imageUrl) + '" alt="" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px;margin-bottom:12px">' : '') +
        '<div class="lg-card-title">' + ui.escapeHtml(e.title || "Événement") + '</div>' +
        '<div class="lg-card-desc">' + ui.escapeHtml(e.description || "") + '</div>' +
        '<div class="lg-stats" style="margin-top:12px">' +
          '<div class="lg-stat"><div class="lg-stat-label">Date</div><div class="lg-stat-value" style="font-size:0.85rem">' + ui.escapeHtml(dateStr) + '</div></div>' +
          '<div class="lg-stat"><div class="lg-stat-label">Lieu</div><div class="lg-stat-value" style="font-size:0.85rem">' + ui.escapeHtml(e.location || "—") + '</div></div>' +
          '<div class="lg-stat"><div class="lg-stat-label">Billet</div><div class="lg-stat-value" style="font-size:0.85rem">' + ui.escapeHtml(price) + '</div></div>' +
        '</div>' +
        '<div class="lg-card-desc" style="margin-top:8px">Places restantes : <strong>' + Math.max(0, avail) + '</strong></div>' +
        (waLink
          ? '<a class="lg-btn lg-btn-nack lg-btn-block" style="margin-top:16px;text-align:center;display:block" href="' + ui.escapeHtml(waLink) + '" target="_blank" rel="noopener">Réserver via WhatsApp</a>'
          : '<p class="lg-card-desc" style="margin-top:16px">Contactez l\'organisateur pour réserver.</p>') +
      '</div>';
  }

  global.NACK_LIGHT.public = global.NACK_LIGHT.public || {};
  global.NACK_LIGHT.public.eventPublic = { render: render };
})(window);
