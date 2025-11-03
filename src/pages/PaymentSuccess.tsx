import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc, addDoc, query, where, getDocs } from "firebase/firestore";
import { notificationsColRef, paymentsColRef } from "@/lib/collections";
import { generateSubscriptionReceiptPDF } from "@/utils/receipt";
import { SUBSCRIPTION_PLANS } from "@/utils/subscription";
import type { PaymentTransaction } from "@/types/payment";

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
        
        // Récupérer les paramètres de l'URL
        const reference = searchParams.get('reference') || '';
        const transactionId = searchParams.get('transactionId') || '';
        
        // Détecter le type d'abonnement depuis la référence ou l'URL
        let subscriptionType: 'transition' | 'transition-pro-max' = 'transition';
        let amount = 2500;
        
        if (reference.includes('transition-pro-max') || reference.includes('pro-max')) {
          subscriptionType = 'transition-pro-max';
          amount = SUBSCRIPTION_PLANS['transition-pro-max'].price;
        } else {
          subscriptionType = 'transition';
          amount = SUBSCRIPTION_PLANS.transition.price;
        }
        
        // Chercher la transaction existante si transactionId fourni
        let paymentTransaction: PaymentTransaction | null = null;
        if (transactionId) {
          try {
            // Essayer de trouver la transaction dans la collection payments
            const paymentsRef = paymentsColRef(db, user.uid);
            const q = query(paymentsRef, where('transactionId', '==', transactionId));
            const paymentsSnapshot = await getDocs(q);
            if (!paymentsSnapshot.empty) {
              const paymentDoc = paymentsSnapshot.docs[0];
              paymentTransaction = { id: paymentDoc.id, ...paymentDoc.data() } as PaymentTransaction;
            }
          } catch (error) {
            console.error('Erreur recherche transaction:', error);
          }
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

        // Enregistrer ou mettre à jour la transaction de paiement
        try {
          const paymentsRef = paymentsColRef(db, user.uid);
          
          if (paymentTransaction) {
            // Mettre à jour la transaction existante
            await updateDoc(doc(paymentsRef, paymentTransaction.id), {
              status: 'completed',
              paidAt: now,
              subscriptionEndsAt: newSubscriptionEndsAt,
              updatedAt: now,
            });
          } else {
            // Créer une nouvelle transaction (cas où transactionId manquant)
            const newTransactionId = transactionId || `TXN-${user.uid}-${Date.now()}`;
            await addDoc(paymentsRef, {
              userId: user.uid,
              transactionId: newTransactionId,
              subscriptionType,
              amount,
              status: 'completed',
              paymentMethod: 'airtel-money',
              reference: reference || `abonnement-${subscriptionType}`,
              createdAt: now,
              paidAt: now,
              subscriptionEndsAt: newSubscriptionEndsAt,
            } as Omit<PaymentTransaction, 'id'>);
          }
        } catch (error) {
          console.error('Erreur enregistrement transaction:', error);
          // Ne pas bloquer le processus si l'enregistrement échoue
        }

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
