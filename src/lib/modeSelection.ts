/**
 * Hook de persistance et de mémorisation du mode appareil.
 * Stocke le mode déterminé en localStorage et permet la réévaluation.
 */

import { detectDeviceCapability, DeviceCapabilityLevel, shouldReEvaluate, getLightModeMessage } from "./deviceCapability";

const STORAGE_KEY = "nack_selected_mode";
const REEVALUATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

export interface ModeSelection {
  mode: DeviceCapabilityLevel;
  detectedAt: number;
  reason?: string;
}

/**
 * Obtient le mode sélectionné (depuis le stockage ou détection automatique).
 */
export function getSelectedMode(): ModeSelection {
  if (typeof window === "undefined") {
    return {
      mode: "full",
      detectedAt: Date.now(),
      reason: "Server-side rendering, assumed full capabilities",
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Vérifier si on doit réévaluer (intervalle écoulé ou changement de capabilities)
      const age = Date.now() - (parsed.detectedAt || 0);
      if (age > REEVALUATION_INTERVAL_MS || shouldReEvaluate()) {
        // Réévaluation nécessaire - détecter à nouveau
        const newMode = detectDeviceCapability();
        const selection: ModeSelection = {
          mode: newMode,
          detectedAt: Date.now(),
          reason: newMode === "light" ? getLightModeMessage() : undefined,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
        return selection;
      }
      return parsed as ModeSelection;
    }
  } catch (e) {
    console.warn("[NACK] Impossible de lire le mode sélectionné depuis localStorage", e);
  }

  // Détection automatique initiale
  const mode = detectDeviceCapability();
  const selection: ModeSelection = {
    mode,
    detectedAt: Date.now(),
    reason: mode === "light" ? getLightModeMessage() : undefined,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    /* ignore quota errors */
  }
  return selection;
}

/**
 * Force une réévaluation du mode (ex: lorsque l'utilisateur change d'appareil ou que
 * les capabilities du navigateur ont changé).
 */
export function reEvaluateMode(): ModeSelection {
  const mode = detectDeviceCapability();
  const selection: ModeSelection = {
    mode,
    detectedAt: Date.now(),
    reason: mode === "light" ? getLightModeMessage() : undefined,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    /* ignore quota errors */
  }
  return selection;
}

/**
 * Change manuellement le mode (pour les tests ou cas particuliers).
 * Note: ceci contourne la détection automatique - utiliser avec précaution.
 */
export function setModeManually(mode: DeviceCapabilityLevel): void {
  const selection: ModeSelection = {
    mode,
    detectedAt: Date.now(),
    reason: mode === "light" ? getLightModeMessage() : undefined,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Vérifie si le mode actuel est le mode léger.
 */
export function isLightMode(): boolean {
  return getSelectedMode().mode === "light";
}

/**
 * Vérifie si le mode actuel est le mode plein.
 */
export function isFullMode(): boolean {
  return getSelectedMode().mode === "full";
}

/**
 * Définit un écouteur de visibilité pour réévaluer les capabilities
 * quand l'utilisateur revient dans l'application.
 * À appeler une fois au démarrage de l'application.
 */
export function setupVisibilityReEvaluation(): void {
  if (typeof window === "undefined") return;

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      setTimeout(() => {
        reEvaluateMode();
      }, 100);
    }
  };

  const existing = document.getAttribute("data-nack-visibility-listener");
  if (!existing) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.setAttribute("data-nack-visibility-listener", "1");
  }
}