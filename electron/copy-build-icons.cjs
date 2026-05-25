/**
 * Prépare build/icon.ico + build/icon.png pour electron-builder (dossier buildResources par défaut : build/).
 * Régénère un .ico multi-tailles depuis assets/icon.png (png-to-ico) ; repli sur la copie de assets/icon.ico.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(__dirname, "assets");
const outDir = path.join(root, "build");

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const srcPng = path.join(srcDir, "icon.png");
  const srcIco = path.join(srcDir, "icon.ico");
  const outIco = path.join(outDir, "icon.ico");
  const outPng = path.join(outDir, "icon.png");

  if (!fs.existsSync(srcPng)) {
    console.error("[copy-build-icons] Manquant:", srcPng);
    process.exit(1);
  }

  try {
    const pngToIco = (await import("png-to-ico")).default;
    const icoBuf = await pngToIco(srcPng);
    fs.writeFileSync(outIco, icoBuf);
    console.log("[copy-build-icons] icon.ico généré (multi-tailles) ->", outIco);
  } catch (e) {
    console.warn("[copy-build-icons] Génération ICO depuis PNG échouée, repli sur icon.ico source:", e?.message || e);
    if (!fs.existsSync(srcIco)) {
      console.error("[copy-build-icons] Pas de repli:", srcIco);
      process.exit(1);
    }
    fs.copyFileSync(srcIco, outIco);
    console.log("[copy-build-icons] icon.ico copié ->", outIco);
  }

  fs.copyFileSync(srcPng, outPng);
  console.log("[copy-build-icons] icon.png ->", outPng);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
