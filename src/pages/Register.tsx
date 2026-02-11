import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Building2, MapPin, Gift, Navigation, Search } from "lucide-react";
import NackLogo from "@/components/NackLogo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { uploadImageToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { validateWhatsApp } from "@/utils/whatsapp";
import { geocodeAddress, searchAddresses } from "@/utils/geocoding";
import { getFriendlyErrorMessage } from "@/utils/authErrors";

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [formData, setFormData] = useState({
    establishmentName: "",
    establishmentType: "",
    ownerName: "",
    email: "",
    phone: "",
    whatsapp: "",
    password: "",
    confirmPassword: "",
    logoUrl: "",
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    address: "",
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref")?.trim() || undefined;
  const isAffiliateMode = searchParams.get("mode") === "affiliate";

  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [affiliateStep, setAffiliateStep] = useState(1); // 1: Form, 2: Success

  const { toast } = useToast();
  const { signUpWithEmail, saveProfile } = useAuth();

  const establishmentTypes = [
    { value: "bar", label: "Bar" },
    { value: "restaurant", label: "Restaurant" },
    { value: "snack", label: "Snack Bar" },
    { value: "nightclub", label: "Boîte de nuit" },
    { value: "restaurant-bar", label: "Restaurant-Bar" },
    { value: "hotel-bar", label: "Bar d'hôtel" },
    { value: "other", label: "Autre" }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: return !!(formData.establishmentName && formData.establishmentType && formData.ownerName);
      case 2: return !!(formData.email && formData.phone && validateWhatsApp(formData.whatsapp));
      case 3: return !!(formData.address && formData.latitude && formData.longitude);
      case 4: return !!(formData.password && formData.password.length >= 6 && formData.password === formData.confirmPassword);
      default: return true;
    }
  };

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError("La géolocalisation n'est pas supportée");
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
      toast({ title: "Position enregistrée" });
    } catch {
      setLocationError("Erreur de géolocalisation");
    } finally {
      setIsGettingLocation(false);
    }
  };

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

  const handleGeocodeAddress = async () => {
    if (!addressInput.trim()) return;
    setIsSearchingAddress(true);
    try {
      const result = await geocodeAddress(addressInput);
      if (result) {
        setFormData({
          ...formData,
          latitude: result.latitude,
          longitude: result.longitude,
          address: result.displayName
        });
        setAddressInput(result.displayName);
      }
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleManagerSubmit = async () => {
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Erreur", description: "Mots de passe différents", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await signUpWithEmail(formData.email, formData.password);
      let finalLogoUrl = formData.logoUrl || undefined;
      if (logoFile && isCloudinaryConfigured()) {
        try {
          finalLogoUrl = await uploadImageToCloudinary(logoFile, "logos");
        } catch (e) {
          console.warn("Logo upload failed", e);
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
        referredBy: refCode,
      });
      toast({ title: "Inscription réussie !" });
      navigate("/configure-tickets");
    } catch (error) {
      toast({
        title: "Erreur",
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAffiliateSubmit = async () => {
    if (!formData.ownerName || !formData.email || !formData.whatsapp) {
      toast({ title: "Champs manquants", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `AFF-${randomSuffix}`;
      const { setDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      const { affiliateDocRef } = await import("@/lib/collections");

      await setDoc(affiliateDocRef(db, code), {
        code: code,
        name: formData.ownerName,
        email: formData.email,
        whatsapp: formData.whatsapp,
        referralCount: 0,
        totalEarned: 0,
        createdAt: Date.now(),
        createdBy: "self-registration",
      });
      setAffiliateCode(code);
      setAffiliateStep(2);
      toast({ title: "Compte créé !" });
    } catch (error) {
      toast({
        title: "Erreur",
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderAffiliateForm = () => {
    if (affiliateStep === 2) {
      return (
        <div className="space-y-8 py-8 animate-scale-in text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 text-green-600 rounded-full mb-4">
            <Gift size={40} className="animate-bounce" />
          </div>
          <h3 className="text-3xl font-bold">Bienvenue, Partenaire !</h3>
          <p className="text-muted-foreground">Votre compte a été créé. Notez votre code :</p>
          <div className="bg-white border-2 border-dashed border-nack-red p-6 rounded-2xl shadow-sm inline-block my-4">
            <span className="text-4xl font-mono font-bold text-nack-red tracking-widest">{affiliateCode}</span>
          </div>
          <Button onClick={() => navigate(`/affiliate?code=${affiliateCode}`)} className="w-full h-16 text-xl font-bold bg-nack-red hover:bg-nack-red-dark text-white rounded-xl shadow-lg mt-6">
            Accéder à mon tableau de bord
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6 py-4">
        <h3 className="text-2xl font-bold text-center">Devenir Affilié Nack</h3>
        <p className="text-center text-muted-foreground">Gagnez des revenus en parrainant des établissements.</p>
        <div className="space-y-4">
          <Input name="ownerName" placeholder="Nom complet" value={formData.ownerName} onChange={handleInputChange} className="h-14" />
          <Input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleInputChange} className="h-14" />
          <Input name="whatsapp" type="tel" placeholder="WhatsApp (ex: +241...)" value={formData.whatsapp} onChange={handleInputChange} className="h-14" />
        </div>
        <Button onClick={handleAffiliateSubmit} disabled={isLoading || !formData.ownerName || !formData.email || !formData.whatsapp} className="w-full h-14 bg-nack-red text-white font-bold">
          {isLoading ? 'Création...' : 'Créer mon compte affilié'}
        </Button>
        <div className="text-center">
          <Button variant="ghost" onClick={() => navigate('/login')} className="text-muted-foreground">Annuler</Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-2xl animate-scale-in">
        <div className="text-center mb-6">
          <NackLogo size="md" className="mb-2" />
          <p className="text-muted-foreground text-sm">Rejoignez la communauté NACK!</p>
        </div>

        <Card className="shadow-card border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl">
              {isAffiliateMode ? (affiliateStep === 2 ? "Félicitations !" : "Devenir Affilié") : "Créer un compte"}
            </CardTitle>
            {!isAffiliateMode && <CardDescription>Étape {formStep} sur 4</CardDescription>}
            {!isAffiliateMode && (
              <div className="flex gap-2 mt-4">
                {[1, 2, 3, 4].map(s => (
                  <div key={s} className={`h-2 flex-1 rounded-full ${formStep >= s ? 'bg-green-500' : 'bg-gray-200'}`} />
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent>
            {isAffiliateMode ? renderAffiliateForm() : (
              <div className="space-y-6 py-4 min-h-[400px]">
                {formStep === 1 && (
                  <div className="space-y-4">
                    <Label>Nom de l'établissement *</Label>
                    <Input name="establishmentName" placeholder="Mon Bar" value={formData.establishmentName} onChange={handleInputChange} className="h-12" />
                    <Label>Type d'établissement *</Label>
                    <select
                      className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={formData.establishmentType}
                      onChange={(e) => setFormData({ ...formData, establishmentType: e.target.value })}
                    >
                      <option value="">Choisir...</option>
                      {establishmentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <Label>Nom du gérant *</Label>
                    <Input name="ownerName" placeholder="Votre nom" value={formData.ownerName} onChange={handleInputChange} className="h-12" />
                  </div>
                )}

                {formStep === 2 && (
                  <div className="space-y-4">
                    <Label>Email *</Label>
                    <Input name="email" type="email" placeholder="votre@email.com" value={formData.email} onChange={handleInputChange} className="h-12" />
                    <Label>Téléphone *</Label>
                    <Input name="phone" type="tel" placeholder="+241..." value={formData.phone} onChange={handleInputChange} className="h-12" />
                    <Label>WhatsApp *</Label>
                    <Input name="whatsapp" type="tel" placeholder="+241..." value={formData.whatsapp} onChange={handleInputChange} className="h-12" />
                  </div>
                )}

                {formStep === 3 && (
                  <div className="space-y-4">
                    <Label>Adresse *</Label>
                    <div className="relative">
                      <Input
                        placeholder="Chercher une adresse..."
                        value={addressInput}
                        onChange={(e) => handleAddressInputChange(e.target.value)}
                        className="h-12 pr-10"
                      />
                      <Button variant="ghost" size="icon" onClick={handleGeocodeAddress} className="absolute right-0 top-0 h-12 w-10">
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                    {showSuggestions && addressSuggestions.length > 0 && (
                      <div className="border rounded-md bg-white shadow-md max-h-40 overflow-y-auto">
                        {addressSuggestions.map((s, i) => (
                          <button key={i} onClick={() => handleSelectAddress(s)} className="w-full text-left p-2 hover:bg-gray-100 text-sm border-b">{s.display_name}</button>
                        ))}
                      </div>
                    )}
                    <Button variant="outline" onClick={getCurrentLocation} disabled={isGettingLocation} className="w-full h-12 mt-2">
                      <Navigation className="w-4 h-4 mr-2" /> GPS
                    </Button>
                    {locationError && <p className="text-xs text-red-500 mt-1">{locationError}</p>}
                    {formData.latitude && <p className="text-xs text-green-600 mt-1">✓ Localisé</p>}
                  </div>
                )}

                {formStep === 4 && (
                  <div className="space-y-4">
                    <Label>Mot de passe *</Label>
                    <div className="relative">
                      <Input name="password" type={showPassword ? "text" : "password"} placeholder="••••••" value={formData.password} onChange={handleInputChange} className="h-12" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <Label>Confirmer *</Label>
                    <Input name="confirmPassword" type="password" placeholder="••••••" value={formData.confirmPassword} onChange={handleInputChange} className="h-12" />
                    <Label>Logo (URL optionnelle)</Label>
                    <Input name="logoUrl" placeholder="https://..." value={formData.logoUrl} onChange={handleInputChange} className="h-12" />
                    <div className="mt-2">
                      <Label className="text-xs text-muted-foreground">Ou uploader un fichier :</Label>
                      <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="h-10 text-xs mt-1" />
                    </div>
                  </div>
                )}

                <div className="flex justify-between gap-3 pt-4 border-t">
                  {formStep > 1 && <Button variant="outline" onClick={() => setFormStep(formStep - 1)} className="h-12 px-6">Retour</Button>}
                  {formStep < 4 ? (
                    <Button onClick={() => setFormStep(formStep + 1)} disabled={!validateStep(formStep)} className="h-12 px-8 font-semibold ml-auto bg-nack-red text-white">Suivant</Button>
                  ) : (
                    <Button onClick={handleManagerSubmit} disabled={isLoading || !validateStep(4)} className="h-12 px-8 font-bold ml-auto bg-green-600 text-white">
                      {isLoading ? 'Création...' : 'Créer mon compte'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Déjà un compte ? <Link to="/login" className="text-nack-red font-medium">Se connecter</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;