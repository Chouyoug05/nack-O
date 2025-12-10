/**
 * Type pour les annulations de commande
 */
export interface OrderCancellationDoc {
  orderId: string;
  orderNumber: string;
  cancelledBy: string; // UID de l'utilisateur qui annule
  cancelledByName?: string; // Nom de l'utilisateur (pour affichage)
  reason: string; // Raison obligatoire (min 5 caractères)
  cancelledAt: number; // Timestamp
  previousStatus: 'pending' | 'sent' | 'served' | 'completed'; // Statut avant annulation
  orderTotal: number; // Montant de la commande
  refundRequired: boolean; // Si un remboursement est nécessaire
  refundStatus?: 'pending' | 'processed' | 'failed'; // Statut du remboursement
  paymentMethod?: 'cash' | 'mobile' | 'card'; // Méthode de paiement originale
  metadata?: {
    // Informations supplémentaires
    flowType?: 'direct_sale' | 'qr_order' | 'table_order' | 'bar_connectee';
    customerId?: string;
    tableNumber?: string;
    agentCode?: string;
  };
}

