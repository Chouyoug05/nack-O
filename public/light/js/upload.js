/** Upload Cloudinary — compatible appareils anciens (FormData + XHR) */
(function (global) {
  function cfg() {
    var c = global.NACK_LIGHT.CLOUDINARY || {};
    return { cloud: c.cloudName || "", preset: c.uploadPreset || "" };
  }

  function isConfigured() {
    var c = cfg();
    return !!(c.cloud && c.preset);
  }

  function uploadFile(file, folder) {
    var c = cfg();
    if (!isConfigured()) return Promise.reject(new Error("Cloudinary non configuré"));
    folder = folder || "uploads";
    return new Promise(function (resolve, reject) {
      var fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", c.preset);
      fd.append("folder", folder);
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "https://api.cloudinary.com/v1_1/" + c.cloud + "/image/upload", true);
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var j = JSON.parse(xhr.responseText);
            resolve({ url: j.secure_url, publicId: j.public_id, deleteToken: j.delete_token });
          } catch (e) { reject(e); }
        } else reject(new Error("Upload échoué"));
      };
      xhr.onerror = function () { reject(new Error("Erreur réseau upload")); };
      xhr.send(fd);
    });
  }

  function readFileInput(inputId) {
    var input = document.getElementById(inputId);
    if (!input || !input.files || !input.files[0]) return Promise.reject(new Error("Aucun fichier"));
    return uploadFile(input.files[0]);
  }

  global.NACK_LIGHT.upload = { isConfigured: isConfigured, uploadFile: uploadFile, readFileInput: readFileInput };
})(window);
