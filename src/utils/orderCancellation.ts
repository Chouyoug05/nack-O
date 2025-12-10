import { db } from "@/lib/firebase";
import { orderCancellationsColRef, ordersColRef, barOrdersColRef, salesColRef } from "@/lib/collections";
import { addDoc, doc, getDoc, query, where, getDocs, orderBy, updateDoc, Timestamp } from "firebase/firestore";
import type { OrderCancellationDoc } from "@/types/orderCancellation";
import type { OrderStatus } from "@/types/order";
import type { SaleDoc } from "@/types/inventory";

/**
 * Configuration pour l'annulation de commande
 */
export const CANCELLATION_CONFIG = {
  MAX_DELAY_MINUTES: 30, // Délai maximum pour annuler une commande validée (en minutes)
  MIN_REASON_LENGTH: 5, // Longueur minimale de la raison
};

/**
 * Vérifie si une commande peut être annulée
 */
export async function canCancelOrder(
  orderId: string,
  ownerUid: string,
  orderStatus: OrderStatus,
  orderCreatedAt: number | Date
): Promise<{ canCancel: boolean; reason?: string }> {
  // Ne pas permettre l'annulation si la commande est déjà servie ou terminée
  if (orderStatus === 'served' || orderStatus === 'completed' || orderStatus === 'termine') {
    return {
      canCancel: false,
      reason: "Impossible d'annuler : la commande est déjà servie ou terminée."
    };
  }

  // Pour les commandes validées ('sent'), vérifier le délai
  if (orderStatus === 'sent') {
    const createdAt = orderCreatedAt instanceof Date 
      ? orderCreatedAt.getTime() 
      : (typeof orderCreatedAt === 'number' ? orderCreatedAt : Date.now());
    
    const now = Date.now();
    const delayMs = now - createdAt;
    const delayMinutes = delayMs / (1000 * 60);

    if (delayMinutes > CANCELLATION_CONFIG.MAX_DELAY_MINUTES) {
      return {
        canCancel: false,
        reason: `Impossible d'annuler : le délai d'annulation (${CANCELLATION_CONFIG.MAX_DELAY_MINUTES} minutes) est dépassé.`
      };
    }
  }

  return { canCancel: true };
}

/**
 * Vérifie si un remboursement est nécessaire en cherchant une vente correspondante
 */
export async function checkRefundRequired(
  orderId: string,
  ownerUid: string,
  orderTotal: number,
  orderCreatedAt: number | Date
): Promise<{ refundRequired: boolean; paymentMethod?: string }> {
  try {
    const salesQuery = query(
      salesColRef(db, ownerUid),
      orderBy("createdAt", "desc")
    );
    const salesSnapshot = await getDocs(salesQuery);
    
    const orderCreatedAtMs = orderCreatedAt instanceof Date 
      ? orderCreatedAt.getTime() 
      : (typeof orderCreatedAt === 'number' ? orderCreatedAt : Date.now());
    
    // Chercher une vente créée après la commande avec le même total
    const matchingSale = salesSnapshot.docs.find(doc => {
      const sale = doc.data() as SaleDoc;
      const saleCreatedAt = sale.createdAt;
      // Vente créée dans les 30 minutes après la commande et avec le même total
      return saleCreatedAt >= orderCreatedAtMs 
        && saleCreatedAt <= orderCreatedAtMs + (30 * 60 * 1000)
        && Math.abs(sale.total - orderTotal) < 1; // Tolérance de 1 XAF pour les arrondis
    });

    if (matchingSale) {
      const sale = matchingSale.data() as SaleDoc;
      return {
        refundRequired: true,
        paymentMethod: sale.paymentMethod
      };
    }
  } catch (error) {
    console.error('Erreur lors de la vérification des ventes:', error);
  }

  return { refundRequired: false };
}

/**
 * Annule une commande avec journalisation complète
 */
export async function cancelOrderWithLogging(
  orderId: string,
  ownerUid: string,
  orderNumber: number | string,
  orderStatus: OrderStatus,
  orderTotal: number,
  orderCreatedAt: number | Date,
  cancelledBy: string,
  cancelledByName: string,
  reason: string,
  refundRequired: boolean,
  paymentMethod?: string,
  metadata?: OrderCancellationDoc['metadata']
): Promise<void> {
  // Vérifier les permissions (doit être le propriétaire ou un agent autorisé)
  // Cette vérification doit être faite avant l'appel à cette fonction

  // Vérifier si l'annulation est possible
  const canCancel = await canCancelOrder(orderId, ownerUid, orderStatus, orderCreatedAt);
  if (!canCancel.canCancel) {
    throw new Error(canCancel.reason || "Annulation non autorisée");
  }

  // Créer l'enregistrement d'annulation
  const cancellationDoc: OrderCancellationDoc = {
    orderId,
    orderNumber: String(orderNumber),
    cancelledBy,
    cancelledByName,
    reason,
    cancelledAt: Date.now(),
    previousStatus: orderStatus,
    orderTotal,
    refundRequired,
    refundStatus: refundRequired ? 'pending' : undefined,
    paymentMethod,
    metadata
  };

  // Enregistrer l'annulation
  await addDoc(orderCancellationsColRef(db, ownerUid), cancellationDoc);

  // Mettre à jour le statut de la commande
  // Essayer d'abord dans orders, puis dans barOrders
  try {
    const orderRef = doc(ordersColRef(db, ownerUid), orderId);
    const orderSnap = await getDoc(orderRef);
    if (orderSnap.exists()) {
      await updateDoc(orderRef, { 
        status: 'cancelled' as OrderStatus,
        cancelledAt: Date.now(),
        cancellationReason: reason
      });
      return;
    }
  } catch (error) {
    // Ignorer si la commande n'est pas dans orders
  }

  try {
    const barOrderRef = doc(barOrdersColRef(db, ownerUid), orderId);
    const barOrderSnap = await getDoc(barOrderRef);
    if (barOrderSnap.exists()) {
      await updateDoc(barOrderRef, { 
        status: 'cancelled',
        cancelledAt: Date.now(),
        cancellationReason: reason
      });
      return;
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la commande bar:', error);
  }

  throw new Error("Commande introuvable pour annulation");
}

