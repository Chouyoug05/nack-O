import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RELOAD_KEY = "nack:chunk-reload-at";

function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || "");
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}

/** Un seul rechargement automatique après un déploiement (chunk hash obsolète). */
export function reloadOnceForStaleChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
    if (Date.now() - last < 15_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

/**
 * Comme React.lazy, mais recharge la page une fois si le chunk
 * n'existe plus (déploiement Vite / PWA avec ancien index en mémoire).
 */
export function lazyWithReload<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((err) => {
      if (isChunkLoadError(err) && reloadOnceForStaleChunk()) {
        return new Promise<{ default: T }>(() => {
          /* attente du reload */
        });
      }
      throw err;
    })
  );
}

export { isChunkLoadError };
