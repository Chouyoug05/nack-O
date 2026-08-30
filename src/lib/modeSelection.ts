/**
 * Persistance et réévaluation du mode appareil.
 *
 * - Lit/écrit `localStorage['nack_selected_mode']`
 * - Réévalue instantanément si la détection a changé (upgrade/downgrade)
 * - Sinon toutes les 24h
 * - Sur visibilitychange : réévaluation débouncée (500 ms), écriture uniquement si changement
 */

import {
  detectDeviceCapability,
  type DeviceCapabilityLevel,
  hasCapabilityChanged,
  getLightModeMessage,
} from "./deviceCapability";

const STORAGE_KEY = "nack_selected_mode";
const REEVALUATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 h

export interface ModeSelection {
  mode: DeviceCapabilityLevel;
  detectedAt: number;
  reason?: string;
}

// ── Lecture ──────────────────────────────────────────────────────────────────

function isValidMode(v: unknown): v is DeviceCapabilityLevel {
  return v === "light" || v === "full";
}

/**
 * Lit le mode depuis localStorage. Retourne null si absent ou corrompu.
 */
function readStoredMode(): ModeSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      isValidMode(parsed.mode) &&
      typeof parsed.detectedAt === "number" &&
      parsed.detectedAt > 0
    ) {
      return parsed as ModeSelection;
    }
    // Corrompu → nettoyer
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

/**
 * Écrit le mode en localStorage sans jamais écrouter une valeur invalide.
 */
function storeMode(selection: ModeSelection): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    /* quota ou storage private */
  }
}

// ── API publique ─────────────────────────────────────────────────────────────

/**
 * Obtient le mode sélectionné.
 * 1. Si la détection a changé → met à jour immédiatement.
 * 2. Si âge > 24 h → réévalue.
 * 3. Sinon retourne la valeur stockée.
 * 4. Première visite → détecte et stocke.
 */
export function getSelectedMode(): ModeSelection {
  if (typeof window === "undefined") {
    return { mode: "full", detectedAt: Date.now(), reason: "SSR" };
  }

  const stored = readStoredMode();

  // Aucun stockage → détection initiale
  if (!stored) {
    const mode = detectDeviceCapability();
    const selection: ModeSelection = {
      mode,
      detectedAt: Date.now(),
      reason: mode === "light" ? getLightModeMessage() : undefined,
    };
    storeMode(selection);
    return selection;
  }

  // Détection a changé → upgrade/downgrade instantané
  if (hasCapabilityChanged(stored.mode)) {
    const newMode = detectDeviceCapability();
    const selection: ModeSelection = {
      mode: newMode,
      detectedAt: Date.now(),
      reason: newMode === "light" ? getLightModeMessage() : undefined,
    };
    storeMode(selection);
    return selection;
  }

  // Intervalle 24 h dépassé → réévaluer (même résultat probable, mais safety net)
  const age = Date.now() - stored.detectedAt;
  if (age > REEVALUATION_INTERVAL_MS) {
    const newMode = detectDeviceCapability();
    const selection: ModeSelection = {
      mode: newMode,
      detectedAt: Date.now(),
      reason: newMode === "light" ? getLightModeMessage() : undefined,
    };
    storeMode(selection);
    return selection;
  }

  return stored;
}

/**
 * Force une réévaluation (appelé sur visibilitychange, manuel, etc.).
 * Écrit uniquement si le mode a changé.
 */
export function reEvaluateMode(): ModeSelection {
  const mode = detectDeviceCapability();
  const stored = readStoredMode();

  // Pas de changement → ne rien écrire
  if (stored && stored.mode === mode) {
    return stored;
  }

  const selection: ModeSelection = {
    mode,
    detectedAt: Date.now(),
    reason: mode === "light" ? getLightModeMessage() : undefined,
  };
  storeMode(selection);
  return selection;
}

/**
 * Mode léger : true si l'appareil ne peut pas exécuter React.
 * Seul cas : unsupported par browserDetect → redirect /light/.
 */
export function isLightMode(): boolean {
  return getSelectedMode().mode === "light";
}

export function isFullMode(): boolean {
  return getSelectedMode().mode === "full";
}

/**
 * Supprime le cache (utile pour debug / tests).
 */
export function clearModeCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

// ── Réévaluation sur visibility ──────────────────────────────────────────────

let visibilityDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Réévalue le mode quand l'utilisateur revient dans l'app.
 * Débouncé 500 ms, ne réécrit que si changement.
 */
export function setupVisibilityReEvaluation(): void {
  if (typeof window === "undefined") return;

  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible") return;
    if (visibilityDebounceTimer !== null) return;
    visibilityDebounceTimer = setTimeout(() => {
      visibilityDebounceTimer = null;
      reEvaluateMode();
    }, 500);
  };

  const el = document.documentElement;
  if (!el.hasAttribute("data-nack-visibility-listener")) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    el.setAttribute("data-nack-visibility-listener", "1");
  }
}
