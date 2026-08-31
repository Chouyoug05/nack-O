import { doc, setDoc, type Firestore } from "firebase/firestore";
import type { UserProfile } from "@/types/profile";
import type { MenuDesignId } from "@/types/menuConfig";

/** Données établissement exposables sans authentification (menu QR, carte). */
export interface PublicProfile {
  uid: string;
  establishmentName: string;
  establishmentType?: string;
  logoUrl?: string;
  ownerName?: string;
  address?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
  companyName?: string;
  businessPhone?: string;
  rcsNumber?: string;
  nifNumber?: string;
  legalMentions?: string;
  customMessage?: string;
  ticketLogoUrl?: string;
  showDeliveryMention?: boolean;
  showCSSMention?: boolean;
  cssPercentage?: number;
  ticketFooterMessage?: string;
  deliveryEnabled?: boolean;
  deliveryPrice?: number;
  /** true si disbursement approuvé — sans exposer l'ID */
  paymentsEnabled?: boolean;
  /** true si la feature menu digital / boutique en ligne est activée. */
  menuConfigEnabled?: boolean;
  /** ID du design sélectionné pour le menu public. */
  menuDesignId?: MenuDesignId;
  /** Quand true, le menu public n'affiche que daily + vedette si au moins un daily existe. */
  dailySpecialMode?: boolean;
  updatedAt: number;
}

export interface MenuConfigPublicFields {
  menuConfigEnabled?: boolean;
  menuDesignId?: MenuDesignId;
  dailySpecialMode?: boolean;
}

export function buildPublicProfile(
  profile: Partial<UserProfile> & { uid: string },
  menuFields?: MenuConfigPublicFields,
): PublicProfile {
  const paymentsEnabled =
    profile.disbursementStatus === "approved" && Boolean(String(profile.disbursementId || "").trim());

  return {
    uid: profile.uid,
    establishmentName: profile.establishmentName || "Établissement",
    establishmentType: profile.establishmentType,
    logoUrl: profile.logoUrl,
    ownerName: profile.ownerName,
    address: profile.address,
    fullAddress: profile.fullAddress,
    latitude: profile.latitude,
    longitude: profile.longitude,
    companyName: profile.companyName,
    businessPhone: profile.businessPhone,
    rcsNumber: profile.rcsNumber,
    nifNumber: profile.nifNumber,
    legalMentions: profile.legalMentions,
    customMessage: profile.customMessage,
    ticketLogoUrl: profile.ticketLogoUrl,
    showDeliveryMention: profile.showDeliveryMention,
    showCSSMention: profile.showCSSMention,
    cssPercentage: profile.cssPercentage,
    ticketFooterMessage: profile.ticketFooterMessage,
    deliveryEnabled: profile.deliveryEnabled,
    deliveryPrice: profile.deliveryPrice,
    paymentsEnabled,
    menuConfigEnabled: menuFields?.menuConfigEnabled,
    menuDesignId: menuFields?.menuDesignId,
    dailySpecialMode: menuFields?.dailySpecialMode,
    updatedAt: profile.updatedAt ?? Date.now(),
  };
}

export async function syncPublicProfile(
  db: Firestore,
  profile: Partial<UserProfile> & { uid: string },
  menuFields?: MenuConfigPublicFields,
): Promise<void> {
  const raw = buildPublicProfile(profile, menuFields);
  const payload = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined)
  );
  await setDoc(doc(db, "publicProfiles", profile.uid), payload, { merge: true });
}
