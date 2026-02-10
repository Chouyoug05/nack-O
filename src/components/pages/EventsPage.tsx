import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useEvents, Event } from "@/contexts/EventContext";
import { canCreateEvent, getCurrentEventsCount } from "@/utils/subscription";
import {
  Calendar,
  Plus,
  MapPin,
  Clock,
  Users,
  Share2,
  Ticket,
  Edit,
  Trash2,
  ExternalLink,
  Copy,
  Mic,
  Music,
  DollarSign,
  Settings,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { eventTicketsColRef } from "@/lib/collections";
import { onSnapshot, orderBy, query, addDoc, doc, updateDoc } from "firebase/firestore";
import type { TicketDoc } from "@/types/event";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { generateEventTicket } from "@/utils/ticketGenerator";
import { createSubscriptionPaymentLink } from "@/lib/payments/singpay";

type NewEventPayload = {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  maxCapacity: number;
  ticketPrice: number;
  currency: string;
  isActive: boolean;
  imageUrl?: string;
  ticketsSold?: number;
  organizerWhatsapp?: string;
  paymentEnabled?: boolean;
};

interface Ticket {
  id: string;
  eventId: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
  totalAmount: number;
  purchaseDate: Date;
  status: 'paid' | 'pending' | 'cancelled';
}

const EventsPage = () => {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { events, addEvent, updateEvent, deleteEvent: removeEvent } = useEvents();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [activeTab, setActiveTab] = useState<'participants' | 'finance'>('participants');

  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    if (!user || !selectedEvent) { setTickets([]); return; }
    const q = query(eventTicketsColRef(db, user.uid, selectedEvent.id), orderBy('purchaseDate', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Ticket[] = snap.docs.map(d => {
        const t = d.data() as TicketDoc;
        return {
          id: d.id,
          eventId: selectedEvent.id,
          customerName: t.customerName,
          customerEmail: t.customerEmail,
          quantity: t.quantity,
          totalAmount: t.totalAmount,
          status: t.status,
          purchaseDate: new Date(t.purchaseDate),
        };
      });
      setTickets(list);
    });
    return () => unsub();
  }, [user, selectedEvent]);

  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    maxCapacity: "",
    ticketPrice: "",
    currency: "XAF",
    imageUrl: "",
    organizerWhatsapp: "",
    paymentEnabled: false
  });

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time || !newEvent.ticketPrice) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }

    // Vérifier les permissions d'abonnement
    if (!isEditingEvent) {
      const eventCheck = canCreateEvent(profile);
      if (!eventCheck.allowed) {
        toast({
          title: "Événement non disponible",
          description: eventCheck.reason || "Vous n'avez pas accès à cette fonctionnalité",
          variant: "destructive"
        });
        return;
      }

      // Si paiement nécessaire pour événement supplémentaire
      if (eventCheck.needsPayment && eventCheck.extraPrice) {
        const confirm = window.confirm(
          `Vous avez atteint la limite d'événements inclus. Cet événement supplémentaire coûtera ${eventCheck.extraPrice.toLocaleString()} XAF. Continuer ?`
        );
        if (!confirm) return;

        // Créer un lien de paiement pour l'événement supplémentaire
        try {
          if (!user) {
            toast({ title: "Erreur", description: "Vous devez être connecté", variant: "destructive" });
            return;
          }

          // Sauvegarder les données de l'événement dans sessionStorage pour les récupérer après paiement
          const eventData = {
            title: newEvent.title,
            description: newEvent.description,
            date: newEvent.date,
            time: newEvent.time,
            location: newEvent.location || "Restaurant NACK",
            maxCapacity: Number(newEvent.maxCapacity) || 50,
            ticketPrice: Number(newEvent.ticketPrice),
            currency: newEvent.currency,
            imageUrl: newEvent.imageUrl,
            organizerWhatsapp: newEvent.organizerWhatsapp,
            selectedImageBase64: imagePreview, // Sauvegarder l'image en base64 temporairement
          };
          sessionStorage.setItem('pendingEventData', JSON.stringify(eventData));

          // Créer un ID unique pour cette transaction
          const transactionId = `EVT-${user.uid}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const now = Date.now();

          const base = (
            (import.meta.env.VITE_PUBLIC_BASE_URL as string)
            || window.location.origin
          ).replace(/\/+$/, '');

          const reference = 'evenement-supplementaire';
          const redirectSuccess = `${base}/payment/success?reference=${reference}&transactionId=${transactionId}&type=event`;
          const redirectError = `${base}/payment/error?transactionId=${transactionId}&type=event`;
          const logoURL = `${base}/favicon.png`;

          // Enregistrer la transaction en attente
          try {
            const { paymentsColRef } = await import('@/lib/collections');
            const { db } = await import('@/lib/firebase');
            const { addDoc } = await import('firebase/firestore');
            const paymentsRef = paymentsColRef(db, user.uid);

            await addDoc(paymentsRef, {
              userId: user.uid,
              transactionId,
              subscriptionType: 'event-extra',
              amount: eventCheck.extraPrice,
              status: 'pending',
              paymentMethod: 'airtel-money',
              reference,
              paymentLink: '', // Sera rempli après génération
              redirectSuccess,
              redirectError,
              createdAt: now,
            });
          } catch (error) {
            console.error('Erreur enregistrement transaction pending:', error);
          }

          // Générer le lien de paiement
          const link = await createSubscriptionPaymentLink({
            amount: eventCheck.extraPrice,
            reference: `${reference}-${transactionId.substring(0, 8)}`,
            redirectSuccess,
            redirectError,
            logoURL,
            isTransfer: false,
          });

          // Mettre à jour la transaction avec le lien généré
          try {
            const { paymentsColRef } = await import('@/lib/collections');
            const { db } = await import('@/lib/firebase');
            const { query, where, getDocs, updateDoc, doc } = await import('firebase/firestore');
            const paymentsRef = paymentsColRef(db, user.uid);
            const q = query(paymentsRef, where('transactionId', '==', transactionId));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              await updateDoc(doc(paymentsRef, snapshot.docs[0].id), { paymentLink: link });
            }
          } catch (error) {
            console.error('Erreur mise à jour lien paiement:', error);
          }

          toast({
            title: "Redirection vers le paiement",
            description: "Vous allez être redirigé pour effectuer le paiement"
          });

          // Rediriger vers le paiement
          window.location.href = link;
          return; // Ne pas continuer avec la création de l'événement
        } catch (error) {
          console.error('Erreur création lien paiement:', error);
          toast({
            title: "Paiement indisponible",
            description: "Impossible de créer le lien de paiement. Réessayez dans quelques instants.",
            variant: "destructive"
          });
          return;
        }
      }
    }

    let finalImageUrl = newEvent.imageUrl;
    try {
      if (selectedImage) {
        finalImageUrl = await uploadImageToCloudinary(selectedImage, "events");
      }
    } catch (e: unknown) {
      toast({ title: "Upload image échoué", description: e instanceof Error ? e.message : "Réessayez.", variant: "destructive" });
      return;
    }

    const data = {
      title: newEvent.title,
      description: newEvent.description,
      date: newEvent.date,
      time: newEvent.time,
      location: newEvent.location || "Restaurant NACK",
      maxCapacity: Number(newEvent.maxCapacity) || 50,
      ticketPrice: Number(newEvent.ticketPrice),
      currency: newEvent.currency,
      isActive: true,
      imageUrl: finalImageUrl || undefined,
      organizerWhatsapp: newEvent.organizerWhatsapp || undefined,
      paymentEnabled: newEvent.paymentEnabled || false,
    } satisfies NewEventPayload;

    try {
      if (isEditingEvent && selectedEvent) {
        await updateEvent(selectedEvent.id, {
          title: data.title,
          description: data.description,
          date: data.date,
          time: data.time,
          location: data.location,
          maxCapacity: data.maxCapacity,
          ticketPrice: data.ticketPrice,
          currency: data.currency,
          imageUrl: data.imageUrl,
          organizerWhatsapp: data.organizerWhatsapp,
          paymentEnabled: data.paymentEnabled,
        });
        toast({ title: "Événement modifié", description: `${data.title} a été mis à jour avec succès` });
      } else {
        await addEvent(data);

        // Mettre à jour le compteur d'événements dans le profil
        if (user && profile) {
          const currentCount = getCurrentEventsCount(profile);
          const eventsResetAt = profile.eventsResetAt ?? profile.subscriptionEndsAt ?? Date.now();
          const now = Date.now();

          // Si on est dans une nouvelle période, réinitialiser
          let newCount = 1;
          let newEventsResetAt = eventsResetAt;

          if (eventsResetAt && now > eventsResetAt) {
            // Nouvelle période
            const oneMonth = 30 * 24 * 60 * 60 * 1000;
            newEventsResetAt = now + oneMonth;
            newCount = 1;
          } else {
            // Même période, incrémenter
            newCount = currentCount + 1;
          }

          try {
            await updateDoc(doc(db, 'profiles', user.uid), {
              eventsCount: newCount,
              eventsResetAt: newEventsResetAt,
              updatedAt: Date.now(),
            });
          } catch (e) {
            console.error('Erreur mise à jour compteur événements:', e);
          }
        }

        toast({ title: "Événement créé", description: `${data.title} a été créé avec succès` });
      }
      setNewEvent({ title: "", description: "", date: "", time: "", location: "", maxCapacity: "", ticketPrice: "", currency: "XAF", imageUrl: "", organizerWhatsapp: "", paymentEnabled: false });
      setSelectedImage(null);
      setImagePreview(null);
      setIsCreateModalOpen(false);
      setIsEditingEvent(false);
      setSelectedEvent(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Réessayez.";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Lien copié", description: "Le lien de partage a été copié dans le presse-papiers" });
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await removeEvent(id);
      toast({ title: "Événement supprimé", description: "L'événement a été supprimé avec succès" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Réessayez.";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    }
  };

  const getEventTickets = (eventId: string) => {
    return tickets.filter(t => t.eventId === eventId);
  };

  const [reserveDialogEvent, setReserveDialogEvent] = useState<Event | null>(null);
  const [reserveForm, setReserveForm] = useState({ name: "", email: "", phone: "", quantity: 1 });

  const saveReservationAndGenerate = async () => {
    if (!user || !reserveDialogEvent) return;
    if (!reserveForm.name || !reserveForm.email || !reserveForm.phone || reserveForm.quantity < 1) {
      toast({ title: "Champs manquants", description: "Nom, email, WhatsApp et quantité requis", variant: "destructive" });
      return;
    }
    const ticket: TicketDoc = {
      customerName: reserveForm.name,
      customerEmail: reserveForm.email,
      customerPhone: reserveForm.phone,
      quantity: reserveForm.quantity,
      totalAmount: reserveDialogEvent.ticketPrice * reserveForm.quantity,
      status: 'pending',
      purchaseDate: Date.now(),
    };
    await addDoc(eventTicketsColRef(db, user.uid, reserveDialogEvent.id), ticket);
    await generateEventTicket({
      id: `TKT-${Date.now()}`,
      eventTitle: reserveDialogEvent.title,
      eventDate: reserveDialogEvent.date,
      eventTime: reserveDialogEvent.time,
      eventLocation: reserveDialogEvent.location,
      customerName: reserveForm.name,
      customerEmail: reserveForm.email,
      customerPhone: reserveForm.phone,
      quantity: reserveForm.quantity,
      totalAmount: reserveDialogEvent.ticketPrice * reserveForm.quantity,
      currency: reserveDialogEvent.currency,
      qrCode: `NACK-${reserveDialogEvent.id}-${reserveForm.email}-${Date.now()}`
    });
    toast({ title: "Réservation enregistrée", description: "Ticket généré avec succès" });
    setReserveDialogEvent(null);
    setReserveForm({ name: "", email: "", phone: "", quantity: 1 });
  };

  // --- Manager authentication (PIN) logic copied from StockPage ---
  const [isManagerAuthOpen, setIsManagerAuthOpen] = useState(false);
  const [managerCode, setManagerCode] = useState("");
  const [isAuthChecking, setIsAuthChecking] = useState(false);
  const [postAuthActionRefState] = useState<null | (() => void)>(null);
  const postAuthActionRef = { current: postAuthActionRefState as undefined | (() => void) } as { current: undefined | (() => void) };
  const [authValidUntil, setAuthValidUntil] = useState<number>(() => {
    try {
      const raw = sessionStorage.getItem('nack_manager_auth_until');
      return raw ? Number(raw) : 0;
    } catch { return 0; }
  });

  const rememberAuthWindow = (ms: number) => {
    const until = Date.now() + ms;
    setAuthValidUntil(until);
    try { sessionStorage.setItem('nack_manager_auth_until', String(until)); } catch { /* ignore */ }
  };

  const requireManagerAuth = (action: () => void) => {
    if (!profile?.managerPinHash) { action(); return; }
    if (Date.now() < authValidUntil) { action(); return; }
    postAuthActionRef.current = action;
    setManagerCode("");
    setIsManagerAuthOpen(true);
  };

  const digestSha256Hex = async (text: string): Promise<string> => {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', data);
    const bytes = Array.from(new Uint8Array(buf));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const submitManagerAuth = async () => {
    if (!profile?.managerPinHash) {
      setIsManagerAuthOpen(false);
      const fn = postAuthActionRef.current; postAuthActionRef.current = undefined; if (fn) fn();
      return;
    }
    if (!managerCode) {
      toast({ title: "Code requis", description: "Veuillez saisir votre code gérant.", variant: "destructive" });
      return;
    }
    setIsAuthChecking(true);
    try {
      const hash = await digestSha256Hex(managerCode);
      if (hash !== profile.managerPinHash) throw new Error('bad');
      rememberAuthWindow(10 * 60 * 1000); // 10 minutes
      setIsManagerAuthOpen(false);
      const fn = postAuthActionRef.current; postAuthActionRef.current = undefined; if (fn) fn();
      toast({ title: "Vérification réussie", description: "Action autorisée pendant 10 minutes." });
    } catch {
      toast({ title: "Code incorrect", description: "Le code gérant ne correspond pas.", variant: "destructive" });
    } finally {
      setIsAuthChecking(false);
    }
  };

  const [showPin, setShowPin] = useState(false);


  const totalRevenue = events.reduce((total, event) => {
    return total + (event.ticketsSold * event.ticketPrice);
  }, 0);

  const getEventIcon = (event: Event) => {
    const title = event.title.toLowerCase();
    if (title.includes('karaoké') || title.includes('karaoke') || title.includes('mic')) {
      return { Icon: Mic, color: 'amber' };
    }
    if (title.includes('concert') || title.includes('live') || title.includes('music')) {
      return { Icon: Music, color: 'rose' };
    }
    return { Icon: Calendar, color: 'blue' };
  };

  const formatEventDate = (date: string, time: string) => {
    try {
      const eventDate = new Date(date);
      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const dayName = days[eventDate.getDay()];
      const day = eventDate.getDate();
      const month = months[eventDate.getMonth()];
      const timeStr = time || '';
      return `${dayName} ${day} ${month} - ${timeStr}`;
    } catch {
      return `${date} - ${time}`;
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background">
      {/* Main Content: Event List */}
      <main className="flex-grow p-4 space-y-4">
        {/* Event Cards */}
        {events.map((event) => {
          const { Icon, color } = getEventIcon(event);
          const colorClasses = {
            amber: {
              bg: 'bg-amber-50 dark:bg-amber-900/30',
              iconBg: 'bg-amber-100 dark:bg-amber-800/50',
              iconColor: 'text-amber-600 dark:text-amber-400'
            },
            rose: {
              bg: 'bg-rose-50 dark:bg-rose-900/30',
              iconBg: 'bg-rose-100 dark:bg-rose-800/50',
              iconColor: 'text-rose-600 dark:text-rose-400'
            },
            blue: {
              bg: 'bg-blue-50 dark:bg-blue-900/30',
              iconBg: 'bg-blue-100 dark:bg-blue-800/50',
              iconColor: 'text-blue-600 dark:text-blue-400'
            }
          };
          const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.blue;

          return (
            <div key={event.id} className="flex flex-col items-stretch justify-start rounded-lg bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              {/* Event Header */}
              <div className={`flex items-center gap-4 p-4 ${colors.bg}`}>
                <div className={`flex items-center justify-center size-12 rounded-full ${colors.iconBg}`}>
                  <Icon className={`text-3xl ${colors.iconColor}`} size={32} />
                </div>
                <div className="flex-grow">
                  <h2 className="text-lg font-bold leading-tight tracking-tight text-gray-900 dark:text-white">{event.title}</h2>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <Calendar size={14} />
                    <p>{formatEventDate(event.date, event.time)}</p>
                  </div>
                </div>
              </div>

              {/* Event Actions */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="gap-2 grid-cols-[repeat(auto-fit,_minmax(80px,_1fr))] grid">
                  <button
                    onClick={() => {
                      setSelectedEvent(event);
                      setActiveTab('participants');
                    }}
                    className="flex flex-col items-center gap-2 py-2.5 text-center hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Voir les participants et billets"
                  >
                    <div className="flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 p-2.5">
                      <Users className="text-xl text-gray-700 dark:text-gray-300" size={20} />
                    </div>
                    <p className="text-sm font-medium leading-normal text-gray-800 dark:text-gray-200">Participants</p>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedEvent(event);
                      setActiveTab('finance');
                    }}
                    className="flex flex-col items-center gap-2 py-2.5 text-center hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Voir les finances et revenus"
                  >
                    <div className="flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 p-2.5">
                      <DollarSign className="text-xl text-gray-700 dark:text-gray-300" size={20} />
                    </div>
                    <p className="text-sm font-medium leading-normal text-gray-800 dark:text-gray-200">Finances</p>
                  </button>
                  <button
                    onClick={() => {
                      // Ouvrir le dialog de modification avec les informations de l'événement
                      setNewEvent({
                        title: event.title,
                        description: event.description || "",
                        date: event.date,
                        time: event.time,
                        location: event.location || "",
                        maxCapacity: String(event.maxCapacity),
                        ticketPrice: String(event.ticketPrice),
                        currency: event.currency,
                        imageUrl: event.imageUrl || "",
                        organizerWhatsapp: event.organizerWhatsapp || "",
                        paymentEnabled: event.paymentEnabled || false
                      });
                      if (event.imageUrl) setImagePreview(event.imageUrl);
                      setSelectedEvent(event);
                      setIsEditingEvent(true);
                      setIsCreateModalOpen(true);
                    }}
                    className="flex flex-col items-center gap-2 py-2.5 text-center hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Modifier l'événement"
                  >
                    <div className="flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 p-2.5">
                      <Settings className="text-xl text-gray-700 dark:text-gray-300" size={20} />
                    </div>
                    <p className="text-sm font-medium leading-normal text-gray-800 dark:text-gray-200">Modifier</p>
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'événement "${event.title}" ?\n\nCette action est irréversible.`)) {
                        handleDeleteEvent(event.id);
                      }
                    }}
                    className="flex flex-col items-center gap-2 py-2.5 text-center hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Supprimer l'événement"
                  >
                    <div className="flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50 p-2.5">
                      <Trash2 className="text-xl text-red-600 dark:text-red-400" size={20} />
                    </div>
                    <p className="text-sm font-medium leading-normal text-red-600 dark:text-red-400">Supprimer</p>
                  </button>
                </div>

                {/* Lien de partage */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <Label className="text-xs text-muted-foreground mb-1 block">Lien de partage :</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={event.shareableLink || `${window.location.origin}/event/${event.id}`}
                          readOnly
                          className="text-xs font-mono flex-1 min-w-0 truncate"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyLink(event.shareableLink || `${window.location.origin}/event/${event.id}`)}
                          className="shrink-0"
                        >
                          <Copy size={14} className="mr-1" />
                          Copier
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(event.shareableLink || `${window.location.origin}/event/${event.id}`, '_blank')}
                          className="shrink-0"
                        >
                          <ExternalLink size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <Calendar className="text-6xl text-gray-300 dark:text-gray-600" size={64} />
            <h3 className="mt-4 text-lg font-semibold text-gray-800 dark:text-gray-200">Aucun événement à venir</h3>
            <p className="mt-1 text-gray-500 dark:text-gray-400">Créez-en un pour commencer !</p>
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-20">
        <Dialog open={isCreateModalOpen} onOpenChange={(open) => {
          setIsCreateModalOpen(open);
          if (!open) {
            setIsEditingEvent(false);
            setSelectedEvent(null);
            setNewEvent({ title: "", description: "", date: "", time: "", location: "", maxCapacity: "", ticketPrice: "", currency: "XAF", imageUrl: "", organizerWhatsapp: "", paymentEnabled: false });
            setSelectedImage(null);
            setImagePreview(null);
          }
        }}>
          <DialogTrigger asChild>
            <button
              onClick={() => {
                setIsEditingEvent(false);
                setSelectedEvent(null);
                setNewEvent({ title: "", description: "", date: "", time: "", location: "", maxCapacity: "", ticketPrice: "", currency: "XAF", imageUrl: "", organizerWhatsapp: "", paymentEnabled: false });
                setSelectedImage(null);
                setImagePreview(null);
              }}
              className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-14 bg-gradient-primary text-white text-base font-bold leading-normal shadow-lg transition-transform hover:scale-105 active:scale-95 min-w-0 gap-3 pl-5 pr-6"
            >
              <Plus className="text-2xl" size={24} />
              <span className="truncate">Ajouter un événement</span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditingEvent ? "Modifier l'événement" : "Créer un nouvel événement"}</DialogTitle>
              <DialogDescription>
                Remplissez les informations de votre événement
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Titre de l'événement *</Label>
                <Input
                  id="title"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Ex: Soirée Jazz"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Décrivez votre événement..."
                  rows={3}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="imageUpload">Image de l'événement</Label>
                <div className="space-y-3">
                  <Input
                    id="imageUpload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gradient-secondary file:text-nack-red hover:file:bg-nack-red/10"
                  />
                  {imagePreview && (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Aperçu de l'événement"
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSelectedImage(null);
                          setImagePreview(null);
                        }}
                        className="absolute top-2 right-2"
                      >
                        ×
                      </Button>
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    Ou utilisez une URL d'image :
                  </div>
                  <Input
                    id="imageUrl"
                    value={newEvent.imageUrl}
                    onChange={(e) => setNewEvent({ ...newEvent, imageUrl: e.target.value })}
                    placeholder="https://exemple.com/image-evenement.jpg"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Heure *</Label>
                <Input
                  id="time"
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="location">Lieu</Label>
                <Input
                  id="location"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="Restaurant NACK - Salle principale"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="organizerWhatsapp">Numéro WhatsApp (organisateur)</Label>
                <Input
                  id="organizerWhatsapp"
                  value={newEvent.organizerWhatsapp}
                  onChange={(e) => setNewEvent({ ...newEvent, organizerWhatsapp: e.target.value })}
                  placeholder="Ex: +241 6XX XX XX XX"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30">
                  <Checkbox
                    id="paymentEnabled"
                    checked={newEvent.paymentEnabled}
                    onCheckedChange={(checked) => setNewEvent({ ...newEvent, paymentEnabled: checked === true })}
                  />
                  <Label htmlFor="paymentEnabled" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                    Activer le paiement en ligne (Airtel Money)
                  </Label>
                </div>
                {newEvent.paymentEnabled && (
                  <p className="text-xs text-muted-foreground ml-6">
                    Les clients pourront payer leurs billets directement en ligne. Assurez-vous d'avoir configuré votre Disbursement ID dans les paramètres.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacité maximale</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={newEvent.maxCapacity}
                  onChange={(e) => setNewEvent({ ...newEvent, maxCapacity: e.target.value })}
                  placeholder="50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Prix du billet (XAF) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={newEvent.ticketPrice}
                  onChange={(e) => setNewEvent({ ...newEvent, ticketPrice: e.target.value })}
                  placeholder="15000"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditingEvent(false);
                  setSelectedEvent(null);
                }}
                className="w-full sm:w-auto"
              >
                Annuler
              </Button>
              <Button onClick={handleCreateEvent} className="bg-gradient-primary text-white w-full sm:w-auto">
                {isEditingEvent ? "Enregistrer" : "Créer l'événement"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Participants & Finance Modal with Tabs */}
      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={() => {
          setSelectedEvent(null);
          setActiveTab('participants');
        }}>
          <DialogContent className="max-w-[95vw] sm:max-w-[4xl] h-[90vh] p-0 overflow-hidden flex flex-col" translate="no">
            <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
              <DialogTitle className="text-lg sm:text-xl">{selectedEvent.title}</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Gérez les participants et les finances de cet événement
              </DialogDescription>
            </DialogHeader>

            {/* Tabs */}
            <div className="flex border-b border-border px-4 sm:px-6">
              <button
                onClick={() => setActiveTab('participants')}
                className={`flex-1 sm:flex-none px-4 py-3 text-sm sm:text-base font-medium border-b-2 transition-colors ${activeTab === 'participants'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Users size={16} className="sm:size-5" />
                  <span>Participants</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('finance')}
                className={`flex-1 sm:flex-none px-4 py-3 text-sm sm:text-base font-medium border-b-2 transition-colors ${activeTab === 'finance'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <DollarSign size={16} className="sm:size-5" />
                  <span>Finances</span>
                </div>
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
              {activeTab === 'participants' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    <Card>
                      <CardContent className="p-3 sm:p-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-nack-red">{selectedEvent.ticketsSold}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Billets vendus</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 sm:p-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-green-600">{selectedEvent.maxCapacity - selectedEvent.ticketsSold}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Places restantes</p>
                      </CardContent>
                    </Card>
                    <Card className="col-span-2 sm:col-span-1">
                      <CardContent className="p-3 sm:p-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold">{(selectedEvent.ticketsSold * selectedEvent.ticketPrice).toLocaleString()} XAF</p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Revenus totaux</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold">Liste des participants</h3>
                    <Button
                      size="sm"
                      className="bg-nack-red hover:bg-nack-red/90 text-white gap-2"
                      onClick={() => requireManagerAuth(() => setReserveDialogEvent(selectedEvent))}
                    >
                      <Plus size={16} />
                      Ajouter un participant
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2 sm:p-4 text-xs sm:text-sm font-semibold">Client</th>
                            <th className="text-left p-2 sm:p-4 text-xs sm:text-sm font-semibold hidden sm:table-cell">Email</th>
                            <th className="text-left p-2 sm:p-4 text-xs sm:text-sm font-semibold">Qté</th>
                            <th className="text-left p-2 sm:p-4 text-xs sm:text-sm font-semibold">Montant</th>
                            <th className="text-left p-2 sm:p-4 text-xs sm:text-sm font-semibold hidden md:table-cell">Date</th>
                            <th className="text-left p-2 sm:p-4 text-xs sm:text-sm font-semibold">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getEventTickets(selectedEvent.id).map((ticket) => (
                            <tr key={ticket.id} className="border-t border-border hover:bg-muted/50">
                              <td className="p-2 sm:p-4 font-medium text-xs sm:text-sm">
                                <div>{ticket.customerName}</div>
                                <div className="text-muted-foreground sm:hidden text-xs mt-1">{ticket.customerEmail}</div>
                              </td>
                              <td className="p-2 sm:p-4 text-muted-foreground text-xs sm:text-sm hidden sm:table-cell">{ticket.customerEmail}</td>
                              <td className="p-2 sm:p-4 text-xs sm:text-sm">{ticket.quantity}</td>
                              <td className="p-2 sm:p-4 font-semibold text-xs sm:text-sm">{ticket.totalAmount.toLocaleString()} XAF</td>
                              <td className="p-2 sm:p-4 text-xs sm:text-sm hidden md:table-cell">{ticket.purchaseDate.toLocaleDateString('fr-FR')}</td>
                              <td className="p-2 sm:p-4">
                                <Badge variant={ticket.status === 'paid' ? 'default' : ticket.status === 'pending' ? 'secondary' : 'destructive'} className="text-xs">
                                  {ticket.status === 'paid' ? 'Payé' : ticket.status === 'pending' ? 'En attente' : 'Annulé'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                          {getEventTickets(selectedEvent.id).length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-4 sm:p-8 text-center text-muted-foreground text-sm sm:text-base">
                                Aucun billet pour le moment
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'finance' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl sm:text-3xl font-bold text-nack-red">{selectedEvent.ticketsSold}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Billets vendus</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl sm:text-3xl font-bold text-green-600">
                          {(selectedEvent.ticketsSold * selectedEvent.ticketPrice).toLocaleString()} XAF
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Revenus totaux</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                          {selectedEvent.ticketPrice.toLocaleString()} XAF
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Prix unitaire</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl sm:text-3xl font-bold text-orange-600">
                          {selectedEvent.maxCapacity - selectedEvent.ticketsSold}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Places restantes</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base sm:text-lg">Détails financiers</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm sm:text-base">Capacité maximale</span>
                        <span className="font-semibold text-sm sm:text-base">{selectedEvent.maxCapacity} places</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm sm:text-base">Taux d'occupation</span>
                        <span className="font-semibold text-sm sm:text-base">
                          {selectedEvent.maxCapacity > 0
                            ? ((selectedEvent.ticketsSold / selectedEvent.maxCapacity) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm sm:text-base">Revenu potentiel maximum</span>
                        <span className="font-semibold text-sm sm:text-base">
                          {(selectedEvent.maxCapacity * selectedEvent.ticketPrice).toLocaleString()} XAF
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm sm:text-base font-bold">Revenu actuel</span>
                        <span className="font-bold text-lg sm:text-xl text-green-600">
                          {(selectedEvent.ticketsSold * selectedEvent.ticketPrice).toLocaleString()} XAF
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Réservation (gérant) */}
      {reserveDialogEvent && (
        <Dialog open={!!reserveDialogEvent} onOpenChange={() => setReserveDialogEvent(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Nouvelle réservation - {reserveDialogEvent.title}</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">Enregistrez un participant et générez son ticket</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="resv-name" className="text-sm sm:text-base">Nom complet *</Label>
                <Input
                  id="resv-name"
                  value={reserveForm.name}
                  onChange={(e) => setReserveForm({ ...reserveForm, name: e.target.value })}
                  className="text-sm sm:text-base"
                />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="resv-email" className="text-sm sm:text-base">Email *</Label>
                <Input
                  id="resv-email"
                  type="email"
                  value={reserveForm.email}
                  onChange={(e) => setReserveForm({ ...reserveForm, email: e.target.value })}
                  className="text-sm sm:text-base"
                />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="resv-phone" className="text-sm sm:text-base">WhatsApp *</Label>
                <Input
                  id="resv-phone"
                  type="tel"
                  value={reserveForm.phone}
                  onChange={(e) => setReserveForm({ ...reserveForm, phone: e.target.value })}
                  className="text-sm sm:text-base"
                />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="resv-qty" className="text-sm sm:text-base">Quantité</Label>
                <Input
                  id="resv-qty"
                  type="number"
                  min="1"
                  value={reserveForm.quantity}
                  onChange={(e) => setReserveForm({ ...reserveForm, quantity: Number(e.target.value) })}
                  className="text-sm sm:text-base"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4 sm:mt-6">
              <Button
                variant="outline"
                onClick={() => setReserveDialogEvent(null)}
                className="w-full sm:w-auto text-sm sm:text-base"
              >
                Annuler
              </Button>
              <Button
                onClick={saveReservationAndGenerate}
                className="bg-gradient-primary text-white w-full sm:w-auto text-sm sm:text-base"
              >
                Enregistrer et générer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Manager Auth Dialog */}
      <Dialog open={isManagerAuthOpen} onOpenChange={setIsManagerAuthOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-nack-red" />
              Code gérant requis
            </DialogTitle>
            <DialogDescription>
              Veuillez saisir votre code de sécurité pour autoriser cette action.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manager-pin">Code de sécurité</Label>
              <div className="relative">
                <Input
                  id="manager-pin"
                  type={showPin ? "text" : "password"}
                  value={managerCode}
                  onChange={(e) => setManagerCode(e.target.value)}
                  placeholder="Saisissez votre code..."
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && submitManagerAuth()}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsManagerAuthOpen(false)} disabled={isAuthChecking}>
              Annuler
            </Button>
            <Button onClick={submitManagerAuth} disabled={isAuthChecking || !managerCode} className="bg-nack-red text-white">
              {isAuthChecking ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Vérification...
                </>
              ) : "Valider"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventsPage;