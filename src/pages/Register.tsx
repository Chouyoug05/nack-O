import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, MapPin, Gift, Navigation, Search, Loader2, Smartphone, ShieldCheck, ArrowLeft, X } from "lucide-react";
import { MAIN_CATEGORIES, ESTABLISHMENT_TYPES } from "@/constants/establishmentTypes";
import NackLogo from "@/components/NackLogo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { uploadImageToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { validateWhatsApp } from "@/utils/whatsapp";
import { geocodeAddress, searchAddresses } from "@/utils/geocoding";
import { getFriendlyErrorMessage } from "@/utils/authErrors";
import { Checkbox } from "@/components/ui/checkbox";
import TermsAndConditions from "@/components/TermsAndConditions";

// MAIN_CATEGORIES and ESTABLISHMENT_TYPES are imported from @/constants/establishmentTypes

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [affiliateStep, setAffiliateStep] = useState(1);
  const [affiliateCode, setAffiliateCode] = useState("");

  const { signUpWithEmail, saveProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref")?.trim() || undefined;
  const isAffiliateMode = searchParams.get("mode") === "affiliate";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(null);
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: return !!(formData.establishmentType);
      case 2: 
        if (selectedMainCategory === 'commerce' || selectedMainCategory === 'boutique') {
          return !!(formData.ownerName);
        }
        return !!(formData.establishmentName && formData.ownerName);
      case 3: return !!(formData.email && formData.whatsapp && validateWhatsApp(formData.whatsapp));
      case 4: return !!(formData.address && formData.latitude && formData.longitude);
      case 5: return !!(formData.password && formData.password.length >= 6 && formData.password === formData.confirmPassword && termsAccepted);
      default: return true;
    }
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

  const handleNext = () => {
    if (!validateStep(formStep)) {
      toast({ title: "Erreur", description: "Veuillez remplir les champs requis.", variant: "destructive" });
      return;
    }
    setFormStep(formStep + 1);
  };

  const handleManagerSubmit = async () => {
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Erreur", description: "Mots de passe diffÃ©rents", variant: "destructive" });
      return;
    }
    if (!termsAccepted) {
      toast({ title: "Erreur", description: "Veuillez accepter les conditions d'utilisation.", variant: "destructive" });
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
      toast({ title: "Inscription rÃ©ussie !" });
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
    if (!formData.ownerName || !formData.email || !formData.whatsapp || !formData.password) {
      toast({ title: "Champs manquants", variant: "destructive" });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Mots de passe diffÃ©rents", variant: "destructive" });
      return;
    }
    if (!termsAccepted) {
      toast({ title: "Erreur", description: "Veuillez accepter les conditions d'utilisation.", variant: "destructive" });
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
        password: formData.password,
        referralCount: 0,
        totalEarned: 0,
        createdAt: Date.now(),
        createdBy: "self-registration",
      });
      setAffiliateCode(code);
      setAffiliateStep(2);
      toast({ title: "Compte crÃ©Ã© !" });
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
          <p className="text-muted-foreground">Votre compte a Ã©tÃ© crÃ©Ã©. Notez votre code :</p>
          <div className="bg-white border-2 border-dashed border-nack-red p-6 rounded-2xl shadow-sm inline-block my-4">
            <span className="text-4xl font-mono font-bold text-nack-red tracking-widest">{affiliateCode}</span>
          </div>
          <Button onClick={() => navigate(`/affiliate?code=${affiliateCode}`)} className="w-full h-16 text-xl font-bold bg-nack-red hover:bg-nack-red-dark text-white rounded-xl shadow-lg mt-6">
            AccÃ©der Ã  mon tableau de bord
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6 py-4">
        <h3 className="text-2xl font-bold text-center">Devenir AffiliÃ© Nack</h3>
        <p className="text-center text-muted-foreground">Gagnez des revenus en parrainant des Ã©tablissements.</p>
        <div className="space-y-4">
          <Input name="ownerName" placeholder="Nom complet" value={formData.ownerName} onChange={handleInputChange} className="h-14" />
          <Input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleInputChange} className="h-14" />
          <Input name="whatsapp" type="tel" placeholder="WhatsApp (ex: +241...)" value={formData.whatsapp}
            onChange={handleInputChange}
            required
            className="h-14"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input name="password" type="password" placeholder="Mot de passe" value={formData.password} onChange={handleInputChange} className="h-14" />
            <Input name="confirmPassword" type="password" placeholder="Confirmer" value={formData.confirmPassword} onChange={handleInputChange} className="h-14" />
          </div>
        </div>

        <div className="flex items-start space-x-2 pt-2">
          <Checkbox
            id="terms-affiliate"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(!!checked)}
            className="mt-1"
          />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor="terms-affiliate"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              J'accepte les{" "}
              <TermsAndConditions trigger={<button type="button" className="text-nack-red hover:underline p-0 h-auto font-medium">conditions d'utilisation</button>} />
              {" "}de NACK!
            </label>
          </div>
        </div>

        <Button
          onClick={handleAffiliateSubmit}
          variant="nack"
          size="lg"
          className="w-full h-12"
          disabled={isLoading || !formData.ownerName || !formData.email || !formData.whatsapp || !formData.password || formData.password !== formData.confirmPassword || !termsAccepted}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              CrÃ©ation du compte...
            </>
          ) : "CrÃ©er mon compte partenaire"}
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
          <p className="text-muted-foreground text-sm">Rejoignez la communautÃ© NACK!</p>
        </div>

        <Card className="shadow-card border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl">
              {isAffiliateMode ? (affiliateStep === 2 ? "FÃ©licitations !" : "Devenir AffiliÃ©") : "CrÃ©er un compte"}
            </CardTitle>
            {!isAffiliateMode && <CardDescription>Ã‰tape {formStep} sur 5</CardDescription>}
            {!isAffiliateMode && (
              <div className="flex gap-2 mt-4">
                {[1, 2, 3, 4, 5].map(s => (
                  <div key={s} className={`h-2 flex-1 rounded-full ${formStep >= s ? 'bg-green-500' : 'bg-gray-200'}`} />
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent>
            {isAffiliateMode ? renderAffiliateForm() : (
              <div className="space-y-6 py-4 min-h-[400px]">
                {/* Step 1: Main category and type */}
                {formStep === 1 && (
                  <div className="space-y-6">
                    {!selectedMainCategory ? (
                      <div className="space-y-4">
                        <Label className="text-lg">Quelle est l'activitÃ© principale de votre Ã©tablissement ? *</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {MAIN_CATEGORIES.map((cat) => {
                            const Icon = cat.icon;
                            return (
                              <button
                                key={cat.id}
                                onClick={() => setSelectedMainCategory(cat.id)}
                                className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-xl hover:border-nack-red hover:bg-red-50 transition-all text-center group"
                              >
                                <Icon className="w-12 h-12 mb-3 text-gray-400 group-hover:text-nack-red" />
                                <h3 className="font-bold text-gray-800 mb-1">{cat.label}</h3>
                                <p className="text-xs text-gray-500">{cat.description}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedMainCategory(null); setFormData({ ...formData, establishmentType: "" }); }} className="p-0 h-auto text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
                          </Button>
                        </div>
                        <Label className="text-lg">PrÃ©cisez votre type d'Ã©tablissement *</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {ESTABLISHMENT_TYPES.filter(t => t.main === selectedMainCategory).map((t) => (
                            <button
                              key={t.value}
                              onClick={() => setFormData({ ...formData, establishmentType: t.value })}
                              className={`p-4 border-2 rounded-lg text-left transition-all ${formData.establishmentType === t.value ? 'border-nack-red bg-red-50 text-nack-red font-semibold' : 'border-gray-100 hover:border-gray-300'}`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Step 2: Owner and establishment name */}
                {formStep === 2 && (
                  <div className="space-y-4">
                    {!(selectedMainCategory === 'commerce' || selectedMainCategory === 'boutique') && (
                      <>
                        <Label>Nom de l'Ã©tablissement *</Label>
                        <Input name="establishmentName" placeholder="Mon Ã©tablissement" value={formData.establishmentName} onChange={handleInputChange} className="h-12" />
                      </>
                    )}
                    <Label>Nom complet du gÃ©rant *</Label>
                    <Input name="ownerName" placeholder="Votre nom complet" value={formData.ownerName} onChange={handleInputChange} className="h-12" />
                  </div>
                )}
                {formStep === 3 && (
                  <div className="space-y-4">
                    <Label>Email *</Label>
                    <Input name="email" type="email" placeholder="votre@email.com" value={formData.email} onChange={handleInputChange} className="h-12" />
                    <Label>WhatsApp *</Label>
                    <Input name="whatsapp" placeholder="WhatsApp (ex: +241...)" value={formData.whatsapp} onChange={handleInputChange} className="h-12" />
                  </div>
                )}
                {/* Step 4: Address */}
                {formStep === 4 && (
                  <div className="space-y-4">
                    <Label>Adresse *</Label>
                    <Input value={addressInput} onChange={e => handleAddressInputChange(e.target.value)} placeholder="Entrez votre adresse" className="h-12" />
                    {showSuggestions && (
                      <div className="border rounded bg-white max-h-48 overflow-y-auto">
                        {addressSuggestions.map((s, i) => (
                          <div key={i} className="p-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSelectAddress(s)}>{s.display_name}</div>
                        ))}
                      </div>
                    )}
                    <div className="flex space-x-2">
                      <Button onClick={getCurrentLocation} variant="outline" disabled={isGettingLocation}>
                        {isGettingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
                        {isGettingLocation ? "Localisation..." : "Utiliser ma position"}
                      </Button>
                      <Button onClick={handleGeocodeAddress} variant="outline" disabled={isSearchingAddress}>
                        {isSearchingAddress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        GÃ©ocoder l'adresse
                      </Button>
                    </div>
                  </div>
                )}
                {/* Step 5: Password and submit */}
                {formStep === 5 && (
                  <div className="space-y-4">
                    <Label>Mot de passe *</Label>
                    <Input name="password" type="password" placeholder="Mot de passe" value={formData.password} onChange={handleInputChange} className="h-12" />
                    <Label>Confirmer le mot de passe *</Label>
                    <Input name="confirmPassword" type="password" placeholder="Confirmer" value={formData.confirmPassword} onChange={handleInputChange} className="h-12" />
                    <div className="flex items-start space-x-2 pt-2">
                      <Checkbox id="terms" checked={termsAccepted} onCheckedChange={checked => setTermsAccepted(!!checked)} className="mt-1" />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          J'accepte les <TermsAndConditions trigger={<button type="button" className="text-nack-red hover:underline p-0 h-auto font-medium">conditions d'utilisation</button>} />
                          de NACK!
                        </label>
                      </div>
                    </div>
                    <Button onClick={handleManagerSubmit} disabled={isLoading || !termsAccepted} className="w-full h-12" variant="nack">
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          CrÃ©ation du compte...
                        </>
                      ) : "CrÃ©er mon compte"}
                    </Button>
                  </div>
                )}
                {/* Navigation Buttons */}
                <div className="flex justify-between mt-6">
                  {formStep > 1 && (
                    <Button variant="outline" onClick={() => setFormStep(formStep - 1)} disabled={isLoading}>PrÃ©cÃ©dent</Button>
                  )}
                  {formStep < 5 && (
                    <Button onClick={handleNext} disabled={isLoading}>Suivant</Button>
                  )}
                </div>
                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    DÃ©jÃ  un compte ? <Link to="/login" className="text-nack-red font-medium">Se connecter</Link>
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;






