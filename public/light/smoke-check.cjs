var fs = require("fs");
var path = require("path");
var files = [];
function walk(d) {
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d).forEach(function (f) {
    var p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.js$/.test(f)) files.push(p);
  });
}
walk("js");
var ok = true;
files.forEach(function (f) {
  try {
    new Function(fs.readFileSync(f, "utf8"));
    console.log("OK", f);
  } catch (e) {
    ok = false;
    console.error("FAIL", f, e.message);
  }
});
var app = fs.readFileSync("js/app.js", "utf8");
var required = [
  "sales-tab", "cart-remove", "hold-order", "login-type", "team-add-role",
  "profile-tab", "profile-pay", "notif-read", "onb-next", "reg-next", "cust-detail",
  "loc-save", "loc-geo", "loc-skip", "open-cgu", "route-nav",
  "reports-receipts", "reports-print-one", "pwa-install", "sales-print"
];
required.forEach(function (a) {
  if (app.indexOf('case "' + a + '"') === -1) {
    ok = false;
    console.error("Missing action:", a);
  }
});
var views = [
  "onboarding", "register", "forgot", "complete-profile", "configure-tickets",
  "notifications", "customer-detail", "admin"
];
views.forEach(function (v) {
  var p = path.join("js", "views", v + ".js");
  if (!fs.existsSync(p)) { ok = false; console.error("Missing view:", p); }
});
["serveur", "caisse", "cuisine", "agent-event"].forEach(function (i) {
  if (!fs.existsSync(path.join("js", "interfaces", i + ".js"))) {
    ok = false; console.error("Missing interface:", i);
  }
});
["ordering", "event-public", "payment-result"].forEach(function (p) {
  if (!fs.existsSync(path.join("js", "public", p + ".js"))) {
    ok = false; console.error("Missing public:", p);
  }
});
if (!fs.existsSync("js/subscription.js")) { ok = false; console.error("Missing subscription.js"); }
if (!fs.existsSync("manifest.json")) { ok = false; console.error("Missing manifest.json"); }
console.log(ok ? "SMOKE OK" : "SMOKE FAILED");
process.exit(ok ? 0 : 1);
