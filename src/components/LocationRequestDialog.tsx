import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Map, CheckCircle2, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress, searchAddresses, reverseGeocode } from "@/utils/geocoding";

const LocationRequestDialog = () => {
  const { profile, saveProfile } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    // Afficher le dialog si le profil existe mais n'a pas de géolocalisation et qu'on ne l'a pas encore demandé
    if (profile && !profile.locationAsked && (!profile.latitude || !profile.longitude)) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [profile]);

  const handleSkipLocation = async () => {
    try {
      await saveProfile({
        establishmentName: profile?.establishmentName || "",
        establishmentType: profile?.establishmentType || "",
        ownerName: profile?.ownerName || "",
        email: profile?.email || "",
        phone: profile?.phone || "",
        whatsapp: profile?.whatsapp,
        logoUrl: profile?.logoUrl,
        latitude: profile?.latitude,
        longitude: profile?.longitude,
        address: profile?.address,
        locationAsked: true,
      });
    } catch {
      // ne pas bloquer la session
    }
    setIsOpen(false);
  };

  // Recherche d'adresses avec autocomplétion
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

  // Sélection d'une adresse depuis les suggestions
  const handleSelectAddress = async (suggestion: { display_name: string; lat: string; lon: string }) => {
    setAddressInput(suggestion.display_name);
    setLocation({
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
      address: suggestion.display_name
    });
    setShowSuggestions(false);
    setLocationError(null);
    toast({
      title: "Adresse sélectionnée",
      description: "Les coordonnées ont été récupérées avec succès",
    });
  };

  // Géocoder une adresse saisie manuellement
  const handleGeocodeAddress = async () => {
    if (!addressInput.trim() || addressInput.trim().length < 3) {
      toast({
        title: "Adresse invalide",
        description: "Veuillez saisir une adresse valide (minimum 3 caractères)",
        variant: "destructive"
      });
      return;
    }

    setIsSearchingAddress(true);
    setLocationError(null);

    try {
      const result = await geocodeAddress(addressInput);
      if (result) {
        setLocation({
          lat: result.latitude,
          lng: result.longitude,
          address: result.displayName
        });
        toast({
          title: "Adresse localisée",
          description: "Les coordonnées ont été récupérées avec succès",
        });
      } else {
        setLocationError("Impossible de trouver cette adresse. Vérifiez l'orthographe ou essayez une adresse plus précise.");
        toast({
          title: "Adresse introuvable",
          description: "Impossible de localiser cette adresse",
          variant: "destructive"
        });
      }
    } catch (error) {
      setLocationError("Erreur lors de la recherche de l'adresse");
      toast({
        title: "Erreur",
        description: "Impossible de géocoder l'adresse",
        variant: "destructive"
      });
    } finally {
      setIsSearchingAddress(false);
      setShowSuggestions(false);
    }
  };

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
          timeout: 15000, // Augmenté à 15 secondes
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      setLocation({ lat: latitude, lng: longitude });

      // Optionnel: obtenir l'adresse via reverse geocoding
      try {
        const address = await reverseGeocode(latitude, longitude);
        if (address) {
          setLocation(prev => prev ? { ...prev, address } : null);
          setAddressInput(address);
        }
      } catch {
        // Ignore l'erreur de reverse geocoding
      }

      toast({
        title: "Position enregistrée",
        description: "Votre localisation a été récupérée avec succès",
      });
    } catch (error: unknown) {
      const geoError = error as GeolocationPositionError;
      let errorMessage = "";

      if (geoError.code === 1) {
        errorMessage = "Permission refusée. Veuillez autoriser la géolocalisation.";
      } else if (geoError.code === 2) {
        errorMessage = "Position indisponible. Vérifiez votre connexion et le GPS de votre appareil.";
      } else if (geoError.code === 3) {
        errorMessage = "Délai d'attente dépassé. Veuillez réessayer.";
      } else {
        errorMessage = geoError.message || "Erreur lors de la récupération de la position.";
      }

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

  const handleSaveLocation = async () => {
    if (!location) return;

    try {
      await saveProfile({
        latitude: location.lat,
        longitude: location.lng,
        address: location.address,
        locationAsked: true,
      });
      setIsOpen(false);
      toast({
        title: "Localisation enregistrée",
        description: "Merci ! Votre établissement apparaîtra sur la carte.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la localisation",
        variant: "destructive"
      });
    }
  };


  if (!profile) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) void handleSkipLocation(); }}>
      <DialogContent className="w-[95vw] max-w-[500px] mx-auto max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header avec illustration */}
        <div className="relative bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 p-6 sm:p-8 text-white">
          <div className="absolute top-4 right-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Map className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
          </div>
          <DialogHeader className="relative z-10">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-white pr-16 sm:pr-20">
              Ajoutez votre localisation
            </DialogTitle>
            <DialogDescription className="text-blue-100 text-sm sm:text-base mt-2">
              Apparaissez sur la carte et soyez facilement trouvé par vos clients
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Contenu */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Carte des bénéfices */}
          <Card className="border-blue-100 bg-blue-50/50">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500 flex items-center justify-center">
                  <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-blue-900 text-sm sm:text-base mb-1">Pourquoi partager votre position ?</h4>
                  <p className="text-blue-700 text-xs sm:text-sm leading-relaxed">
                    Votre établissement apparaîtra sur une carte interactive, permettant à vos clients de vous trouver facilement près d'eux.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Option 1: Saisie manuelle d'adresse */}
          <div className="space-y-2">
            <Label htmlFor="address-dialog" className="text-base font-semibold">
              Adresse de l'établissement
            </Label>
            <div className="relative">
              <Input
                id="address-dialog"
                type="text"
                placeholder="Ex: Avenue de l'Indépendance, Libreville, Gabon"
                value={addressInput}
                onChange={(e) => handleAddressInputChange(e.target.value)}
                onFocus={() => addressInput.length >= 3 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="h-12 text-base pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleGeocodeAddress}
                disabled={isSearchingAddress || !addressInput.trim() || addressInput.trim().length < 3}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10"
              >
                <Search className={`h-4 w-4 ${isSearchingAddress ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            {/* Suggestions d'adresses */}
            {showSuggestions && addressSuggestions.length > 0 && (
              <div className="border rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto z-10">
                {addressSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectAddress(suggestion)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b last:border-b-0 text-sm"
                  >
                    <MapPin className="inline-block w-4 h-4 mr-2 text-gray-400" />
                    {suggestion.display_name}
                  </button>
                ))}
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Saisissez l'adresse complète de votre établissement. Des suggestions apparaîtront automatiquement.
            </p>
          </div>

          {/* Séparateur OU */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Ou</span>
            </div>
          </div>

          {/* Option 2: Géolocalisation automatique */}
          <Button
            type="button"
            onClick={() => {
              // Réinitialiser l'erreur et les suggestions avant de demander la position
              setLocationError(null);
              setShowSuggestions(false);
              getCurrentLocation();
            }}
            disabled={isGettingLocation}
            size="lg"
            variant="outline"
            className="w-full h-14"
          >
            {isGettingLocation ? (
              <>
                <Navigation className="w-5 h-5 mr-2 animate-spin" />
                <span className="hidden sm:inline">Récupération de la position...</span>
                <span className="sm:hidden">Récupération...</span>
              </>
            ) : (
              <>
                <Navigation className="w-5 h-5 mr-2" />
                <span className="hidden sm:inline">Utiliser ma position GPS</span>
                <span className="sm:hidden">GPS</span>
              </>
            )}
          </Button>

          {/* Message d'erreur */}
          {locationError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <p className="text-sm sm:text-base text-red-800">
                  {locationError}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Position détectée */}
          {location && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-semibold text-green-900 mb-2">✓ Position détectée avec succès</p>
                    {location.address ? (
                      <p className="text-sm text-green-700 line-clamp-3 break-words">{location.address}</p>
                    ) : (
                      <p className="text-sm text-green-700">Votre position a été enregistrée</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {location ? (
              <Button
                onClick={handleSaveLocation}
                size="lg"
                className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-base font-semibold shadow-lg"
              >
                Enregistrer ma position
              </Button>
            ) : (
              <div className="w-full text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Saisissez votre adresse ou utilisez la géolocalisation GPS
                </p>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="h-12 text-muted-foreground"
              onClick={() => void handleSkipLocation()}
            >
              Plus tard
            </Button>
          </div>

          {/* Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-blue-800 text-center">
              💡 Vous pouvez saisir votre adresse manuellement ou utiliser la géolocalisation GPS. Vous pourrez modifier votre position plus tard dans les paramètres.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationRequestDialog;