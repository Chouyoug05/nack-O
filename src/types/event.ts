export interface EventDoc {
  title: string;
  description: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  location: string;
  maxCapacity: number;
  ticketPrice: number;
  currency: string;
  createdAt: number;
  isActive: boolean;
  ticketsSold: number;
  shareableLink?: string;
  imageUrl?: string;
  ownerUid?: string;
  eventId?: string;
  organizerWhatsapp?: string;
  paymentEnabled?: boolean; // Activer le paiement en ligne pour cet événement
}

export type TicketStatus = 'paid' | 'pending' | 'cancelled';

export interface TicketDoc {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  quantity: number;
  totalAmount: number;
  status: TicketStatus;
  purchaseDate: number; // epoch ms
  validated?: boolean;
  validatedAt?: number;
} 