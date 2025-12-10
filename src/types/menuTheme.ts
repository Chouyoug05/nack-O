/**
 * Configuration du thème pour le menu digital
 */
export interface MenuThemeConfig {
  // Couleurs
  primaryColor: string; // Couleur principale (rouge/bordeaux par défaut)
  secondaryColor: string; // Couleur secondaire
  backgroundColor: string; // Couleur ou image d'arrière-plan
  backgroundType: 'color' | 'image'; // Type d'arrière-plan
  
  // Style des cartes
  cardStyle: 'minimalist' | 'shadow' | 'border'; // Style des cartes produits
  borderRadius: 'small' | 'medium' | 'large'; // Taille des arrondis
  
  // Typographie
  titleFont?: string; // Police pour les titres (optionnel)
  
  // Autres
  updatedAt?: number; // Date de dernière mise à jour
}

/**
 * Valeurs par défaut du thème
 */
export const defaultMenuTheme: MenuThemeConfig = {
  primaryColor: '#8B2635', // Rouge bordeaux
  secondaryColor: '#D4A574', // Beige doré
  backgroundColor: '#F5F1EB', // Beige clair texturé
  backgroundType: 'color',
  cardStyle: 'shadow',
  borderRadius: 'medium',
  updatedAt: Date.now()
};

