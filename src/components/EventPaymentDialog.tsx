import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Event } from "@/contexts/EventContext";
import { CreditCard, Download, Loader2 } from "lucide-react";
import NackLogo from "@/components/NackLogo";
import { generateEventTicket } from "@/utils/ticketGenerator";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { eventTicketsColRef, eventsColRef, paymentsColRef } from "@/lib/collections";
import { addDoc, doc, getDoc, increment, orderBy, query, runTransaction, updateDoc, getDocs } from "firebase/firestore";
import type { TicketDoc } from "@/types/event";
import { createEventPaymentLink } from "@/lib/payments/eventPayment";

interface EventPaymentDialogProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (ticketData: unknown) => void;
}

const EventPaymentDialog = ({ event, isOpen, onClose, onPaymentSuccess }: EventPaymentDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'form' | 'payment' | 'success'>('form');
  
  const [formData, setFormData] = useState({
    name: "",
    email: "", 
    phone: "",
    quantity: 1
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      toast({ title: "Champs manquants", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({ title: "Email invalide", description: "Veuillez saisir une adresse email valide", variant: "destructive" });
      return false;
    }
    if (formData.quantity < 1) {
      toast({ title: "Quantité invalide", description: "Choisissez au moins 1 billet", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleContinueToPayment = () => {
    if (!validateForm()) return;
    setCurrentStep('payment');
  };

  const processPayment = async () => {
    if (!event) return;
    if (!validateForm()) return;
    
    setIsProcessing(true);
    
    try {
      const ownerUid = event.ownerUid || user?.uid || "";
      
      // Vérifier que l'événement existe et qu'il y a assez de places
      const evtRef = doc(eventsColRef(db, ownerUid), event.id);
      const evtSnap = await getDoc(evtRef);
      if (!evtSnap.exists()) {
        throw new Error("Événement introuvable");
      }
      
      const eventData = evtSnap.data();
      const available = eventData.maxCapacity - (eventData.ticketsSold || 0);
      if (formData.quantity > available) {
        throw new Error("Plus assez de places disponibles");
      }
      
      // Récupérer le profil du propriétaire pour obtenir le disbursementId
      const profileRef = doc(db, 'profiles', ownerUid);
      const profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) {
        throw new Error("Profil du propriétaire introuvable");
      }
      
      const profileData = profileSnap.data();
      if (!profileData.disbursementId || profileData.disbursementStatus !== 'approved') {
        throw new Error("Le paiement en ligne n'est pas disponible pour cet événement. Veuillez contacter l'organisateur.");
      }
      
      // Calculer le montant total
      const totalAmount = event.ticketPrice * formData.quantity;
      
      // Générer les URLs de redirection
      const baseUrl = window.location.origin;
      const transactionId = `EVT-${event.id}-${Date.now()}`;
      const reference = `event-ticket-${event.id}-${Date.now()}`;
      const redirectSuccess = `${baseUrl}/payment/success?reference=${encodeURIComponent(reference)}&transactionId=${transactionId}&type=event-ticket`;
      const redirectError = `${baseUrl}/payment/error?reference=${encodeURIComponent(reference)}&transactionId=${transactionId}`;
      
      // Logo URL (utiliser le logo de l'établissement ou un logo par défaut)
      const logoURL = profileData.logoUrl || `${baseUrl}/logo.png`;
      
      // Préparer les données du billet à créer après paiement réussi
      const ticketData = {
        customerName: formData.name,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        quantity: formData.quantity,
        totalAmount: totalAmount,
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
        currency: event.currency,
      };
      
      // Enregistrer la transaction de paiement avec les données du billet
      await addDoc(paymentsColRef(db, ownerUid), {
        userId: ownerUid,
        transactionId,
        subscriptionType: 'event-ticket',
        amount: totalAmount,
        status: 'pending',
        paymentMethod: 'airtel-money',
        reference,
        paymentLink: '',
        redirectSuccess,
        redirectError,
        establishmentId: ownerUid,
        disbursementId: profileData.disbursementId,
        eventId: event.id,
        // Stocker les données du billet dans la transaction pour création après paiement
        ticketData: ticketData,
        createdAt: Date.now(),
      });
      
      // Créer le lien de paiement
      const paymentLink = await createEventPaymentLink({
        amount: totalAmount,
        reference,
        redirectSuccess,
        redirectError,
        logoURL,
        disbursementId: profileData.disbursementId,
      });
      
      // Mettre à jour la transaction avec le lien
      const paymentsRef = paymentsColRef(db, ownerUid);
      const paymentsQuery = query(paymentsRef, orderBy('createdAt', 'desc'));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      if (!paymentsSnapshot.empty) {
        const latestPayment = paymentsSnapshot.docs[0];
        if (latestPayment.data().transactionId === transactionId) {
          await updateDoc(doc(paymentsRef, latestPayment.id), {
            paymentLink,
          });
        }
      }
      
      // Rediriger vers le lien de paiement
      window.location.href = paymentLink;
    } catch (e: unknown) {
      setIsProcessing(false);
      toast({ 
        title: "Erreur", 
        description: e instanceof Error ? e.message : "Impossible de procéder au paiement", 
        variant: "destructive" 
      });
    }
  };

  const saveReservationAndGenerate = async () => {
    if (!event) return;
    if (!validateForm()) return;
    setIsProcessing(true);
    try {
      const ownerUid = event.ownerUid || user?.uid || "";
      const ticket: TicketDoc = {
        customerName: formData.name,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        quantity: formData.quantity,
        totalAmount: event.ticketPrice * formData.quantity,
        status: 'pending',
        purchaseDate: Date.now(),
      };
      await addDoc(eventTicketsColRef(db, ownerUid, event.id), ticket);

      // Générer le PDF immédiatement
      await generateEventTicket({
        id: `TKT-${Date.now()}`,
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
        customerName: formData.name,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        quantity: formData.quantity,
        totalAmount: event.ticketPrice * formData.quantity,
        currency: event.currency,
        qrCode: `NACK-${event.id}-${formData.email}-${Date.now()}`
      });

      toast({ title: "Réservation enregistrée", description: "Ticket généré avec succès" });
      setIsProcessing(false);
      setCurrentStep('success');
    } catch (e: unknown) {
      setIsProcessing(false);
      toast({ title: "Erreur", description: e instanceof Error ? e.message : "Impossible d'enregistrer la réservation", variant: "destructive" });
    }
  };

  const downloadTicket = async () => {
    if (!event) return;
    const ticketData = {
      id: `TKT-${Date.now()}`,
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.time,
      eventLocation: event.location,
      customerName: formData.name,
      customerEmail: formData.email,
      customerPhone: formData.phone,
      quantity: formData.quantity,
      totalAmount: event.ticketPrice * formData.quantity,
      currency: event.currency,
      qrCode: `NACK-${event.id}-${formData.email}-${Date.now()}`
    };

    try {
      await generateEventTicket(ticketData);
      toast({ title: "Ticket téléchargé", description: "Votre ticket a été téléchargé avec succès" });
    } catch (error) {
      toast({ title: "Erreur de téléchargement", description: "Impossible de générer le ticket", variant: "destructive" });
    }
  };

  const resetDialog = () => {
    setCurrentStep('form');
    setFormData({ name: "", email: "", phone: "", quantity: 1 });
    onClose();
  };

  if (!event) return null;

  const totalAmount = event.ticketPrice * formData.quantity;

  return (
    <Dialog open={isOpen} onOpenChange={resetDialog}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <NackLogo size="lg" />
          </div>
          {event.imageUrl && currentStep === 'form' && (
            <div className="w-full h-32 rounded-lg overflow-hidden mb-4">
              <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}
          <DialogTitle className="text-xl">
            {currentStep === 'form' && "Réservation de billet"}
            {currentStep === 'payment' && "Paiement sécurisé"} 
            {currentStep === 'success' && "Paiement confirmé"}
          </DialogTitle>
          <DialogDescription>
            {event.title} - {new Date(event.date).toLocaleDateString('fr-FR')} à {event.time}
          </DialogDescription>
        </DialogHeader>

        {/* Étapes */}
        {currentStep === 'form' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet *</Label>
                <Input id="name" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Votre nom complet" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Adresse email *</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="votre@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Numéro WhatsApp *</Label>
                <Input id="phone" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} placeholder="Ex: +241 6XX XX XX XX" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Nombre de billets</Label>
                <Input id="quantity" type="number" min="1" max="10" value={formData.quantity} onChange={(e) => handleInputChange('quantity', e.target.value)} />
              </div>
            </div>
            <Separator />
            <div className="bg-nack-beige-light rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total à payer</span>
                <span className="text-xl font-bold text-nack-red">{Number(totalAmount || 0).toLocaleString()} {event.currency}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button onClick={handleContinueToPayment} className="w-full bg-gradient-primary text-white shadow-button">Continuer vers le paiement</Button>
              <Button variant="outline" disabled={isProcessing} onClick={saveReservationAndGenerate}>
                {isProcessing ? (<><Loader2 className="mr-2 animate-spin" size={18} />Enregistrement...</>) : ("Enregistrer et générer le ticket")}
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'payment' && (
          <div className="space-y-6">
            <div className="bg-nack-beige-light rounded-lg p-4 space-y-2">
              <div className="flex justify-between"><span>Client:</span><span className="font-medium">{formData.name}</span></div>
              <div className="flex justify-between"><span>Email:</span><span className="font-medium">{formData.email}</span></div>
              <div className="flex justify-between"><span>WhatsApp:</span><span className="font-medium">{formData.phone}</span></div>
              <div className="flex justify-between"><span>Billets:</span><span className="font-medium">{formData.quantity}</span></div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-nack-red"><span>Total:</span><span>{Number(totalAmount || 0).toLocaleString()} {event.currency}</span></div>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-800 mb-4">
              <p className="font-semibold mb-1">💳 Paiement par Airtel Money</p>
              <p className="text-xs">Le paiement est disponible uniquement via <strong>Airtel Money</strong> pour le moment.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={processPayment} disabled={isProcessing} className="w-full bg-gradient-primary text-white shadow-button">
                {isProcessing ? (<><Loader2 className="mr-2 animate-spin" size={18} />Traitement en cours...</>) : ("Payer maintenant")}
              </Button>
              <Button variant="outline" disabled={isProcessing} onClick={saveReservationAndGenerate}>
                {isProcessing ? (<><Loader2 className="mr-2 animate-spin" size={18} />Enregistrement...</>) : ("Enregistrer et générer le ticket")}
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'success' && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"><span className="text-white text-sm">✓</span></div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-600 mb-2">Paiement confirmé !</h3>
              <p className="text-muted-foreground">Votre réservation a été confirmée. Téléchargez votre ticket ci-dessous.</p>
            </div>
            <div className="bg-nack-beige-light rounded-lg p-4"><p className="text-sm text-muted-foreground mb-2">Un email de confirmation a été envoyé à :</p><p className="font-medium">{formData.email}</p></div>
            <Button onClick={downloadTicket} className="w-full bg-gradient-primary text-white shadow-button"><Download className="mr-2" size={18} />Télécharger votre ticket</Button>
            <Button onClick={resetDialog} variant="outline" className="w-full">Fermer</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EventPaymentDialog;