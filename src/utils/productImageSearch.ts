/**
 * Recherche automatique d'images pour les produits
 * Utilise plusieurs sources pour trouver des images basées sur le nom et la catégorie du produit
 */

/**
 * Dictionnaire de traduction des noms de produits français vers anglais
 * pour améliorer la recherche d'images
 */
const productTranslations: Record<string, string> = {
  // Boissons
  "bière": "beer",
  "vin": "wine",
  "whisky": "whisky",
  "vodka": "vodka",
  "rhum": "rum",
  "cognac": "cognac",
  "champagne": "champagne",
  "coca": "coca cola",
  "coca-cola": "coca cola",
  "pepsi": "pepsi",
  "fanta": "fanta",
  "sprite": "sprite",
  "jus": "juice",
  "eau": "water",
  "café": "coffee",
  "thé": "tea",
  "cappuccino": "cappuccino",
  "expresso": "espresso",
  "latte": "latte",
  
  // Plats
  "pizza": "pizza",
  "burger": "burger",
  "hamburger": "hamburger",
  "sandwich": "sandwich",
  "frites": "french fries",
  "poulet": "chicken",
  "poisson": "fish",
  "riz": "rice",
  "pâtes": "pasta",
  "salade": "salad",
  "soupe": "soup",
  
  // Snacks
  "chips": "chips",
  "cacahuètes": "peanuts",
  "noix": "nuts",
  "biscuit": "cookie",
  "gâteau": "cake",
  
  // Desserts
  "glace": "ice cream",
  "gâteau": "cake",
  "tarte": "pie",
  "crème": "cream",
  "chocolat": "chocolate",
};

/**
 * Traduit un nom de produit français en anglais pour améliorer la recherche
 */
const translateProductName = (productName: string): string => {
  const lowerName = productName.toLowerCase().trim();
  let translated = productName;
  
  // Chercher des correspondances partielles et remplacer
  for (const [french, english] of Object.entries(productTranslations)) {
    if (lowerName.includes(french)) {
      translated = translated.replace(new RegExp(french, 'gi'), english);
    }
  }
  
  // Si le nom contient déjà des mots anglais communs, le garder tel quel
  const commonEnglishWords = ['beer', 'wine', 'coffee', 'tea', 'pizza', 'burger', 'chicken', 'fish', 'rice', 'pasta', 'salad', 'soup', 'cake', 'ice cream', 'chocolate'];
  const hasEnglishWords = commonEnglishWords.some(word => lowerName.includes(word));
  
  if (hasEnglishWords) {
    return productName; // Garder le nom original s'il contient déjà des mots anglais
  }
  
  return translated;
};

/**
 * Construit une requête de recherche optimisée basée sur le nom et la catégorie du produit
 */
const buildSearchQuery = (productName: string, category?: string): string => {
  // Traduire le nom du produit en anglais si possible
  let query = translateProductName(productName).trim().toLowerCase();
  
  // Nettoyer les caractères spéciaux et garder seulement les mots importants
  query = query.replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Supprimer les mots trop courts ou non pertinents
  const words = query.split(/\s+/).filter(word => {
    // Garder les mots de plus de 2 caractères
    if (word.length <= 2) return false;
    // Exclure les articles et mots communs non pertinents
    const stopWords = ['the', 'a', 'an', 'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou'];
    return !stopWords.includes(word);
  });
  
  query = words.join(' ');
  
  // Si la requête est trop courte après nettoyage, utiliser le nom original
  if (query.length < 3) {
    query = productName.trim().toLowerCase();
  }
  
  return query;
};

/**
 * Configuration Unsplash - Clé API
 */
const UNSPLASH_ACCESS_KEY = "MgAdku7WGkdkMVr5dWfzpibCN1sF0gDqOqy3H4JuEPSfBTzrq7RbcMaz";

/**
 * Recherche une image via l'API Unsplash
 * Cherche plusieurs résultats et prend le plus pertinent
 */
