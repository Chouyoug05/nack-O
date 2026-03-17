import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/firebase";
import ErrorBoundary from "@/components/ErrorBoundary";

// Service worker (PWA + offline + notifications)
// En production on enregistre le SW principal. En dev, on évite de garder un SW
// qui peut mettre le serveur vite en cache.
try {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {
        // ignore registration errors (ex: navigateur non supporté / policies)
      });
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => {
          try { r.unregister(); } catch { /* ignore */ }
        });
      }).catch(() => { /* ignore */ });
    }
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

// Garde globale: éviter NotFoundError sur insertBefore quand un script externe
// modifie le DOM sous React (le "before" n'est plus un enfant du parent).
try {
  if (typeof window !== "undefined" && typeof Node !== "undefined") {
    const originalInsertBefore: typeof Node.prototype.insertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(newChild: T, refChild: Node | null): T {
      try {
        if (refChild == null) {
          return originalInsertBefore.call(this, newChild, refChild) as T;
        }
        // Si le noeud de référence n'est plus un enfant de ce parent, fallback sans crash.
        if (refChild.parentNode !== this) {
          // appendChild est le plus proche équivalent sémantiquement.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (this.appendChild(newChild) as any) as T;
        }
        return originalInsertBefore.call(this, newChild, refChild) as T;
      } catch {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (this.appendChild(newChild) as any) as T;
        } catch {
          return newChild;
        }
      }
    };
  }
} catch { /* ignore */ }

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
