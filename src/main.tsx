import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { OrderProvider } from "@/contexts/OrderContext";
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

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <OrderProvider>
      <App />
    </OrderProvider>
  </ErrorBoundary>
);
