import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, X } from "lucide-react";
import { validateWhatsApp, getWhatsAppErrorMessage } from "@/utils/whatsapp";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WhatsAppPopup = ({ open, onOpenChange }: Props) => {
  const { user, profile, saveProfile } = useAuth();
  const { toast } = useToast();
  const [whatsapp, setWhatsapp] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (profile?.whatsapp) {
      setWhatsapp(profile.whatsapp);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsapp.trim()) {
      toast({
        title: "Numéro WhatsApp requis",
        description: "Veuillez saisir votre numéro WhatsApp",
        variant: "destructive"
      });
      return;
    }
    
    if (!validateWhatsApp(whatsapp)) {
      toast({
        title: "Format WhatsApp invalide",
        description: getWhatsAppErrorMessage(whatsapp),
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      await saveProfile({
        establishmentName: profile?.establishmentName || "",
        establishmentType: profile?.establishmentType || "",
        ownerName: profile?.ownerName || "",
        email: profile?.email || "",
        phone: profile?.phone || "",
        whatsapp: whatsapp.trim(),
        logoUrl: profile?.logoUrl,
      });
      
      toast({
        title: "WhatsApp enregistré",
        description: "Votre numéro WhatsApp a été sauvegardé",
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le numéro WhatsApp",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactWhatsApp = () => {
    const message = `Bonjour, je suis ${profile?.ownerName || "un utilisateur"} de ${profile?.establishmentName || "mon établissement"}. Je souhaite ajouter mon numéro WhatsApp à mon profil NACK. Mon numéro est: ${whatsapp || "à définir"}`;
    const whatsappUrl = `https://wa.me/24104746847?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[425px] sm:max-w-[425px] mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <MessageCircle className="text-green-600 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="leading-tight">Numéro WhatsApp requis</span>
          </DialogTitle>
          <DialogDescription className="text-sm leading-tight">
            Votre numéro WhatsApp est nécessaire pour le support technique et les notifications importantes.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp">Numéro WhatsApp</Label>
            <Input
              id="whatsapp"
              type="tel"
              placeholder="+241 XX XX XX XX"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
              className={whatsapp && !validateWhatsApp(whatsapp) ? "border-red-500" : ""}
            />
            {whatsapp && !validateWhatsApp(whatsapp) && (
              <p className="text-xs text-red-500">{getWhatsAppErrorMessage(whatsapp)}</p>
            )}
            {whatsapp && validateWhatsApp(whatsapp) && (
              <p className="text-xs text-green-600">✓ Format WhatsApp valide</p>
            )}
            <p className="text-xs text-muted-foreground">
              Format: +241 suivi de votre numéro (ex: +241 01 23 45 67)
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleContactWhatsApp}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Nous contacter
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {isLoading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>

        <div className="text-xs text-muted-foreground text-center">
          Vous pouvez aussi nous contacter directement sur WhatsApp pour obtenir de l'aide
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppPopup;
