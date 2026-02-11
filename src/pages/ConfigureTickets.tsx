import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Paintbrush, ArrowRight } from "lucide-react";

const ConfigureTickets = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, saveProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [ticketInfo, setTicketInfo] = useState({
    companyName: profile?.companyName || "",
    rcsNumber: profile?.rcsNumber || "",
    nifNumber: profile?.nifNumber || "",
    businessPhone: profile?.businessPhone || "",
    fullAddress: profile?.fullAddress || "",
    customMessage: profile?.customMessage || "",
    legalMentions: profile?.legalMentions || "",
  });

  const handleSkip = () => {
    navigate("/dashboard");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProfile({
        establishmentName: profile?.establishmentName || "",
        establishmentType: profile?.establishmentType || "",
        ownerName: profile?.ownerName || "",
        email: profile?.email || "",
        phone: profile?.phone || "",
        whatsapp: profile?.whatsapp || "",
        logoUrl: profile?.logoUrl || undefined,
        companyName: ticketInfo.companyName || undefined,
        rcsNumber: ticketInfo.rcsNumber || undefined,
        nifNumber: ticketInfo.nifNumber || undefined,
        businessPhone: ticketInfo.businessPhone || undefined,
        fullAddress: ticketInfo.fullAddress || undefined,
        customMessage: ticketInfo.customMessage || undefined,
        legalMentions: ticketInfo.legalMentions || undefined,
      });
      toast({
        title: "Configuration enregistrée",
        description: "Les informations de tickets ont été sauvegardées. Vous pourrez les modifier plus tard dans les paramètres."
      });
      navigate("/dashboard");
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la configuration",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-card border-0">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Paintbrush className="text-nack-red" size={24} />
            <CardTitle className="text-2xl">Configuration des tickets</CardTitle>
          </div>
          <CardDescription>
            Configurez les informations qui apparaîtront sur vos tickets de paiement.
            <strong className="text-foreground"> Cette étape est optionnelle</strong> - vous pourrez la compléter plus tard dans les paramètres.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nom de la structure / Entreprise (optionnel)</Label>
              <Input
                id="company-name"
                value={ticketInfo.companyName}
                onChange={(e) => setTicketInfo({ ...ticketInfo, companyName: e.target.value })}
                placeholder="Ex: Restaurant NACK SARL"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rcs-number">Numéro RCS (optionnel)</Label>
                <Input
                  id="rcs-number"
                  value={ticketInfo.rcsNumber}
                  onChange={(e) => setTicketInfo({ ...ticketInfo, rcsNumber: e.target.value })}
                  placeholder="Ex: RCS-LB-2024-A-1234"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nif-number">Numéro NIF (optionnel)</Label>
                <Input
                  id="nif-number"
                  value={ticketInfo.nifNumber}
                  onChange={(e) => setTicketInfo({ ...ticketInfo, nifNumber: e.target.value })}
                  placeholder="Ex: 1234567890"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-phone">Numéro de téléphone professionnel (optionnel)</Label>
              <Input
                id="business-phone"
                type="tel"
                value={ticketInfo.businessPhone}
                onChange={(e) => setTicketInfo({ ...ticketInfo, businessPhone: e.target.value })}
                placeholder="+241 XX XX XX XX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full-address">Adresse complète (optionnel)</Label>
              <Input
                id="full-address"
                value={ticketInfo.fullAddress}
                onChange={(e) => setTicketInfo({ ...ticketInfo, fullAddress: e.target.value })}
                placeholder="Ex: Avenue Léon Mba, Libreville, Gabon"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-message">Message personnalisé (optionnel)</Label>
              <Input
                id="custom-message"
                value={ticketInfo.customMessage}
                onChange={(e) => setTicketInfo({ ...ticketInfo, customMessage: e.target.value })}
                placeholder="Ex: Merci pour votre confiance ❤️"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="legal-mentions">Mentions légales (optionnel)</Label>
              <Textarea
                id="legal-mentions"
                value={ticketInfo.legalMentions}
                onChange={(e) => setTicketInfo({ ...ticketInfo, legalMentions: e.target.value })}
                placeholder="Ex: SIRET: 12345678901234 - TVA: FR12345678901"
                rows={3}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleSkip}
              className="w-full sm:flex-1"
            >
              Passer cette étape
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:flex-1 bg-gradient-primary text-white"
            >
              {isSaving ? "Enregistrement..." : (
                <>
                  Enregistrer et continuer
                  <ArrowRight size={16} className="ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfigureTickets;
