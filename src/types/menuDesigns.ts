import { MenuThemeConfig } from './menuTheme';

export type MenuDesignId = 
  | 'nack-modern'
  | 'nack-shop'
  | 'nack-shop-fashion'
  | 'nack-shop-premium'
  | 'restaurant-classic'
  | 'restaurant-modern'
  | 'bar-lounge'
  | 'cafe-cozy'
  | 'boutique-minimal'
  | 'boutique-grid'
  | 'boutique-luxury'
  | 'service-professional'
  | 'service-creative';

export interface MenuDesign {
  id: MenuDesignId;
  name: string;
  description: string;
  category: 'restaurant' | 'bar' | 'cafe' | 'boutique' | 'service';
  preview: {
    primaryColor: string;
    backgroundColor: string;
    accentColor: string;
  };
  theme: MenuThemeConfig;
}

export const MENU_DESIGNS: MenuDesign[] = [
  // === NACK MODERN (Default - Restaurant/Bar) ===
  {
    id: 'nack-modern',
    name: 'NACK Modern',
    description: 'Design moderne et adaptatif par défaut. Interface épurée, mobile-first, avec cartes produits élégantes. S\'adapte automatiquement au type d\'établissement.',
    category: 'restaurant',
    preview: {
      primaryColor: '#E63946',
      backgroundColor: '#FFFFFF',
      accentColor: '#F4A261',
    },
    theme: {
      primaryColor: '#E63946',
      secondaryColor: '#F4A261',
      backgroundColor: '#FFFFFF',
      backgroundType: 'color',
      cardStyle: 'shadow',
      borderRadius: 'large',
      titleFont: 'system-ui, sans-serif',
      designId: 'nack-modern',
    },
  },

  // === NACK SHOP (Boutique / Catalogue) ===
  {
    id: 'nack-shop',
    name: 'NACK Shop',
    description: 'Design catalogue moderne pour boutiques. Grille 2 colonnes, grandes images, favoris, navigation par catégories. Idéal pour friperies, boutiques de vêtements, accessoires.',
    category: 'boutique',
    preview: {
      primaryColor: '#1a1a1a',
      backgroundColor: '#FAFAFA',
      accentColor: '#E63946',
    },
    theme: {
      primaryColor: '#1a1a1a',
      secondaryColor: '#E63946',
      backgroundColor: '#FAFAFA',
      backgroundType: 'color',
      cardStyle: 'shadow',
      borderRadius: 'large',
      titleFont: 'system-ui, sans-serif',
      designId: 'nack-shop',
    },
  },
  {
    id: 'nack-shop-fashion',
    name: 'NACK Fashion',
    description: 'Design élégant orienté mode. Interface minimaliste avec emphasis sur les visuels. Parfait pour boutiques de vêtements, chaussures, accessoires de mode.',
    category: 'boutique',
    preview: {
      primaryColor: '#2C3E50',
      backgroundColor: '#FFFFFF',
      accentColor: '#E74C3C',
    },
    theme: {
      primaryColor: '#2C3E50',
      secondaryColor: '#E74C3C',
      backgroundColor: '#FFFFFF',
      backgroundType: 'color',
      cardStyle: 'minimalist',
      borderRadius: 'medium',
      titleFont: 'system-ui, sans-serif',
      designId: 'nack-shop-fashion',
    },
  },
  {
    id: 'nack-shop-premium',
    name: 'NACK Premium',
    description: 'Design haut de gamme pour boutiques premium. Interface sombre et élégante avec accents dorés. Idéal pour bijouteries, parfumeries, produits de luxe.',
    category: 'boutique',
    preview: {
      primaryColor: '#D4AF37',
      backgroundColor: '#0D0D0D',
      accentColor: '#FFFFFF',
    },
    theme: {
      primaryColor: '#D4AF37',
      secondaryColor: '#FFFFFF',
      backgroundColor: '#0D0D0D',
      backgroundType: 'color',
      cardStyle: 'shadow',
      borderRadius: 'large',
      titleFont: 'Georgia, serif',
      designId: 'nack-shop-premium',
    },
  },

  // === RESTAURANTS ===
  {
    id: 'restaurant-classic',
    name: 'Restaurant Classique',
    description: 'Design élégant avec header imposant, sections par catégorie, cartes produits avec image large. Idéal pour restaurants traditionnels.',
    category: 'restaurant',
    preview: {
      primaryColor: '#8B2635',
      backgroundColor: '#F5F1EB',
      accentColor: '#D4A574',
    },
    theme: {
      primaryColor: '#8B2635',
      secondaryColor: '#D4A574',
      backgroundColor: '#F5F1EB',
      backgroundType: 'color',
      cardStyle: 'shadow',
      borderRadius: 'large',
      titleFont: 'Georgia, serif',
      designId: 'restaurant-classic',
    },
  },
  {
    id: 'restaurant-modern',
    name: 'Restaurant Moderne',
    description: 'Design épuré avec navigation horizontale, cartes produits compactes, mise en page aérée. Parfait pour restaurants contemporains.',
    category: 'restaurant',
    preview: {
      primaryColor: '#2C3E50',
      backgroundColor: '#FFFFFF',
      accentColor: '#E74C3C',
    },
    theme: {
      primaryColor: '#2C3E50',
      secondaryColor: '#E74C3C',
      backgroundColor: '#FFFFFF',
      backgroundType: 'color',
      cardStyle: 'minimalist',
      borderRadius: 'medium',
      titleFont: 'system-ui, sans-serif',
      designId: 'restaurant-modern',
    },
  },

  // === BARS & LOUNGES ===
  {
    id: 'bar-lounge',
    name: 'Bar & Lounge',
    description: 'Design sombre et atmosphérique avec accents néon, cartes produits avec effets hover. Idéal pour bars, clubs et lounges.',
    category: 'bar',
    preview: {
      primaryColor: '#9B59B6',
      backgroundColor: '#1A1A2E',
      accentColor: '#E94560',
    },
    theme: {
      primaryColor: '#9B59B6',
      secondaryColor: '#E94560',
      backgroundColor: '#1A1A2E',
      backgroundType: 'color',
      cardStyle: 'shadow',
      borderRadius: 'large',
      titleFont: 'system-ui, sans-serif',
      designId: 'bar-lounge',
    },
  },

  // === CAFÉS ===
  {
    id: 'cafe-cozy',
    name: 'Café Cosy',
    description: 'Design chaleureux avec tons bois et crème, typographie manuscrite pour les titres. Parfait pour cafés et salons de thé.',
    category: 'cafe',
    preview: {
      primaryColor: '#6F4E37',
      backgroundColor: '#FDF6E3',
      accentColor: '#C19A6B',
    },
    theme: {
      primaryColor: '#6F4E37',
      secondaryColor: '#C19A6B',
      backgroundColor: '#FDF6E3',
      backgroundType: 'color',
      cardStyle: 'border',
      borderRadius: 'medium',
      titleFont: 'Georgia, serif',
      designId: 'cafe-cozy',
    },
  },

  // === BOUTIQUES EN LIGNE ===
  {
    id: 'boutique-minimal',
    name: 'Boutique Minimaliste',
    description: 'Design épuré style e-commerce moderne avec grille 3 colonnes, filtres latéraux, panier flottant. Idéal pour boutiques de mode.',
    category: 'boutique',
    preview: {
      primaryColor: '#000000',
      backgroundColor: '#FAFAFA',
      accentColor: '#FF6B6B',
    },
    theme: {
      primaryColor: '#000000',
      secondaryColor: '#FF6B6B',
      backgroundColor: '#FAFAFA',
      backgroundType: 'color',
      cardStyle: 'minimalist',
      borderRadius: 'medium',
      titleFont: 'system-ui, sans-serif',
      designId: 'boutique-minimal',
    },
  },
  {
    id: 'boutique-grid',
    name: 'Boutique Grid Pro',
    description: 'Design grille dense avec informations produit complètes, badges de promo, navigation par catégories. Parfait pour multi-produits.',
    category: 'boutique',
    preview: {
      primaryColor: '#2980B9',
      backgroundColor: '#ECF0F1',
      accentColor: '#27AE60',
    },
    theme: {
      primaryColor: '#2980B9',
      secondaryColor: '#27AE60',
      backgroundColor: '#ECF0F1',
      backgroundType: 'color',
      cardStyle: 'border',
      borderRadius: 'small',
      titleFont: 'system-ui, sans-serif',
      designId: 'boutique-grid',
    },
  },
  {
    id: 'boutique-luxury',
    name: 'Boutique Luxe',
    description: 'Design premium avec fond sombre, accents dorés, typographie élégante. Idéal pour bijouteries, parfumeries, produits haut de gamme.',
    category: 'boutique',
    preview: {
      primaryColor: '#D4AF37',
      backgroundColor: '#0D0D0D',
      accentColor: '#FFFFFF',
    },
    theme: {
      primaryColor: '#D4AF37',
      secondaryColor: '#FFFFFF',
      backgroundColor: '#0D0D0D',
      backgroundType: 'color',
      cardStyle: 'shadow',
      borderRadius: 'large',
      titleFont: 'Georgia, serif',
      designId: 'boutique-luxury',
    },
  },

  // === SERVICES ===
  {
    id: 'service-professional',
    name: 'Service Professionnel',
    description: 'Design sobre et professionnel avec cartes prestations, sections claires, bouton de réservation. Idéal pour consultants, avocats, comptables.',
    category: 'service',
    preview: {
      primaryColor: '#1E40AF',
      backgroundColor: '#F8FAFC',
      accentColor: '#3B82F6',
    },
    theme: {
      primaryColor: '#1E40AF',
      secondaryColor: '#3B82F6',
      backgroundColor: '#F8FAFC',
      backgroundType: 'color',
      cardStyle: 'border',
      borderRadius: 'medium',
      titleFont: 'system-ui, sans-serif',
      designId: 'service-professional',
    },
  },
  {
    id: 'service-creative',
    name: 'Service Créatif',
    description: 'Design moderne et dynamique avec dégradés, animations subtiles, mise en page créative. Parfait pour agences, designers, freelances.',
    category: 'service',
    preview: {
      primaryColor: '#7C3AED',
      backgroundColor: '#FAF5FF',
      accentColor: '#EC4899',
    },
    theme: {
      primaryColor: '#7C3AED',
      secondaryColor: '#EC4899',
      backgroundColor: '#FAF5FF',
      backgroundType: 'color',
      cardStyle: 'shadow',
      borderRadius: 'large',
      titleFont: 'system-ui, sans-serif',
      designId: 'service-creative',
    },
  },
];

