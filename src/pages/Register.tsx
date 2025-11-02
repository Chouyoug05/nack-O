import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Building2, MapPin, Map, Navigation } from "lucide-react";
import NackLogo from "@/components/NackLogo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { uploadImageToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { validateWhatsApp, getWhatsAppErrorMessage } from "@/utils/whatsapp";

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formStep, setFormStep] = useState(1); // Étape du formulaire guidé
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

  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUpWithEmail, saveProfile } = useAuth();

  const establishmentTypes = [
    { value: "bar", label: "Bar" },
    { value: "snack", label: "Snack Bar" },
    { value: "nightclub", label: "Boîte de nuit" },
    { value: "restaurant-bar", label: "Restaurant-Bar" },
    { value: "hotel-bar", label: "Bar d'hôtel" },
    { value: "other", label: "Autre" }
  ];

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError("La géolocalisation n'est pas supportée par votre navigateur");
      return;
    }

    setIsGettingLocation(true);
    setLocationError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      setFormData({
        ...formData,
        latitude,
        longitude,
      });

      // Optionnel: obtenir l'adresse via reverse geocoding
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'Nack App'
            }
          }
        );
        const data = await response.json();
        const address = data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setFormData(prev => ({ ...prev, address }));
      } catch {
        setFormData(prev => ({ ...prev, address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` }));
      }

      toast({
        title: "Position enregistrée",
        description: "Votre localisation a été récupérée avec succès",
      });
    } catch (error: unknown) {
      const geoError = error as GeolocationPositionError;
      const errorMessage = geoError.code === 1 
        ? "Permission refusée. Veuillez autoriser la géolocalisation."
        : geoError.code === 2
        ? "Position indisponible. Vérifiez votre connexion."
        : geoError.message || "Erreur lors de la récupération de la position.";
      setLocationError(errorMessage);
      toast({
        title: "Erreur de géolocalisation",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.establishmentName && formData.establishmentType && formData.ownerName);
      case 2:
        if (!formData.email || !formData.phone || !formData.whatsapp) return false;
        if (!validateWhatsApp(formData.whatsapp)) return false;
        return true;
      case 3:
        // Géolocalisation optionnelle mais recommandée
        return true;
      case 4:
        if (!formData.password || formData.password.length < 6) return false;
        if (formData.password !== formData.confirmPassword) return false;
        return true;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive"
      });
      return;
    }
    
    const email = formData.email.trim();
    const password = formData.password.trim();
    if (password.length < 6) {
      toast({
        title: "Mot de passe trop court",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      await signUpWithEmail(email, password);
      let finalLogoUrl = formData.logoUrl || undefined;
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
        latitude: formData.latitude,
        longitude: formData.longitude,
        address: formData.address || undefined,
        locationAsked: true,
      });
      toast({ title: "Inscription réussie !", description: "Bienvenue sur NACK!" });
      navigate("/dashboard");
    } catch (error: unknown) {
      toast({ title: "Inscription échouée", description: "Une erreur est survenue. Réessayez.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-2xl animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-6">
          <NackLogo size="md" className="mb-2" />
          <p className="text-muted-foreground text-sm">Rejoignez la communauté NACK!</p>
        </div>

        {/* Register Card */}
        <Card className="shadow-card border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl">Créer un compte</CardTitle>
            <CardDescription className="text-base">
              Étape {formStep} sur 4
            </CardDescription>
            {/* Barre de progression */}
            <div className="flex gap-2 mt-4">
              <div className={`h-2 flex-1 rounded-full ${formStep >= 1 ? 'bg-green-500' : 'bg-gray-200'}`} />
              <div className={`h-2 flex-1 rounded-full ${formStep >= 2 ? 'bg-green-500' : 'bg-gray-200'}`} />
              <div className={`h-2 flex-1 rounded-full ${formStep >= 3 ? 'bg-green-500' : 'bg-gray-200'}`} />
              <div className={`h-2 flex-1 rounded-full ${formStep >= 4 ? 'bg-green-500' : 'bg-gray-200'}`} />
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-6 py-4 min-h-[400px]">
              {/* ÉTAPE 1: Informations de base */}
              {formStep === 1 && (
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-center">Informations de l'établissement</h3>
                  <p className="text-center text-muted-foreground text-lg">Commençons par les bases</p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="establishmentName" className="text-lg font-semibold">Nom de l'établissement *</Label>
                      <Input
                        id="establishmentName"
                        name="establishmentName"
                        placeholder="Mon Bar"
                        value={formData.establishmentName}
                        onChange={handleInputChange}
                        className="h-14 text-lg"
                        required
                        autoFocus
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="establishmentType" className="text-lg font-semibold">Type d'établissement *</Label>
                      <select
                        id="establishmentType"
                        name="establishmentType"
                        className="flex h-14 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-lg ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        value={formData.establishmentType}
                        onChange={(e) => setFormData({ ...formData, establishmentType: e.target.value })}
                        required
                      >
                        <option value="" disabled>Choisir le type…</option>
                        {establishmentTypes.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ownerName" className="text-lg font-semibold">Nom du gérant *</Label>
                      <Input
                        id="ownerName"
                        name="ownerName"
                        placeholder="Votre nom"
                        value={formData.ownerName}
                        onChange={handleInputChange}
                        className="h-14 text-lg"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 2: Coordonnées */}
              {formStep === 2 && (
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-center">Coordonnées</h3>
                  <p className="text-center text-muted-foreground text-lg">Comment vous contacter ?</p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-lg font-semibold">Email *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="votre@email.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="h-14 text-lg"
                        required
                        autoFocus
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-lg font-semibold">Téléphone *</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="+241 XX XX XX XX"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="h-14 text-lg"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="whatsapp" className="text-lg font-semibold">
                        WhatsApp <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="whatsapp"
                        name="whatsapp"
                        type="tel"
                        placeholder="+241 XX XX XX XX"
                        value={formData.whatsapp}
                        onChange={handleInputChange}
                        className={`h-14 text-lg ${formData.whatsapp && !validateWhatsApp(formData.whatsapp) ? "border-red-500" : ""}`}
                        required
                      />
                      {formData.whatsapp && !validateWhatsApp(formData.whatsapp) && (
                        <p className="text-sm text-red-500">{getWhatsAppErrorMessage(formData.whatsapp)}</p>
                      )}
                      {formData.whatsapp && validateWhatsApp(formData.whatsapp) && (
                        <p className="text-sm text-green-600">✓ Format WhatsApp valide</p>
                      )}
                      <p className="text-xs text-muted-foreground">Numéro WhatsApp obligatoire pour le support</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 3: Géolocalisation */}
              {formStep === 3 && (
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-center">Localisation</h3>
                  <p className="text-center text-muted-foreground text-lg">Où se trouve votre établissement ?</p>
                  
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        <strong>Pourquoi nous demandons votre localisation ?</strong><br />
                        Cela nous permet de créer une carte interactive pour que vos clients vous trouvent facilement.
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={getCurrentLocation}
                      disabled={isGettingLocation}
                      className="w-full h-16 bg-gradient-primary text-white text-lg font-semibold"
                    >
                      {isGettingLocation ? (
                        <>
                          <Navigation className="w-5 h-5 mr-2 animate-spin" />
                          Récupération de la position...
                        </>
                      ) : (
                        <>
                          <MapPin className="w-5 h-5 mr-2" />
                          Obtenir ma position automatiquement
                        </>
                      )}
                    </Button>

                    {locationError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-800">{locationError}</p>
                      </div>
                    )}

                    {formData.latitude && formData.longitude && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm text-green-800 font-medium mb-2">✓ Position enregistrée</p>
                        {formData.address && (
                          <p className="text-sm text-green-700">{formData.address}</p>
                        )}
                        <p className="text-xs text-green-600 mt-1">
                          {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                        </p>
                      </div>
                    )}

                    <div className="text-center">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setFormData({ ...formData, latitude: undefined, longitude: undefined, address: "" });
                          setLocationError(null);
                        }}
                        className="text-sm"
                      >
                        Réessayer
                      </Button>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-xs text-yellow-800">
                        Vous pouvez continuer sans géolocalisation, mais nous vous recommandons fortement de la fournir.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 4: Sécurité et Logo */}
              {formStep === 4 && (
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-center">Sécurité et Logo</h3>
                  <p className="text-center text-muted-foreground text-lg">Dernière étape !</p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-lg font-semibold">Mot de passe *</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={handleInputChange}
                          className="h-14 text-lg"
                          required
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">Au moins 6 caractères</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-lg font-semibold">Confirmer le mot de passe *</Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="h-14 text-lg"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="logoUrl" className="text-lg font-semibold">Logo (optionnel)</Label>
                      <Input
                        id="logoUrl"
                        name="logoUrl"
                        placeholder="https://.../logo.png"
                        value={formData.logoUrl}
                        onChange={handleInputChange}
                        className="h-14 text-lg"
                      />
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => setLogoFile(e.target.files?.[0] || null)} 
                        className="h-12 text-base"
                      />
                      <p className="text-xs text-muted-foreground">Vous pouvez ajouter votre logo plus tard</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t">
              {formStep > 1 ? (
                <Button 
                  variant="outline" 
                  onClick={() => setFormStep(formStep - 1)}
                  className="h-14 px-8 text-lg font-semibold"
                >
                  Retour
                </Button>
              ) : (
                <div></div>
              )}
              
              {formStep < 4 ? (
                <Button 
                  onClick={() => {
                    if (validateStep(formStep)) {
                      setFormStep(formStep + 1);
                    } else {
                      toast({
                        title: "Champs manquants",
                        description: "Veuillez remplir tous les champs obligatoires",
                        variant: "destructive"
                      });
                    }
                  }}
                  disabled={!validateStep(formStep)}
                  className="bg-gradient-primary text-white h-14 px-8 text-lg font-semibold ml-auto"
                >
                  Suivant
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit}
                  disabled={isLoading || !validateStep(4)}
                  className="bg-green-600 hover:bg-green-700 text-white h-14 px-8 text-lg font-bold ml-auto"
                >
                  {isLoading ? 'Création du compte...' : 'Créer mon compte'}
                </Button>
              )}
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Déjà un compte ?{" "}
                <Link 
                  to="/login" 
                  className="text-nack-red hover:text-nack-red-dark font-medium"
                >
                  Se connecter
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Business Type Hint */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-white/50 px-3 py-2 rounded-full">
            <Building2 size={14} />
            <span>Pour tous types d'établissements au Gabon</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;