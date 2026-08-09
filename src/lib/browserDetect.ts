/**
 * Détection légère des capacités du navigateur.
 * Ne bloque pas les appareils anciens — identifie juste le niveau de support.
 */

export type BrowserLevel = 'modern' | 'compatibility' | 'unsupported';

/**
 * Vérifie les fonctionnalités critiques nécessaires au fonctionnement de NACK!.
 */
export function detectBrowserLevel(): BrowserLevel {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 'unsupported';
  }

  // ES2015+ fondamentaux — si absent, le code transpilé ne fonctionnera pas non plus
  if (typeof Symbol === 'undefined') return 'unsupported';
  if (typeof Promise === 'undefined') return 'unsupported';
  if (typeof Array.prototype.find === 'undefined') return 'unsupported';
  if (typeof Array.prototype.includes === 'undefined') return 'unsupported';
  if (typeof Object.assign === 'undefined') return 'unsupported';

  // fetch obligatoire pour Firebase / API
  if (typeof fetch === 'undefined') return 'unsupported';

  // IndexedDB pour le stockage offline
  if (typeof indexedDB === 'undefined') return 'unsupported';

  // Service Worker (nécessaire pour le mode hors ligne PWA)
  if (typeof navigator !== 'undefined' && !('serviceWorker' in navigator)) {
    // SW absent : on peut quand même fonctionner en mode web classique
    return 'compatibility';
  }

  // Tout est présent — appareil modern ou transpilé correctement
  return 'modern';
}

/**
 * Retourne un message explicatif pour les appareils non supportés.
 */
export function getUnsupportedMessage(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);

  if (isIOS) {
    return (
      "Votre appareil iOS est trop ancien pour exécuter NACK!. " +
      "Veuillez mettre à jour votre appareil vers iOS 13 ou supérieur, " +
      "ou utilisez un appareil plus récent."
    );
  }

  return (
    "Votre navigateur est trop ancien pour exécuter NACK!. " +
    "Veuillez mettre à jour votre navigateur vers une version récente, " +
    "ou utilisez un appareil plus récent."
  );
}
