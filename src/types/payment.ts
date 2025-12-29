export interface PaymentTransaction {
  id: string;
  userId: string;
  transactionId: string; // ID unique de la transaction
  subscriptionType: 'transition' | 'transition-pro-max' | 'menu-digital';
  amount: number; // Montant en XAF
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  paymentMethod: 'airtel-money' | 'moov-money' | 'other';
  reference: string; // Référence du paiement SingPay
  paymentLink?: string; // URL du lien de paiement généré
  redirectSuccess?: string; // URL de redirection en cas de succès
  redirectError?: string; // URL de redirection en cas d'erreur
  createdAt: number; // Timestamp de création de la transaction
  paidAt?: number; // Timestamp de paiement confirmé
  subscriptionEndsAt?: number; // Date de fin d'abonnement après paiement
  notes?: string; // Notes supplémentaires
  // Pour les paiements Menu Digital
  orderId?: string; // ID de la commande associée (créée après paiement réussi)
  establishmentId?: string; // ID de l'établissement
  disbursementId?: string; // Disbursement ID utilisé pour ce paiement
  orderData?: any; // Données de la commande à créer après paiement réussi (si paiement demandé)
}

export interface DisbursementRequest {
  id: string;
  userId: string;
  establishmentName: string;
  ownerName: string;
  email: string;
  airtelMoneyNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  disbursementId?: string; // Rempli par l'admin
  requestedAt: number;
  approvedAt?: number;
  approvedBy?: string; // ID de l'admin qui a approuvé
  rejectionReason?: string;
  notes?: string;
}

