import type { UserProfile } from "@/types/profile";
import { getAssignedTabletImei } from "@/lib/tabletsSupport";

const UNLOCK_KEY = "nack_tablet_full_access_until";
const DEFAULT_UNLOCK_MS = 8 * 60 * 60 * 1000; // 8 h

/** Mode restreint uniquement si l'admin a assigné un IMEI au compte. */
export function isTabletRestrictedMode(
  _uid: string | undefined,
  profile: UserProfile | null | undefined
): boolean {
  const imei = getAssignedTabletImei(profile);
  if (!imei) return false;
  try {
    const until = Number(sessionStorage.getItem(UNLOCK_KEY) || "0");
    return Date.now() >= until;
  } catch {
    return true;
  }
}

export function unlockTabletFullAccess(ms: number = DEFAULT_UNLOCK_MS): void {
  try {
    sessionStorage.setItem(UNLOCK_KEY, String(Date.now() + ms));
  } catch {
    /* ignore */
  }
}

export function lockTabletRestrictedMode(): void {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}
