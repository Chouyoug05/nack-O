import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, ExternalLink, X } from "lucide-react";

const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029VbBeYoYDJ6GtVge5A409";
const POPUP_INTERVAL = 3 * 60 * 60 * 1000; // 3 heures en millisecondes
const STORAGE_KEY = "nack_whatsapp_popup_last_shown";

const WhatsAppCommunityPopup = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkAndShowPopup = () => {
      try {
        const lastShown = localStorage.getItem(STORAGE_KEY);
        const now = Date.now();
        
        if (!lastShown || (now - parseInt(lastShown)) >= POPUP_INTERVAL) {
          setIsOpen(true);
          localStorage.setItem(STORAGE_KEY, now.toString());
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Rejoignez la communauté Nack!
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Restez informé des dernières nouveautés et actualités de votre plateforme
          </DialogDescription>
        </DialogHeader>
        
        <Card className="border-0 shadow-none bg-transparent">
          <CardContent className="p-0 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-green-800 mb-1">Nack! Communauté</h3>
                  <p className="text-sm text-green-700 mb-3">
                    Suivez les nouveautés de votre plateforme et les actualités importantes
                  </p>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Channel WhatsApp
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">Ce que vous y trouverez :</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>Nouvelles fonctionnalités en avant-première</li>
                  <li>Conseils d'utilisation de la plateforme</li>
                  <li>Maintenance et mises à jour</li>
                  <li>Support et assistance</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleJoinCommunity}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Rejoindre la communauté
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDismiss}
                className="px-4"
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
