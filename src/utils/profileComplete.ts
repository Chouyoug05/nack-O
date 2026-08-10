import type { UserProfile } from "@/types/profile";

/** Profil assez rempli pour accéder au dashboard (évite la boucle complete-profile). */
export function isProfileComplete(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  const name = String(profile.establishmentName || "").trim();
  const owner = String(profile.ownerName || "").trim();
  return Boolean(name && owner);
}
