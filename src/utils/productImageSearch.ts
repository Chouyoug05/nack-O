/**
 * Recherche automatique d'images pour les produits
 * Utilise plusieurs sources pour trouver des images basées sur le nom et la catégorie du produit
 */

/**
 * Construit une requête de recherche optimisée basée sur le nom et la catégorie du produit
 */
const buildSearchQuery = (productName: string, category?: string): string => {
  // Nettoyer le nom du produit
  let query = productName.trim().toLowerCase();
  
  // Ajouter des mots-clés basés sur la catégorie pour améliorer les résultats
  if (category) {
    const categoryKeywords: Record<string, string> = {
      "Boisson alcoolisée": "drink beverage alcohol",
      "Boisson non alcoolisée": "drink beverage non-alcoholic",
      "Plat / Repas": "food meal dish",
      "Snack": "snack food",
      "Dessert": "dessert sweet",
      "Entrée": "appetizer starter food",
    };
    
    const keywords = categoryKeywords[category] || "";
    if (keywords) {
      query = `${query} ${keywords}`;
    }
  }
  
  return query;
};

/**
 * Recherche une image via l'API Unsplash (si clé API disponible)
 */
const searchUnsplash = async (query: string): Promise<string | null> => {
  const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  
  if (!UNSPLASH_ACCESS_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const image = data.results[0];
      return image.urls?.regular || image.urls?.small || null;
    }

    return null;
  } catch (error) {
    console.error('Erreur Unsplash:', error);
    return null;
  }
};

/**
 * Recherche une image via l'API Pexels (alternative gratuite)
 */
const searchPexels = async (query: string): Promise<string | null> => {
  const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY;
  
  if (!PEXELS_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      {
        headers: {
          'Authorization': PEXELS_API_KEY,
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.photos && data.photos.length > 0) {
      const photo = data.photos[0];
      return photo.src?.medium || photo.src?.large || null;
    }

    return null;
  } catch (error) {
    console.error('Erreur Pexels:', error);
    return null;
  }
};

/**
 * Génère une image placeholder basée sur le nom du produit
 * Utilise un service d'images placeholder avec un seed basé sur le nom
 */
const generatePlaceholderImage = (productName: string): string => {
  // Créer un seed basé sur le nom pour avoir une image cohérente
  const seed = productName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  // Utiliser Lorem Picsum avec un seed pour avoir une image déterministe
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/400/400`;
};

/**
 * Recherche une image pour un produit
 * @param productName - Nom du produit
 * @param category - Catégorie du produit (optionnel)
 * @returns URL de l'image ou null si aucune image trouvée
 */
export const searchProductImage = async (
  productName: string,
  category?: string
): Promise<string | null> => {
  if (!productName || productName.trim().length === 0) {
    return null;
  }

  const query = buildSearchQuery(productName, category);

  // Essayer d'abord Unsplash si une clé API est configurée
  const unsplashImage = await searchUnsplash(query);
  if (unsplashImage) {
    return unsplashImage;
  }

  // Essayer Pexels si une clé API est configurée
  const pexelsImage = await searchPexels(query);
  if (pexelsImage) {
    return pexelsImage;
  }

  // En dernier recours, générer une image placeholder
  // Note: Cette image sera toujours la même pour le même nom de produit
  return generatePlaceholderImage(productName);
};


