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
  subscriptionType?: 'transition' | 'transition-pro-max'; // Type d'abonnement payant
  trialEndsAt?: number; // epoch ms
  subscriptionEndsAt?: number; // epoch ms
  lastPaymentAt?: number; // epoch ms
  // Gestion des événements (pour Pro Max)
  eventsCount?: number; // Nombre d'événements créés dans la période
  extraEventsBilled?: number; // Nombre d'événements supplémentaires facturés
  eventsResetAt?: number; // Date de reset du compteur d'événements (début de période)
  // Tutoriel
  tutorialCompleted?: boolean;
  tutorialStep?: 'stock' | 'first-product' | 'sales' | 'report' | 'security' | 'completed';
  // Géolocalisation
  latitude?: number;
  longitude?: number;
  address?: string; // Adresse formatée
  locationAsked?: boolean; // Indique si on a déjà demandé la géolocalisation
  // Personnalisation des tickets
  companyName?: string; // Nom de la structure / Entreprise
  rcsNumber?: string; // Numéro RCS
  nifNumber?: string; // Numéro NIF
  businessPhone?: string; // Numéro de téléphone professionnel
  fullAddress?: string; // Adresse complète pour les tickets
  customMessage?: string; // Message personnalisé (ex : "Merci pour votre confiance ❤️")
  legalMentions?: string; // Mentions légales
  createdAt: number;
  updatedAt: number;
} 