(function (global) {
  var ui, api, state;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    state = { ctx: ctx, items: [] };
    root.innerHTML =
      '<div class="lg-row-actions">' +
        '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="notif-read-all">Tout marquer lu</button>' +
      '</div>' +
      '<div id="notif-list" class="lg-loading">Chargement…</div>';
    load();
  }

  function path() { return "profiles/" + state.ctx.uid + "/notifications"; }

  function load() {
    api.listDocs(path(), 100).then(function (docs) {
      state.items = docs || [];
      state.items.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      paint();
      updateBadge();
    }).catch(function () {
      var el = ui.$("notif-list");
      if (el) el.innerHTML = '<div class="lg-empty">Aucune notification</div>';
    });
  }

  function unreadCount() {
    var n = 0;
    for (var i = 0; i < state.items.length; i++) if (!state.items[i].read) n++;
    return n;
  }

  function updateBadge() {
    var badge = ui.$("hdr-notif-badge");
    var btn = ui.$("hdr-notif-btn");
    var n = unreadCount();
    if (badge) {
      if (n > 0) {
        badge.style.display = "flex";
        badge.textContent = n > 9 ? "9+" : String(n);
      } else {
        badge.style.display = "none";
      }
    }
    if (btn) {
      if (n > 0) btn.className = "lg-notif-btn has-unread";
      else btn.className = "lg-notif-btn";
    }
  }

  function paint() {
    var el = ui.$("notif-list");
    if (!el) return;
    if (!state.items.length) { el.innerHTML = '<div class="lg-empty">Aucune notification</div>'; return; }
    var html = "";
    for (var i = 0; i < state.items.length; i++) {
      var n = state.items[i];
      html +=
        '<div class="lg-card' + (n.read ? "" : " lg-unread") + '">' +
          '<div class="lg-card-title">' + ui.escapeHtml(n.title || "Notification") + '</div>' +
          '<div class="lg-card-desc">' + ui.escapeHtml(n.message || "") + '</div>' +
          '<div class="lg-card-desc" style="margin-top:4px">' + ui.escapeHtml(ui.formatDate(n.createdAt)) + '</div>' +
          '<div class="lg-row-actions" style="margin-top:8px">' +
            (!n.read ? '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" data-action="notif-read" data-arg="' + ui.escapeHtml(n.id) + '">Marquer lu</button>' : "") +
            '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="notif-del" data-arg="' + ui.escapeHtml(n.id) + '">Supprimer</button>' +
          '</div></div>';
    }
    el.innerHTML = html;
  }

  function markRead(id) {
    api.patchDoc(path() + "/" + id, { read: true, updatedAt: Date.now() }, ["read", "updatedAt"]).then(load);
  }

  function markAllRead() {
    var chain = Promise.resolve();
    for (var i = 0; i < state.items.length; i++) {
      if (!state.items[i].read) {
        (function (id) {
          chain = chain.then(function () {
            return api.patchDoc(path() + "/" + id, { read: true }, ["read"]);
          });
        })(state.items[i].id);
      }
    }
    chain.then(function () { load(); ui.toast("Notifications lues", "ok"); });
  }

  function del(id) {
    api.deleteDoc(path() + "/" + id).then(load);
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.notifications = { render: render, markRead: markRead, markAllRead: markAllRead, del: del, refreshBadge: updateBadge, load: load };
})(window);
