/**
 * QR Code Scanner using html5-qrcode library.
 * Fonctionne en mode léger comme en mode plein.
 * Détecte automatiquement les capabilities et s'adapte.
 */

import Html5Qrcode from "html5-qrcode";
import { detectDeviceCapability, isFullMode, isLightMode } from "./deviceCapability";

export type QrScanResult = {
  success: true;
  code: string;
} | {
  success: false;
  error: string;
};

/** Options pour le scanner QR. */
export interface QrScannerOptions {
  /** Id de l'élément DOM où le scanner sera rendu */
  containerId: string;
  /** Traitement du code scanné (obligatoire) */
  onSuccess: (code: string) => void;
  /** Gestion des erreurs */
  onError?: (error: string) => void;
  /** Options html5-qrcode personnalisées */
  qrCodeSuccessCallback?: (decodedText: string, decodedResult: unknown) => void;
  qrCodeFailureCallback?: (error: string) => void;
}

/**
 * Démarre le scanner QR Code.
 * Retourne une fonction d'arrêt pour arrêter le scanner.
 * Si l'appareil n'est pas capable de scanner (mode light sans caméra),
 * appelle le callback d'erreur et retourne une fonction vide.
 */
export function startQrScanner(
  options: QrScannerOptions,
  onModeRestriction?: (message: string) => void
): () => void {
  const { containerId, onSuccess, onError, qrCodeSuccessCallback, qrCodeFailureCallback } =
    options;

  // Vérifier si le mode light restreint la caméra
  const deviceCapability: DeviceCapabilityLevel = detectDeviceCapability();

  // En mode light, on peut quand même scanner si la caméra est disponible
  // Mais on avertit l'utilisateur si les capabilities sont limitées
  if (!isFullMode() && onModeRestriction) {
    const message =
      deviceCapability === "light"
        ? "Le mode léger ne dispose pas d'accès caméra complet. Certaines fonctionnalités de scan peuvent être limitées."
        : undefined;
    if (message) onModeRestriction(message);
  }

  const scannerElement = document.getElementById(containerId);
  if (!scannerElement) {
    onError?.("Élément container QR non trouvé");
    return () => {};
  }

  // Configuration html5-qrcode
  const config: any = {
    qrCodeSuccessCallback: (decodedText: string, decodedResult: unknown) => {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      if (typeof onSuccess === "function") {
        onSuccess(decodedText);
      }
      if (typeof qrCodeSuccessCallback === "function") {
        qrCodeSuccessCallback(decodedText, decodedResult);
      }
    },
    qrCodeFailureCallback: (error: string) => {
      if (typeof qrCodeFailureCallback === "function") {
        qrCodeFailureCallback(error);
      }
      onError?.(`Erreur scanner: ${error}`);
    },
  };

  try {
    const scanner = new Html5Qrcode(containerId);
    scanner.start(
      // Success callback for getting camera permissions
      {
        facingMode: "environment", // Caméra arrière par défaut sur mobile
        // Optional: facingMode: "user" for front camera
      },
      config,
      // Error callback
      (error: string | object) => {
        // Gestion des erreurs d'appareil/camera
        const errorMsg = `Erreur scanner QR: ${typeof error === "string" ? error : JSON.stringify(error)}`;
        onError?.(errorMsg);
      }
    );
    // Retourne la fonction d'arrêt
    return () => {
      try {
        scanner.stop();
      } catch (e) {
        // Scanner déjà arrêté ou erreur
      }
    };
  } catch (e) {
    onError?.("Impossible de démarrer le scanner QR");
    return () => {};
  }
}

/**
 * Arrête un scanner QR démarré précédemment.
 * À appeler lors du déchargement du composant.
 */
export function stopQrScanner(): void {
  // Cette fonction est un placeholder - l'arrêt est géré via la fonction de retour de startQrScanner
  // Mais on garde pour compatibilité
}

/**
 * Vérifie si le scanner QR est supporté par cet appareil.
 */
export function isQrScannerSupported(): boolean {
  // html5-qrcode a besoin de getUserMedia et de la caméra
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.mediaDevices === "undefined") return false;
  if (typeof navigator.mediaDevices.getUserMedia === "undefined") return false;
  return true;
}

/**
 * Obtient le message approprié selon le mode et les capabilities.
 */
export function getQrScannerModeMessage(): string {
  if (isFullMode()) {
    return "Scanner QR Code activé - mode plein";
  }
  return "Scanner QR Code activé - mode léger";
}