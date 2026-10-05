import { useEffect, useRef } from "react";
import { startQrScanner, isQrScannerSupported } from "@/lib/qrScanner";

const QRScanner = ({
  onScan,
  onError,
  containerId = "qr-reader",
}: {
  onScan: (code: string) => void;
  onError?: (error: string) => void;
  containerId?: string;
}) => {
  const scannerRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!isQrScannerSupported()) {
      onError?.("Scanner QR non supporté par cet navigateur/appareil");
      return;
    }

    scannerRef.current = startQrScanner({
      containerId,
      onSuccess: onScan,
      onError,
    });

    return () => {
      scannerRef.current?.();
    };
  }, [containerId, onScan, onError]);

  return (
    <div className="w-full">
      <div
        id={containerId}
        className="mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-black"
        style={{ minHeight: 260 }}
      />
    </div>
  );
};

export default QRScanner;
