export interface UserProfile {
  uid: string;
  establishmentName: string;
  establishmentType: string;
  ownerName: string;
  email: string;
  phone: string;
  logoUrl?: string;
  logoDeleteToken?: string;
  // Abonnement
  plan?: 'trial' | 'active' | 'expired';
  trialEndsAt?: number; // epoch ms
  subscriptionEndsAt?: number; // epoch ms
  lastPaymentAt?: number; // epoch ms
  createdAt: number;
  updatedAt: number;
} 