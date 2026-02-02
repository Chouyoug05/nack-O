/**
 * Utilitaires pour le géocodage (adresse ↔ coordonnées GPS)
 */

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  address: string;
  displayName: string;
}

/**
 * Convertit une adresse en coordonnées GPS (géocodage)
 * Utilise Nominatim (OpenStreetMap)
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!address || address.trim().length < 3) {
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Nack App'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Erreur de géocodage');
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0];
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      address: result.display_name || address,
      displayName: result.display_name || address
    };
  } catch (error) {
    console.error('Erreur géocodage:', error);
    return null;
  }
}

/**
 * Convertit des coordonnées GPS en adresse (reverse geocoding)
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Nack App'
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.display_name || null;
  } catch (error) {
    console.error('Erreur reverse géocodage:', error);
    return null;
  }
}

/**
 * Recherche d'adresses avec autocomplétion
 */
export async function searchAddresses(query: string, limit: number = 5): Promise<Array<{ display_name: string; lat: string; lon: string }>> {
  if (!query || query.trim().length < 3) {
    return [];
  }

  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=${limit}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Nack App'
        }
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.map((item: { display_name?: string; lat?: string; lon?: string }) => ({
      display_name: item.display_name,
      lat: item.lat,
      lon: item.lon
    }));
  } catch (error) {
    console.error('Erreur recherche adresses:', error);
    return [];
  }
}

