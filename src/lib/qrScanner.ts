/**
 * QR Code Scanner using html5-qrcode library.
 * Compatible avec les navigateurs modernes (getUserMedia / caméra arrière).
 */

import { Html5Qrcode } from "html5-qrcode";

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
  /** Gestion des erreurs bloquantes (support/caméra) */
  onError?: (error: string) => void;
  /** Options html5-qrcode personnalisées */
  qrCodeSuccessCallback?: (decodedText: string, decodedResult: unknown) => void;
  qrCodeFailureCallback?: (error: string) => void;
}

/**
 * Démarre le scanner QR Code.
 * Retourne une fonction d'arrêt asynchrone à appeler au démontage.
 */
export function startQrScanner(options: QrScannerOptions): () => void {
  const { containerId, onSuccess, onError, qrCodeSuccessCallback, qrCodeFailureCallback } =
    options;

  const scannerElement = document.getElementById(containerId);
  if (!scannerElement) {
    onError?.("Élément container QR non trouvé");
    return () => {};
  }

  let scanner: Html5Qrcode;
  try {
    scanner = new Html5Qrcode(containerId);
  } catch {
    onError?.("Impossible d'initialiser le scanner QR");
    return () => {};
  }

  // Configuration html5-qrcode.
  // La signature correcte de start() est :
  //   start(camera, configuration, qrCodeSuccessCallback, qrCodeErrorCallback)
  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1,
  };

  const onDecode = (decodedText: string, decodedResult: unknown): void => {
    if (typeof onSuccess === "function") onSuccess(decodedText);
    if (typeof qrCodeSuccessCallback === "function") {
      qrCodeSuccessCallback(decodedText, decodedResult);
    }
  };

  // Les erreurs de décodage (frame sans QR) sont fréquentes et ne doivent PAS
  // être remontées comme erreur bloquante.
  const onDecodeFailure = (error: string): void => {
    if (typeof qrCodeFailureCallback === "function") qrCodeFailureCallback(error);
  };

  scanner
    .start({ facingMode: "environment" }, config, onDecode, onDecodeFailure)
    .catch((error: unknown) => {
      const msg = typeof error === "string" ? error : (error instanceof Error ? error.message : "Erreur caméra");
      onError?.(`Erreur scanner QR: ${msg}`);
    });

  return () => {
    try {
      scanner.stop().catch(() => { /* scanner déjà arrêté */ });
    } catch {
      /* scanner déjà arrêté ou erreur */
    }
  };
}

/**
 * Arrête un scanner QR démarré précédemment.
 * Conservé pour compatibilité — l'arrêt est géré via la fonction retour de startQrScanner.
 */
export function stopQrScanner(): void {
  // no-op
}

/**
 * Vérifie si le scanner QR est supporté par cet appareil.
 */
export function isQrScannerSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.mediaDevices === "undefined") return false;
  if (typeof navigator.mediaDevices.getUserMedia === "undefined") return false;
  return true;
}
