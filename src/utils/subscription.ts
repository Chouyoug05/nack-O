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
  barConnectee: boolean; // Bar connectée
  menuDigital: boolean; // Accès au Menu Digital
  disbursementRequest: boolean; // Possibilité de demander un Disbursement ID
  events: boolean; // Créer des événements
  eventsLimit?: number; // Nombre d'événements inclus (pour Pro Max)
  eventsExtraPrice?: number; // Prix par événement supplémentaire
}

export const SUBSCRIPTION_PLANS = {
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
      barConnectee: false,
      menuDigital: false,
      disbursementRequest: false,
      events: true,
      eventsLimit: 0,
      eventsExtraPrice: 1000,
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
      barConnectee: true,
      menuDigital: true,
      disbursementRequest: false,
      events: true,
      eventsLimit: 5,
      eventsExtraPrice: 1000,
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
      barConnectee: true,
      menuDigital: true,
      disbursementRequest: true,
      events: true,
      eventsExtraPrice: 1000,
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
  
  // En mode freemium, trial ou expired reviennent au plan Gratuit (free)
  if (profile.plan === 'trial' || profile.plan === 'expired' || profile.plan === 'free') {
    return 'free';
  }
  
  // Vérifier l'abonnement actif
  // Si plan est 'active' OU si subscriptionType est défini (pour assurer la compatibilité)
  if ((profile.plan === 'active' || profile.subscriptionType) && profile.subscriptionEndsAt) {
    if (profile.subscriptionEndsAt > now) {
      // Retourner le type d'abonnement ou 'transition' par défaut
      return profile.subscriptionType || 'transition';
    }
  }
  
  return 'free';
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
  
  // Gratuit, tout passe par le feature set de 'free'
  if (plan === 'free' || plan === 'trial' || plan === 'expired') {
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
  
  if (plan === 'free' || plan === 'trial' || plan === 'expired') {
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
  
  if (plan === 'free' || plan === 'trial' || plan === 'expired') {
    eventsLimit = SUBSCRIPTION_PLANS.free.features.eventsLimit ?? 0;
    extraPrice = SUBSCRIPTION_PLANS.free.features.eventsExtraPrice ?? 1000;
  } else if (plan === 'transition') {
    eventsLimit = SUBSCRIPTION_PLANS.transition.features.eventsLimit ?? 5;
    extraPrice = SUBSCRIPTION_PLANS.transition.features.eventsExtraPrice ?? 1000;
  } else if (plan === 'transition-pro-max') {
    // Pro max: eventsLimit is Infinity implicitly if undefined, but let's handle it
    const limit = SUBSCRIPTION_PLANS['transition-pro-max'].features.eventsLimit;
    eventsLimit = limit !== undefined ? limit : Infinity;
    extraPrice = SUBSCRIPTION_PLANS['transition-pro-max'].features.eventsExtraPrice ?? 1000;
  }

  // Vérifier le compteur d'événements
  const eventsCount = profile.eventsCount ?? 0;
  const eventsResetAt = profile.eventsResetAt ?? profile.subscriptionEndsAt ?? Date.now();
  const now = Date.now();
  
  // Si on est dans une nouvelle période (pour les abonnements), le compteur est reset
  // Pour le plan gratuit, eventsResetAt ne sera probablement jamais dans le futur, donc ça s'accumule ?
  // En fait, peu importe, s'ils ont payé, on utilise le compteur pour voir s'ils ont épuisé le quota.
  // Pour les gratuits, limit = 0, donc ça demandera toujours un paiement.
  
  if (eventsLimit === Infinity) {
    return { allowed: true };
  }

  // Reset count if period is over
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

