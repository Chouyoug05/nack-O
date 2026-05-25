"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Après le pack Windows : si `signAndEditExecutable` est false (évite winCodeSign / symlinks),
 * on applique quand même l'icône sur l'exe avec rcedit.
 */
exports.default = async function afterPackWinIcon(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }
  const { rcedit } = await import("rcedit");
  const projectDir = context.packager.projectDir;
  const iconPath = path.join(projectDir, "build", "icon.ico");
  const exePath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`,
  );
  if (!fs.existsSync(iconPath)) {
    throw new Error(`afterPack: icône absente (${iconPath}). Lancez npm run electron:copy-icons avant le build.`);
  }
  if (!fs.existsSync(exePath)) {
    console.warn(`afterPack: exécutable absent, ignoré: ${exePath}`);
    return;
  }
  await rcedit(exePath, { icon: iconPath });
};
