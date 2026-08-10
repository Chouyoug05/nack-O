(function (global) {
  var ui, api;

  function needsLocation(profile) {
    if (!profile) return false;
    if (!profile.establishmentName || !profile.ownerName) return true;
    if (!profile.latitude && !profile.longitude && !profile.address) return true;
    return false;
  }

  function ensureModal() {
    if (document.getElementById("modal-location")) return;
    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<div id="modal-location-overlay" class="lg-modal-overlay lg-hidden" style="display:none"></div>' +
      '<div id="modal-location" class="lg-modal lg-hidden" style="display:none">' +
        '<h2>Complétez votre adresse</h2>' +
        '<p class="lg-modal-desc">Indiquez votre adresse ou utilisez la géolocalisation pour le menu digital et la carte.</p>' +
        '<div class="lg-field"><label class="lg-label">Adresse</label><input class="lg-input" id="loc-address"></div>' +
        '<div class="lg-modal-actions">' +
          '<button type="button" class="lg-btn lg-btn-secondary" data-action="loc-skip">Plus tard</button>' +
          '<button type="button" class="lg-btn lg-btn-outline" data-action="loc-geo">Ma position</button>' +
          '<button type="button" class="lg-btn lg-btn-nack" data-action="loc-save">Enregistrer</button>' +
        '</div></div>';
    document.body.appendChild(wrap.firstChild);
    document.body.appendChild(wrap.firstChild);
  }

  function open(profile, uid, onUpdate) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    ensureModal();
    var addr = ui.$("loc-address");
    if (addr) addr.value = (profile && profile.address) || "";
    ui.openModal("modal-location");
    global.NACK_LIGHT._locCtx = { profile: profile, uid: uid, onUpdate: onUpdate };
  }

  function save() {
    var ctx = global.NACK_LIGHT._locCtx;
    if (!ctx) return;
    var address = (ui.$("loc-address").value || "").trim();
    api.patchProfile(ctx.uid, { address: address, updatedAt: Date.now() }, ["address", "updatedAt"]).then(function () {
      ctx.profile.address = address;
      if (ctx.onUpdate) ctx.onUpdate(ctx.profile);
      ui.closeModal("modal-location");
      ui.toast("Adresse enregistrée", "ok");
    });
  }

  function useGeo() {
    var ctx = global.NACK_LIGHT._locCtx;
    if (!ctx || !navigator.geolocation) { ui.toast("Géolocalisation indisponible", "error"); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      api.patchProfile(ctx.uid, {
        latitude: pos.coords.latitude, longitude: pos.coords.longitude, updatedAt: Date.now()
      }, ["latitude", "longitude", "updatedAt"]).then(function () {
        ctx.profile.latitude = pos.coords.latitude;
        ctx.profile.longitude = pos.coords.longitude;
        if (ctx.onUpdate) ctx.onUpdate(ctx.profile);
        ui.closeModal("modal-location");
        ui.toast("Position enregistrée", "ok");
      });
    }, function () { ui.toast("Impossible d'obtenir la position", "error"); });
  }

  function skip() { ui.closeModal("modal-location"); }

  function maybeShow(profile, uid, onUpdate) {
    if (needsLocation(profile)) open(profile, uid, onUpdate);
  }

  global.NACK_LIGHT.locationDialog = { maybeShow: maybeShow, save: save, useGeo: useGeo, skip: skip };
})(window);