const searchUnsplash = async (query: string): Promise<string | null> => {
  if (!UNSPLASH_ACCESS_KEY) {
    return null;
  }

  try {
    // Chercher plusieurs résultats pour avoir plus de choix
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    // Gérer les erreurs d'authentification
    if (response.status === 401) {
      console.warn('Clé API Unsplash invalide ou expirée. Utilisation d\'une alternative.');
      return null;
    }

    if (!response.ok) {
      console.warn(`Erreur Unsplash (${response.status}): ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Prendre le premier résultat (le plus pertinent selon Unsplash)
      const image = data.results[0];
      
      // Retourner l'image
      return image.urls?.regular || image.urls?.small || null;
    }

    return null;
  } catch (error) {
    console.error('Erreur Unsplash:', error);
    return null;
  }
};

/**
 * Configuration Pexels - Clé API (optionnelle)
 */
const PEXELS_API_KEY = ""; // Optionnel: ajouter votre clé Pexels ici si vous en avez une

/**
 * Recherche une image via l'API Pexels (alternative gratuite)
 */
const searchPexels = async (query: string): Promise<string | null> => {
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
 * Recherche une image via l'API Foodish (gratuite, pour produits alimentaires)
 */
const searchFoodish = async (query: string): Promise<string | null> => {
  try {
    // Foodish API est gratuite et ne nécessite pas de clé API
    // Elle retourne des images aléatoires de nourriture
    const response = await fetch('https://foodish-api.herokuapp.com/images/');
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.image || null;
  } catch (error) {
    console.error('Erreur Foodish:', error);
    return null;
  }
};

/**
 * Recherche une image via l'API Pixabay (nécessite une clé API gratuite)
 * Pour obtenir une clé: https://pixabay.com/api/docs/
 */
const searchPixabay = async (query: string): Promise<string | null> => {
  // Pixabay nécessite une clé API gratuite
  // Pour l'instant, on retourne null - peut être activé avec une clé API
  return null;
  
  /* Exemple d'utilisation avec une clé API:
  try {
    const PIXABAY_API_KEY = ""; // À configurer si disponible
    if (!PIXABAY_API_KEY) return null;
    
    const response = await fetch(
      `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&category=food&per_page=3&safesearch=true`
    );
    
    if (!response.ok) return null;
    const data = await response.json();
    if (data.hits && data.hits.length > 0) {
      return data.hits[0].webformatURL || data.hits[0].previewURL || null;
    }
    return null;
  } catch (error) {
    console.error('Erreur Pixabay:', error);
    return null;
  }
  */
};

/**
 * Génère une image placeholder basée sur le nom du produit
 * Utilise un service d'images placeholder avec un seed basé sur le nom
 */
const generatePlaceholderImage = (productName: string, category?: string): string => {
  // Créer un seed basé sur le nom pour avoir une image cohérente
  const seed = productName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  
  // Utiliser Lorem Picsum avec un seed pour avoir une image déterministe
  // L'image sera toujours la même pour le même nom de produit
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
  
  // Log pour débogage (peut être supprimé en production)
  console.log(`Recherche d'image pour: "${productName}" (catégorie: ${category || 'aucune'}) -> Requête: "${query}"`);

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

  // Si c'est un produit alimentaire, essayer Foodish (gratuit, sans clé API)
  const foodCategories = ["Boisson alcoolisée", "Boisson non alcoolisée", "Plat / Repas", "Snack", "Dessert", "Entrée"];
  if (category && foodCategories.includes(category)) {
    const foodishImage = await searchFoodish(query);
    if (foodishImage) {
      return foodishImage;
    }
  }

  // Essayer Pixabay si une clé API est configurée
  const pixabayImage = await searchPixabay(query);
  if (pixabayImage) {
    return pixabayImage;
  }

  // En dernier recours, générer une image placeholder
  // L'image sera toujours la même pour le même nom de produit
  return generatePlaceholderImage(productName, category);
};


