export type LoyaltyType = 'points' | 'amount' | 'vip';
export type CustomerStatus = 'classic' | 'fidel' | 'vip';

export interface CustomerDoc {
  // Informations de base
  firstName: string;
  lastName: string;
  phone: string; // unique
  email?: string;
  photoUrl?: string;
  customerId: string; // ID généré automatiquement
  
  // Système de fidélité
  loyaltyType: LoyaltyType;
  status: CustomerStatus;
  
  // Points (pour carte à points)
  points: number;
  totalPointsEarned: number; // Total historique
  pointsConfig?: {
    pointsPer1000XAF: number; // Ex: 10 points par 1000 XAF
    bonusThreshold: number; // Ex: 100 points = récompense
    autoReset: boolean; // Réinitialiser après récompense
  };
  
  // Montant cumulé (pour fidélité par montant)
  totalAmountSpent: number;
  amountThresholds?: number[]; // [20000, 50000, 100000]
  unlockedRewards?: string[]; // IDs des récompenses débloquées
  
  // VIP
  vipThreshold?: number; // Montant pour devenir VIP
  vipSince?: number; // Date de passage VIP
  
  // Récompenses
  availableRewards: Reward[];
  rewardHistory: RewardHistory[];
  
  // Historique
  totalOrders: number;
  lastVisit?: number; // timestamp
  mostOrderedItems?: { productId: string; productName: string; quantity: number }[];
  
  // Notes internes
  notes?: string;
  allergies?: string[];
  preferences?: string[];
  
  // Métadonnées
  createdAt: number;
  updatedAt: number;
  ownerUid: string;
}

export interface Reward {
  id: string;
  type: 'drink' | 'discount' | 'free_item' | 'vip_benefit';
  title: string;
  description: string;
  value?: number; // Pourcentage de remise ou montant
  pointsRequired?: number;
  amountThreshold?: number;
  expiresAt?: number;
  used: boolean;
  usedAt?: number;
  createdAt: number;
}

export interface RewardHistory {
  rewardId: string;
  rewardTitle: string;
  usedAt: number;
  orderId?: string;
  orderNumber?: number;
}

export interface Customer {
  id: string; // Firestore doc ID
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  photoUrl?: string;
  customerId: string;
  loyaltyType: LoyaltyType;
  status: CustomerStatus;
  points: number;
  totalPointsEarned: number;
  totalAmountSpent: number;
  totalOrders: number;
  lastVisit?: Date;
  availableRewards: Reward[];
  notes?: string;
  allergies?: string[];
  preferences?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LoyaltyConfig {
  // Configuration globale de l'établissement
  pointsMode: {
    enabled: boolean;
    pointsPer1000XAF: number;
    bonusThreshold: number;
    autoReset: boolean;
  };
  amountMode: {
    enabled: boolean;
    thresholds: number[];
  };
  vipMode: {
    enabled: boolean;
    threshold: number; // Montant pour devenir VIP
    benefits: {
      permanentDiscount?: number; // Pourcentage
      priorityService: boolean;
      skipQueue: boolean;
    };
  };
}

