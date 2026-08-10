(function (global) {
  var api = global.NACK_LIGHT.api;
  var ui = global.NACK_LIGHT.ui;
  var views = global.NACK_LIGHT.views;
  var pendingOrdersCount = 0;

  var state = {
    view: "home",
    profile: null,
    uid: null,
    email: null,
    stats: { salesToday: 0, productsCount: 0, teamCount: 0 }
  };

  var TITLES = {
    home: "NACK Pro",
    stock: "Stock",
    sales: "Vente",
    reports: "Rapport",
    team: "Équipe",
    menu: "Menu Digital",
    events: "Événements",
    customers: "Clients",
    "customer-detail": "Fiche client",
    profile: "Mon Profil",
    admin: "Administration",
    notifications: "Notifications"
  };

  var FEATURE_MAP = {
    sales: "sales", stock: "stock", reports: "reports", team: "team",
    menu: "menuDigital", events: "events", customers: "products"
  };

  function checkFeatureGate(view) {
    var sub = global.NACK_LIGHT.subscription;
    if (!sub || !state.profile) return true;
    var feat = FEATURE_MAP[view];
    if (!feat) return true;
    return sub.hasFeature(state.profile, feat);
  }

  function maybeSubscriptionGate() {
    var sub = global.NACK_LIGHT.subscription;
    if (!sub || !state.profile) return;
    if (sub.isDashboardBlocked(state.profile) && state.profile.plan === "expired") {
      ui.openModal("modal-subscription");
    }
  }

  function parseHashRoute() {
    var raw = (location.hash || "").replace(/^#/, "");
    if (raw.charAt(0) === "/") raw = raw.slice(1);
    var qIdx = raw.indexOf("?");
    var query = qIdx >= 0 ? raw.slice(qIdx + 1) : "";
    if (qIdx >= 0) raw = raw.slice(0, qIdx);
    var parts = raw.split("/").filter(function (p) { return !!p; });
    return { parts: parts, query: query };
  }

  function showRouteShell() {
    ui.hideEl(ui.$("screen-login"));
    ui.hideEl(ui.$("screen-affiliate"));
    ui.hideEl(ui.$("screen-app"));
    ui.showEl(ui.$("screen-route"));
    if (global.NACK_LIGHT.offline && global.NACK_LIGHT.offline.refresh) global.NACK_LIGHT.offline.refresh();
  }

  function hideRouteShell() {
    ui.hideEl(ui.$("screen-route"));
  }

  function bootRoute() {
    var route = parseHashRoute();
    var parts = route.parts;
    if (!parts.length) return false;
    var name = parts[0];
    var interfaces = global.NACK_LIGHT.interfaces || {};
    var pub = global.NACK_LIGHT.public || {};
    var root = ui.$("route-root");
    if (!root) return false;

    showRouteShell();

    if (name === "serveur" && parts[1] && interfaces.serveur) {
      interfaces.serveur.render(root, { token: parts[1] });
      return true;
    }
    if (name === "caisse" && parts[1] && interfaces.caisse) {
      interfaces.caisse.render(root, { token: parts[1] });
      return true;
    }
    if (name === "cuisine" && parts[1] && interfaces.cuisine) {
      interfaces.cuisine.render(root, { token: parts[1] });
      return true;
    }
    if ((name === "agent-event" || name === "agent-evenement") && parts[1] && interfaces.agentEvent) {
      interfaces.agentEvent.render(root, { token: parts[1] });
      return true;
    }
    if (name === "commande" && parts[1] && pub.ordering) {
      pub.ordering.render(root, { uid: parts[1] });
      return true;
    }
    if (name === "event" && parts[1] && pub.eventPublic) {
      pub.eventPublic.render(root, { eventId: parts[1] });
      return true;
    }
    if ((name === "payment-result" || name === "payment-success" || name === "payment-error") && pub.paymentResult) {
      pub.paymentResult.render(root, {
        route: name,
        status: name === "payment-error" ? "error" : "success",
        query: route.query
      });
      return true;
    }
    if (name === "onboarding" && views.onboarding) {
      views.onboarding.render(root);
      return true;
    }
    if (name === "register" && views.register) {
      views.register.render(root);
      return true;
    }
    if (name === "forgot" && views.forgot) {
      views.forgot.render(root);
      return true;
    }
    if (name === "complete-profile" && views["complete-profile"]) {
      views["complete-profile"].render(root);
      return true;
    }
    if (name === "configure-tickets" && views["configure-tickets"]) {
      views["configure-tickets"].render(root);
      return true;
    }
    if (name === "admin" && views.admin) {
      var session = api.getSession();
      if (!session || !session.uid) {
        root.innerHTML = '<div class="lg-empty">Connexion gérant requise pour l\'admin</div>';
        return true;
      }
      state.uid = session.uid;
      state.email = session.email;
      loadProfile().then(function () {
        views.admin.render(root, ctx());
      }).catch(function () {
        root.innerHTML = '<div class="lg-empty">Session admin invalide</div>';
      });
      return true;
    }
    root.innerHTML = '<div class="lg-empty">Page introuvable</div>';
    return true;
  }

  global.NACK_LIGHT.setPendingOrdersCount = function (n) {
    pendingOrdersCount = n || 0;
  };

  function onHashChange() {
    if (bootRoute()) return;
    hideRouteShell();
    var parts = parseHashRoute().parts;
    if (!parts.length) {
      var session = api.getSession();
      if (session && session.idToken && session.uid) showAppShell();
      else showLogin();
    }
  }

  function boot() {
    ui.paintNavIcons();
    bindForms();
    ui.installGlobalTaps(handleAction);
    if (global.NACK_LIGHT.pwa && global.NACK_LIGHT.pwa.init) global.NACK_LIGHT.pwa.init();
    if (global.NACK_LIGHT.offline && global.NACK_LIGHT.offline.init) global.NACK_LIGHT.offline.init();
    if (global.NACK_LIGHT.login && global.NACK_LIGHT.login.init) global.NACK_LIGHT.login.init();

    window.addEventListener("hashchange", onHashChange, false);

    if (bootRoute()) return;
    hideRouteShell();

    var session = api.getSession();
    if (session && session.idToken && session.uid) {
      state.uid = session.uid;
      state.email = session.email;
      showAppShell();
      loadProfile().then(function () {
        if (profileIncomplete(state.profile)) {
          location.hash = "#/complete-profile";
          bootRoute();
          return;
        }
        showAppShell();
        if (location.hash && location.hash.indexOf("#/admin") === 0) {
          navigate("admin");
        } else {
          navigate("home");
        }
        afterSessionReady();
      }).catch(function (err) {
        ui.toast(err.message || "Session invalide", "error");
        logout();
      });
    } else {
      showLogin();
    }
  }

  function prefetchOrdersCount() {
    if (!state.profile || !state.uid) return;
    api.listDocs(api.dataRoot(state.profile, state.uid) + "/orders", 50).then(function (docs) {
      var n = 0;
      for (var i = 0; i < (docs || []).length; i++) {
        if ((docs[i].status || "pending") === "pending") n++;
      }
      global.NACK_LIGHT.setPendingOrdersCount(n);
      updateNavSalesBadge(n);
    }).catch(function () {});
  }

  function updateNavSalesBadge(n) {
    var nav = ui.$("nav-sales");
    if (!nav) return;
    var old = nav.querySelector(".lg-nav-badge");
    if (old) old.parentNode.removeChild(old);
    if (n > 0) {
      var b = document.createElement("span");
      b.className = "lg-nav-badge";
      b.textContent = String(n);
      nav.appendChild(b);
    }
  }

  function bindForms() {
    bindForm("login-form", function () { doLogin(); });
    bindForm("mgr-form", function () { ui.submitManagerAuth(state.profile); });
    bindForm("product-form", function () {
      if (views.stock && views.stock.submitAddProduct) views.stock.submitAddProduct();
    });
    bindForm("event-form", function () {
      if (views.events && views.events.submitEvent) views.events.submitEvent();
    });
    bindForm("team-login-form", function () {
      if (global.NACK_LIGHT.login && global.NACK_LIGHT.login.doTeamLogin) global.NACK_LIGHT.login.doTeamLogin();
    });
    bindForm("affiliate-login-form", function () {
      if (global.NACK_LIGHT.login && global.NACK_LIGHT.login.doAffiliateLogin) global.NACK_LIGHT.login.doAffiliateLogin();
    });
    bindForm("team-form", function () {
      if (views.team && views.team.submitMember) views.team.submitMember();
    });
    bindForm("profile-form", function () {
      if (views.profile && views.profile.saveProfile) views.profile.saveProfile();
    });
  }

  function bindForm(id, fn) {
    var form = ui.$(id);
    if (!form || form.getAttribute("data-bound") === "1") return;
    form.setAttribute("data-bound", "1");
    form.addEventListener("submit", function (e) {
      if (e.preventDefault) e.preventDefault();
      fn();
    }, false);
  }

  function handleAction(action, arg) {
    switch (action) {
      case "nav": navigate(arg); break;
      case "back": navigate("home"); break;
      case "logout": logout(); break;
      case "close-modal": ui.closeModal(arg); break;
      case "mgr-cancel": ui.closeModal("modal-manager"); break;
      case "prod-cancel": ui.closeModal("modal-product"); break;
      case "ev-cancel": ui.closeModal("modal-event"); break;
      case "cart-cancel": ui.closeModal("modal-cart"); break;
      case "cart-pay":
        if (views.sales && views.sales.checkout) views.sales.checkout();
        break;
      case "open-cart":
        if (views.sales && views.sales.openCartModal) views.sales.openCartModal();
        break;
      case "add-cart":
        if (views.sales && views.sales.addToCart) views.sales.addToCart(arg);
        break;
      case "cart-inc":
        if (views.sales && views.sales.addToCart) views.sales.addToCart(arg);
        break;
      case "cart-dec":
        if (views.sales && views.sales.decCart) views.sales.decCart(arg);
        break;
      case "cart-remove":
        if (views.sales && views.sales.removeCart) views.sales.removeCart(arg);
        break;
      case "cart-clear":
        if (views.sales && views.sales.clearCart) views.sales.clearCart();
        break;
      case "hold-order":
        if (views.sales && views.sales.holdOrder) views.sales.holdOrder();
        break;
      case "sales-tab":
        if (views.sales && views.sales.setTab) views.sales.setTab(arg);
        break;
      case "edit-order":
        if (views.sales && views.sales.loadOrderToCart) views.sales.loadOrderToCart(arg);
        break;
      case "pay-order":
        if (views.sales && views.sales.payOrder) views.sales.payOrder(arg);
        break;
      case "cancel-order":
        if (views.sales && views.sales.cancelOrder) views.sales.cancelOrder(arg);
        break;
      case "add-product":
      case "stock-add-open":
        ui.requireManagerAuth(state.profile, function () {
          if (views.stock && views.stock.openAddModal) views.stock.openAddModal();
          else {
            var form = ui.$("product-form");
            if (form) form.reset();
            ui.openModal("modal-product");
          }
        });
        break;
      case "add-event":
        ui.requireManagerAuth(state.profile, function () {
          var form = ui.$("event-form");
          if (form) form.reset();
          if (ui.$("ev-edit-id")) ui.$("ev-edit-id").value = "";
          if (ui.$("ev-submit")) ui.$("ev-submit").textContent = "Créer";
          ui.openModal("modal-event");
        });
        break;
      case "stock-edit":
        if (views.stock && views.stock.openAddModal) views.stock.openAddModal(arg);
        break;
      case "stock-del":
        if (views.stock && views.stock.deleteProduct) views.stock.deleteProduct(arg);
        break;
      case "stock-dup":
        if (views.stock && views.stock.duplicateProduct) views.stock.duplicateProduct(arg);
        break;
      case "stock-export":
        if (views.stock && views.stock.exportCsv) views.stock.exportCsv();
        break;
      case "stock-entry-open":
        if (views.stock && views.stock.openEntryModal) views.stock.openEntryModal();
        break;
      case "stock-exit-open":
        if (views.stock && views.stock.openExitModal) views.stock.openExitModal();
        break;
      case "stock-pin-open":
        if (views.stock && views.stock.openPinModal) views.stock.openPinModal();
        break;
      case "stock-pin-save":
        if (views.stock && views.stock.savePin) views.stock.savePin();
        break;
      case "stock-add-next":
        if (views.stock && views.stock.addNext) views.stock.addNext();
        break;
      case "stock-add-prev":
        if (views.stock && views.stock.addPrev) views.stock.addPrev();
        break;
      case "stock-add-save":
        if (views.stock && views.stock.addSave) views.stock.addSave();
        break;
      case "stock-menu-toggle":
        if (views.stock && views.stock.toggleMenuDigital) views.stock.toggleMenuDigital(arg);
        break;
      case "stock-entry-save":
        if (views.stock && views.stock.saveEntry) views.stock.saveEntry();
        break;
      case "stock-exit-save":
        if (views.stock && views.stock.saveExit) views.stock.saveExit();
        break;
      case "sales-cat":
        if (views.sales && views.sales.setCategory) views.sales.setCategory(arg);
        break;
      case "sales-print":
        if (views.sales && views.sales.printReceipt) views.sales.printReceipt(arg);
        break;
      case "reports-export-csv":
        if (views.reports && views.reports.exportCsv) views.reports.exportCsv();
        break;
      case "reports-export-pdf":
        if (views.reports && views.reports.exportPdf) views.reports.exportPdf();
        break;
      case "reports-receipts":
        if (views.reports && views.reports.downloadReceipts) views.reports.downloadReceipts();
        break;
      case "reports-print-one":
        if (views.reports && views.reports.printOneReceipt) views.reports.printOneReceipt(arg);
        break;
      case "reports-cal-prev":
        if (views.reports && views.reports.calPrev) views.reports.calPrev();
        break;
      case "reports-cal-next":
        if (views.reports && views.reports.calNext) views.reports.calNext();
        break;
      case "menu-tab":
        if (views.menu && views.menu.setTab) views.menu.setTab(arg);
        break;
      case "menu-add-table":
        if (views.menu && views.menu.addTable) views.menu.addTable();
        break;
      case "menu-del-table":
        if (views.menu && views.menu.delTable) views.menu.delTable(arg);
        break;
      case "menu-order-done":
        if (views.menu && views.menu.orderDone) views.menu.orderDone(arg);
        break;
      case "menu-order-cancel":
        if (views.menu && views.menu.orderCancel) views.menu.orderCancel(arg);
        break;
      case "menu-scan-submit":
        if (views.menu && views.menu.scanSubmit) views.menu.scanSubmit();
        break;
      case "menu-save-theme":
        if (views.menu && views.menu.saveTheme) views.menu.saveTheme();
        break;
      case "event-edit":
        if (views.events && views.events.openEdit) views.events.openEdit(arg);
        break;
      case "event-del":
        if (views.events && views.events.deleteEvent) views.events.deleteEvent(arg);
        break;
      case "event-participants":
        if (views.events && views.events.showParticipants) views.events.showParticipants(arg);
        break;
      case "event-pay-extra":
        if (views.events && views.events.payExtra) views.events.payExtra(arg);
        break;
      case "cust-add-open":
        if (views.customers && views.customers.openAdd) views.customers.openAdd();
        break;
      case "cust-edit":
        if (views.customers && views.customers.openEdit) views.customers.openEdit(arg);
        break;
      case "cust-del":
        if (views.customers && views.customers.deleteCustomer) views.customers.deleteCustomer(arg);
        break;
      case "cust-detail":
        if (views.customers && views.customers.openDetail) views.customers.openDetail(arg);
        break;
      case "cust-pts-add":
        if (views["customer-detail"] && views["customer-detail"].adjustPoints) views["customer-detail"].adjustPoints(Number(arg) || 0);
        break;
      case "prof-tickets-save":
        if (views.profile && views.profile.saveTickets) views.profile.saveTickets();
        break;
      case "prof-est-switch":
        if (views.profile && views.profile.switchEstablishment) views.profile.switchEstablishment(arg);
        break;
      case "prof-est-create-open":
        if (views.profile && views.profile.openCreateEst) views.profile.openCreateEst();
        break;
      case "prof-est-create":
        if (views.profile && views.profile.createEstablishment) views.profile.createEstablishment();
        break;
      case "prof-backup":
        if (views.profile && views.profile.backupLocal) views.profile.backupLocal();
        break;
      case "prof-export-products":
        if (views.profile && views.profile.exportProducts) views.profile.exportProducts();
        break;
      case "prof-reset-data":
        if (views.profile && views.profile.resetData) views.profile.resetData();
        break;
      case "prof-delete-account":
        if (views.profile && views.profile.deleteAccount) views.profile.deleteAccount();
        break;
      case "prof-tablet-save":
        if (views.profile && views.profile.registerTabletDevice) views.profile.registerTabletDevice();
        break;
      case "prof-support-send":
        if (views.profile && views.profile.sendSupportTicket) views.profile.sendSupportTicket();
        break;
      case "onb-skip":
        if (views.onboarding && views.onboarding.skip) views.onboarding.skip();
        break;
      case "onb-next":
        if (views.onboarding && views.onboarding.next) views.onboarding.next();
        break;
      case "forgot-resend":
        if (views.forgot && views.forgot.resend) views.forgot.resend();
        break;
      case "reg-next":
        if (views.register && views.register.next) views.register.next();
        break;
      case "reg-prev":
        if (views.register && views.register.prev) views.register.prev();
        break;
      case "reg-submit":
        if (views.register && views.register.submitManager) views.register.submitManager();
        break;
      case "reg-main-cat":
        if (views.register && views.register.setMainCategory) views.register.setMainCategory(arg);
        break;
      case "reg-est-type":
        if (views.register && views.register.setEstType) views.register.setEstType(arg);
        break;
      case "reg-main-back":
        if (views.register) views.register.setMainCategory(null);
        break;
      case "reg-geo":
        if (views.register && views.register.useGeo) views.register.useGeo();
        break;
      case "aff-reg-submit":
        if (views.register && views.register.submitAffiliate) views.register.submitAffiliate();
        break;
      case "tk-skip":
        if (views["configure-tickets"] && views["configure-tickets"].skip) views["configure-tickets"].skip();
        break;
      case "stock-inc":
        if (views.stock && views.stock.adjustStock) views.stock.adjustStock(arg, 1);
        break;
      case "stock-dec":
        if (views.stock && views.stock.adjustStock) views.stock.adjustStock(arg, -1);
        break;
      case "stock-toggle-zero":
        if (views.stock && views.stock.toggleZero) views.stock.toggleZero();
        break;
      case "reports-period":
        if (views.reports && views.reports.setPeriod) views.reports.setPeriod(arg);
        break;
      case "copy-text":
        ui.copyText(arg);
        break;
      case "login-type":
        if (global.NACK_LIGHT.login && global.NACK_LIGHT.login.setLoginType) global.NACK_LIGHT.login.setLoginType(arg);
        break;
      case "aff-logout":
        if (global.NACK_LIGHT.login && global.NACK_LIGHT.login.affiliateLogout) global.NACK_LIGHT.login.affiliateLogout();
        break;
      case "team-add-role":
        ui.requireManagerAuth(state.profile, function () {
          if (views.team && views.team.openAddModal) views.team.openAddModal(arg);
        });
        break;
      case "team-edit":
        ui.requireManagerAuth(state.profile, function () {
          if (views.team && views.team.openEditModal) views.team.openEditModal(arg);
        });
        break;
      case "team-regen":
        if (views.team && views.team.regenerateCodes) views.team.regenerateCodes(arg);
        break;
      case "team-toggle":
        if (views.team && views.team.toggleStatus) views.team.toggleStatus(arg);
        break;
      case "team-del":
        if (views.team && views.team.deleteMember) views.team.deleteMember(arg);
        break;
      case "team-cancel":
        ui.closeModal("modal-team");
        break;
      case "profile-tab":
        if (views.profile && views.profile.setTab) views.profile.setTab(arg);
        break;
      case "profile-edit":
        if (views.profile && views.profile.openEditModal) views.profile.openEditModal();
        break;
      case "profile-pay":
        if (views.profile && views.profile.payNow) views.profile.payNow(arg);
        break;
      case "prof-cancel":
        ui.closeModal("modal-profile");
        break;
      case "notif-read":
        if (views.notifications && views.notifications.markRead) views.notifications.markRead(arg);
        break;
      case "notif-read-all":
        if (views.notifications && views.notifications.markAllRead) views.notifications.markAllRead();
        break;
      case "notif-del":
        if (views.notifications && views.notifications.del) views.notifications.del(arg);
        break;
      case "loc-save":
        if (global.NACK_LIGHT.locationDialog) global.NACK_LIGHT.locationDialog.save();
        break;
      case "loc-geo":
        if (global.NACK_LIGHT.locationDialog) global.NACK_LIGHT.locationDialog.useGeo();
        break;
      case "loc-skip":
        if (global.NACK_LIGHT.locationDialog) global.NACK_LIGHT.locationDialog.skip();
        break;
      case "open-cgu":
        window.open(api.publicBase() + "/cgu", "_blank");
        break;
      case "route-nav":
        try { location.hash = "#/" + String(arg || "").replace(/^\//, ""); } catch (e) {}
        bootRoute();
        break;
      default:
        console.warn("[NACK Light] action inconnue:", action);
    }
  }

  global.NACK_LIGHT.handleAction = handleAction;

  function maybeTutorial() {
    if (global.NACK_LIGHT.tutorial && global.NACK_LIGHT.tutorial.init && state.profile) {
      global.NACK_LIGHT.tutorial.init(state.profile);
    }
  }

  function showLogin() {
    hideRouteShell();
    ui.showEl(ui.$("screen-login"));
    ui.hideEl(ui.$("screen-app"));
    ui.hideEl(ui.$("screen-affiliate"));
    if (global.NACK_LIGHT.establishment && global.NACK_LIGHT.establishment.applyTheme) {
      global.NACK_LIGHT.establishment.applyTheme(null);
    }
    if (global.NACK_LIGHT.login && global.NACK_LIGHT.login.setLoginType) {
      global.NACK_LIGHT.login.setLoginType("manager");
    }
    if (global.NACK_LIGHT.offline && global.NACK_LIGHT.offline.refresh) global.NACK_LIGHT.offline.refresh();
  }
  function afterSessionReady() {
    refreshStats();
    prefetchOrdersCount();
    maybeTutorial();
    maybeSubscriptionGate();
    maybeTrialWelcome();
    if (state.uid) api.pingRegisteredTablet(state.uid);
    if (global.NACK_LIGHT.locationDialog) {
      global.NACK_LIGHT.locationDialog.maybeShow(state.profile, state.uid, function (p) {
        state.profile = p;
        updateHeader();
      });
    }
    api.isAdmin(state.uid).then(function (ok) {
      state.isAdmin = ok;
      if (state.view === "home") navigate("home");
    }).catch(function () {});
  }

  function showAppShell() {
    ui.hideEl(ui.$("screen-login"));
    ui.hideEl(ui.$("screen-affiliate"));
    ui.showEl(ui.$("screen-app"));
    if (global.NACK_LIGHT.offline && global.NACK_LIGHT.offline.refresh) global.NACK_LIGHT.offline.refresh();
    if (global.NACK_LIGHT.whatsapp && global.NACK_LIGHT.whatsapp.init) global.NACK_LIGHT.whatsapp.init();
  }

  function profileIncomplete(profile) {
    if (!profile) return true;
    if (!profile.establishmentName || !profile.ownerName) return true;
    if (!profile.whatsapp && !profile.phone) return true;
    return false;
  }

  function maybeTrialWelcome() {
    if (!state.profile || state.profile.plan !== "trial") return;
    try {
      var k = "nack_trial_welcome_" + state.uid;
      if (localStorage.getItem(k) === "1") return;
      localStorage.setItem(k, "1");
    } catch (e) {}
    ui.toast("Bienvenue ! Profitez de 7 jours d'essai gratuit.", "ok");
  }

  function doLogin() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      ui.toast("Connexion impossible hors ligne", "error");
      return;
    }
    var email = (ui.$("login-email") && ui.$("login-email").value || "").trim();
    var password = (ui.$("login-password") && ui.$("login-password").value || "");
    if (!email || !password) { ui.toast("Email et mot de passe requis", "error"); return; }
    var btn = ui.$("login-submit");
    ui.setLoading(btn, true);
    api.signIn(email, password).then(function (res) {
      state.uid = res.localId;
      state.email = res.email || email;
      return loadProfile();
    }).then(function () {
      if (profileIncomplete(state.profile)) {
        location.hash = "#/complete-profile";
        bootRoute();
        return;
      }
      showAppShell();
      if (location.hash && location.hash.indexOf("#/admin") === 0) navigate("admin");
      else navigate("home");
      afterSessionReady();
      ui.toast("Connexion réussie", "ok");
    }).catch(function (err) {
      ui.toast(err.message || "Échec de connexion", "error");
    }).then(function () { ui.setLoading(btn, false); });
  }

  function loadProfile() {
    return api.getProfile(state.uid).then(function (profile) {
      if (!profile) throw new Error("Profil introuvable");
      state.profile = profile;
      updateHeader();
      return profile;
    });
  }

  function updateHeader() {
    var profile = state.profile;
    var name = (profile && profile.establishmentName) || "NACK Pro";
    var est = global.NACK_LIGHT.establishment;
    if (est && est.applyTheme) est.applyTheme(profile);

    var titleEl = ui.$("hdr-title");
    if (titleEl && state.view === "home") titleEl.textContent = name;

    var logo = profile && profile.logoUrl;
    var ownerName = (profile && profile.ownerName) || "";
    var ownerLetter = (ownerName.charAt(0) || "G").toUpperCase();
    var avatar = ui.$("hdr-profile-avatar");
    if (avatar) {
      if (logo) {
        avatar.innerHTML = '<img src="' + ui.escapeHtml(logo) + '" alt="">';
        avatar.className = "lg-profile-avatar has-img";
      } else {
        avatar.textContent = ownerLetter;
        avatar.className = "lg-profile-avatar";
        avatar.style.background = est && est.isShopProfile(profile) ? "#2563eb" : "#dc2626";
      }
    }
  }

  function ctx() {
    return {
      profile: state.profile,
      uid: state.uid,
      email: state.email,
      stats: state.stats,
      isAdmin: state.isAdmin,
      onNavigate: navigate,
      onLogout: logout,
      onProfileUpdate: function (profile) {
        state.profile = profile;
        updateHeader();
      },
      onStats: function (partial) {
        for (var k in partial) {
          if (Object.prototype.hasOwnProperty.call(partial, k)) state.stats[k] = partial[k];
        }
      },
      refreshStats: refreshStats
    };
  }

  function setHidden(el, hidden) {
    if (!el) return;
    if (hidden) ui.hideEl(el); else ui.showEl(el);
  }

  function navigate(view) {
    if (view === "admin" && views.admin && state.uid) {
      try { location.hash = "#/admin"; } catch (e) {}
      state.view = "admin";
      var titleEl = ui.$("hdr-title");
      if (titleEl) titleEl.textContent = TITLES.admin;
      setHidden(ui.$("hdr-back"), false);
      var main = ui.$("view-root");
      if (main) views.admin.render(main, ctx());
      return;
    }
    if (location.hash && location.hash.indexOf("#/admin") === 0 && view !== "admin") {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    }
    if (!views[view]) view = "home";
    if (!checkFeatureGate(view)) {
      ui.toast("Fonctionnalité non incluse dans votre plan", "error");
      ui.openModal("modal-subscription");
      return;
    }
    state.view = view;
    var titleEl = ui.$("hdr-title");
    if (titleEl) {
      if (view === "home") titleEl.textContent = (state.profile && state.profile.establishmentName) || "NACK Pro";
      else titleEl.textContent = TITLES[view] || "NACK Pro";
    }
    updateHeader();
    setHidden(ui.$("hdr-back"), view === "home" || view === "customer-detail");

    var nav = ui.$("bottom-nav");
    if (nav) {
      var buttons = nav.querySelectorAll("[data-action='nav']");
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        if (b.getAttribute("data-arg") === view) {
          if (b.className.indexOf("active") === -1) b.className += " active";
        } else {
          b.className = String(b.className || "").replace(/\bactive\b/g, "");
        }
      }
    }

    var main = ui.$("view-root");
    if (!main) return;
    var renderer = views[view];
    if (renderer && renderer.render) renderer.render(main, ctx());
    updateNavSalesBadge(pendingOrdersCount);
  }

  function refreshStats() {
    if (!state.profile || !state.uid) return;
    var root = api.dataRoot(state.profile, state.uid);
    var start = new Date();
    start.setHours(0, 0, 0, 0);
    var startTs = start.getTime();
    Promise.all([
      api.listDocs(root + "/products", 200).catch(function () { return []; }),
      api.listDocs(root + "/sales", 100).catch(function () { return []; }),
      api.listDocs(root + "/team", 50).catch(function () { return []; })
    ]).then(function (results) {
      var products = results[0] || [];
      var sales = results[1] || [];
      var team = results[2] || [];
      var salesToday = 0;
      for (var i = 0; i < sales.length; i++) {
        if (Number(sales[i].createdAt) >= startTs) salesToday += Number(sales[i].total) || 0;
      }
      state.stats = { salesToday: salesToday, productsCount: products.length, teamCount: team.length };
      if (state.view === "home") navigate("home");
    });
  }

  function logout() {
    api.clearSession();
    state.profile = null;
    state.uid = null;
    state.email = null;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    hideRouteShell();
    showLogin();
  }

  if (typeof Promise === "undefined") {
    document.body.innerHTML = "<p style='padding:2rem;text-align:center'>Navigateur trop ancien (Promise manquant).</p>";
    return;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, false);
  else boot();
})(window);
