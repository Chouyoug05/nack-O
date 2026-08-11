import { WifiOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useAuth } from "@/contexts/AuthContext";
import { listPendingOrders } from "@/lib/localSyncQueue";

function countManagerOutbox(uid: string): number {
  try {
    const raw = localStorage.getItem(`nack_m_outbox_${uid}`);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Bandeau global hors-ligne avec compteur d'actions en attente (comme Lite).
 */
export default function OfflineStatusBar() {
  const { isOnline } = useOnlineStatus();
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (!user?.uid) {
        if (!cancelled) setPendingCount(0);
        return;
      }
      try {
        const rows = await listPendingOrders(user.uid);
        const total = rows.length + countManagerOutbox(user.uid);
        if (!cancelled) setPendingCount(total);
      } catch {
        if (!cancelled) setPendingCount(countManagerOutbox(user.uid));
      }
    };

    void refresh();
    const onOnline = () => {
      setFlushing(true);
      void refresh().finally(() => {
        window.setTimeout(() => {
          if (!cancelled) setFlushing(false);
          void refresh();
        }, 2000);
      });
    };

    window.addEventListener("online", onOnline);
    const interval = window.setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
    };
  }, [user?.uid, isOnline]);

  if (isOnline && pendingCount === 0 && !flushing) return null;

  let message = "Pas d’internet pour le moment — vos actions restent enregistrées et seront envoyées dès le retour du réseau.";
  if (isOnline && flushing) {
    message = pendingCount > 0
      ? `Envoi de ${pendingCount} action(s) en cours…`
      : "Synchronisation en cours…";
  } else if (!isOnline && pendingCount > 0) {
    message = `Mode sans internet — ${pendingCount} action(s) seront envoyées dès le retour du réseau`;
  } else if (isOnline && pendingCount > 0) {
    message = `${pendingCount} action(s) en attente d’envoi…`;
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] flex items-center justify-center gap-2 bg-amber-600 px-3 py-2 text-center text-sm font-medium text-white shadow-md"
    >
      {flushing ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span>{message}</span>
    </div>
  );
}
