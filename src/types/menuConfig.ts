/** Configuration du menu digital / boutique en ligne pour un établissement. */
export interface MenuConfig {
  /** UID du propriétaire (même clé que profiles/{uid}). */
  uid: string;
  /** Owner UID pour les règles d'autorisation Firestore. */
  ownerUid: string;
  /** Slug public optionnel (ex: "nack-bar") — réservé pour usage futur. */
  publicSlug?: string;
  /** ID du design/template visuel sélectionné. */
  selectedDesign: MenuDesignId;
  /** La feature est-elle activée ? */
  enabled: boolean;
  /** Tables de l'établissement (vide si type = boutique/commerce). */
  tables: MenuTable[];
  createdAt: number;
  updatedAt: number;
}

/** Identifiant d'un template de design. */
export type MenuDesignId =
  | "modern"
  | "elegant"
  | "minimal"
  | "boutique"
  | "gastronomique";

export interface MENU_DESIGN_META {
  id: MenuDesignId;
  label: string;
  description: string;
  previewColor: string; // couleur dominante pour la miniature
}

export const MENU_DESIGNS: MENU_DESIGN_META[] = [
  { id: "modern", label: "Moderne", description: "Cartes avec ombres, fond sombre, accents colorés", previewColor: "#1e293b" },
  { id: "elegant", label: "Élégant", description: "Fond crème, typo élégante, bordures fines", previewColor: "#f5f0e8" },
  { id: "minimal", label: "Minimal", description: "Blanc pur, grille simple, focus sur les images", previewColor: "#ffffff" },
  { id: "boutique", label: "Boutique", description: "Grid e-commerce, badges prix, bouton Commander", previewColor: "#2563eb" },
  { id: "gastronomique", label: "Gastronomique", description: "Sections par catégorie, style restaurant haut de gamme", previewColor: "#7c2d12" },
];

/** Une table physique de l'établissement (bar, restaurant, etc.). */
export interface MenuTable {
  /** ID Firestore auto-généré. */
  id: string;
  /** Numéro ou nom affiché (ex: "5", "Terrasse A"). */
  number: string;
  /** Token unique pour le QR code de cette table. */
  qrToken: string;
  /** Optionnel : capacité / zone / notes. */
  capacity?: number;
  zone?: string;
  createdAt: number;
}