export const getMenuDesignById = (id: MenuDesignId | string | undefined): MenuDesign => {
  return MENU_DESIGNS.find(d => d.id === id) || MENU_DESIGNS[0];
};

export const getDesignsByCategory = (category: 'restaurant' | 'bar' | 'cafe' | 'boutique' | 'service'): MenuDesign[] => {
  return MENU_DESIGNS.filter(d => d.category === category);
};

/**
 * Retourne les designs disponibles selon le type d'établissement
 */
export const getDesignsForEstablishment = (establishmentType: string | undefined | null): MenuDesign[] => {
  if (!establishmentType) return MENU_DESIGNS;
  
  const type = establishmentType.toLowerCase();
  
  // Restauration & Bar
  if (type === 'restaurant' || type === 'bar' || type === 'snack' || type === 'nightclub' || 
      type === 'restaurant-bar' || type === 'hotel-bar' || type === 'cafe') {
    return MENU_DESIGNS.filter(d => 
      d.category === 'restaurant' || d.category === 'bar' || d.category === 'cafe'
    );
  }
  
  // Boutique & Commerce
  if (type === 'boutique' || type === 'friperie' || type === 'boutique-vetements' || 
      type === 'boutique-chaussures' || type === 'boutique-electronique' || 
      type === 'boutique-accessoires' || type === 'boutique-maison' || 
      type === 'commerce' || type === 'commerce-alimentation' || 
      type === 'commerce-cosmetique' || type === 'commerce-marche') {
    return MENU_DESIGNS.filter(d => d.category === 'boutique');
  }
  
  // Services
  if (type === 'services' || type === 'other') {
    return MENU_DESIGNS.filter(d => d.category === 'service');
  }
  
  return MENU_DESIGNS;
};

