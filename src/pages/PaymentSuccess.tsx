import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc, addDoc, query, where, getDocs, getDoc, collectionGroup } from "firebase/firestore";
import { notificationsColRef, paymentsColRef, receiptsColRef } from "@/lib/collections";
import { generateSubscriptionReceiptPDF } from "@/utils/receipt";
import { SUBSCRIPTION_PLANS } from "@/utils/subscription";
import type { PaymentTransaction } from "@/types/payment";
import type { TicketDoc } from "@/types/event";

const PaymentSuccess = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [establishmentInfo, setEstablishmentInfo] = useState<{ name: string; logoUrl?: string } | null>(null);

  useEffect(() => {
    const run = async () => {
      const returnClientElectron = searchParams.get("returnClient") === "electron";
      const scheduleNav = (fn: () => void, ms: number) => {
        if (returnClientElectron) return;
        setTimeout(fn, ms);
      };

      // Pour les paiements menu digital et événements, l'utilisateur n'est pas nécessairement authentifié
      const reference = searchParams.get('reference') || '';
      const paymentType = searchParams.get('type') || '';
      const isMenuDigitalPayment = reference.includes('menu-digital');
      const isEventTicketPayment = reference.includes('event-ticket') || paymentType === 'event-ticket';

      // Gérer les paiements de billets d'événement
      if (isEventTicketPayment) {
        const transactionId = searchParams.get('transactionId') || '';

        if (transactionId) {
          try {
            // Chercher la transaction dans toutes les collections payments
            const paymentsQuery = query(
              collectionGroup(db, 'payments'),
              where('transactionId', '==', transactionId)
            );
            const snapshot = await getDocs(paymentsQuery);

            if (!snapshot.empty) {
              const paymentDoc = snapshot.docs[0];
              const paymentData = paymentDoc.data() as PaymentTransaction;

              // Vérifier si la transaction est déjà complétée
              if (paymentData.status === 'completed') {
                console.warn(`PaymentSuccess: Transaction ${transactionId} déjà complétée. Ignorant le traitement dupliqué.`);
                setTimeout(() => navigate('/', { replace: true }), 2000);
                return;
              }

              // Mettre à jour la transaction
              await updateDoc(paymentDoc.ref, {
                status: 'completed',
                paidAt: Date.now(),
                updatedAt: Date.now(),
              });

              // CRÉER le billet seulement après paiement réussi
              // Les données du billet sont stockées dans ticketData de la transaction
              if (paymentData.ticketData && paymentData.eventId && paymentData.establishmentId) {
                const { eventTicketsColRef, eventsColRef } = await import('@/lib/collections');
                const { increment } = await import('firebase/firestore');

                const td = paymentData.ticketData as { customerName?: string; customerEmail?: string; customerPhone?: string; quantity?: number; totalAmount?: number };
                const qty = Number(td.quantity ?? 0);

                // Créer le billet avec le statut 'paid' directement
                const ticket: TicketDoc = {
                  customerName: String(td.customerName ?? ''),
                  customerEmail: String(td.customerEmail ?? ''),
                  customerPhone: String(td.customerPhone ?? ''),
                  quantity: qty,
                  totalAmount: Number(td.totalAmount ?? 0),
                  status: 'paid',
                  purchaseDate: Date.now(),
                };

                const ticketsCol = eventTicketsColRef(db, paymentData.establishmentId, paymentData.eventId);
                await addDoc(ticketsCol, ticket);

                // Mettre à jour le compteur de billets vendus
                const evtRef = doc(eventsColRef(db, paymentData.establishmentId), paymentData.eventId);
                await updateDoc(evtRef, {
                  ticketsSold: increment(qty)
                });

                // Charger les infos de l'établissement pour l'affichage
                const profileDoc = await getDoc(doc(db, 'profiles', paymentData.establishmentId));
                if (profileDoc.exists()) {
                  const profileData = profileDoc.data();
                  setEstablishmentInfo({
                    name: profileData.establishmentName || 'Établissement',
                    logoUrl: profileData.logoUrl,
                  });
                }
              }

              // Rediriger vers la page d'accueil après 3 secondes
              scheduleNav(() => {
                navigate('/', { replace: true });
              }, 3000);
              return;
            }
          } catch (error) {
            console.error('Erreur traitement paiement billet événement:', error);
          }
        }

        // Redirection par défaut si erreur
        scheduleNav(() => navigate('/', { replace: true }), 3000);
        return;
      }

      if (isMenuDigitalPayment) {
        // Charger les informations de l'établissement depuis la transaction
        const transactionId = searchParams.get('transactionId') || '';
        const orderId = searchParams.get('orderId') || '';

        if (transactionId) {
          try {
            // Chercher la transaction dans toutes les collections payments
            const paymentsQuery = query(
              collectionGroup(db, 'payments'),
              where('transactionId', '==', transactionId)
            );
            const snapshot = await getDocs(paymentsQuery);

            if (!snapshot.empty) {
              const paymentData = snapshot.docs[0].data() as PaymentTransaction;
              const establishmentId = paymentData.establishmentId;

              if (establishmentId) {
                // Charger les infos de l'établissement
                const profileDoc = await getDoc(doc(db, 'profiles', establishmentId));
                if (profileDoc.exists()) {
                  const profileData = profileDoc.data();
                  setEstablishmentInfo({
                    name: profileData.establishmentName || 'Établissement',
                    logoUrl: profileData.logoUrl,
                  });
                }
              }
            }
          } catch (error) {
            console.error('Erreur chargement établissement:', error);
          }
        }

        // Mettre à jour la transaction et la commande même sans authentification
        try {
          const transactionId = searchParams.get('transactionId') || '';

          if (transactionId) {
            const paymentsQuery = query(
              collectionGroup(db, 'payments'),
              where('transactionId', '==', transactionId)
            );
            const snapshot = await getDocs(paymentsQuery);

            if (!snapshot.empty) {
              const paymentDoc = snapshot.docs[0];
              const paymentData = paymentDoc.data() as PaymentTransaction;

              // Mettre à jour la transaction
              await updateDoc(paymentDoc.ref, {
                status: 'completed',
                paidAt: Date.now(),
                updatedAt: Date.now(),
              });

              // CRÉER la commande seulement après paiement réussi
              // Les données de commande sont stockées dans orderData de la transaction
              if (paymentData.orderData && paymentData.establishmentId) {
                const { barOrdersColRef } = await import('@/lib/collections');

                // Différencier les commandes sur place et les livraisons
                // - Sur place (avec table) : status 'pending' pour apparaître dans les commandes clients
                // - Livraison : status 'paid' car déjà payée et livrée
                const isDelivery = paymentData.orderData.isDelivery === true;
                const orderStatus = isDelivery ? 'paid' : 'pending';

                // Nettoyer l'objet orderData pour supprimer les valeurs undefined (Firestore ne les accepte pas)
                const cleanedOrderData: Record<string, unknown> = {
                  orderNumber: paymentData.orderData?.orderNumber,
                  receiptNumber: paymentData.orderData?.receiptNumber,
                  tableZone: paymentData.orderData?.tableZone,
                  items: paymentData.orderData?.items,
                  total: paymentData.orderData?.total,
                  status: orderStatus,
                  createdAt: paymentData.orderData?.createdAt,
                  isDelivery: (paymentData.orderData as Record<string, unknown>)?.isDelivery === true,
                  deliveryPrice: (paymentData.orderData as Record<string, unknown>)?.deliveryPrice ?? 0,
                  customerInfo: (paymentData.orderData as Record<string, unknown>)?.customerInfo,
                  paidAt: Date.now(),
                  paymentMethod: 'airtel-money',
                  paymentTransactionId: transactionId,
                };

                // Ajouter deliveryAddress seulement si défini et non undefined
                const od = paymentData.orderData as Record<string, unknown> | undefined;
                if (od?.deliveryAddress !== undefined && od?.deliveryAddress !== null) {
                  cleanedOrderData.deliveryAddress = od.deliveryAddress;
                }

                // Créer la commande avec le statut approprié
                const orderDocRef = await addDoc(barOrdersColRef(db, paymentData.establishmentId!), cleanedOrderData);

                // Envoyer la notification push au gérant si le token est disponible
                try {
                  const profDoc = await getDoc(doc(db, 'profiles', paymentData.establishmentId!));
                  if (profDoc.exists()) {
                    const profData = profDoc.data();
                    if (profData.fcmToken) {
                      const orderNum = (cleanedOrderData as { orderNumber?: string | number }).orderNumber;
                      const tableZone = (cleanedOrderData as { tableZone?: string }).tableZone;
                      const totalAmount = (cleanedOrderData as { total?: number }).total;
                      const body = `Commande PAYÉE #${orderNum} - ${tableZone} - ${Number(totalAmount).toLocaleString('fr-FR')} XAF`;
                      fetch('/.netlify/functions/send-notification', {
                        method: 'POST',
                        body: JSON.stringify({
                          token: profData.fcmToken,
                          title: "Nouvelle commande payée",
                          body: body,
                          data: {
                            orderNumber: String((cleanedOrderData as { orderNumber?: string | number }).orderNumber),
                            type: 'NEW_PAID_ORDER'
                          }
                        })
                      }).catch(err => console.error('Erreur fetch notification success:', err));
                    }
                  }
                } catch (notiErr) {
                  console.error('Erreur trigger notification payment success:', notiErr);
                }

                // Mettre à jour la transaction avec l'ID de la commande créée
                await updateDoc(paymentDoc.ref, {
                  orderId: orderDocRef.id,
                });
              } else if (orderId && paymentData.establishmentId) {
                // Fallback : si orderId existe déjà (ancien système), mettre à jour
                const orderRef = doc(db, `profiles/${paymentData.establishmentId}/barOrders`, orderId);
                await updateDoc(orderRef, {
                  status: 'paid',
                  paidAt: Date.now(),
                  paymentMethod: 'airtel-money',
                  paymentTransactionId: transactionId,
                });
              }

              // Rediriger vers le menu après 3 secondes
              scheduleNav(() => {
                if (paymentData.establishmentId) {
                  navigate(`/commande/${paymentData.establishmentId}`, {
                    replace: true,
                    state: { paymentSuccess: true }
                  });
                } else {
                  navigate('/', { replace: true });
                }
              }, 3000);
              return;
            }
          }
        } catch (error) {
          console.error('Erreur traitement paiement menu digital:', error);
        }

        // Redirection par défaut si erreur - essayer de récupérer l'établissement depuis l'URL
        const establishmentIdFromUrl = searchParams.get('establishmentId');
        if (establishmentIdFromUrl) {
          scheduleNav(() => navigate(`/commande/${establishmentIdFromUrl}`, {
            replace: true,
            state: { paymentSuccess: true }
          }), 3000);
        } else {
          // Si on ne peut pas récupérer l'établissement, rediriger vers la page d'accueil
          scheduleNav(() => navigate('/', { replace: true }), 3000);
        }
        return;
      }

      // Pour les autres types de paiement, authentification requise
      if (!user) return;
      try {
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        // Récupérer les paramètres de l'URL
        const reference = searchParams.get('reference') || '';
        const transactionId = searchParams.get('transactionId') || '';
        const paymentType = searchParams.get('type') || 'subscription';
        const orderId = searchParams.get('orderId') || '';

        // Vérification de sécurité: s'assurer qu'on a au moins une référence ou un transactionId
        if (!reference && !transactionId) {
          console.error('PaymentSuccess: Aucune référence ou transactionId fournie');
          scheduleNav(() => navigate('/dashboard', { replace: true }), 2000);
          return;
        }

        // Gérer le paiement d'événement supplémentaire
        if (paymentType === 'event') {
          // Récupérer les données de l'événement depuis sessionStorage
          const pendingEventDataStr = sessionStorage.getItem('pendingEventData');
          if (!pendingEventDataStr) {
            console.error('PaymentSuccess: Données d\'événement non trouvées');
            scheduleNav(() => navigate('/dashboard', { replace: true }), 2000);
            return;
          }

          try {
            const eventData = JSON.parse(pendingEventDataStr);

            // Chercher la transaction pour obtenir le montant
            let amount = 0;
            const paymentsRef = paymentsColRef(db, user.uid);
            if (transactionId) {
              const q = query(paymentsRef, where('transactionId', '==', transactionId));
              const paymentsSnapshot = await getDocs(q);
              if (!paymentsSnapshot.empty) {
                const paymentDoc = paymentsSnapshot.docs[0];
                const paymentData = paymentDoc.data() as PaymentTransaction;
                amount = paymentData.amount || 0;

                // Mettre à jour la transaction
                await updateDoc(doc(paymentsRef, paymentDoc.id), {
                  status: 'completed',
                  paidAt: now,
                  updatedAt: now,
                });
              }
            }

            // Créer l'événement après paiement réussi
            const { useEvents } = await import('@/contexts/EventContext');
            // Note: On ne peut pas utiliser useEvents ici car c'est un hook
            // On va créer l'événement directement via Firestore
            const { eventsColRef } = await import('@/lib/collections');
            const { addDoc } = await import('firebase/firestore');

            // Uploader l'image si elle existe
            let finalImageUrl = eventData.imageUrl;
            if (eventData.selectedImageBase64) {
              try {
                // Convertir base64 en File
                const response = await fetch(eventData.selectedImageBase64);
                const blob = await response.blob();
                const file = new File([blob], 'event-image.jpg', { type: 'image/jpeg' });
                const { uploadImageToCloudinary } = await import('@/lib/cloudinary');
                finalImageUrl = await uploadImageToCloudinary(file, "events");
              } catch (imageError) {
                console.error('Erreur upload image événement:', imageError);
              }
            }

            // Créer l'événement
            const eventPayload = {
              title: eventData.title,
              description: eventData.description,
              date: eventData.date,
              time: eventData.time,
              location: eventData.location || "Restaurant NACK",
              maxCapacity: eventData.maxCapacity || 50,
              ticketPrice: eventData.ticketPrice,
              currency: eventData.currency || "XAF",
              isActive: true,
              imageUrl: finalImageUrl || undefined,
              organizerWhatsapp: eventData.organizerWhatsapp || undefined,
            };

            await addDoc(eventsColRef(db, user.uid), {
              ...eventPayload,
              ticketsSold: 0,
              createdAt: now,
              updatedAt: now,
            });

            // Nettoyer sessionStorage
            sessionStorage.removeItem('pendingEventData');

            // Notification de succès
            try {
              await addDoc(notificationsColRef(db, user.uid), {
                title: "Événement créé",
                message: `Votre événement "${eventData.title}" a été créé avec succès après le paiement de ${amount.toLocaleString()} XAF.`,
                type: "success",
                createdAt: now,
                read: false,
              });
            } catch {/* ignore */ }

            scheduleNav(() => navigate('/dashboard', { replace: true }), 2000);
            return;
          } catch (error) {
            console.error('Erreur création événement après paiement:', error);
            scheduleNav(() => navigate('/dashboard', { replace: true }), 2000);
            return;
          }
        }

        // Détecter le type de paiement depuis la référence ou l'URL
        let subscriptionType: 'transition' | 'transition-pro-max' | 'menu-digital' = 'transition';
        let amount = 2500;
        let isMenuDigitalPayment = false;

        if (reference.includes('menu-digital')) {
          subscriptionType = 'menu-digital';
          isMenuDigitalPayment = true;
        } else if (reference.includes('transition-pro-max') || reference.includes('pro-max')) {
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

              // Si c'est un paiement Menu Digital, récupérer le montant depuis la transaction
              if (paymentTransaction.subscriptionType === 'menu-digital') {
                isMenuDigitalPayment = true;
                amount = paymentTransaction.amount;
              }

              // VÉRIFICATION IMPORTANTE: Si la transaction est déjà complétée, ne pas la traiter à nouveau
              if (paymentTransaction.status === 'completed') {
                console.warn(`PaymentSuccess: Transaction ${transactionId} déjà complétée. Ignorant le traitement dupliqué.`);

                // Pour les paiements Menu Digital, rediriger vers la page de commande
                if (isMenuDigitalPayment && orderId) {
                  scheduleNav(() => navigate(`/commande/${paymentTransaction.establishmentId || user.uid}`, {
                    replace: true,
                    state: { paymentSuccess: true }
                  }), 2000);
                  return;
                }

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
                      companyName: profile.companyName,
                      fullAddress: profile.fullAddress,
                      businessPhone: profile.businessPhone,
                      rcsNumber: profile.rcsNumber,
                      nifNumber: profile.nifNumber,
                      legalMentions: profile.legalMentions,
                      customMessage: profile.customMessage,
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

                scheduleNav(() => navigate('/dashboard', { replace: true }), 1200);
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
              scheduleNav(() => navigate('/dashboard', { replace: true }), 2000);
              return;
            }
          } catch (error) {
            console.error('Erreur vérification doublon par référence:', error);
          }
        }

        // Gérer les paiements Menu Digital différemment
        if (isMenuDigitalPayment && paymentTransaction) {
          const paymentData = paymentTransaction as PaymentTransaction;

          // Mettre à jour la transaction de paiement
          await updateDoc(doc(paymentsRef, paymentTransaction.id), {
            status: 'completed',
            paidAt: now,
            updatedAt: now,
          });

          // CRÉER la commande seulement après paiement réussi
          // Les données de commande sont stockées dans orderData de la transaction
          if (paymentData.orderData && paymentTransaction.establishmentId) {
            try {
              const { barOrdersColRef } = await import('@/lib/collections');

              // Différencier les commandes sur place et les livraisons
              // - Sur place (avec table) : status 'pending' pour apparaître dans les commandes clients
              // - Livraison : status 'paid' car déjà payée et livrée
              const isDelivery = paymentData.orderData.isDelivery === true;
              const orderStatus = isDelivery ? 'paid' : 'pending';

              // Nettoyer l'objet orderData pour supprimer les valeurs undefined (Firestore ne les accepte pas)
              const cleanedOrderData: Record<string, unknown> = {
                orderNumber: paymentData.orderData?.orderNumber,
                receiptNumber: paymentData.orderData?.receiptNumber,
                tableZone: paymentData.orderData?.tableZone,
                items: paymentData.orderData?.items,
                total: paymentData.orderData?.total,
                status: orderStatus,
                createdAt: paymentData.orderData?.createdAt,
                isDelivery: (paymentData.orderData as Record<string, unknown>)?.isDelivery === true,
                deliveryPrice: (paymentData.orderData as Record<string, unknown>)?.deliveryPrice ?? 0,
                customerInfo: (paymentData.orderData as Record<string, unknown>)?.customerInfo,
                paidAt: now,
                paymentMethod: 'airtel-money',
                paymentTransactionId: transactionId,
              };

              // Ajouter deliveryAddress seulement si défini et non undefined
              const od2 = paymentData.orderData as Record<string, unknown> | undefined;
              if (od2?.deliveryAddress !== undefined && od2?.deliveryAddress !== null) {
                cleanedOrderData.deliveryAddress = od2.deliveryAddress;
              }

              // Créer la commande avec le statut approprié
              const orderDocRef = await addDoc(barOrdersColRef(db, paymentTransaction.establishmentId!), cleanedOrderData);

              // Mettre à jour la transaction avec l'ID de la commande créée
              await updateDoc(doc(paymentsRef, paymentTransaction.id), {
                orderId: orderDocRef.id,
              });
            } catch (error) {
              console.error('Erreur création commande après paiement:', error);
            }
          } else if (orderId && paymentTransaction.establishmentId) {
            // Fallback : si orderId existe déjà (ancien système), mettre à jour
            try {
              const { barOrdersColRef } = await import('@/lib/collections');
              const orderRef = doc(db, `profiles/${paymentTransaction.establishmentId}/barOrders`, orderId);
              await updateDoc(orderRef, {
                status: 'paid',
                paidAt: now,
                paymentMethod: 'airtel-money',
                paymentTransactionId: transactionId,
              });
            } catch (error) {
              console.error('Erreur mise à jour commande:', error);
            }
          }

          // Rediriger vers la page de commande avec un message de succès
          scheduleNav(() => {
            if (paymentTransaction.establishmentId) {
              navigate(`/commande/${paymentTransaction.establishmentId}`, {
                replace: true,
                state: { paymentSuccess: true }
              });
            } else {
              navigate('/dashboard', { replace: true });
            }
          }, 2000);
          return;
        }

        // Calculer la nouvelle date de fin d'abonnement
        const duration = searchParams.get('duration') || (paymentTransaction as { duration?: string })?.duration || 'month';
        let periodDays = 30;
        let periodLabel = '30 jours';

        if (duration === 'quarter') {
          periodDays = 90;
          periodLabel = '90 jours';
        } else if (duration === 'semester') {
          periodDays = 180;
          periodLabel = '180 jours';
        } else if (duration === 'year') {
          periodDays = 365;
          periodLabel = '365 jours';
        }

        const newSubscriptionEndsAt: number = now + (periodDays * 24 * 60 * 60 * 1000);

        // Si l'abonnement actuel a plus de 30 jours, c'est une anomalie - on le corrige
        if (profile?.subscriptionEndsAt && profile.subscriptionEndsAt > now) {
          const daysRemaining = (profile.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000);
          if (daysRemaining > 30) {
            console.warn(`PaymentSuccess: Abonnement anormal détecté (${Math.floor(daysRemaining)} jours restants). Nouveau paiement = 30 jours à partir de maintenant.`);
          }
        }

        // TOUJOURS mettre 30 jours à partir de maintenant, jamais accumuler

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
          subscriptionType: subscriptionType as 'transition' | 'transition-pro-max',
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
            message: `Votre abonnement ${subscriptionType === 'transition' ? 'Transition' : 'Transition Pro Max'} (${amount.toLocaleString()} XAF) est activé pour ${periodLabel}.`,
            type: "success",
            createdAt: now,
            read: false,
          });
        } catch {/* ignore */ }

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
              companyName: profile.companyName,
              fullAddress: profile.fullAddress,
              businessPhone: profile.businessPhone,
              rcsNumber: profile.rcsNumber,
              nifNumber: profile.nifNumber,
              legalMentions: profile.legalMentions,
              customMessage: profile.customMessage,
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
        if (!returnClientElectron) {
          setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
        }
      }
    };
    run();
  }, [user, profile, navigate, searchParams]);

  const reference = searchParams.get('reference') || '';
  const paymentType = searchParams.get('type') || '';
  const isMenuDigitalPayment = reference.includes('menu-digital');
  const isEventTicketPayment = reference.includes('event-ticket') || paymentType === 'event-ticket';
  const wantsDesktopReturn = searchParams.get("returnClient") === "electron";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full text-center space-y-6 bg-white rounded-2xl shadow-xl p-8">
        {establishmentInfo?.logoUrl && (
          <div className="flex justify-center mb-4">
            <img
              src={establishmentInfo.logoUrl}
              alt={establishmentInfo.name}
              className="w-20 h-20 rounded-full object-cover border-4 border-green-500"
            />
          </div>
        )}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          {isMenuDigitalPayment || isEventTicketPayment ? 'Paiement confirmé !' : 'Paiement confirmé'}
        </h1>
        <p className="text-sm text-gray-600">
          {wantsDesktopReturn
            ? isMenuDigitalPayment || isEventTicketPayment
              ? "Paiement enregistré. Utilisez le bouton ci-dessous pour revenir à l'application NACK."
              : "Votre abonnement est activé. Revenez à l'application NACK pour continuer (synchronisation automatique avec votre compte)."
            : isMenuDigitalPayment
              ? 'Votre commande a été payée avec succès. Vous allez être redirigé vers le menu...'
              : isEventTicketPayment
                ? 'Votre billet a été payé avec succès. Vous allez être redirigé...'
                : 'Votre abonnement a été activé. Redirection…'}
        </p>
        {wantsDesktopReturn && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-left space-y-3">
            <p className="text-sm font-medium text-emerald-950">Retour à l&apos;application</p>
            <p className="text-xs text-emerald-900">
              Vous pouvez fermer cet onglet après être revenu dans NACK. Les données sont déjà enregistrées.
            </p>
            <Button asChild className="w-full" size="lg">
              <a href="nack://open">Ouvrir l&apos;application NACK</a>
            </Button>
          </div>
        )}
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-800">
          <p className="font-semibold mb-1">💳 Paiement par Airtel Money</p>
          <p className="text-xs">Le paiement est disponible uniquement via <strong>Airtel Money</strong> pour le moment.</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
