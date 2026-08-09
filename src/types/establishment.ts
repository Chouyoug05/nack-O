export interface EstablishmentDoc {
  id: string;
  ownerUid: string;
  name: string;
  type: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  logoUrl?: string;
  logoDeleteToken?: string;
  managerPinHash?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  locationAsked?: boolean;
  companyName?: string;
  rcsNumber?: string;
  nifNumber?: string;
  businessPhone?: string;
  fullAddress?: string;
  customMessage?: string;
  legalMentions?: string;
  ticketLogoUrl?: string;
  showDeliveryMention?: boolean;
  showCSSMention?: boolean;
  cssPercentage?: number;
  ticketFooterMessage?: string;
  airtelMoneyNumber?: string;
  deliveryEnabled?: boolean;
  deliveryPrice?: number;
  plan?: 'trial' | 'active' | 'expired' | 'free';
  subscriptionType?: 'transition' | 'transition-pro-max';
  trialEndsAt?: number;
  subscriptionEndsAt?: number;
  lastPaymentAt?: number;
  eventsCount?: number;
  extraEventsBilled?: number;
  eventsResetAt?: number;
  tutorialCompleted?: boolean;
  tutorialStep?: 'stock' | 'first-product' | 'sales' | 'report' | 'security' | 'completed';
  createdAt: number;
  updatedAt: number;
}

export interface EstablishmentRef {
  id: string;
  name: string;
  type: string;
  logoUrl?: string;
}
