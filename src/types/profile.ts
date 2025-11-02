export interface UserProfile {
  uid: string;
  establishmentName: string;
  establishmentType: string;
  ownerName: string;
  email: string;
  phone: string;
  whatsapp?: string; // Numéro WhatsApp obligatoire
  logoUrl?: string;
  logoDeleteToken?: string;
  // Sécurité gérant
  managerPinHash?: string; // SHA-256 hex of optional manager code (not account password)
  // Abonnement
  plan?: 'trial' | 'active' | 'expired';
  trialEndsAt?: number; // epoch ms
  subscriptionEndsAt?: number; // epoch ms
  lastPaymentAt?: number; // epoch ms
  // Tutoriel
  tutorialCompleted?: boolean;
  tutorialStep?: 'stock' | 'first-product' | 'sales' | 'report' | 'security' | 'completed';
  // Géolocalisation
  latitude?: number;
  longitude?: number;
  address?: string; // Adresse formatée
  locationAsked?: boolean; // Indique si on a déjà demandé la géolocalisation
  createdAt: number;
  updatedAt: number;
} 