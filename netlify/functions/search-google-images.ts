import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { query } = JSON.parse(event.body || '{}') as { query?: string };
    
    if (!query || query.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Query parameter is required' })
      };
    }

    // Scraper directement Google Images
    // Utiliser un user-agent réaliste pour éviter les blocages
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&safe=active&ijn=0`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.google.com/',
      }
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `Erreur HTTP: ${response.statusText}`,
          images: []
        })
      };
    }

    const html = await response.text();
    const images: string[] = [];
    
    // Méthode 1: Extraire depuis les données JSON embarquées dans le HTML
    // Google Images stocke les URLs dans des scripts avec AF_initDataCallback
    try {
      // Chercher les patterns de données JSON
      const jsonPattern = /AF_initDataCallback\([^)]*\{key:'ds:1'[^}]*data:([^\]]+\])/g;
      let match;
      
      while ((match = jsonPattern.exec(html)) !== null && images.length < 3) {
        try {
          const jsonStr = match[1];
          // Nettoyer et parser le JSON
          const cleaned = jsonStr.replace(/\\x[0-9a-f]{2}/gi, '');
          const data = JSON.parse(cleaned);
          
          // Parcourir récursivement pour trouver les URLs d'images
          const findImages = (obj: any): void => {
            if (typeof obj === 'string' && obj.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i)) {
              if (!obj.includes('googleusercontent.com/url') && 
                  !obj.includes('gstatic.com') && 
                  !obj.includes('google.com/logos') &&
                  images.length < 3) {
                images.push(obj);
              }
            } else if (Array.isArray(obj)) {
              obj.forEach(findImages);
            } else if (typeof obj === 'object' && obj !== null) {
              Object.values(obj).forEach(findImages);
            }
          };
          
          findImages(data);
        } catch {
          // Ignorer les erreurs de parsing
        }
      }
    } catch {
      // Continuer avec d'autres méthodes
    }

    // Méthode 2: Extraire depuis les attributs data-src et src des images
    if (images.length < 3) {
      const imgTagPattern = /<img[^>]+(?:data-src|src)=["']([^"']+\.(?:jpg|jpeg|png|gif|webp)[^"']*)["']/gi;
      let match;
      
      while ((match = imgTagPattern.exec(html)) !== null && images.length < 3) {
        const url = match[1];
        if (url && 
            url.startsWith('http') && 
            !url.includes('googleusercontent.com/url') && 
            !url.includes('gstatic.com') &&
            !url.includes('google.com/logos')) {
          images.push(url);
        }
      }
    }

    // Méthode 3: Extraire depuis les patterns d'URLs directes dans le HTML
    if (images.length < 3) {
      const urlPattern = /https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s"']*)?/gi;
      let match;
      
      while ((match = urlPattern.exec(html)) !== null && images.length < 3) {
        const url = match[0];
        if (!url.includes('googleusercontent.com/url') && 
            !url.includes('gstatic.com') && 
            !url.includes('google.com/logos') &&
            !url.includes('google.com/images')) {
          images.push(url);
        }
      }
    }

    // Dédupliquer et limiter à 3
    const uniqueImages = Array.from(new Set(images))
      .filter(url => {
        // Filtrer les URLs invalides
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      })
      .slice(0, 3);

    if (uniqueImages.length > 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ images: uniqueImages })
      };
    }

    // Si aucune image trouvée, retourner un message d'erreur
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        images: [],
        message: 'Aucune image trouvée. Google peut avoir bloqué la requête.'
      })
    };

  } catch (error) {
    console.error('Erreur recherche images:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        images: []
      })
    };
  }
};
