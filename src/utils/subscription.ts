import type { UserProfile } from "@/types/profile";
import { db } from "@/lib/firebase";
import { subscriptionPlanDocRef } from "@/lib/collections";
import { getDoc } from "firebase/firestore";

export type SubscriptionPlan = 'trial' | 'free' | 'transition' | 'transition-pro-max' | 'expired';

export interface SubscriptionFeatures {
  products: boolean; // Accès aux produits
  productLimit?: number; // Limite de produits (pour le plan gratuit)
  sales: boolean; // Vendre
  stock: boolean; // Voir le stock
  reports: boolean; // Voir les rapports
  team: boolean; // Gérer les équipiers
  disbursementRequest: boolean; // Possibilité de demander un Disbursement ID
  events: boolean; // Créer des événements
  eventsLimit?: number; // Nombre d'événements inclus (pour Pro Max)
  eventsExtraPrice?: number; // Prix par événement supplémentaire
  menuDigital: boolean; // Menu digital / Boutique en ligne
}

export const SUBSCRIPTION_PLANS = {
  expired: {
    name: 'Expiré',
    price: 0,
    features: {
      products: true,
      productLimit: 0,
      sales: false,
      stock: false,
      reports: false,
      team: false,
      disbursementRequest: false,
      events: false,
      eventsLimit: 0,
      eventsExtraPrice: 1000,
      menuDigital: false,
    } as SubscriptionFeatures,
  },
  free: {
    name: 'Gratuit',
    price: 0,
    features: {
      products: true,
      productLimit: 10,
      sales: true,
      stock: true,
      reports: true,
      team: false,
      disbursementRequest: false,
      events: true,
      eventsLimit: 0,
      eventsExtraPrice: 1000,
      menuDigital: true,
    } as SubscriptionFeatures,
  },
  transition: {
    name: 'Standard',
    price: 3000,
    features: {
      products: true,
      sales: true,
      stock: true,
      reports: true,
      team: false,
      disbursementRequest: false,
      events: true,
      eventsLimit: 5,
      eventsExtraPrice: 1000,
      menuDigital: true,
    } as SubscriptionFeatures,
  },
  'transition-pro-max': {
    name: 'Premium',
    price: 7500,
    features: {
      products: true,
      sales: true,
      stock: true,
      reports: true,
      team: true,
      disbursementRequest: true,
      events: true,
      eventsExtraPrice: 1000,
      menuDigital: true,
    } as SubscriptionFeatures,
  },
} as const;

/** Commission affilié par type d'abonnement payé (versée par l'admin à la date du paiement) */
export const AFFILIATE_COMMISSION_STANDARD = 1000; // XAF par paiement abo Standard
export const AFFILIATE_COMMISSION_PRO = 2000;      // XAF par paiement abo Premium

export const EVENT_PRICE_STANDALONE = 1000; // Prix pour 1 événement avec agent

/**
 * Détermine le plan actuel d'un utilisateur
 */
export function getCurrentPlan(profile: UserProfile | null | undefined): SubscriptionPlan {
  if (!profile) return 'expired';
  
  const now = Date.now();
  
  // Essai gratuit (trial)
  if (profile.plan === 'trial') {
    if (profile.trialEndsAt && profile.trialEndsAt > now) {
      return 'free';
    }
    return 'expired';
  }
  
  // Plan gratuit explicite
  if (profile.plan === 'free') {
    return 'free';
  }
  
  // Déjà expiré
  if (profile.plan === 'expired') {
    return 'expired';
  }
  
  // Vérifier l'abonnement actif
  if ((profile.plan === 'active' || profile.subscriptionType) && profile.subscriptionEndsAt) {
    if (profile.subscriptionEndsAt > now) {
      return profile.subscriptionType || 'transition';
    }
    return 'expired';
  }
  
  return 'expired';
}

/**
 * Charge un plan depuis Firestore avec fallback sur les valeurs par défaut
 */
export async function getPlanFromFirestore(planKey: 'transition' | 'transition-pro-max') {
  try {
    const planRef = subscriptionPlanDocRef(db, planKey);
    const planSnap = await getDoc(planRef);
    
    if (planSnap.exists()) {
      const planData = planSnap.data();
      return {
        name: planData.name || SUBSCRIPTION_PLANS[planKey].name,
        price: planData.price ?? SUBSCRIPTION_PLANS[planKey].price,
        features: {
          ...SUBSCRIPTION_PLANS[planKey].features,
          ...planData.features,
        },
      };
    }
  } catch (error) {
    console.error(`Erreur chargement plan ${planKey} depuis Firestore:`, error);
  }
  
  // Fallback sur les valeurs par défaut
  return SUBSCRIPTION_PLANS[planKey];
}

