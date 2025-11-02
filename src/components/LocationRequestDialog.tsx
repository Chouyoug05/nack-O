import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Map, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const LocationRequestDialog = () => {
  const { profile, saveProfile } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);

  useEffect(() => {
    // Afficher le dialog si le profil existe mais n'a pas de géolocalisation et qu'on ne l'a pas encore demandé
    if (profile && !profile.locationAsked && (!profile.latitude || !profile.longitude)) {
      setIsOpen(true);
    }
  }, [profile]);

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
      setLocation({ lat: latitude, lng: longitude });

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
        const address = data.display_name || undefined;
        setLocation(prev => prev ? { ...prev, address } : null);
      } catch {
        // Ignore l'erreur de reverse geocoding
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
    <Dialog open={isOpen} onOpenChange={() => {}}>
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

          {/* Bouton de géolocalisation */}
          <Button
            type="button"
            onClick={getCurrentLocation}
            disabled={isGettingLocation}
            size="lg"
            className="w-full h-14 sm:h-16 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            {isGettingLocation ? (
              <>
                <Navigation className="w-5 h-5 sm:w-6 sm:h-6 mr-2 animate-spin" />
                <span className="hidden sm:inline">Récupération de la position...</span>
                <span className="sm:hidden">Récupération...</span>
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                <span className="hidden sm:inline">Obtenir ma position automatiquement</span>
                <span className="sm:hidden">Ma position</span>
              </>
            )}
          </Button>

          {/* Message d'erreur */}
          {locationError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <p className="text-sm sm:text-base text-red-800">{locationError}</p>
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
                  La géolocalisation est obligatoire pour continuer
                </p>
              </div>
            )}
          </div>

          {/* Note */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-amber-800 text-center">
              ⚠️ La géolocalisation est obligatoire pour utiliser Nack. Vous pourrez modifier votre position plus tard dans les paramètres.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationRequestDialog;