export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  image?: string;
  imageUrl?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export type OrderStatus =
  | 'awaiting-validation' // Commande créée → en attente de validation serveur
  | 'validated'           // Validée par serveur → envoyée au cuisinier
  | 'in-preparation'      // En préparation (cuisine)
  | 'ready'               // Préparation terminée → prête, serveur notifié
  | 'delivered'           // Livrée au client
  | 'paid'                // Payée (encaissée)
  | 'closed'              // Clôturée
  | 'cancelled';          // Annulée
export type PaymentStatus = 'unpaid' | 'paid';
export type PaymentMethod = 'cash' | 'mobile' | 'card' | 'airtel-money' | 'moov-money';

export interface Order {
  id: string;
  orderNumber: number | string;
  tableNumber: string;
  /** ID structuré de la table (menu digital) — optionnel, rétrocompatible. */
  tableId?: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paidBy?: 'server' | 'manager';
  source?: 'qr' | 'internal';
  createdAt: Date;
  agentCode: string;
  agentName?: string;
  // Attribution des acteurs du circuit
  serverId?: string;
  serverName?: string;
  cookId?: string;
  cookName?: string;
  managerId?: string;
  // Horodatage des transitions
  validatedByServerAt?: number;
  startedAt?: number;
  completedByCookAt?: number;
  deliveredAt?: number;
  paidAt?: number;
  closedAt?: number;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  'awaiting-validation': 'En attente de validation serveur',
  'validated': 'Validée par serveur',
  'in-preparation': 'En préparation',
  'ready': 'Prête / Serveur notifié',
  'delivered': 'Livrée',
  'paid': 'Payée',
  'closed': 'Clôturée',
  'cancelled': 'Annulée',
};