/**
 * Retourne le design par défaut approprié selon le type d'établissement
 */
export const getDefaultDesignForEstablishment = (establishmentType: string | undefined | null): MenuDesign => {
  if (!establishmentType) return MENU_DESIGNS[0]; // nack-modern
  
  const type = establishmentType.toLowerCase();
  
  // Restauration & Bar -> NACK Modern
  if (type === 'restaurant' || type === 'bar' || type === 'snack' || type === 'nightclub' || 
      type === 'restaurant-bar' || type === 'hotel-bar' || type === 'cafe') {
    return MENU_DESIGNS.find(d => d.id === 'nack-modern') || MENU_DESIGNS[0];
  }
  
  // Boutique & Commerce -> NACK Shop
  if (type === 'boutique' || type === 'friperie' || type === 'boutique-vetements' || 
      type === 'boutique-chaussures' || type === 'boutique-electronique' || 
      type === 'boutique-accessoires' || type === 'boutique-maison' || 
      type === 'commerce' || type === 'commerce-alimentation' || 
      type === 'commerce-cosmetique' || type === 'commerce-marche') {
    return MENU_DESIGNS.find(d => d.id === 'nack-shop') || MENU_DESIGNS[0];
  }
  
  // Services -> Service Professional
  if (type === 'services' || type === 'other') {
    return MENU_DESIGNS.find(d => d.id === 'service-professional') || MENU_DESIGNS[0];
  }
  
  return MENU_DESIGNS[0];
};
