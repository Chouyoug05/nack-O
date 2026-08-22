export interface UserProfile {
  uid: string;
  establishmentName: string;
  establishmentType: string;
  ownerName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  logoUrl?: string;
  logoDeleteToken?: string;
  managerPinHash?: string;
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
  latitude?: number;
  longitude?: number;
  address?: string;
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
  disbursementId?: string;
  disbursementStatus?: 'pending' | 'approved' | 'rejected';
  deliveryEnabled?: boolean;
  deliveryPrice?: number;
  fcmToken?: string;
  /** ID du design de menu sélectionné */
  menuDesignId?: string;
  /** IMEI assigné par l'admin — active le mode tablette restreint */
  assignedTabletImei?: string | null;
  assignedTabletLabel?: string | null;
  referredBy?: string;
  // Multi-établissement
  activeEstablishmentId?: string;
  establishments?: Array<{
    id: string;
    name: string;
    type: string;
    logoUrl?: string;
  }>;
  createdAt: number;
  updatedAt: number;
}

/** Document affilié (collection affiliates) – créé par l'admin. Id du doc = code (pour lecture publique par code) */
export interface AffiliateDoc {
  id?: string;
  code: string; // Code unique (ex: AFF001)
  name: string;
  whatsapp: string;
  password?: string;
  email?: string;
  referralCount?: number; // Nombre d'établissements parrainés (mis à jour par l'admin)
  /** Commission totale gagnée (1000 XAF par paiement standard, 2000 par pro) – versée par l'admin à la date du paiement */
  totalEarned?: number;
  /** Montant déjà versé à l'affilié par l'admin */
  paidEarnings?: number;
  /** Date du dernier versement */
  lastPaymentDate?: number;
  createdAt: number;
  createdBy: string; // uid admin
} 