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
import { geocodeAddress, searchAddresses } from "@/utils/geocoding";
import { Search, Navigation, MapPin, Loader2, Building2 } from "lucide-react";
import { ESTABLISHMENT_TYPES, getEstablishmentLabel } from "@/constants/establishmentTypes";
import { Checkbox } from "@/components/ui/checkbox";
import TermsAndConditions from "@/components/TermsAndConditions";
import { isProfileComplete } from "@/utils/profileComplete";

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
    address: "",
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    // Si admin, rediriger vers /admin même sans profil
    if (user && !isAdminLoading && isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [user, isAdmin, isAdminLoading, navigate]);

  useEffect(() => {
    // Uniquement si le profil est vraiment complet — un doc vide (inscription) doit rester ici
    if (!profileLoading && isProfileComplete(profile)) {
      navigate("/dashboard", { replace: true });
    }
  }, [profileLoading, profile, navigate]);

  useEffect(() => {
    if (!profile) return;
    setFormData((prev) => ({
      ...prev,
      establishmentName: profile.establishmentName || prev.establishmentName,
      establishmentType: profile.establishmentType || prev.establishmentType,
      ownerName: profile.ownerName || prev.ownerName,
      email: profile.email || prev.email || user?.email || "",
      phone: profile.phone || prev.phone,
      whatsapp: profile.whatsapp || prev.whatsapp,
      logoUrl: profile.logoUrl || prev.logoUrl,
      address: profile.address || prev.address,
      latitude: profile.latitude ?? prev.latitude,
      longitude: profile.longitude ?? prev.longitude,
    }));
    if (profile.address) setAddressInput(profile.address);
  }, [profile, user?.email]);

  const handleAddressInputChange = async (value: string) => {
    setAddressInput(value);
    if (value.length >= 3) {
      setIsSearchingAddress(true);
      const suggestions = await searchAddresses(value);
      setAddressSuggestions(suggestions);
      setShowSuggestions(true);
      setIsSearchingAddress(false);
    } else {
      setAddressSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectAddress = async (suggestion: { display_name: string; lat: string; lon: string }) => {
    setAddressInput(suggestion.display_name);
    setFormData({
      ...formData,
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
      address: suggestion.display_name
    });
    setShowSuggestions(false);
  };

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError("La gÃ©olocalisation n'est pas supportÃ©e");
      return;
    }
    setIsGettingLocation(true);
    setLocationError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const { latitude, longitude } = position.coords;
      setFormData({ ...formData, latitude, longitude });
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`);
        const data = await response.json();
        const address = data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setFormData(prev => ({ ...prev, address }));
        setAddressInput(address);
      } catch {
        const fallback = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setFormData(prev => ({ ...prev, address: fallback }));
        setAddressInput(fallback);
      }
      toast({ title: "Position enregistrÃ©e" });
    } catch {
      setLocationError("Erreur de gÃ©olocalisation");
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!termsAccepted) {
      toast({
        title: "Conditions non acceptÃ©es",
        description: "Veuillez accepter les conditions d'utilisation.",
        variant: "destructive"
      });
      return;
    }

    // Validation WhatsApp
    if (!formData.whatsapp.trim()) {
      toast({
        title: "NumÃ©ro WhatsApp requis",
        description: "Le numÃ©ro WhatsApp est obligatoire pour le support.",
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

    setIsSaving(true);
    try {
      let finalLogoUrl: string | undefined = formData.logoUrl || undefined;
      if (logoFile) {
        if (!isCloudinaryConfigured()) {
          toast({ title: "Cloudinary non configurÃ©", description: "Ajoutez VITE_CLOUDINARY_CLOUD_NAME et VITE_CLOUDINARY_UPLOAD_PRESET", variant: "destructive" });
          return;
        }
        try {
          finalLogoUrl = await uploadImageToCloudinary(logoFile, "logos");
        } catch (uploadErr: unknown) {
          const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          toast({ title: "Ã‰chec de l'upload du logo", description: msg, variant: "destructive" });
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
        latitude: formData.latitude,
        longitude: formData.longitude,
        address: formData.address || undefined,
        locationAsked: true,
      });
      toast({ title: "Profil enregistrÃ©", description: "Bienvenue sur NACK!" });
      navigate("/dashboard", { replace: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "RÃ©essayez.";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
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
          <p className="text-muted-foreground text-sm">ComplÃ©tez votre profil pour continuer</p>
        </div>

        <Card className="shadow-card border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">ComplÃ©ter le profil</CardTitle>
            <CardDescription>Ces informations seront utilisÃ©es dans votre tableau de bord</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="establishmentName">Nom de l'Ã©tablissement</Label>
                <Input id="establishmentName" name="establishmentName" value={formData.establishmentName} onChange={handleInputChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="establishmentType">Type d'Ã©tablissement</Label>
                <Select value={formData.establishmentType} onValueChange={(value) => setFormData({ ...formData, establishmentType: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="SÃ©lectionnez le type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTABLISHMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownerName">Nom du gÃ©rant</Label>
                <Input id="ownerName" name="ownerName" value={formData.ownerName} onChange={handleInputChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">TÃ©lÃ©phone</Label>
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
                  <p className="text-xs text-green-600">âœ“ Format WhatsApp valide</p>
                )}
                <p className="text-xs text-muted-foreground">NumÃ©ro WhatsApp obligatoire pour le support</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo (URL)</Label>
                <Input id="logoUrl" name="logoUrl" value={formData.logoUrl} onChange={handleInputChange} placeholder="https://.../logo.png" />
                <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
              </div>

              <div className="space-y-2 border-t pt-4 mt-4">
                <Label className="font-semibold">Localisation de l'Ã©tablissement</Label>
                <div className="relative">
                  <Input
                    placeholder="Chercher une adresse..."
                    value={addressInput}
                    onChange={(e) => handleAddressInputChange(e.target.value)}
                    className="h-12 pr-10"
                  />
                  <div className="absolute right-0 top-0 h-12 w-10 flex items-center justify-center text-muted-foreground">
                    <Search className="h-4 w-4" />
                  </div>
                </div>
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="border rounded-md bg-white shadow-md max-h-40 overflow-y-auto z-10">
                    {addressSuggestions.map((s, i) => (
                      <button key={i} type="button" onClick={() => handleSelectAddress(s)} className="w-full text-left p-2 hover:bg-gray-100 text-sm border-b">{s.display_name}</button>
                    ))}
                  </div>
                )}
                <Button type="button" variant="outline" onClick={getCurrentLocation} disabled={isGettingLocation} className="w-full h-12 mt-2">
                  <Navigation className="w-4 h-4 mr-2" /> GPS
                </Button>
                {locationError && <p className="text-xs text-red-500 mt-1">{locationError}</p>}
                {formData.latitude && <p className="text-xs text-green-600 mt-1 font-medium">âœ“ LocalisÃ© avec succÃ¨s</p>}
              </div>

              <div className="flex items-start space-x-2 pt-2">
                <Checkbox
                  id="terms-complete"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(!!checked)}
                  className="mt-1"
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="terms-complete"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    J'accepte les{" "}
                    <TermsAndConditions trigger={<button type="button" className="text-nack-red hover:underline p-0 h-auto font-medium">conditions d'utilisation</button>} />
                    {" "}de NACK!
                  </label>
                </div>
              </div>

              <Button type="submit" variant="nack" size="lg" className="w-full h-14 text-lg font-bold" disabled={!formData.latitude || !termsAccepted || isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  formData.latitude ? "Finaliser mon inscription" : "Veuillez localiser l'Ã©tablissement"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompleteProfile; 


