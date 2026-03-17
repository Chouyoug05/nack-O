import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

type Props = {
  title?: string;
};

export default function OfflineAuthBlock({ title = "Connexion requise" }: Props) {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-4 text-center">
        <div className="text-2xl font-bold text-gray-900">{title}</div>
        <p className="text-sm text-gray-600">
          Vous êtes <strong>hors connexion</strong>. La connexion et l’inscription nécessitent Internet.
          <br />
          Réactivez vos données ou le Wi‑Fi puis réessayez.
        </p>
        <Button variant="nack" onClick={() => window.location.reload()}>
          Réessayer
        </Button>
      </div>
    </div>
  );
}

