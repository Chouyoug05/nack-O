import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc, addDoc, query, where, getDocs } from "firebase/firestore";
import { notificationsColRef, paymentsColRef, receiptsColRef } from "@/lib/collections";
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
        
        // Vérification de sécurité: s'assurer qu'on a au moins une référence ou un transactionId
        if (!reference && !transactionId) {
          console.error('PaymentSuccess: Aucune référence ou transactionId fournie');
          setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
          return;
        }
        
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
        const paymentsRef = paymentsColRef(db, user.uid);
        
        if (transactionId) {
          try {
            // Essayer de trouver la transaction dans la collection payments
            const q = query(paymentsRef, where('transactionId', '==', transactionId));
            const paymentsSnapshot = await getDocs(q);
            if (!paymentsSnapshot.empty) {
              const paymentDoc = paymentsSnapshot.docs[0];
              paymentTransaction = { id: paymentDoc.id, ...paymentDoc.data() } as PaymentTransaction;
              
              // VÉRIFICATION IMPORTANTE: Si la transaction est déjà complétée, ne pas la traiter à nouveau
              if (paymentTransaction.status === 'completed') {
                console.warn(`PaymentSuccess: Transaction ${transactionId} déjà complétée. Ignorant le traitement dupliqué.`);
                // Vérifier si un reçu existe déjà
                const receiptsRef = receiptsColRef(db, user.uid);
                const receiptQuery = query(receiptsRef, where('transactionId', '==', transactionId));
                const receiptSnapshot = await getDocs(receiptQuery);
                
                if (receiptSnapshot.empty && profile) {
                  // Générer le reçu si il n'existe pas encore
                  try {
                    await generateSubscriptionReceiptPDF({
                      establishmentName: profile.establishmentName,
                      email: profile.email,
                      phone: profile.phone,
                      logoUrl: profile.logoUrl,
                      uid: user.uid,
                    }, {
                      amountXaf: paymentTransaction.amount,
                      paidAt: paymentTransaction.paidAt || now,
                      paymentMethod: "Airtel Money",
                      reference: paymentTransaction.reference,
                    });
                  } catch (receiptError) {
                    console.error('Erreur génération reçu (transaction déjà complétée):', receiptError);
                  }
                }
                
                setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
                return;
              }
            }
          } catch (error) {
            console.error('Erreur recherche transaction:', error);
          }
        }
        
        // Vérification supplémentaire: chercher par référence pour éviter les doublons
        if (reference && !paymentTransaction) {
          try {
            const refQuery = query(paymentsRef, where('reference', '==', reference), where('status', '==', 'completed'));
            const refSnapshot = await getDocs(refQuery);
            if (!refSnapshot.empty) {
              const existingTransaction = { id: refSnapshot.docs[0].id, ...refSnapshot.docs[0].data() } as PaymentTransaction;
              console.warn(`PaymentSuccess: Une transaction avec la référence ${reference} est déjà complétée. TransactionId: ${existingTransaction.transactionId}`);
              setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
              return;
            }
          } catch (error) {
            console.error('Erreur vérification doublon par référence:', error);
          }
        }
        
        // Calculer la nouvelle date de fin d'abonnement
        // CORRECTION: Chaque paiement donne exactement 30 jours à partir de maintenant
        // Ne pas accumuler les jours pour éviter des abonnements de 357+ jours
        let newSubscriptionEndsAt: number;
        if (profile?.subscriptionEndsAt && profile.subscriptionEndsAt > now) {
          // Si l'abonnement actuel se termine dans plus de 30 jours, c'est anormal
          // Sinon, on peut prolonger depuis la fin actuelle (mais max 30 jours supplémentaires)
          const daysRemaining = (profile.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000);
          if (daysRemaining > 30) {
            // Anomalie détectée: abonnement avec plus de 30 jours restants
            // Réinitialiser à 30 jours à partir de maintenant
            console.warn(`PaymentSuccess: Abonnement anormal détecté (${Math.floor(daysRemaining)} jours restants). Réinitialisation à 30 jours.`);
            newSubscriptionEndsAt = now + thirtyDaysMs;
          } else {
            // Prolonger depuis la fin actuelle (mais on limite à max 30 jours supplémentaires)
            newSubscriptionEndsAt = profile.subscriptionEndsAt + thirtyDaysMs;
          }
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
        
        // Forcer le rafraîchissement du profil dans AuthContext pour activer immédiatement les fonctionnalités
        // Le AuthContext écoute déjà les changements via onSnapshot, donc cette mise à jour
        // devrait automatiquement déclencher le rafraîchissement du profil et activer les fonctionnalités

        // Enregistrer ou mettre à jour la transaction de paiement
        let finalTransactionId = transactionId;
        try {
          if (paymentTransaction) {
            // Mettre à jour la transaction existante
            await updateDoc(doc(paymentsRef, paymentTransaction.id), {
              status: 'completed',
              paidAt: now,
              subscriptionEndsAt: newSubscriptionEndsAt,
              updatedAt: now,
            });
            finalTransactionId = paymentTransaction.transactionId;
            console.log(`PaymentSuccess: Transaction ${finalTransactionId} mise à jour avec succès`);
          } else {
            // Créer une nouvelle transaction (cas où transactionId manquant)
            const newTransactionId = transactionId || `TXN-${user.uid}-${Date.now()}`;
            const newTransactionRef = await addDoc(paymentsRef, {
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
            finalTransactionId = newTransactionId;
            console.log(`PaymentSuccess: Nouvelle transaction ${finalTransactionId} créée avec succès`);
          }
        } catch (error) {
          console.error('Erreur enregistrement transaction:', error);
          // Ne pas bloquer le processus si l'enregistrement échoue, mais logger l'erreur
          throw new Error(`Échec de l'enregistrement de la transaction: ${error instanceof Error ? error.message : String(error)}`);
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

        // Générer et sauvegarder le reçu si le profil est disponible
        try {
          if (profile) {
            // Générer le reçu PDF
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
            
            // Sauvegarder une référence au reçu dans Firestore
            try {
              const receiptsRef = receiptsColRef(db, user.uid);
              await addDoc(receiptsRef, {
                transactionId: finalTransactionId,
                userId: user.uid,
                subscriptionType,
                amount,
                reference: reference || `abonnement-${subscriptionType}`,
                paymentMethod: 'airtel-money',
                paidAt: now,
                createdAt: now,
                receiptType: 'subscription',
                establishmentName: profile.establishmentName,
              });
              console.log(`PaymentSuccess: Reçu sauvegardé pour la transaction ${finalTransactionId}`);
            } catch (receiptSaveError) {
              console.error('Erreur sauvegarde référence reçu:', receiptSaveError);
              // Ne pas bloquer, le reçu PDF a déjà été généré
            }
          } else {
            console.warn('PaymentSuccess: Profil non disponible, reçu non généré');
          }
        } catch (receiptError) {
          console.error('Erreur génération reçu:', receiptError);
          // Ne pas bloquer le processus, mais logger l'erreur
        }
      } catch (e) {
        console.error('PaymentSuccess: Erreur critique:', e);
        // Afficher un message d'erreur à l'utilisateur
        alert(`Une erreur est survenue lors du traitement du paiement. Veuillez contacter le support avec votre référence: ${searchParams.get('reference') || searchParams.get('transactionId') || 'N/A'}`);
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