/**
 * Vérifie si l'utilisateur a accès à une fonctionnalité
 */
export async function hasFeatureAccess(
  profile: UserProfile | null | undefined,
  feature: keyof SubscriptionFeatures
): Promise<boolean> {
  const plan = getCurrentPlan(profile);
  
  if (plan === 'expired') {
    return SUBSCRIPTION_PLANS.expired.features[feature] === true;
  }
  
  if (plan === 'free' || plan === 'trial') {
    return SUBSCRIPTION_PLANS.free.features[feature] === true;
  }
  
  // Charger le plan depuis Firestore
  if (plan === 'transition') {
    const planData = await getPlanFromFirestore('transition');
    return planData.features[feature] === true;
  }
  
  if (plan === 'transition-pro-max') {
    const planData = await getPlanFromFirestore('transition-pro-max');
    return planData.features[feature] === true;
  }
  
  return false;
}

/**
 * Version synchrone pour compatibilité (utilise les valeurs par défaut)
 */
export function hasFeatureAccessSync(
  profile: UserProfile | null | undefined,
  feature: keyof SubscriptionFeatures
): boolean {
  const plan = getCurrentPlan(profile);
  
  if (plan === 'expired') {
    return SUBSCRIPTION_PLANS.expired.features[feature] === true;
  }
  
  if (plan === 'free' || plan === 'trial') {
    return SUBSCRIPTION_PLANS.free.features[feature] === true;
  }
  
  if (plan === 'transition') {
    return SUBSCRIPTION_PLANS.transition.features[feature] === true;
  }
  
  if (plan === 'transition-pro-max') {
    return SUBSCRIPTION_PLANS['transition-pro-max'].features[feature] === true;
  }
  
  return false;
}

/**
 * Vérifie si l'utilisateur peut créer un événement
 */
export function canCreateEvent(profile: UserProfile | null | undefined): {
  allowed: boolean;
  reason?: string;
  needsPayment?: boolean;
  extraPrice?: number;
} {
  const plan = getCurrentPlan(profile);
  
  // Pour tous les plans, on vérifie la limite d'événements et le prix supplémentaire
  let eventsLimit = 0;
  let extraPrice = 1000;
  
  if (plan === 'expired') {
    return { allowed: false, reason: 'Votre abonnement a expiré. Veuillez le renouveler pour créer des événements.' };
  }
  
  if (plan === 'free' || plan === 'trial') {
    eventsLimit = SUBSCRIPTION_PLANS.free.features.eventsLimit ?? 0;
    extraPrice = SUBSCRIPTION_PLANS.free.features.eventsExtraPrice ?? 1000;
  } else if (plan === 'transition') {
    eventsLimit = SUBSCRIPTION_PLANS.transition.features.eventsLimit ?? 5;
    extraPrice = SUBSCRIPTION_PLANS.transition.features.eventsExtraPrice ?? 1000;
  } else if (plan === 'transition-pro-max') {
    const limit = SUBSCRIPTION_PLANS['transition-pro-max'].features.eventsLimit;
    eventsLimit = limit !== undefined ? limit : Infinity;
    extraPrice = SUBSCRIPTION_PLANS['transition-pro-max'].features.eventsExtraPrice ?? 1000;
  }

  const eventsCount = profile.eventsCount ?? 0;
  const eventsResetAt = profile.eventsResetAt ?? profile.subscriptionEndsAt ?? Date.now();
  const now = Date.now();
  
  if (eventsLimit === Infinity) {
    return { allowed: true };
  }

  if (eventsResetAt && now > eventsResetAt && plan !== 'free') {
    return { allowed: true };
  }
  
  if (eventsCount >= eventsLimit) {
    return {
      allowed: true,
      needsPayment: true,
      extraPrice,
      reason: eventsLimit > 0 
        ? `Vous avez atteint la limite de ${eventsLimit} événements inclus. Chaque événement supplémentaire coûte ${extraPrice} XAF.`
        : `La création d'événement coûte ${extraPrice} XAF par événement.`,
    };
  }
  
  return { allowed: true };
}

/**
 * Compte le nombre d'événements créés dans la période actuelle
 */
export function getCurrentEventsCount(profile: UserProfile | null | undefined): number {
  if (!profile) return 0;
  
  const eventsResetAt = profile.eventsResetAt ?? profile.subscriptionEndsAt;
  const now = Date.now();
  
  // Si on est dans une nouvelle période, le compteur doit être réinitialisé
  if (eventsResetAt && now > eventsResetAt) {
    return 0;
  }
  
  return profile.eventsCount ?? 0;
}

