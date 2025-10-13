import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, ExternalLink } from "lucide-react";

const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029VbBeYoYDJ6GtVge5A409";
const POPUP_INTERVAL = 5 * 60 * 60 * 1000; // 5 heures en millisecondes
const STORAGE_KEY = "nack_whatsapp_popup_last_shown";

const WhatsAppCommunityPopup = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkAndShowPopup = () => {
      try {
        const lastShown = localStorage.getItem(STORAGE_KEY);
        const now = Date.now();
        
        if (!lastShown || (now - parseInt(lastShown)) >= POPUP_INTERVAL) {
          // Vérifier si le tutoriel est ouvert pour éviter les conflits
          const tutorialDialog = document.querySelector('[role="dialog"]');
          if (!tutorialDialog) {
            setIsOpen(true);
            localStorage.setItem(STORAGE_KEY, now.toString());
          }
        }
      } catch (error) {
        // Ignore localStorage errors
        console.warn("Could not access localStorage for WhatsApp popup");
      }
    };

    // Vérifier immédiatement
    checkAndShowPopup();

    // Vérifier toutes les heures
    const interval = setInterval(checkAndShowPopup, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleJoinCommunity = () => {
    window.open(WHATSAPP_CHANNEL_URL, "_blank");
    setIsOpen(false);
  };

  const handleDismiss = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    const onOpenEvt = () => setIsOpen(true);
    window.addEventListener('nack:community:open', onOpenEvt as EventListener);
    return () => window.removeEventListener('nack:community:open', onOpenEvt as EventListener);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[90vw] max-w-[500px] sm:max-w-[520px] mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
            <span className="leading-tight">Rejoignez la communauté Nack!</span>
          </DialogTitle>
          <DialogDescription className="text-sm leading-tight">
            Restez informé des dernières nouveautés et actualités de votre plateforme
          </DialogDescription>
        </DialogHeader>
        
        <Card className="border-0 shadow-none bg-transparent">
          <CardContent className="p-0 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-green-800 mb-1 text-sm sm:text-base">Nack! Communauté</h3>
                  <p className="text-xs sm:text-sm text-green-700 mb-3 leading-tight">
                    Suivez les nouveautés de votre plateforme et les actualités importantes
                  </p>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    Channel WhatsApp
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs sm:text-sm text-muted-foreground">
                <p className="font-medium mb-2">Ce que vous y trouverez :</p>
                <ul className="list-disc ml-4 sm:ml-5 space-y-1 text-xs sm:text-sm">
                  <li>Nouvelles fonctionnalités en avant-première</li>
                  <li>Conseils d'utilisation de la plateforme</li>
                  <li>Maintenance et mises à jour</li>
                  <li>Support et assistance</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button 
                onClick={handleJoinCommunity}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="text-sm sm:text-base">Rejoindre la communauté</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDismiss}
                className="px-4 w-full sm:w-auto"
              >
                Plus tard
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppCommunityPopup;
