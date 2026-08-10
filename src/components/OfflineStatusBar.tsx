import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Bandeau global quand internet n'est pas disponible.
 */
export default function OfflineStatusBar() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] flex items-center justify-center gap-2 bg-amber-600 px-3 py-2 text-center text-sm font-medium text-white shadow-md"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        Pas d’internet pour le moment — vos actions restent enregistrées et seront envoyées dès le retour du réseau.
      </span>
    </div>
  );
}
