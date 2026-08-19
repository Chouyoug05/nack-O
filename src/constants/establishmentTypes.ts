import { Wine, ShoppingBag, Store, Building2, GlassWater, Utensils, Pizza, Music, UtensilsCrossed, Hotel, Briefcase, HelpCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface MainCategoryConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export interface EstablishmentTypeConfig {
  value: string;
  label: string;
  main: string;
  icon: LucideIcon;
}

export const MAIN_CATEGORIES: MainCategoryConfig[] = [
  { id: "restauration", label: "Restauration & Bar", icon: Wine, description: "Bar, Restaurant, Snack, Boîte de nuit..." },
  { id: "boutique", label: "Boutique", icon: ShoppingBag, description: "Vêtements, Électronique, Accessoires..." },
  { id: "commerce", label: "Commerce", icon: Store, description: "Marché, Alimentation, Cosmétique..." },
  { id: "services", label: "Services & Entreprise", icon: Building2, description: "Imprimerie, Startup, Prestation..." },
];

export const ESTABLISHMENT_TYPES: EstablishmentTypeConfig[] = [
  { value: "bar", label: "Bar", main: "restauration", icon: GlassWater },
  { value: "restaurant", label: "Restaurant", main: "restauration", icon: Utensils },
  { value: "snack", label: "Snack Bar", main: "restauration", icon: Pizza },
  { value: "nightclub", label: "Boîte de nuit", main: "restauration", icon: Music },
  { value: "restaurant-bar", label: "Restaurant-Bar", main: "restauration", icon: UtensilsCrossed },
  { value: "hotel-bar", label: "Bar d'hôtel", main: "restauration", icon: Hotel },
  { value: "friperie", label: "Friperie", main: "boutique", icon: ShoppingBag },
  { value: "boutique-vetements", label: "Boutique vêtements", main: "boutique", icon: ShoppingBag },
  { value: "boutique-chaussures", label: "Boutique chaussures", main: "boutique", icon: ShoppingBag },
  { value: "boutique-electronique", label: "Boutique électronique", main: "boutique", icon: ShoppingBag },
  { value: "boutique-accessoires", label: "Boutique accessoires", main: "boutique", icon: ShoppingBag },
  { value: "boutique-maison", label: "Articles maison & déco", main: "boutique", icon: ShoppingBag },
  { value: "boutique", label: "Boutique généraliste", main: "boutique", icon: ShoppingBag },
  { value: "commerce-alimentation", label: "Alimentation générale", main: "commerce", icon: Store },
  { value: "commerce-cosmetique", label: "Cosmétique & beauté", main: "commerce", icon: Store },
  { value: "commerce-marche", label: "Marché / stand", main: "commerce", icon: Store },
  { value: "commerce", label: "Commerce général", main: "commerce", icon: Store },
  { value: "services", label: "Services (Imprimerie, Startup, Prestation...)", main: "services", icon: Briefcase },
  { value: "other", label: "Autre", main: "services", icon: HelpCircle },
];

export function getEstablishmentLabel(value: string): string {
  return ESTABLISHMENT_TYPES.find(t => t.value === value)?.label || value;
}

export function getEstablishmentIcon(value: string): LucideIcon {
  return ESTABLISHMENT_TYPES.find(t => t.value === value)?.icon || Building2;
}

export function getMainCategory(value: string): MainCategoryConfig | undefined {
  const type = ESTABLISHMENT_TYPES.find(t => t.value === value);
  return type ? MAIN_CATEGORIES.find(c => c.id === type.main) : undefined;
}

export function isFoodBusiness(value: string | undefined | null): boolean {
  if (!value) return true;
  const main = getMainCategory(value);
  return main?.id === "restauration";
}

export function isServiceBusiness(value: string | undefined | null): boolean {
  return value === "services";
}

export function isBoutique(value: string | undefined | null): boolean {
  if (!value) return false;
  const main = getMainCategory(value);
  return main?.id === "boutique" || main?.id === "commerce";
}

export function isSimpleBusiness(value: string | undefined | null): boolean {
  return isBoutique(value) || isServiceBusiness(value);
}

/**
 * Catégories de produits proposées selon le type d'établissement.
 * - Restauration & Bar : uniquement les catégories alimentaires/boissons.
 * - Boutique / Commerce : catégories marchandises (vêtements, accessoires...).
 * - Services : catégories génériques.
 * "Autre" est toujours présent pour ne jamais bloquer la création de produit.
 */
export function getCategoriesForEstablishment(value: string | undefined | null): string[] {
  if (isFoodBusiness(value)) {
    return [
      "Boisson alcoolisée",
      "Boisson non alcoolisée",
      "Plat / Repas",
      "Snack",
      "Dessert",
      "Entrée",
      "Autre",
    ];
  }
  if (isBoutique(value)) {
    return [
      "Vêtements",
      "Accessoires",
      "Chaussures",
      "Maison & Déco",
      "Cosmétiques",
      "Électronique",
      "Jeux & Jouets",
      "Alimentation",
      "Autre",
    ];
  }
  return [
    "Boisson alcoolisée",
    "Boisson non alcoolisée",
    "Plat / Repas",
    "Snack",
    "Dessert",
    "Entrée",
    "Vêtements",
    "Accessoires",
    "Chaussures",
    "Maison & Déco",
    "Cosmétiques",
    "Électronique",
    "Jeux & Jouets",
    "Alimentation",
    "Autre",
  ];
}
