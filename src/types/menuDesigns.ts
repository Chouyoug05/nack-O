import { MenuThemeConfig } from './menuTheme';

export type MenuDesignId = 
  | 'restaurant-classic'
  | 'restaurant-modern'
  | 'bar-lounge'
  | 'cafe-cozy'
  | 'boutique-minimal'
  | 'boutique-grid'
  | 'boutique-luxury';

export interface MenuDesign {
  id: MenuDesignId;
  name: string;
  description: string;
  category: 'restaurant' | 'bar' | 'cafe' | 'boutique';
  preview: {
    primaryColor: string;
    backgroundColor: string;
    accentColor: string;
  };
  theme: MenuThemeConfig;
}

export const MENU_DESIGNS: MenuDesign[] = [
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
];

export const getMenuDesignById = (id: MenuDesignId | string | undefined): MenuDesign => {
  return MENU_DESIGNS.find(d => d.id === id) || MENU_DESIGNS[0];
};

export const getDesignsByCategory = (category: 'restaurant' | 'bar' | 'cafe' | 'boutique'): MenuDesign[] => {
  return MENU_DESIGNS.filter(d => d.category === category);
};
