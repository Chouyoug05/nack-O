import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc, addDoc } from "firebase/firestore";
import { notificationsColRef } from "@/lib/collections";
import { generateSubscriptionReceiptPDF } from "@/utils/receipt";
import { SUBSCRIPTION_PLANS } from "@/utils/subscription";

const PaymentSuccess = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      try {
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        
        // Détecter le type d'abonnement depuis la référence ou l'URL
        const reference = searchParams.get('reference') || '';
        let subscriptionType: 'transition' | 'transition-pro-max' = 'transition';
        let amount = 2500;
        
        if (reference.includes('transition-pro-max') || reference.includes('pro-max')) {
          subscriptionType = 'transition-pro-max';
          amount = SUBSCRIPTION_PLANS['transition-pro-max'].price;
        } else {
          subscriptionType = 'transition';
          amount = SUBSCRIPTION_PLANS.transition.price;
        }
        
        // Calculer la nouvelle date de fin d'abonnement
        // Si l'utilisateur a déjà un abonnement actif qui n'a pas expiré, ajouter 30 jours à partir de la fin actuelle
        // Sinon, ajouter 30 jours à partir de maintenant
        let newSubscriptionEndsAt: number;
        if (profile?.subscriptionEndsAt && profile.subscriptionEndsAt > now) {
          // Prolonger depuis la fin actuelle
          newSubscriptionEndsAt = profile.subscriptionEndsAt + thirtyDaysMs;
        } else {
          // Nouvel abonnement ou renouvellement après expiration
          newSubscriptionEndsAt = now + thirtyDaysMs;
        }
        
        // Mettre à jour le profil avec le type d'abonnement
        const updateData: {
          plan: 'active';
          subscriptionType: 'transition' | 'transition-pro-max';
          subscriptionEndsAt: number;
          lastPaymentAt: number;
          updatedAt: number;
          eventsCount?: number;
          eventsResetAt?: number;
        } = {
          plan: 'active',
          subscriptionType,
          subscriptionEndsAt: newSubscriptionEndsAt,
          lastPaymentAt: now,
          updatedAt: now,
        };
        
        // Pour Pro Max, initialiser/réinitialiser le compteur d'événements si nécessaire
        if (subscriptionType === 'transition-pro-max') {
          // Si on est dans une nouvelle période (abonnement expiré ou première souscription), réinitialiser
          if (!profile?.subscriptionEndsAt || profile.subscriptionEndsAt <= now) {
            updateData.eventsCount = 0;
            updateData.eventsResetAt = newSubscriptionEndsAt;
          } else {
            // Garder les valeurs actuelles si on prolonge un abonnement existant
            if (profile.eventsCount !== undefined) updateData.eventsCount = profile.eventsCount;
            if (profile.eventsResetAt !== undefined) updateData.eventsResetAt = profile.eventsResetAt;
          }
        }
        
        await updateDoc(doc(db, "profiles", user.uid), updateData);

        // Notification de paiement réussi
        try {
          await addDoc(notificationsColRef(db, user.uid), {
            title: "Paiement réussi",
            message: `Votre abonnement ${subscriptionType === 'transition' ? 'Transition' : 'Transition Pro Max'} (${amount.toLocaleString()} XAF) est activé pour 30 jours.`,
            type: "success",
            createdAt: now,
            read: false,
          });
        } catch {/* ignore */}

        // Générer le reçu si le profil est disponible
        try {
          if (profile) {
            await generateSubscriptionReceiptPDF({
              establishmentName: profile.establishmentName,
              email: profile.email,
              phone: profile.phone,
              logoUrl: profile.logoUrl,
              uid: user.uid,
            }, {
              amountXaf: amount,
              paidAt: now,
              paymentMethod: "Airtel Money",
              reference: reference || `abonnement-${subscriptionType}`,
            });
          }
        } catch {/* ignore receipt generation errors */}
      } catch (e) {
        console.error(e);
      } finally {
        setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
      }
    };
    run();
  }, [user, profile, navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold">Paiement confirmé</h1>
        <p className="text-sm text-muted-foreground">Votre abonnement a été activé. Redirection…</p>
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800">
          Avertissement: le paiement est disponible uniquement via <strong>Airtel Money</strong>. Moov Money est momentanément indisponible.
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
