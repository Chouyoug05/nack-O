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
  
  // Design template
  designId?: string; // ID du template de design sélectionné
  
  // Autres
  updatedAt?: number; // Date de dernière mise à jour
}

/**
 * Valeurs par défaut du thème
 */
export const defaultMenuTheme: MenuThemeConfig = {
  primaryColor: '#E63946', // Rouge NACK
  secondaryColor: '#F4A261', // Orange doré
  backgroundColor: '#FFFFFF', // Blanc pur
  backgroundType: 'color',
  cardStyle: 'shadow',
  borderRadius: 'large',
  designId: 'nack-modern',
  updatedAt: Date.now()
};

