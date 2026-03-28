import { useEffect, useState } from "react";

/**
 * État réseau : sur Capacitor (Android/iOS), utilise @capacitor/network ;
 * sinon événements online/offline du navigateur.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const run = async () => {
      try {
        const { Network } = await import("@capacitor/network");
        const status = await Network.getStatus();
        if (!cancelled) setIsOnline(status.connected);
        const handle = await Network.addListener("networkStatusChange", (s) => {
          if (!cancelled) setIsOnline(s.connected);
        });
        cleanup = () => {
          void handle.remove();
        };
      } catch {
        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        if (typeof window !== "undefined") {
          setIsOnline(navigator.onLine);
          window.addEventListener("online", onOnline);
          window.addEventListener("offline", onOffline);
          cleanup = () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
          };
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return { isOnline };
}
