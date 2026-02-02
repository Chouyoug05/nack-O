import type { UserProfile } from "@/types/profile";
import { db } from "@/lib/firebase";
import { subscriptionPlanDocRef } from "@/lib/collections";
import { getDoc } from "firebase/firestore";

export type SubscriptionPlan = 'trial' | 'transition' | 'transition-pro-max' | 'expired';

export interface SubscriptionFeatures {
  products: boolean; // Accès aux produits
  sales: boolean; // Vendre
  stock: boolean; // Voir le stock
  reports: boolean; // Voir les rapports
  team: boolean; // Gérer les équipiers
  barConnectee: boolean; // Bar connectée
  events: boolean; // Créer des événements
  eventsLimit?: number; // Nombre d'événements inclus (pour Pro Max)
  eventsExtraPrice?: number; // Prix par événement supplémentaire
}

export const SUBSCRIPTION_PLANS = {
  transition: {
    name: 'Transition',
    price: 5000,
    features: {
      products: true,
      sales: true,
      stock: true,
      reports: true,
      team: false,
      barConnectee: false,
      events: false,
    } as SubscriptionFeatures,
  },
  'transition-pro-max': {
    name: 'Transition Pro Max',
    price: 15000,
    features: {
      products: true,
      sales: true,
      stock: true,
      reports: true,
      team: true,
      barConnectee: true,
      events: true,
      eventsLimit: 5,
      eventsExtraPrice: 1500,
    } as SubscriptionFeatures,
  },
} as const;

/** Commission affilié par type d'abonnement payé (versée par l'admin à la date du paiement) */
export const AFFILIATE_COMMISSION_STANDARD = 1000; // XAF par paiement abo Transition
export const AFFILIATE_COMMISSION_PRO = 2000;      // XAF par paiement abo Pro Max

export const EVENT_PRICE_STANDALONE = 1500; // Prix pour 1 événement avec agent (offre Transition standalone)

/**
 * Détermine le plan actuel d'un utilisateur
 */
export function getCurrentPlan(profile: UserProfile | null | undefined): SubscriptionPlan {
  if (!profile) return 'expired';
  
  const now = Date.now();
  
  // Vérifier si en essai
  if (profile.plan === 'trial') {
    const trialEndsAt = profile.trialEndsAt ?? 0;
    if (trialEndsAt > now) {
      return 'trial';
    }
    return 'expired';
  }
  
  // Vérifier l'abonnement actif
  // Si plan est 'active' OU si subscriptionType est défini (pour assurer la compatibilité)
  if ((profile.plan === 'active' || profile.subscriptionType) && profile.subscriptionEndsAt) {
    if (profile.subscriptionEndsAt > now) {
      // Retourner le type d'abonnement ou 'transition' par défaut
      return profile.subscriptionType || 'transition';
    }
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
  
  // En essai, tout est accessible
  if (plan === 'trial') {
    return true;
  }
  
  // Si expiré, rien n'est accessible
  if (plan === 'expired') {
    return false;
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
  
  if (plan === 'trial') return true;
  if (plan === 'expired') return false;
  
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
  
  // En essai, autorisé
  if (plan === 'trial') {
    return { allowed: true };
  }
  
  // Si expiré, non autorisé
  if (plan === 'expired') {
    return { allowed: false, reason: 'Votre abonnement a expiré' };
  }
  
  // Transition de base : pas d'événements
  if (plan === 'transition') {
    return {
      allowed: false,
      reason: 'Les événements ne sont pas disponibles avec l\'offre Transition. Passez à Transition Pro Max pour créer des événements.',
      needsPayment: true,
    };
  }
  
  // Pro Max : vérifier la limite
  if (plan === 'transition-pro-max') {
    // Charger le plan depuis Firestore de manière asynchrone
    // Pour l'instant, utiliser les valeurs par défaut (sera amélioré si nécessaire)
    const eventsLimit = SUBSCRIPTION_PLANS['transition-pro-max'].features.eventsLimit ?? 5;
    const eventsCount = profile.eventsCount ?? 0;
    const eventsResetAt = profile.eventsResetAt ?? profile.subscriptionEndsAt ?? Date.now();
    const now = Date.now();
    
    // Si on est dans une nouvelle période, réinitialiser le compteur
    if (eventsResetAt && now > eventsResetAt) {
      return { allowed: true };
    }
    
    // Vérifier si on a dépassé la limite
    if (eventsCount >= eventsLimit) {
      const extraPrice = SUBSCRIPTION_PLANS['transition-pro-max'].features.eventsExtraPrice ?? 1500;
      return {
        allowed: true,
        needsPayment: true,
        extraPrice,
        reason: `Vous avez atteint la limite de ${eventsLimit} événements. Chaque événement supplémentaire coûte ${extraPrice} XAF.`,
      };
    }
    
    return { allowed: true };
  }
  
  return { allowed: false, reason: 'Plan non reconnu' };
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

