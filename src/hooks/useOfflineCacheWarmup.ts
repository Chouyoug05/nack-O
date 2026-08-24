import { useEffect, useRef } from "react";
import { getDocs, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { productsColRef, ordersColRef } from "@/lib/collections";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { flushPendingOrders } from "@/lib/localSyncQueue";

const PRELOAD_LIMIT = 200;

/**
 * Précharge en arrière-plan produits + commandes pour le mode hors-ligne,
 * et synchronise la file d'attente au retour du réseau.
 */
export function useOfflineCacheWarmup() {
  const { user, profile } = useAuth();
  const { isOnline } = useOnlineStatus();
  const warmedRef = useRef(false);

  useEffect(() => {
    if (!user?.uid || !profile || !isOnline || warmedRef.current) return;

    const uid = user.uid;
    warmedRef.current = true;

    const run = () => {
      Promise.all([
        getDocs(query(productsColRef(db, uid), limit(PRELOAD_LIMIT))),
        getDocs(query(ordersColRef(db, uid), limit(PRELOAD_LIMIT))),
      ]).catch(() => {
        warmedRef.current = false;
      });
    };

    const id = window.setTimeout(run, 1500);
    return () => clearTimeout(id);
  }, [user?.uid, profile, isOnline]);

  useEffect(() => {
    if (!user?.uid || !isOnline) return;

    const flush = () => {
      void flushPendingOrders(user.uid);
    };

    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [user?.uid, isOnline]);
}
