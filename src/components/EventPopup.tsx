import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Event } from "@/contexts/EventContext";
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  Ticket,
  ShoppingCart,
  CreditCard,
  X
} from "lucide-react";
import NackLogo from "@/components/NackLogo";
import EventPaymentDialog from "@/components/EventPaymentDialog";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface EventPopupProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
}

const EventPopup = ({ event, isOpen, onClose }: EventPopupProps) => {
  const { toast } = useToast();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const { profile } = useAuth();
  const [ownerProfile, setOwnerProfile] = useState<{ disbursementId?: string; disbursementStatus?: string } | null>(null);
  
  // Récupérer le profil du propriétaire pour vérifier le disbursementId
  useEffect(() => {
    const fetchOwnerProfile = async () => {
      if (event.ownerUid) {
        try {
          const profileRef = doc(db, 'profiles', event.ownerUid);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const data = profileSnap.data();
            setOwnerProfile({
              disbursementId: data.disbursementId,
              disbursementStatus: data.disbursementStatus,
            });
          }
        } catch (error) {
          console.error('Erreur récupération profil propriétaire:', error);
        }
      }
    };
    
    if (event.paymentEnabled && event.ownerUid) {
      fetchOwnerProfile();
    }
  }, [event.paymentEnabled, event.ownerUid]);

  const handlePaymentSuccess = (ticketData: { quantity: number; eventName: string; totalPrice: number }) => {
    toast({
      title: "Paiement confirmé !",
      description: `${ticketData.quantity} billet(s) acheté(s) avec succès`,
    });
  };

  const remainingTickets = event.maxCapacity - event.ticketsSold;
  const eventDate = new Date(event.date);
  const isEventPassed = eventDate < new Date();

  const handleWhatsappReserve = () => {
    if (!profile?.phone) return;
    const when = `${eventDate.toLocaleDateString('fr-FR')} ${event.time}`;
    const baseDesc = (event.description || '').trim();
    const shortDesc = baseDesc.length > 200 ? baseDesc.slice(0, 200) + '…' : baseDesc;
    const text = `Bonjour, je souhaite réserver des billets pour:\n` +
      `• ${event.title}\n` +
      `• Quand: ${when}\n` +
      `• Où: ${event.location}\n` +
      (shortDesc ? `• Infos: ${shortDesc}\n` : '') +
      `• Quantité souhaitée: 1\n` +
      `• Tarif: ${event.ticketPrice.toLocaleString()} ${event.currency} / billet`;
    const url = `https://wa.me/${encodeURIComponent(profile.phone.replace(/\D/g, ''))}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <>
      <Dialog open={isOpen && !isPaymentDialogOpen} onOpenChange={(open) => {
        if (!open) onClose();
      }}>
        <DialogContent className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-[101] w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[900px] xl:w-[1100px] max-w-[1100px] max-h-[95vh] overflow-auto p-0 border-0 shadow-2xl bg-transparent">
          {/* Container principal avec design moderne */}
          <div className="bg-gradient-to-br from-nack-beige-light to-nack-cream rounded-3xl overflow-hidden shadow-elegant relative">
            {/* Bouton de fermeture */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <X size={20} className="text-gray-600" />
            </button>

            {/* Layout responsive : mobile stack, desktop side-by-side */}
            <div className="flex flex-col lg:flex-row min-h-[650px]">
              {/* Section gauche - Image avec formes géométriques */}
              <div className="relative lg:w-1/2 h-64 lg:h-auto bg-gradient-to-br from-nack-red/10 to-accent/20 overflow-hidden">
                {/* Formes géométriques en arrière-plan */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/20 rounded-full"></div>
                  <div className="absolute top-20 right-10 w-20 h-20 bg-accent/30 rounded-lg rotate-45"></div>
                  <div className="absolute bottom-10 left-16 w-16 h-16 bg-nack-red/20 rounded-full"></div>
                  <div className="absolute bottom-20 right-20 w-24 h-24 bg-white/15 rounded-lg rotate-12"></div>
                </div>

                {/* Image de l'événement */}
                {event.imageUrl && (
                  <div className="relative z-10 w-full h-full flex items-center justify-center p-8">
                    <div className="relative max-w-xs lg:max-w-sm">
                      <img
                        src={event.imageUrl}
                        alt={event.title}
                        className="w-full h-48 lg:h-64 object-cover rounded-2xl shadow-lg"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl"></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section droite - Contenu */}
              <div className="lg:w-1/2 p-6 lg:p-8 flex flex-col justify-between overflow-y-auto">
                {/* Header */}
                <div className="mb-6">
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3 leading-tight">
                    {event.title}
                  </h1>
                  <p className="text-gray-600 text-sm lg:text-base leading-relaxed mb-4">
                    Réservez votre place pour cet événement exceptionnel au Restaurant NAC.
                  </p>
                </div>

                {/* Informations de l'événement */}
                <div className="space-y-4 mb-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-white/60 rounded-xl">
                      <Calendar className="text-nack-red flex-shrink-0" size={18} />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {eventDate.toLocaleDateString('fr-FR', { 
                            weekday: 'long',
                            day: 'numeric', 
                            month: 'long',
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-white/60 rounded-xl">
                      <Clock className="text-nack-red flex-shrink-0" size={18} />
                      <p className="font-medium text-gray-900 text-sm">{event.time}</p>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-white/60 rounded-xl">
                      <MapPin className="text-nack-red flex-shrink-0" size={18} />
                      <p className="font-medium text-gray-900 text-sm">{event.location}</p>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-white/60 rounded-xl">
                      <Users className="text-nack-red flex-shrink-0" size={18} />
                      <p className="font-medium text-gray-900 text-sm">
                        {remainingTickets} places disponibles sur {event.maxCapacity}
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA WhatsApp uniquement */}
                <div className="mt-auto">
                  <div className="bg-white/80 rounded-2xl p-4 mb-4">
                    <div className="text-center mb-4">
                      <p className="text-sm text-gray-600 mb-1">Contact WhatsApp</p>
                      <p className="text-2xl lg:text-3xl font-bold text-nack-red">
                        Organisateur
                      </p>
                    </div>

                    {remainingTickets > 0 && !isEventPassed && event.isActive ? (
                      <div className="grid grid-cols-1 gap-2">
                        {/* Bouton de paiement en ligne si activé */}
                        {event.paymentEnabled && ownerProfile?.disbursementId && ownerProfile?.disbursementStatus === 'approved' && (
                          <Button
                            onClick={() => {
                              setIsPaymentDialogOpen(true);
                              onClose(); // Fermer le popup principal
                            }}
                            className="w-full bg-gradient-primary text-white shadow-button"
                          >
                            <CreditCard className="mr-2" size={18} />
                            Payer le billet
                          </Button>
                        )}
                        {/* Bouton WhatsApp */}
                        <Button
                          variant="outline"
                          disabled={!profile?.phone}
                          onClick={handleWhatsappReserve}
                          className="w-full"
                        >
                          Réserver via WhatsApp
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-3">
                        <Badge variant="destructive" className="px-4 py-2">
                          {isEventPassed ? "Événement terminé" : 
                           !event.isActive ? "Événement inactif" : 
                           "Complet"}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Logo NAC en bas */}
                  <div className="flex justify-center">
                    <NackLogo size="sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de paiement */}
      <EventPaymentDialog
        event={event}
        isOpen={isPaymentDialogOpen}
        onClose={() => {
          setIsPaymentDialogOpen(false);
          // Si le popup principal était ouvert, on peut le rouvrir si nécessaire
        }}
        onPaymentSuccess={(ticketData) => {
          handlePaymentSuccess(ticketData);
          setIsPaymentDialogOpen(false);
        }}
      />
    </>
  );
};

export default EventPopup;
