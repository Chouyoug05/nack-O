(function (global) {
  var ui, api, state;

  var TABS = [
    { id: "users", label: "Utilisateurs" },
    { id: "tablets", label: "Tablettes" },
    { id: "support", label: "Support" },
    { id: "products", label: "Produits" },
    { id: "orders", label: "Commandes" },
    { id: "events", label: "Événements" },
    { id: "subscriptions", label: "Abonnements" },
    { id: "notifications", label: "Notifications" },
    { id: "customers", label: "Clients" },
    { id: "disbursements", label: "Versements" },
    { id: "affiliates", label: "Affiliés" },
    { id: "stats", label: "Statistiques" }
  ];

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    state = { root: root, ctx: ctx, tab: "users", data: {}, search: "" };

    if (!ctx.uid) {
      root.innerHTML = '<div class="lg-empty">Connexion requise</div>';
      return;
    }
    api.isAdmin(ctx.uid).then(function (ok) {
      if (!ok) {
        root.innerHTML = '<div class="lg-empty">Accès admin refusé</div>';
        return;
      }
      paintShell();
      loadTab("users");
    });
  }

  function paintShell() {
    var tabs = "";
    for (var i = 0; i < TABS.length; i++) {
      var t = TABS[i];
      tabs += '<button type="button" class="lg-tab' + (state.tab === t.id ? " active" : "") + '" data-adm-tab="' + t.id + '">' + t.label + '</button>';
    }
    state.root.innerHTML =
      '<div class="lg-team-header"><div class="lg-card-title">Administration NACK</div></div>' +
      '<div class="lg-search"><input class="lg-input" id="adm-search" type="search" placeholder="Rechercher…"></div>' +
      '<div class="lg-tabs" style="flex-wrap:wrap;margin-bottom:12px">' + tabs + '</div>' +
      '<div id="adm-panel" class="lg-loading">Chargement…</div>';
    ui.$("adm-search").oninput = function () {
      state.search = String(ui.$("adm-search").value || "").toLowerCase();
      paintPanel();
    };
    var btns = state.root.querySelectorAll("[data-adm-tab]");
    for (var j = 0; j < btns.length; j++) {
      btns[j].onclick = function () { loadTab(this.getAttribute("data-adm-tab")); };
    }
  }

  function loadTab(tab) {
    state.tab = tab;
    var btns = state.root.querySelectorAll("[data-adm-tab]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].className = "lg-tab" + (btns[i].getAttribute("data-adm-tab") === tab ? " active" : "");
    }
    var panel = ui.$("adm-panel");
    if (panel) panel.innerHTML = '<div class="lg-loading">Chargement…</div>';
    var loaders = {
      users: loadUsers,
      tablets: loadTablets,
      support: loadSupport,
      products: loadProducts,
      orders: loadOrders,
      events: loadEvents,
      subscriptions: loadSubscriptions,
      notifications: loadNotifications,
      customers: loadCustomers,
      disbursements: loadDisbursements,
      affiliates: loadAffiliates,
      stats: loadStats
    };
    (loaders[tab] || loadUsers)();
  }

  function paintPanel() {
    var panel = ui.$("adm-panel");
    if (!panel) return;
    var rows = state.data[state.tab] || [];
    var q = state.search;
    if (q) {
      rows = rows.filter(function (r) {
        return JSON.stringify(r).toLowerCase().indexOf(q) !== -1;
      });
    }
    if (state.tab === "support") {
      paintSupportPanel(panel, rows);
      return;
    }
    if (!rows.length) {
      panel.innerHTML = '<div class="lg-empty">Aucune donnée</div>';
      return;
    }
    var html = '<div class="lg-admin-list">';
    for (var i = 0; i < rows.length && i < 100; i++) {
      html += rowHtml(rows[i]);
    }
    html += '</div>';
    panel.innerHTML = html;
    bindRowActions();
  }

  function rowHtml(r) {
    return '<div class="lg-card lg-admin-row" data-id="' + ui.escapeHtml(r._id || r.id || "") + '" data-tab="' + state.tab + '">' +
      '<div class="lg-list-item-main"><div class="lg-list-item-title">' + ui.escapeHtml(r._title || r.title || r.name || r.email || r.id || "—") + '</div>' +
      '<div class="lg-list-item-meta">' + ui.escapeHtml(r._meta || r._subtitle || "") + '</div></div>' +
      (r._actions ? '<div class="lg-row-actions">' + r._actions + '</div>' : '') +
      '</div>';
  }

  function bindRowActions() {
    var dels = state.root.querySelectorAll("[data-adm-del]");
    for (var i = 0; i < dels.length; i++) {
      dels[i].onclick = function () {
        var id = this.getAttribute("data-adm-del");
        var path = this.getAttribute("data-adm-path");
        if (!window.confirm("Supprimer ?")) return;
        api.deleteDoc(path).then(function () { ui.toast("Supprimé", "ok"); loadTab(state.tab); })
          .catch(function (e) { ui.toast(e.message, "error"); });
      };
    }
    var patches = state.root.querySelectorAll("[data-adm-patch]");
    for (var j = 0; j < patches.length; j++) {
      patches[j].onclick = function () {
        var path = this.getAttribute("data-adm-path");
        var field = this.getAttribute("data-adm-field");
        var val = this.getAttribute("data-adm-val");
        var data = {}; data[field] = val === "true" ? true : val === "false" ? false : val;
        api.patchDoc(path, data, [field]).then(function () { ui.toast("Mis à jour", "ok"); loadTab(state.tab); })
          .catch(function (e) { ui.toast(e.message, "error"); });
      };
    }
    var approveButtons = state.root.querySelectorAll("[data-approve-disbursement]");
    for (var k = 0; k < approveButtons.length; k++) {
      approveButtons[k].onclick = function () {
        var requestId = this.getAttribute("data-approve-disbursement");
        var userId = this.getAttribute("data-user-id");
        var disbursementId = this.getAttribute("data-disbursement-id");
        approveDisbursement(requestId, userId, disbursementId);
      };
    }
  }

  function approveDisbursement(requestId, userId, disbursementId) {
    if (!requestId || !userId || !disbursementId) {
      ui.toast("Données manquantes", "error");
      return;
    }
    api.patchDoc("disbursementRequests/" + requestId, {
      status: "approved",
      approvedAt: Date.now(),
      approvedBy: "admin"
    }, ["status", "approvedAt", "approvedBy"]).then(function () {
      return api.patchProfile(userId, {
        disbursementId: disbursementId,
        disbursementStatus: "approved",
        updatedAt: Date.now()
      }, ["disbursementId", "disbursementStatus", "updatedAt"]);
    }).then(function () {
      return api.patchDoc("publicProfiles/" + userId, {
        paymentsEnabled: true,
        updatedAt: Date.now()
      }, ["paymentsEnabled", "updatedAt"]);
    }).then(function () {
      ui.toast("Disbursement approuvé", "ok");
      loadTab(state.tab);
    }).catch(function (e) {
      ui.toast(e.message || "Erreur", "error");
    });
  }

  function loadTablets() {
    api.listAllTablets().then(function (docs) {
      state.data.tablets = (docs || []).map(function (d) {
        var seen = d.lastSeenAt ? ui.formatDate(d.lastSeenAt) : "—";
        return {
          _id: d.id, id: d.id, imei: d.imei || d.id,
          _title: (d.establishmentName || d.ownerName || "Établissement") + " — " + (d.label || "Tablette"),
          _meta: "IMEI " + (d.imei || d.id) + " • " + (d.ownerName || d.email || d.ownerUid || "—") + " • Vue " + seen,
          ownerUid: d.ownerUid, whatsapp: d.whatsapp, status: d.status || "active"
        };
      });
      paintPanel();
    }).catch(failPanel);
  }

  function loadSupport() {
    api.listAllSupportTickets().then(function (docs) {
      state.data.support = (docs || []).map(function (d) {
        return {
          _id: d.id, id: d.id,
          _title: d.subject || "Ticket",
          _meta: (d.establishmentName || d.ownerName || d.ownerUid || "—") + " • " + (d.status || "open"),
          subject: d.subject, message: d.message, status: d.status,
          adminReply: d.adminReply, ownerUid: d.ownerUid,
          establishmentName: d.establishmentName, ownerName: d.ownerName,
          whatsapp: d.whatsapp, email: d.email, tabletImei: d.tabletImei,
          createdAt: d.createdAt
        };
      });
      paintPanel();
    }).catch(failPanel);
  }

  function paintSupportPanel(panel, rows) {
    var html = "";
    for (var i = 0; i < rows.length && i < 50; i++) {
      var r = rows[i];
      var wa = r.whatsapp ? "https://wa.me/" + String(r.whatsapp).replace(/\D/g, "") : "";
      html +=
        '<div class="lg-card lg-support-ticket" data-ticket-id="' + ui.escapeHtml(r.id) + '">' +
          '<div class="lg-list-item-title">' + ui.escapeHtml(r.subject || "Ticket") + '</div>' +
          '<div class="lg-card-desc">' + ui.escapeHtml(r.establishmentName || r.ownerName || r.ownerUid || "—") +
            (r.tabletImei ? " • IMEI " + ui.escapeHtml(r.tabletImei) : "") + '</div>' +
          '<div class="lg-card-desc"><strong>Utilisateur :</strong> ' + ui.escapeHtml(r.message || "") + '</div>' +
          '<div class="lg-card-desc">Statut : ' + ui.escapeHtml(r.status || "open") + ' • ' + ui.escapeHtml(ui.formatDate(r.createdAt)) + '</div>' +
          (r.adminReply ? '<div class="lg-support-reply"><strong>Votre réponse :</strong> ' + ui.escapeHtml(r.adminReply) + '</div>' : '') +
          '<textarea class="lg-textarea adm-reply-input" data-reply-for="' + ui.escapeHtml(r.id) + '" placeholder="Répondre à l\'utilisateur…"></textarea>' +
          '<div class="lg-row-actions">' +
            '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-adm-reply="' + ui.escapeHtml(r.id) + '">Répondre</button>' +
            '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-adm-status="' + ui.escapeHtml(r.id) + '" data-adm-status-val="resolved">Marquer résolu</button>' +
            (wa ? '<a class="lg-btn lg-btn-outline lg-btn-sm" href="' + ui.escapeHtml(wa) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
          '</div></div>';
    }
    panel.innerHTML = html || '<div class="lg-empty">Aucun ticket support</div>';
    bindSupportActions();
  }

  function bindSupportActions() {
    var replies = state.root.querySelectorAll("[data-adm-reply]");
    for (var i = 0; i < replies.length; i++) {
      replies[i].onclick = function () {
        var id = this.getAttribute("data-adm-reply");
        var ta = state.root.querySelector('[data-reply-for="' + id + '"]');
        var text = ta ? String(ta.value || "").trim() : "";
        if (!text) { ui.toast("Saisissez une réponse", "error"); return; }
        api.replySupportTicket(id, state.ctx.uid, text, "in_progress").then(function () {
          ui.toast("Réponse envoyée", "ok");
          loadTab("support");
        }).catch(function (e) { ui.toast(e.message, "error"); });
      };
    }
    var statuses = state.root.querySelectorAll("[data-adm-status]");
    for (var j = 0; j < statuses.length; j++) {
      statuses[j].onclick = function () {
        var id = this.getAttribute("data-adm-status");
        var val = this.getAttribute("data-adm-status-val") || "resolved";
        api.patchDoc("supportTickets/" + id, { status: val, updatedAt: Date.now() }, ["status", "updatedAt"]).then(function () {
          ui.toast("Statut mis à jour", "ok");
          loadTab("support");
        }).catch(function (e) { ui.toast(e.message, "error"); });
      };
    }
  }

  function loadUsers() {
    api.runPublicQuery({ from: [{ collectionId: "profiles" }], limit: 200 }).then(function (docs) {
      state.data.users = docs.map(function (d) {
        return {
          _id: d.id, id: d.id, _title: d.establishmentName || d.ownerName || d.email || d.id,
          _meta: (d.email || "") + " • " + (d.subscriptionStatus || d.planType || "—"),
          _actions: '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-adm-patch data-adm-path="profiles/' + ui.escapeHtml(d.id) + '" data-adm-field="subscriptionStatus" data-adm-val="active">Activer</button>'
        };
      });
      paintPanel();
    }).catch(failPanel);
  }

  function loadProducts() {
    api.runPublicQuery({ from: [{ collectionId: "products", allDescendants: true }], limit: 200 }).then(function (docs) {
      state.data.products = docs.map(function (d) {
        return {
          _id: d.id, _title: d.name || d.id, _meta: ui.formatMoney(d.price) + " • stock " + (d.quantity || 0),
          _path: d._path
        };
      });
      paintPanel();
    }).catch(failPanel);
  }

  function loadOrders() {
    api.runPublicQuery({ from: [{ collectionId: "orders", allDescendants: true }], limit: 200 }).then(function (docs) {
      state.data.orders = docs.map(function (d) {
        return {
          _id: d.id, _title: "Commande #" + (d.orderNumber || d.id),
          _meta: "Table " + (d.tableNumber || "—") + " • " + ui.formatMoney(d.total) + " • " + (d.status || "pending"),
          _path: d._path,
          _actions: d._path ? '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-adm-patch data-adm-path="' + ui.escapeHtml(d._path) + '" data-adm-field="status" data-adm-val="cancelled">Annuler</button>' : ""
        };
      });
      paintPanel();
    }).catch(failPanel);
  }

  function loadEvents() {
    api.runPublicQuery({ from: [{ collectionId: "events", allDescendants: true }], limit: 200 }).then(function (docs) {
      state.data.events = docs.map(function (d) {
        return {
          _id: d.id, _title: d.title || d.id,
          _meta: (d.date || "") + " • " + (d.ticketsSold || 0) + "/" + (d.maxCapacity || "?") + " billets"
        };
      });
      paintPanel();
    }).catch(failPanel);
  }

  function loadSubscriptions() {
    api.listDocs("subscriptionPlans", 10).then(function (docs) {
      state.data.subscriptions = (docs || []).map(function (d) {
        return { _id: d.id, _title: d.name || d.id, _meta: ui.formatMoney(d.price) };
      });
      if (!state.data.subscriptions.length) {
        state.data.subscriptions = [
          { _id: "transition", _title: "Standard", _meta: "3000 XAF" },
          { _id: "transition-pro-max", _title: "Premium", _meta: "7500 XAF" }
        ];
      }
      paintPanel();
    }).catch(failPanel);
  }

  function loadNotifications() {
    api.runPublicQuery({ from: [{ collectionId: "notifications", allDescendants: true }], limit: 100 }).then(function (docs) {
      state.data.notifications = docs.map(function (d) {
        return { _id: d.id, _title: d.title || "Notification", _meta: d.message || "" };
      });
      paintPanel();
    }).catch(failPanel);
  }

  function loadCustomers() {
    api.runPublicQuery({ from: [{ collectionId: "customers", allDescendants: true }], limit: 200 }).then(function (docs) {
      state.data.customers = docs.map(function (d) {
        return {
          _id: d.id, _title: ((d.firstName || "") + " " + (d.lastName || "")).trim() || d.id,
          _meta: (d.phone || d.email || "") + " • " + (d.totalOrders || 0) + " cmd"
        };
      });
      paintPanel();
    }).catch(failPanel);
  }

  function loadDisbursements() {
    api.runPublicQuery({ from: [{ collectionId: "disbursementRequests" }], limit: 100 }).then(function (docs) {
      state.data.disbursements = docs.map(function (d) {
        return {
          _id: d.id, _title: d.userId || d.id, _meta: (d.status || "pending") + " • " + (d.disbursementId || "—"),
          _path: "disbursementRequests/" + d.id,
          userId: d.userId,
          disbursementId: d.disbursementId,
          status: d.status,
          _actions: d.status === "pending"
            ? '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-approve-disbursement="' + ui.escapeHtml(d.id) + '" data-user-id="' + ui.escapeHtml(d.userId || "") + '" data-disbursement-id="' + ui.escapeHtml(d.disbursementId || "") + '">Approuver</button>'
            : ""
        };
      });
      paintPanel();
    }).catch(failPanel);
  }

  function loadAffiliates() {
    api.runPublicQuery({ from: [{ collectionId: "affiliates" }], limit: 100 }).then(function (docs) {
      state.data.affiliates = docs.map(function (d) {
        return {
          _id: d.id, _title: d.name || d.code || d.id,
          _meta: "Code " + (d.code || d.id) + " • " + (d.referralCount || 0) + " parrainages"
        };
      });
      paintPanel();
    }).catch(failPanel);
  }

  function loadStats() {
    Promise.all([
      api.runPublicQuery({ from: [{ collectionId: "profiles" }] }),
      api.runPublicQuery({ from: [{ collectionId: "products", allDescendants: true }], limit: 500 }),
      api.runPublicQuery({ from: [{ collectionId: "orders", allDescendants: true }], limit: 500 }),
      api.runPublicQuery({ from: [{ collectionId: "events", allDescendants: true }], limit: 200 }),
      api.runPublicQuery({ from: [{ collectionId: "affiliates" }] })
    ]).then(function (res) {
      state.data.stats = [{
        _id: "global", _title: "Statistiques globales",
        _meta: "Profils: " + (res[0] || []).length +
          " • Produits: " + (res[1] || []).length +
          " • Commandes: " + (res[2] || []).length +
          " • Événements: " + (res[3] || []).length +
          " • Affiliés: " + (res[4] || []).length
      }];
      paintPanel();
    }).catch(failPanel);
  }

  function failPanel(err) {
    var panel = ui.$("adm-panel");
    if (panel) panel.innerHTML = '<div class="lg-empty">' + ui.escapeHtml((err && err.message) || "Erreur chargement") + '</div>';
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.admin = { render: render };
})(window);
