import { db } from "./firebase";
import { profilesColRef } from "./collections";
import { query, where, getDocs, orderBy, onSnapshot } from "firebase/firestore";
import type { UserProfile } from "@/types/profile";

/**
 * Interface pour un établissement avec localisation
 * Note: Ne contient que les données publiques nécessaires pour la carte
 */
export interface EstablishmentWithLocation {
  uid: string;
  establishmentName: string;
  establishmentType: string;
  ownerName?: string; // Optionnel pour la carte publique
  logoUrl?: string;
  latitude: number;
  longitude: number;
  address?: string;
}

/**
 * Récupère tous les établissements qui ont une localisation enregistrée
 * Cette fonction peut être utilisée pour créer une carte interactive
 */
/**
 * Recherche d'établissements par texte (nom, adresse, type)
 */
export async function searchEstablishmentsByText(searchText: string): Promise<EstablishmentWithLocation[]> {
  if (!searchText || searchText.trim().length < 2) {
    return [];
  }

  const searchLower = searchText.toLowerCase().trim();
  const all = await getAllEstablishmentsWithLocation();
  
  return all.filter((establishment) => {
    const nameMatch = establishment.establishmentName.toLowerCase().includes(searchLower);
    const typeMatch = establishment.establishmentType.toLowerCase().includes(searchLower);
    const addressMatch = establishment.address?.toLowerCase().includes(searchLower);
    
    return nameMatch || typeMatch || addressMatch;
  });
}

export async function getAllEstablishmentsWithLocation(): Promise<EstablishmentWithLocation[]> {
  try {
    // Essayer d'abord avec une requête optimisée (si index existe)
    const q = query(
      profilesColRef(db),
      where("latitude", "!=", null),
      where("longitude", "!=", null),
      orderBy("establishmentName")
    );

    const snapshot = await getDocs(q);
    const establishments: EstablishmentWithLocation[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data() as UserProfile;
      if (data.latitude && data.longitude) {
        establishments.push({
          uid: data.uid,
          establishmentName: data.establishmentName,
          establishmentType: data.establishmentType,
          ownerName: data.ownerName,
          logoUrl: data.logoUrl,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address,
        });
      }
    });

    return establishments;
  } catch (error) {
    console.error("Erreur lors de la récupération des établissements:", error);
    // Si la requête avec where échoue (index manquant), récupérer tous les profils et filtrer
    try {
      const q = query(profilesColRef(db), orderBy("establishmentName"));
      const snapshot = await getDocs(q);
      const establishments: EstablishmentWithLocation[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as UserProfile;
        // Accepter les établissements avec adresse même sans coordonnées GPS
        if ((data.latitude && data.longitude && typeof data.latitude === 'number' && typeof data.longitude === 'number') || data.address) {
          establishments.push({
            uid: data.uid,
            establishmentName: data.establishmentName,
            establishmentType: data.establishmentType,
            ownerName: data.ownerName,
            email: data.email,
            phone: data.phone,
            logoUrl: data.logoUrl,
            latitude: data.latitude || 0,
            longitude: data.longitude || 0,
            address: data.address,
          });
        }
      });

      return establishments;
    } catch (fallbackError) {
      console.error("Erreur lors de la récupération de secours:", fallbackError);
      return [];
    }
  }
}

/**
 * Crée un listener en temps réel pour les établissements avec localisation
 * Utile pour les cartes interactives qui se mettent à jour automatiquement
 */
export function subscribeToEstablishmentsWithLocation(
  callback: (establishments: EstablishmentWithLocation[]) => void
): () => void {
  // Essayer d'abord avec une requête optimisée
  try {
    const q = query(
      profilesColRef(db),
      where("latitude", "!=", null),
      where("longitude", "!=", null),
      orderBy("establishmentName")
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const establishments: EstablishmentWithLocation[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as UserProfile;
          if (data.latitude && data.longitude && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
            establishments.push({
              uid: data.uid,
              establishmentName: data.establishmentName,
              establishmentType: data.establishmentType,
              ownerName: data.ownerName,
              email: data.email,
              phone: data.phone,
              logoUrl: data.logoUrl,
              latitude: data.latitude,
              longitude: data.longitude,
              address: data.address,
            });
          }
        });
        callback(establishments);
      },
      (error) => {
        console.error("Erreur lors de l'écoute des établissements:", error);
        // Fallback: récupérer tous les profils et filtrer (inclure ceux avec adresse même sans GPS)
        const q = query(profilesColRef(db), orderBy("establishmentName"));
        return onSnapshot(
          q,
          (snapshot) => {
            const establishments: EstablishmentWithLocation[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data() as UserProfile;
              // Accepter les établissements avec coordonnées GPS OU avec adresse
              if ((data.latitude && data.longitude && typeof data.latitude === 'number' && typeof data.longitude === 'number') || data.address) {
                establishments.push({
                  uid: data.uid,
                  establishmentName: data.establishmentName,
                  establishmentType: data.establishmentType,
                  ownerName: data.ownerName,
                  email: data.email,
                  phone: data.phone,
                  logoUrl: data.logoUrl,
                  latitude: data.latitude || 0,
                  longitude: data.longitude || 0,
                  address: data.address,
                });
              }
            });
            callback(establishments);
          },
          (fallbackError) => {
            console.error("Erreur lors de la récupération de secours:", fallbackError);
            callback([]);
          }
        );
      }
    );
  } catch (error) {
    // Fallback immédiat si la requête n'est pas supportée
    const q = query(profilesColRef(db), orderBy("establishmentName"));
    return onSnapshot(q, (snapshot) => {
      const establishments: EstablishmentWithLocation[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as UserProfile;
        // Accepter les établissements avec coordonnées GPS OU avec adresse
        if ((data.latitude && data.longitude && typeof data.latitude === 'number' && typeof data.longitude === 'number') || data.address) {
          establishments.push({
            uid: data.uid,
            establishmentName: data.establishmentName,
            establishmentType: data.establishmentType,
            ownerName: data.ownerName,
            email: data.email,
            phone: data.phone,
            logoUrl: data.logoUrl,
            latitude: data.latitude || 0,
            longitude: data.longitude || 0,
            address: data.address,
          });
        }
      });
      callback(establishments);
    });
  }
}

/**
 * Récupère les établissements dans une zone géographique (recherche par rayon)
 * Note: Firestore ne supporte pas nativement les requêtes géospatiales.
 * Cette fonction récupère tous les établissements et les filtre côté client.
 * Pour de meilleures performances avec beaucoup de données, considérez utiliser
 * une solution comme Geofire ou une extension Firestore.
 */
export async function getEstablishmentsInRadius(
  centerLat: number,
  centerLng: number,
  radiusKm: number
): Promise<EstablishmentWithLocation[]> {
  const all = await getAllEstablishmentsWithLocation();
  
  return all.filter((establishment) => {
    const distance = calculateDistance(
      centerLat,
      centerLng,
      establishment.latitude,
      establishment.longitude
    );
    return distance <= radiusKm;
  });
}

/**
 * Calcule la distance en kilomètres entre deux points GPS
 * Utilise la formule de Haversine
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
