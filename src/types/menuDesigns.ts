import { MenuThemeConfig } from './menuTheme';

export type MenuDesignId = 
  | 'classic-elegant'
  | 'modern-minimal'
  | 'warm-rustic'
  | 'luxury-dark'
  | 'mediterranean-fresh';

export interface MenuDesign {
  id: MenuDesignId;
  name: string;
  description: string;
  category: string;
  preview: {
    primaryColor: string;
    backgroundColor: string;
    accentColor: string;
  };
  theme: MenuThemeConfig;
}

export const MENU_DESIGNS: MenuDesign[] = [
  {
    id: 'classic-elegant',
    name: 'Classique Élégant',
    description: 'Design raffiné pour restaurants haut de gamme. Tons bordeaux et dorés, typographie serif élégante.',
    category: 'Restaurant',
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
      designId: 'classic-elegant',
    },
  },
  {
    id: 'modern-minimal',
    name: 'Moderne Minimaliste',
    description: 'Design épuré et contemporain pour bars et lounges. Lignes nettes, couleurs vives.',
    category: 'Bar / Lounge',
    preview: {
      primaryColor: '#1A1A2E',
      backgroundColor: '#F8F9FA',
      accentColor: '#E94560',
    },
    theme: {
      primaryColor: '#1A1A2E',
      secondaryColor: '#E94560',
      backgroundColor: '#F8F9FA',
      backgroundType: 'color',
      cardStyle: 'minimalist',
      borderRadius: 'medium',
      titleFont: 'system-ui, sans-serif',
      designId: 'modern-minimal',
    },
  },
  {
    id: 'warm-rustic',
    name: 'Chaleureux Rustique',
    description: 'Ambiance cozy pour cafés et brasseries. Tons chauds, texture bois et cuir.',
    category: 'Café / Brasserie',
    preview: {
      primaryColor: '#5D4037',
      backgroundColor: '#EFEBE9',
      accentColor: '#FF8F00',
    },
    theme: {
      primaryColor: '#5D4037',
      secondaryColor: '#FF8F00',
      backgroundColor: '#EFEBE9',
      backgroundType: 'color',
      cardStyle: 'border',
      borderRadius: 'medium',
      titleFont: 'Georgia, serif',
      designId: 'warm-rustic',
    },
  },
  {
    id: 'luxury-dark',
    name: 'Luxe Noir & Or',
    description: 'Design premium pour restaurants gastronomiques. Fond sombre, accents dorés luxueux.',
    category: 'Gastronomie',
    preview: {
      primaryColor: '#D4AF37',
      backgroundColor: '#1A1A1A',
      accentColor: '#FFFFFF',
    },
    theme: {
      primaryColor: '#D4AF37',
      secondaryColor: '#FFFFFF',
      backgroundColor: '#1A1A1A',
      backgroundType: 'color',
      cardStyle: 'shadow',
      borderRadius: 'large',
      titleFont: 'Georgia, serif',
      designId: 'luxury-dark',
    },
  },
  {
    id: 'mediterranean-fresh',
    name: 'Fraîcheur Méditerranéenne',
    description: 'Style frais et léger pour restaurants méditerranéens. Bleus et verts, ambiance estivale.',
    category: 'Méditerranéen',
    preview: {
      primaryColor: '#006994',
      backgroundColor: '#F0F8FF',
      accentColor: '#2E8B57',
    },
    theme: {
      primaryColor: '#006994',
      secondaryColor: '#2E8B57',
      backgroundColor: '#F0F8FF',
      backgroundType: 'color',
      cardStyle: 'shadow',
      borderRadius: 'large',
      titleFont: 'system-ui, sans-serif',
      designId: 'mediterranean-fresh',
    },
  },
];

export const getMenuDesignById = (id: MenuDesignId | string | undefined): MenuDesign => {
  return MENU_DESIGNS.find(d => d.id === id) || MENU_DESIGNS[0];
};
