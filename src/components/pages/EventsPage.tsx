import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useEvents, Event } from "@/contexts/EventContext";
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
  Copy
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { eventTicketsColRef } from "@/lib/collections";
import { onSnapshot, orderBy, query, addDoc } from "firebase/firestore";
import type { TicketDoc } from "@/types/event";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { generateEventTicket } from "@/utils/ticketGenerator";

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
  const { user } = useAuth();
  const { events, addEvent, deleteEvent: removeEvent } = useEvents();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

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
    organizerWhatsapp: ""
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
    } satisfies NewEventPayload;

    try {
      await addEvent(data);
      setNewEvent({ title: "", description: "", date: "", time: "", location: "", maxCapacity: "", ticketPrice: "", currency: "XAF", imageUrl: "", organizerWhatsapp: "" });
      setSelectedImage(null);
      setImagePreview(null);
      setIsCreateModalOpen(false);
      toast({ title: "Événement créé", description: `${data.title} a été créé avec succès` });
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

  const totalRevenue = events.reduce((total, event) => {
    return total + (event.ticketsSold * event.ticketPrice);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Événements</p>
                <p className="text-2xl font-bold">{events.length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <Calendar size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Billets Vendus</p>
                <p className="text-2xl font-bold">{events.reduce((total, e) => total + e.ticketsSold, 0)}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <Ticket size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenus</p>
                <p className="text-2xl font-bold">{totalRevenue.toLocaleString()} XAF</p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <Users size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Événements Actifs</p>
                <p className="text-2xl font-bold text-green-600">{events.filter(e => e.isActive).length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar size={24} className="text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Gestion des Événements</CardTitle>
              <CardDescription>Créez et gérez vos événements avec vente de billets</CardDescription>
            </div>
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary text-white shadow-button hover:shadow-elegant">
                  <Plus className="mr-2" size={18} />
                  Créer un événement
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Créer un nouvel événement</DialogTitle>
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
                      onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                      placeholder="Ex: Soirée Jazz"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
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
                        onChange={(e) => setNewEvent({...newEvent, imageUrl: e.target.value})}
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
                      onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Heure *</Label>
                    <Input
                      id="time"
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="location">Lieu</Label>
                    <Input
                      id="location"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                      placeholder="Restaurant NACK - Salle principale"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="organizerWhatsapp">Numéro WhatsApp (organisateur)</Label>
                    <Input
                      id="organizerWhatsapp"
                      value={newEvent.organizerWhatsapp}
                      onChange={(e) => setNewEvent({...newEvent, organizerWhatsapp: e.target.value})}
                      placeholder="Ex: +241 6XX XX XX XX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacité maximale</Label>
                    <Input
                      id="capacity"
                      type="number"
                      value={newEvent.maxCapacity}
                      onChange={(e) => setNewEvent({...newEvent, maxCapacity: e.target.value})}
                      placeholder="50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Prix du billet (XAF) *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={newEvent.ticketPrice}
                      onChange={(e) => setNewEvent({...newEvent, ticketPrice: e.target.value})}
                      placeholder="15000"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} className="w-full sm:w-auto">
                    Annuler
                  </Button>
                  <Button onClick={handleCreateEvent} className="bg-gradient-primary text-white w-full sm:w-auto">
                    Créer l'événement
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Events List */}
          <div className="space-y-4">
            {events.map((event) => (
              <Card key={event.id} className="border-l-4 border-l-nack-red">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-semibold">{event.title}</h3>
                        <Badge variant={event.isActive ? "default" : "secondary"}>
                          {event.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mb-3">{event.description}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className="text-nack-red" />
                          <span>{new Date(event.date).toLocaleDateString('fr-FR')} à {event.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={16} className="text-nack-red" />
                          <span>{event.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Ticket size={16} className="text-nack-red" />
                          <span>{event.ticketsSold}/{event.maxCapacity} billets</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-nack-red" />
                          <span>{event.ticketPrice.toLocaleString()} {event.currency}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReserveDialogEvent(event)}
                        className="flex items-center gap-2"
                      >
                        <Ticket size={16} />
                        Nouvelle réservation
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyLink(event.shareableLink)}
                        className="flex items-center gap-2"
                      >
                        <Copy size={16} />
                        Copier le lien
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(event.shareableLink, '_blank')}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink size={16} />
                        Voir la page
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedEvent(event)}
                        className="flex items-center gap-2"
                      >
                        <Ticket size={16} />
                        Billets
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEvent(event.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {events.length === 0 && (
              <div className="text-center py-12">
                <Calendar size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun événement</h3>
                <p className="text-muted-foreground mb-4">
                  Commencez par créer votre premier événement avec vente de billets
                </p>
                <Button onClick={() => setIsCreateModalOpen(true)} className="bg-gradient-primary text-white">
                  <Plus className="mr-2" size={18} />
                  Créer un événement
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tickets Modal */}
      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Billets vendus - {selectedEvent.title}</DialogTitle>
              <DialogDescription>
                Gérez les billets vendus pour cet événement
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-nack-red">{selectedEvent.ticketsSold}</p>
                    <p className="text-sm text-muted-foreground">Billets vendus</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{selectedEvent.maxCapacity - selectedEvent.ticketsSold}</p>
                    <p className="text-sm text-muted-foreground">Places restantes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{(selectedEvent.ticketsSold * selectedEvent.ticketPrice).toLocaleString()} XAF</p>
                    <p className="text-sm text-muted-foreground">Revenus</p>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-4 font-semibold">Client</th>
                        <th className="text-left p-4 font-semibold">Email</th>
                        <th className="text-left p-4 font-semibold">Quantité</th>
                        <th className="text-left p-4 font-semibold">Montant</th>
                        <th className="text-left p-4 font-semibold">Date</th>
                        <th className="text-left p-4 font-semibold">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getEventTickets(selectedEvent.id).map((ticket) => (
                        <tr key={ticket.id} className="border-t border-border hover:bg-muted/50">
                          <td className="p-4 font-medium">{ticket.customerName}</td>
                          <td className="p-4 text-muted-foreground">{ticket.customerEmail}</td>
                          <td className="p-4">{ticket.quantity}</td>
                          <td className="p-4 font-semibold">{ticket.totalAmount.toLocaleString()} XAF</td>
                          <td className="p-4">{ticket.purchaseDate.toLocaleDateString('fr-FR')}</td>
                          <td className="p-4">
                            <Badge variant={ticket.status === 'paid' ? 'default' : ticket.status === 'pending' ? 'secondary' : 'destructive'}>
                              {ticket.status === 'paid' ? 'Payé' : ticket.status === 'pending' ? 'En attente' : 'Annulé'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {tickets.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-muted-foreground">Aucun billet pour le moment</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Réservation (gérant) */}
      {reserveDialogEvent && (
        <Dialog open={!!reserveDialogEvent} onOpenChange={() => setReserveDialogEvent(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvelle réservation - {reserveDialogEvent.title}</DialogTitle>
              <DialogDescription>Enregistrez un participant et générez son ticket</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="resv-name">Nom complet *</Label>
                <Input id="resv-name" value={reserveForm.name} onChange={(e) => setReserveForm({ ...reserveForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="resv-email">Email *</Label>
                <Input id="resv-email" value={reserveForm.email} onChange={(e) => setReserveForm({ ...reserveForm, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="resv-phone">WhatsApp *</Label>
                <Input id="resv-phone" value={reserveForm.phone} onChange={(e) => setReserveForm({ ...reserveForm, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="resv-qty">Quantité</Label>
                <Input id="resv-qty" type="number" min="1" value={reserveForm.quantity} onChange={(e) => setReserveForm({ ...reserveForm, quantity: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setReserveDialogEvent(null)}>Annuler</Button>
              <Button onClick={saveReservationAndGenerate} className="bg-gradient-primary text-white">Enregistrer et générer</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default EventsPage;