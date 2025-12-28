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
  
  // Desserts
  "glace": "ice cream",
  "gâteau": "cake",
  "tarte": "pie",
  "crème": "cream",
  "chocolat": "chocolate",
};

/**
 * Dictionnaire de descriptions détaillées pour produits locaux/africains
 * Utilisé pour générer des images précises via IA
 */
const productDescriptions: Record<string, string> = {
  // Produits locaux africains
  "alloco": "fried plantain banana fritters, golden brown, crispy on the outside, soft inside, West African street food",
  "alloco banane": "fried plantain banana fritters, golden brown, crispy on the outside, soft inside, West African street food",
  "banane plantain": "fried plantain banana fritters, golden brown, crispy on the outside, soft inside, West African street food",
  "beignet": "African donut, fried dough, golden brown, round shape, sweet, West African street food",
  "beignet banane": "banana fritter, fried banana dough, golden brown, crispy, West African snack",
  "poulet braisé": "grilled chicken, marinated, charred skin, West African style, served with onions and spices",
  "poulet DG": "chicken DG, sautéed chicken with vegetables, plantains, spicy sauce, West African dish",
  "riz gras": "jollof rice, one-pot rice dish, red-orange color, with vegetables and meat, West African cuisine",
  "jollof": "jollof rice, one-pot rice dish, red-orange color, with vegetables and meat, West African cuisine",
  "riz sauce": "rice with sauce, white rice with tomato-based sauce, vegetables, West African dish",
  "attiéké": "cassava couscous, fermented cassava, white grains, served with fish or meat, Ivorian dish",
  "foutou": "fufu, pounded cassava and plantain, white smooth dough, served with soup, West African dish",
  "fufu": "pounded cassava and plantain, white smooth dough, served with soup, West African dish",
  "ndolé": "bitterleaf stew, green leafy vegetable stew, with meat or fish, peanuts, Cameroonian dish",
  "poulet yassa": "chicken yassa, marinated chicken with onions, lemon, mustard, Senegalese dish",
  "thieboudienne": "ceebu jen, rice with fish and vegetables, red sauce, Senegalese national dish",
  "mafé": "peanut stew, meat in peanut sauce, rich brown sauce, West African dish",
  "tchep": "rice with fish, red rice dish, vegetables, West African cuisine",
  "akara": "black-eyed pea fritters, fried bean fritters, golden brown, round shape, West African snack",
  "bissap": "hibiscus drink, red-purple color, refreshing, West African beverage",
  "gingembre": "ginger drink, spicy ginger beverage, golden color, West African drink",
  "tamarin": "tamarind drink, sweet and sour, brown color, West African beverage",
  "dablé": "peanut brittle, sweet peanut candy, West African snack",
  "koki": "steamed black-eyed pea pudding, wrapped in leaves, Cameroonian dish",
  "eru": "wild spinach stew, green leafy vegetable, with meat or fish, Cameroonian dish",
  "achu": "pounded cocoyam, yellow-orange color, served with soup, Cameroonian dish",
  "kwacoco": "steamed cocoyam, wrapped in leaves, Cameroonian dish",
  "bobolo": "fermented cassava sticks, wrapped in leaves, Cameroonian dish",
  "soya": "grilled meat skewers, spicy, charred, West African street food",
  "suya": "spicy grilled meat skewers, peanut spice rub, charred, West African street food",
  "brochette": "grilled meat skewers, marinated, charred, West African street food",
  "poisson braisé": "grilled fish, whole fish, charred skin, West African style",
  "poisson frit": "fried fish, whole fish, golden brown, crispy skin, West African style",
  "sauce arachide": "peanut sauce, rich brown sauce, with meat or vegetables, West African sauce",
  "sauce gombo": "okra sauce, green slimy sauce, with meat or fish, West African sauce",
  "sauce tomate": "tomato sauce, red sauce, with meat or fish, West African sauce",
  "couscous": "couscous, small grains, served with sauce, North African dish",
  "tajine": "tagine, slow-cooked stew, with meat and vegetables, North African dish",
  "pastel": "fried pastry, filled with fish or meat, golden brown, West African snack",
  "fataya": "fried pastry, filled with meat or fish, triangular shape, West African snack",
  "dibi": "grilled lamb or mutton, charred, served with onions, Senegalese dish",
  "yassa": "marinated meat or fish with onions, lemon, mustard, Senegalese dish",
  "thiakry": "millet couscous dessert, sweet, with yogurt, Senegalese dessert",
  "thiakri": "millet couscous dessert, sweet, with yogurt, Senegalese dessert",
  "jus de bissap": "hibiscus juice, red-purple color, refreshing, West African beverage",
  "jus de gingembre": "ginger juice, spicy ginger beverage, golden color, West African drink",
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
 * Configuration Gemini - Clé API pour génération d'images
 * Obtenez votre clé sur: https://aistudio.google.com/apikey
 */
const GEMINI_API_KEY = "AIzaSyAGFIIBvG21u8O7PA-lGLk7Dy9i595doXQ";

/**
 * Génère une image via l'API Gemini (Imagen)
 * Utilise le modèle gemini-2.0-flash-exp-image-generation pour générer des images
 */
const generateImageWithGemini = async (productName: string, category?: string): Promise<string | null> => {
  if (!GEMINI_API_KEY) {
    return null;
  }

  try {
    // Construire un prompt descriptif pour générer l'image
    const prompt = buildImageGenerationPrompt(productName, category);
    
    // Log du prompt pour débogage
    console.log(`[Gemini] Génération d'image avec le prompt: "${prompt}"`);
    
    // Utiliser l'API Gemini pour générer l'image
    // Modèle: gemini-2.0-flash-exp-image-generation (modèle expérimental pour génération d'images)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Erreur Gemini API (${response.status}): ${errorText}`);
      return null;
    }

    const data = await response.json();
    
    // Log de la réponse pour débogage
    console.log('[Gemini] Réponse API:', JSON.stringify(data, null, 2));
    
    // L'API Gemini retourne l'image dans les parts de la réponse
    if (data.candidates && data.candidates[0]?.content?.parts) {
      const parts = data.candidates[0].content.parts;
      
      console.log('[Gemini] Nombre de parts trouvées:', parts.length);
      
      // Chercher une partie avec une image (base64)
      for (const part of parts) {
        console.log('[Gemini] Part type:', Object.keys(part));
        
        if (part.inlineData && part.inlineData.data) {
          // Image en base64 - convertir en data URL pour l'affichage
          const mimeType = part.inlineData.mimeType || 'image/png';
          console.log('[Gemini] Image trouvée en base64, type:', mimeType);
          return `data:${mimeType};base64,${part.inlineData.data}`;
        }
        // Si l'API retourne une URL d'image
        if (part.url) {
          console.log('[Gemini] URL d\'image trouvée:', part.url);
          return part.url;
        }
        // Vérifier si c'est du texte (peut contenir des instructions)
        if (part.text) {
          console.log('[Gemini] Texte dans la réponse:', part.text);
        }
      }
    }

    // Si aucune image trouvée dans la réponse standard, essayer d'autres formats
    if (data.imageData) {
      console.log('[Gemini] Image trouvée dans imageData');
      return `data:image/png;base64,${data.imageData}`;
    }

    console.warn('[Gemini] Aucune image trouvée dans la réponse');
    return null;
  } catch (error) {
    console.error('Erreur génération image Gemini:', error);
    return null;
  }
};

