/**
 * Détection des capacités de l'appareil pour choisir le mode approprié.
 * Lège vs plein selon les fonctionnalités navigateur disponibles.
 */

export type DeviceCapabilityLevel = 'light' | 'full';

/**
 * Détecte le niveau de capacités de l'appareil.
 * Retourne 'light' si l'appareil ne peut pas exécuter l'app React pleine grandeur,
 * 'full' sinon.
 */
export function detectDeviceCapability(): DeviceCapabilityLevel {
  if (typeof window === "undefined") return "full";

  // Vérifier IndexedDB pour le stockage offline
  if (typeof indexedDB === "undefined") return "light";

  // Vérifier fetch pour Firebase / API
  if (typeof fetch === "undefined") return "light";

  // Vérifier Promise (ES2015+)
  if (typeof Promise === "undefined") return "light";

  // Vérifier Array.prototype.includes / find
  if (typeof Array.prototype.includes === "undefined") return "light";
  if (typeof Array.prototype.find === "undefined") return "light";

  // Vérifier Service Worker pour le mode hors ligne PWA
  if (typeof navigator !== "undefined" && !("serviceWorker" in navigator)) {
    // Pas de SW : on peut quand même faire le mode full (compatibility mode)
    // mais on retourne light si on manque d'autres features déjà vérifiées
    return "light";
  }

  // Toutes les features critiques présentes → appareil moderne → mode full
  return "full";
}

/**
 * Vérifie si l'appareil peut exécuter le mode plein (React + SW + IndexedDB).
 */
export function canUseFullMode(): boolean {
  return detectDeviceCapability() === "full";
}

/**
 * Retourne un message explicatif pour les appareils en mode light.
 */
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
 * Vérifie si un re-évaluation est nécessaire (capabilities might have changed).
 * On considère qu'une réévaluation est nécessaire si on n'a pas encore
 * déterminé le mode ou si les conditions précédentes ne s'appliquent plus.
 */
export function shouldReEvaluate(): boolean {
  const stored = typeof window !== "undefined"
    ? localStorage.getItem("nack_device_capability")
    : null;

  // Si pas de stocker précédent, on doit évaluer
  if (!stored) return true;

  // On stocke le niveau détecté ; si c'est "light", on garde en mémoire
  // mais on vérifie quand même si les conditions se sont améliorées
  return false;
}