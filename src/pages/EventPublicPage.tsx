import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useEvents, Event } from "@/contexts/EventContext";
import NackLogo from "@/components/NackLogo";
import EventPopup from "@/components/EventPopup";
import { db } from "@/lib/firebase";
import { collectionGroup, getDocs, limit, query, where } from "firebase/firestore";

const EventPublicPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { toast } = useToast();
  const { getEventById } = useEvents();
  const [event, setEvent] = useState<Event | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Récupération de l'événement depuis le contexte puis fallback Firestore public
  useEffect(() => {
    (async () => {
      if (!eventId) { setLoading(false); return; }
      const foundEvent = getEventById(eventId);
      if (foundEvent) {
        setEvent(foundEvent);
        setLoading(false);
        setIsPopupOpen(true);
        return;
      }
      try {
        const cg = collectionGroup(db, 'events');
        const q = query(cg, where('eventId', '==', eventId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          const data = d.data();
          const e: Event = {
            id: d.id,
            title: data.title,
            description: data.description,
            date: data.date,
            time: data.time,
            location: data.location,
            maxCapacity: data.maxCapacity,
            ticketPrice: data.ticketPrice,
            currency: data.currency,
            createdAt: new Date(data.createdAt),
            isActive: data.isActive,
            ticketsSold: data.ticketsSold ?? 0,
            shareableLink: data.shareableLink ?? `${window.location.origin}/event/${d.id}`,
            imageUrl: data.imageUrl,
            ownerUid: data.ownerUid,
            organizerWhatsapp: data.organizerWhatsapp,
          };
          setEvent(e);
          setIsPopupOpen(true);
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId, getEventById]);

  const handleClosePopup = () => {
    // Fermer la page et revenir en arrière
    window.history.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
        <div className="text-center">
          <NackLogo size="lg" />
          <p className="mt-4 text-muted-foreground animate-pulse">Chargement de l'événement...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <NackLogo size="lg" />
          <h1 className="text-2xl font-bold mb-4 mt-6">Événement introuvable</h1>
          <p className="text-muted-foreground">Cet événement n'existe pas ou n'est plus disponible.</p>
        </div>
      </div>
    );
  }

  const availableTickets = event.maxCapacity - event.ticketsSold;
  const isEventPassed = new Date(event.date) < new Date();
  const isSoldOut = availableTickets <= 0;

  const handleBuyTickets = () => {
    setIsPopupOpen(true);
  };

  // Lien WhatsApp direct vers l'organisateur
  const organizerPhone = (event.organizerWhatsapp || '').replace(/\D/g, '');
  const shortDesc = (event.description || '').trim().slice(0, 200);
  const wText = `Bonjour, je souhaite réserver des billets pour:\n• ${event.title}\n• Quand: ${new Date(event.date).toLocaleDateString('fr-FR')} ${event.time}\n• Où: ${event.location}\n${shortDesc ? '• Infos: ' + shortDesc + '\n' : ''}• Quantité souhaitée: 1\n• Tarif: ${Number(event.ticketPrice || 0).toLocaleString()} ${event.currency} / billet`;
  const whatsappHref = organizerPhone ? `https://wa.me/${encodeURIComponent(organizerPhone)}?text=${encodeURIComponent(wText)}` : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Afficher le contenu seulement si le popup n'est pas ouvert */}
      {!isPopupOpen && (
        <>
          {/* Header with logo */}
          <div className="container mx-auto px-4 py-6">
            <div className="flex justify-center mb-8">
              <NackLogo size="lg" />
            </div>

            {/* Event Details Card */}
            <div className="max-w-4xl mx-auto">
              <div className="bg-card rounded-3xl shadow-elegant overflow-hidden border border-border/50">
                {/* Event Image */}
                {event.imageUrl && (
                  <div className="relative h-64 md:h-80 overflow-hidden">
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    
                    {/* Event Status Badge */}
                    <div className="absolute top-4 right-4">
                      {isEventPassed ? (
                        <div className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm font-medium">
                          Événement passé
                        </div>
                      ) : isSoldOut ? (
                        <div className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm font-medium">
                          Complet
                        </div>
                      ) : (
                        <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                          Billets disponibles
                        </div>
                      )}
                    </div>

                    {/* Event Title Overlay */}
                    <div className="absolute bottom-4 left-4 right-4">
                      <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
                        {event.title}
                      </h1>
                    </div>
                  </div>
                )}

                {/* Event Content */}
                <div className="p-6 md:p-8">
                  {/* Event Info Grid */}
                  <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {/* Left Column - Event Details */}
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-lg font-semibold mb-3 text-primary">Description</h2>
                        <p className="text-muted-foreground leading-relaxed">
                          {event.description}
                        </p>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-2 text-primary">Informations importantes</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          <li>• Présentation d'une pièce d'identité requise</li>
                          <li>• Billet non remboursable</li>
                          <li>• Ouverture des portes 30 minutes avant l'événement</li>
                        </ul>
                      </div>
                    </div>

                    {/* Right Column - Event Info */}
                    <div className="space-y-4">
                      <div className="bg-nack-beige-light rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            📅
                          </div>
                          <div>
                            <p className="font-medium">Date</p>
                            <p className="text-muted-foreground">
                              {new Date(event.date).toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            🕒
                          </div>
                          <div>
                            <p className="font-medium">Heure</p>
                            <p className="text-muted-foreground">{event.time}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            📍
                          </div>
                          <div>
                            <p className="font-medium">Lieu</p>
                            <p className="text-muted-foreground">{event.location}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            🎫
                          </div>
                          <div>
                            <p className="font-medium">Disponibilité</p>
                            <p className="text-muted-foreground">
                              {availableTickets} / {event.maxCapacity} places disponibles
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Contact Organizer via WhatsApp - direct */}
                      <div className="bg-gradient-primary rounded-2xl p-6 text-center">
                        <div className="text-white mb-4">
                          <p className="text-lg font-semibold">Contact</p>
                          <p className="text-3xl font-bold">WhatsApp Organisateur</p>
                        </div>
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noreferrer"
                          className={`w-full inline-block px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg hover:scale-105 ${whatsappHref ? 'bg-white text-primary hover:bg-white/90' : 'bg-white/50 text-white/60 cursor-not-allowed'}`}
                          aria-disabled={!whatsappHref}
                        >
                          {whatsappHref ? 'Réserver via WhatsApp' : 'WhatsApp non disponible'}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Payment/Contact Dialog - Always render when event exists */}
      {event && (
        <EventPopup
          event={event}
          isOpen={isPopupOpen}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
};

export default EventPublicPage;
