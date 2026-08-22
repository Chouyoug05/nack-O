import { doc, setDoc, type Firestore } from "firebase/firestore";
import type { UserProfile } from "@/types/profile";

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
  /** ID du design de menu sélectionné */
  menuDesignId?: string;
  updatedAt: number;
}

export function buildPublicProfile(profile: Partial<UserProfile> & { uid: string }): PublicProfile {
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
    menuDesignId: profile.menuDesignId,
    updatedAt: profile.updatedAt ?? Date.now(),
  };
}

export async function syncPublicProfile(
  db: Firestore,
  profile: Partial<UserProfile> & { uid: string }
): Promise<void> {
  const payload = buildPublicProfile(profile);
  await setDoc(doc(db, "publicProfiles", profile.uid), payload, { merge: true });
}
