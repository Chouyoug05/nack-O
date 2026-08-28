import { useEffect, useRef, useState } from "react";
import { startQrScanner, stopQrScanner, isQrScannerSupported, getQrScannerModeMessage, QrScanResult } from "@/lib/qrScanner";
import { isLightMode, isFullMode } from "@/lib/modeSelection";

const QRScanner = ({
  onScan,
  onError,
  containerId = "qr-reader",
  modeRestrictionCallback,
}: {
  onScan: (code: string) => void;
  onError?: (error: string) => void;
  containerId?: string;
  modeRestrictionCallback?: (message: string) => void;
}) => {
  const scannerRef = useRef<() => void>(() => {});
  const [isSupported, setIsSupported] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    // Vérifier le support du scanner au montage
    const supported = isQrScannerSupported();
    setIsSupported(supported);

    if (!supported) {
      onError?.("Scanner QR non supporté par cet navigateur/appareil");
      return;
    }

    // Démarrer le scanner
    scannerRef.current = startQrScanner(
      {
        containerId,
        onSuccess: (code) => {
          setIsScanning(false);
          onScan(code);
        },
        onError: (error) => {
          setIsScanning(false);
          onError?.(error);
        },
        modeRestrictionCallback,
      },
      (message) => {
        // Callback de restriction de mode
        if (modeRestrictionCallback) {
          modeRestrictionCallback(message);
        }
      }
    );

    return () => {
      // Arrêter le scanner au démontage
      scannerRef.current?.();
    };
  }, [containerId, onScan, onError, modeRestrictionCallback]);

  useEffect(() => {
    // Vérifier le mode actuel et mettre à jour le statut
    setIsScanning(!!scannerRef.current);
  }, [isLightMode(), isFullMode()]);

  return null;
};

export default QRScanner;