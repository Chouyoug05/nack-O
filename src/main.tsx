import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/firebase";
import ErrorBoundary from "@/components/ErrorBoundary";
import { isElectronRenderer } from "@/lib/platform";

// Service worker (PWA + offline + notifications)
// En production on enregistre le SW principal. En dev, on évite de garder un SW
// qui peut mettre le serveur vite en cache.
try {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    if (import.meta.env.PROD && !isElectronRenderer()) {
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

// Handler global : afficher une erreur au lieu d'un écran blanc
if (typeof window !== "undefined") {
  window.onerror = function (msg, _src, _line, _col, error) {
    console.error("[NACK] Global error:", msg, error);
    var fb = document.getElementById("nack-fallback");
    if (fb) {
      fb.innerHTML =
        '<div style="text-align:center;padding:1.5rem">' +
        '<svg width="48" height="48" viewBox="0 0 48 48" fill="none" style="margin:0 auto 1rem"><rect width="48" height="48" rx="12" fill="#dc2626"/><text x="24" y="32" text-anchor="middle" fill="white" font-size="24" font-weight="bold" font-family="sans-serif">N</text></svg>' +
        '<h2 style="font-size:1.125rem;margin-bottom:0.5rem">Une erreur est survenue</h2>' +
        '<p style="color:#666;font-size:0.875rem;margin-bottom:1rem">Essayez de recharger la page. Si le problème persiste, votre appareil est peut-être trop ancien.</p>' +
        '<button onclick="window.location.reload()" style="padding:0.5rem 1.5rem;background:#dc2626;color:white;border:none;border-radius:0.375rem;cursor:pointer;font-size:0.875rem">Recharger</button>' +
        '</div>';
    }
    return false;
  };

  window.addEventListener("unhandledrejection", function (e) {
    console.error("[NACK] Unhandled promise rejection:", e.reason);
  });
}

try {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Root element not found");

  // Supprimer le fallback une fois que React est prêt
  const fallback = document.getElementById("nack-fallback");
  if (fallback) fallback.remove();

  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} catch (err) {
  console.error("[NACK] Failed to mount React:", err);
  var fb = document.getElementById("nack-fallback");
  if (fb) {
    fb.innerHTML =
      '<div style="text-align:center;padding:1.5rem">' +
      '<svg width="48" height="48" viewBox="0 0 48 48" fill="none" style="margin:0 auto 1rem"><rect width="48" height="48" rx="12" fill="#dc2626"/><text x="24" y="32" text-anchor="middle" fill="white" font-size="24" font-weight="bold" font-family="sans-serif">N</text></svg>' +
      '<h2 style="font-size:1.125rem;margin-bottom:0.5rem">Appareil non compatible</h2>' +
      '<p style="color:#666;font-size:0.875rem;margin-bottom:1rem">Votre navigateur ne peut pas exécuter NACK. Veuillez utiliser un navigateur plus récent.</p>' +
      '<button onclick="window.location.reload()" style="padding:0.5rem 1.5rem;background:#dc2626;color:white;border:none;border-radius:0.375rem;cursor:pointer;font-size:0.875rem">Recharger</button>' +
      '</div>';
  }
}
