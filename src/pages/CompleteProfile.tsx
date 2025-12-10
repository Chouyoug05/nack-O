import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NackLogo from "@/components/NackLogo";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { uploadImageToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { validateWhatsApp, getWhatsAppErrorMessage } from "@/utils/whatsapp";

const establishmentTypes = [
  { value: "bar", label: "Bar" },
  { value: "restaurant", label: "Restaurant" },
  { value: "snack", label: "Snack Bar" },
  { value: "nightclub", label: "Boîte de nuit" },
  { value: "restaurant-bar", label: "Restaurant-Bar" },
  { value: "hotel-bar", label: "Bar d'hôtel" },
  { value: "other", label: "Autre" }
];

const CompleteProfile = () => {
  const { user, profile, profileLoading, saveProfile, isAdmin, isAdminLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    establishmentName: "",
    establishmentType: "",
    ownerName: "",
    email: user?.email ?? "",
    phone: "",
    whatsapp: "",
    logoUrl: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    // Si admin, rediriger vers /admin même sans profil
    if (user && !isAdminLoading && isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [user, isAdmin, isAdminLoading, navigate]);

  useEffect(() => {
    if (!profileLoading && profile) {
      navigate("/dashboard", { replace: true });
    }
  }, [profileLoading, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation WhatsApp
    if (!formData.whatsapp.trim()) {
      toast({
        title: "Numéro WhatsApp requis",
        description: "Le numéro WhatsApp est obligatoire pour le support.",
        variant: "destructive"
      });
      return;
    }
    
    if (!validateWhatsApp(formData.whatsapp)) {
      toast({
        title: "Format WhatsApp invalide",
        description: getWhatsAppErrorMessage(formData.whatsapp),
        variant: "destructive"
      });
      return;
    }
    
    try {
      let finalLogoUrl: string | undefined = formData.logoUrl || undefined;
      if (logoFile) {
        if (!isCloudinaryConfigured()) {
          toast({ title: "Cloudinary non configuré", description: "Ajoutez VITE_CLOUDINARY_CLOUD_NAME et VITE_CLOUDINARY_UPLOAD_PRESET", variant: "destructive" });
          return;
        }
        try {
          finalLogoUrl = await uploadImageToCloudinary(logoFile, "logos");
        } catch (uploadErr: unknown) {
          const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          toast({ title: "Échec de l'upload du logo", description: msg, variant: "destructive" });
          return;
        }
      }
      await saveProfile({
        establishmentName: formData.establishmentName,
        establishmentType: formData.establishmentType,
        ownerName: formData.ownerName,
        email: formData.email,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        logoUrl: finalLogoUrl,
      });
      toast({ title: "Profil enregistré", description: "Bienvenue sur NACK!" });
      navigate("/dashboard", { replace: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Réessayez.";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-6">
          <NackLogo size="md" className="mb-2" />
          <p className="text-muted-foreground text-sm">Complétez votre profil pour continuer</p>
        </div>

        <Card className="shadow-card border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Compléter le profil</CardTitle>
            <CardDescription>Ces informations seront utilisées dans votre tableau de bord</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="establishmentName">Nom de l'établissement</Label>
                <Input id="establishmentName" name="establishmentName" value={formData.establishmentName} onChange={handleInputChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="establishmentType">Type d'établissement</Label>
                <Select value={formData.establishmentType} onValueChange={(value) => setFormData({ ...formData, establishmentType: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez le type" />
                  </SelectTrigger>
                  <SelectContent>
                    {establishmentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownerName">Nom du gérant</Label>
                <Input id="ownerName" name="ownerName" value={formData.ownerName} onChange={handleInputChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleInputChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp <span className="text-red-500">*</span></Label>
                <Input 
                  id="whatsapp" 
                  name="whatsapp" 
                  type="tel" 
                  value={formData.whatsapp} 
                  onChange={handleInputChange} 
                  required 
                  placeholder="+241 XX XX XX XX"
                  className={formData.whatsapp && !validateWhatsApp(formData.whatsapp) ? "border-red-500" : ""}
                />
                {formData.whatsapp && !validateWhatsApp(formData.whatsapp) && (
                  <p className="text-xs text-red-500">{getWhatsAppErrorMessage(formData.whatsapp)}</p>
                )}
                {formData.whatsapp && validateWhatsApp(formData.whatsapp) && (
                  <p className="text-xs text-green-600">✓ Format WhatsApp valide</p>
                )}
                <p className="text-xs text-muted-foreground">Numéro WhatsApp obligatoire pour le support</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo (URL)</Label>
                <Input id="logoUrl" name="logoUrl" value={formData.logoUrl} onChange={handleInputChange} placeholder="https://.../logo.png" />
                <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
              </div>

              <Button type="submit" variant="nack" size="lg" className="w-full">Enregistrer</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompleteProfile; 