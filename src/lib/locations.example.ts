/**
 * EXEMPLE D'UTILISATION - Récupérer toutes les localisations
 * 
 * Ce fichier montre comment utiliser les fonctions de localisation
 * pour créer une carte interactive des établissements.
 */

import { getAllEstablishmentsWithLocation, subscribeToEstablishmentsWithLocation } from "./locations";

// EXEMPLE 1: Récupérer une seule fois tous les établissements avec localisation
export async function exampleGetAllLocations() {
  const establishments = await getAllEstablishmentsWithLocation();
  
  console.log(`Trouvé ${establishments.length} établissements avec localisation`);
  
  establishments.forEach((establishment) => {
    console.log(`${establishment.establishmentName}:`, {
      lat: establishment.latitude,
      lng: establishment.longitude,
      address: establishment.address,
    });
  });
  
  return establishments;
}

// EXEMPLE 2: Écouter en temps réel les établissements avec localisation (pour une carte interactive)
export function exampleSubscribeToLocations() {
  const unsubscribe = subscribeToEstablishmentsWithLocation((establishments) => {
    console.log(`Mise à jour: ${establishments.length} établissements`);
    
    // Utiliser ces données pour mettre à jour une carte (ex: Google Maps, Leaflet, etc.)
    establishments.forEach((establishment) => {
      // Ajouter un marqueur sur la carte
      // map.addMarker({
      //   lat: establishment.latitude,
      //   lng: establishment.longitude,
      //   title: establishment.establishmentName,
      //   info: establishment.address,
      // });
    });
  });
  
  // N'oubliez pas de se désabonner quand le composant est démonté
  // return () => unsubscribe();
  return unsubscribe;
}

// EXEMPLE 3: Utiliser dans un composant React
/*
import { useEffect, useState } from "react";
import { getAllEstablishmentsWithLocation, EstablishmentWithLocation } from "@/lib/locations";

function MapComponent() {
  const [establishments, setEstablishments] = useState<EstablishmentWithLocation[]>([]);
  
  useEffect(() => {
    getAllEstablishmentsWithLocation().then(setEstablishments);
  }, []);
  
  return (
    <div>
      {establishments.map((est) => (
        <div key={est.uid}>
          {est.establishmentName} - {est.latitude}, {est.longitude}
        </div>
      ))}
    </div>
  );
}
*/

// EXEMPLE 4: Utiliser avec un listener en temps réel
/*
import { useEffect } from "react";
import { subscribeToEstablishmentsWithLocation, EstablishmentWithLocation } from "@/lib/locations";

function LiveMapComponent() {
  const [establishments, setEstablishments] = useState<EstablishmentWithLocation[]>([]);
  
  useEffect(() => {
    const unsubscribe = subscribeToEstablishmentsWithLocation(setEstablishments);
    return unsubscribe; // Cleanup à la démontée
  }, []);
  
  return (
    <div>
      {establishments.map((est) => (
        <div key={est.uid}>
          {est.establishmentName} - {est.latitude}, {est.longitude}
        </div>
      ))}
    </div>
  );
}
*/
