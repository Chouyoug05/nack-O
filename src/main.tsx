import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/firebase";
import ErrorBoundary from "@/components/ErrorBoundary";

// Nettoyage préventif d'anciens Service Workers/caches qui peuvent casser la navigation sur Chrome
try {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length > 0) {
          for (const reg of regs) {
            // Ne pas désenregistrer le service worker des notifications
            if (reg.active?.scriptURL.includes('firebase-messaging-sw.js')) continue;
            try { await reg.unregister(); } catch { /* ignore */ }
          }
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          } catch { /* ignore */ }
          // L’onglet courant restera contrôlé jusqu’au rechargement; log d’info.
          // L’utilisateur peut recharger manuellement si un SW contrôlait la page.
          console.warn('Service workers/caches nettoyés. Rechargez la page si un comportement persiste.');
        }
      } catch { /* ignore */ }
    })();
  }
} catch { /* ignore */ }

// Garde globale: éviter NotFoundError sur removeChild pour des portails démontés
try {
  if (typeof window !== 'undefined' && typeof Node !== 'undefined') {
    const originalRemoveChild: typeof Node.prototype.removeChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(child: T): T {
      try {
        // Supprimer seulement si le parent correspond encore
        if (child && child.parentNode === this) {
          return originalRemoveChild.call(this, child);
        }
      } catch {
        // ignore et retomber sur retour neutre
      }
      return child;
    };
  }
} catch { /* ignore */ }

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
