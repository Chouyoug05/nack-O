/**
 * Recherche automatique d'images pour les produits
 * Utilise le scraping direct de Google Images pour trouver des images
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
 * Recherche des images via Google Images en utilisant le scraping direct
 * Retourne jusqu'à 3 images pour que l'utilisateur puisse choisir
 */
export const searchGoogleImages = async (
  productName: string,
  category?: string
): Promise<string[]> => {
  try {
    const query = buildSearchQuery(productName, category);
    
    // Appeler la fonction Netlify qui scrape Google Images
    const baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
    const apiUrl = `${baseUrl}/.netlify/functions/search-google-images`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.warn(`Erreur API recherche images (${response.status}): ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      return data.images.slice(0, 3);
    }

    return [];
  } catch (error) {
    console.error('Erreur recherche Google Images:', error);
    return [];
  }
};
