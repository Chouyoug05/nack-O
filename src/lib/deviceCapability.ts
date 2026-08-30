/**
 * Détection des capacités de l'appareil — wrapper autour de browserDetect.ts.
 *
 * unsupported → light  (redirige vers /light/ HTML)
 * compatibility → full (reste dans React, mode compat sans SW)
 * modern → full (React complet)
 */

import { detectBrowserLevel } from "./browserDetect";

export type DeviceCapabilityLevel = "light" | "full";

/**
 * Retourne le niveau de capacité de l'appareil.
 * unsupported → light (doit quitter React), compatibility|modern → full.
 */
export function detectDeviceCapability(): DeviceCapabilityLevel {
  if (typeof window === "undefined") return "full";

  const level = detectBrowserLevel();
  // Seul "unsupported" passe en mode léger HTML (public/light)
  return level === "unsupported" ? "light" : "full";
}

/** @deprecated Utiliser detectDeviceCapability() ou detectBrowserLevel() directement. */
export function canUseFullMode(): boolean {
  return detectDeviceCapability() === "full";
}

export function getLightModeMessage(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);

  if (isIOS) {
    return (
      "Votre appareil iOS est trop ancien pour exécuter NACK en mode plein. " +
      "Le mode léger activé offre les fonctionnalités de base."
    );
  }
  return (
    "Votre navigateur ou appareil ne dispose pas de toutes les fonctionnalités requises pour le mode plein. " +
    "Le mode léger activé offre les fonctionnalités de base."
  );
}

/**
 * Vérifie si le mode stocké est toujours valide par rapport à la détection actuelle.
 * Retourne true si la détection a changé (upgrade/downgrade nécessaire).
 */
export function hasCapabilityChanged(storedMode: DeviceCapabilityLevel): boolean {
  return detectDeviceCapability() !== storedMode;
}
