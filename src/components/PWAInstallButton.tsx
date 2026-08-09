import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { isElectronRenderer } from "@/lib/platform";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
}

const PWAInstallButton = () => {
  const isElectron = isElectronRenderer();

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      try {
        const alreadyInstalled = isStandalone();
        const dismissed = localStorage.getItem('pwa-install-dismissed') === 'true';
        if (!alreadyInstalled && !dismissed) {
          e.preventDefault();
          setDeferredPrompt(e as BeforeInstallPromptEvent);
          setShowInstallBanner(true);
        }
      } catch {
        // En cas d'erreur d'accès storage, fallback au comportement par défaut
      }
    };

    const handleAppInstalled = () => {
      console.log('PWA was installed');
      setIsInstalled(true);
      setShowInstallBanner(false);
    };

    if (isStandalone()) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setShowInstallBanner(false);
    } else {
      console.log('User dismissed the install prompt');
    }

    setDeferredPrompt(null);
  };

  const dismissBanner = () => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem('pwa-install-dismissed', 'true');
    } catch {
      // ignore
    }
  };

  // Vérifier si déjà dismissé
  const dismissed = typeof window !== 'undefined' ? (() => {
    try {
      return localStorage.getItem('pwa-install-dismissed');
    } catch {
      return null;
    }
  })() : null;

  if (isElectron || isInstalled || dismissed) {
    return null;
  }

  // iOS Safari : pas de beforeinstallprompt → afficher instructions manuelles
  const showIOSInstructions = isIOS() && !isStandalone() && !deferredPrompt;
  if (showIOSInstructions && !dismissed) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
        <Card className="shadow-lg border-2 border-nack-red/20 bg-gradient-to-r from-white to-nack-beige-light">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground mb-1">
                  Installer NACK
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Ajoutez NACK à l'écran d'accueil pour un accès rapide
                </p>
                <div className="bg-blue-50 rounded-lg p-2.5 mb-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-blue-800">
                    <span className="font-bold text-blue-600">1.</span>
                    <span>Appuyez sur l'icône <Share className="w-3 h-3 inline" /> de partage en bas</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-blue-800">
                    <span className="font-bold text-blue-600">2.</span>
                    <span>Sélectionnez « Sur l'écran d'accueil » <Plus className="w-3 h-3 inline" /></span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-blue-800">
                    <span className="font-bold text-blue-600">3.</span>
                    <span>Appuyez sur « Ajouter »</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={dismissBanner}
                  className="text-xs h-8 hover:bg-red-50 hover:text-red-600"
                >
                  Plus tard
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismissBanner}
                className="h-6 w-6 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Navigation normale (Android/Chrome) — bannière classique avec beforeinstallprompt
  if (!showInstallBanner || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
      <Card className="shadow-lg border-2 border-nack-red/20 bg-gradient-to-r from-white to-nack-beige-light">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground mb-1">
                Installer NACK
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Installez l'app sur votre appareil pour un accès rapide et hors ligne
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="nack"
                  onClick={handleInstallClick}
                  className="text-xs h-8"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Installer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={dismissBanner}
                  className="text-xs h-8 hover:bg-red-50 hover:text-red-600"
                >
                  Plus tard
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={dismissBanner}
              className="h-6 w-6 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PWAInstallButton;