/**
 * Trouve une description détaillée pour un produit local/africain
 */
const getProductDescription = (productName: string): string | null => {
  const lowerName = productName.toLowerCase().trim();
  
  // Chercher une correspondance exacte
  if (productDescriptions[lowerName]) {
    return productDescriptions[lowerName];
  }
  
  // Chercher une correspondance partielle
  for (const [key, description] of Object.entries(productDescriptions)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return description;
    }
  }
  
  return null;
};

/**
 * Construit un prompt optimisé pour la génération d'image via IA
 * Le prompt est conçu pour générer une image spécifique du produit mentionné
 */
const buildImageGenerationPrompt = (productName: string, category?: string): string => {
  // Vérifier d'abord si c'est un produit local avec une description détaillée
  const productDescription = getProductDescription(productName);
  
  if (productDescription) {
    // Utiliser la description détaillée pour les produits locaux
    return `Generate a high-quality professional food photography image of ${productDescription}, restaurant menu style, good lighting, sharp focus, centered composition, appetizing appearance, suitable for menu display`;
  }
  
  // Pour les autres produits, traduire le nom en anglais
  const translatedName = translateProductName(productName);
  
  // Commencer avec le nom du produit comme élément principal
  let prompt = `Generate a high-quality professional food photography image of ${translatedName}`;
  
  // Ajouter des détails spécifiques selon la catégorie pour guider la génération
  if (category) {
    const categoryPrompts: Record<string, string> = {
      "Boisson alcoolisée": "showing the drink in a glass or bottle, clean restaurant background",
      "Boisson non alcoolisée": "showing the drink in a glass, refreshing appearance, restaurant style",
      "Plat / Repas": "showing the dish beautifully plated, restaurant presentation",
      "Snack": "showing the snack food, appetizing appearance, restaurant quality",
      "Dessert": "showing the dessert, delicious presentation, restaurant style",
      "Entrée": "showing the starter dish, appetizing presentation, restaurant style",
    };
    
    if (categoryPrompts[category]) {
      prompt += `, ${categoryPrompts[category]}`;
    } else {
      prompt += ", restaurant style, high quality";
    }
  } else {
    prompt += ", restaurant style, high quality, appetizing";
  }
  
  // Ajouter des instructions supplémentaires pour garantir la qualité
  prompt += ", good lighting, sharp focus, centered composition, suitable for menu display";
  
  return prompt;
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

  // Essayer de générer une image via Gemini/Imagen si une clé API est configurée
  const geminiImage = await generateImageWithGemini(productName, category);
  if (geminiImage) {
    return geminiImage;
  }

  // En dernier recours, générer une image placeholder
  // L'image sera toujours la même pour le même nom de produit
  return generatePlaceholderImage(productName, category);
};


