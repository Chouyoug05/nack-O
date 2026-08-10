var fs = require("fs");
var path = require("path");
var files = [];
function walk(d) {
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
[
  "sales-tab", "cart-remove", "cart-clear", "hold-order",
  "edit-order", "pay-order", "cancel-order", "stock-toggle-zero",
  "login-type", "team-add-role", "profile-tab", "profile-pay"
].forEach(function (a) {
  if (app.indexOf('case "' + a + '"') === -1) {
    ok = false;
    console.error("Missing action:", a);
  }
});
process.exit(ok ? 0 : 1);
