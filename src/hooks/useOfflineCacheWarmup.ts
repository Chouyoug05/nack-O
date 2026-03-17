import { useEffect, useRef } from "react";
import { getDocs, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { productsColRef, barOrdersColRef } from "@/lib/collections";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const PRELOAD_LIMIT = 200;

/**
 * Précharge en arrière-plan les produits et commandes de l'établissement
 * quand l'utilisateur est connecté et en ligne, pour que le cache Firestore
 * contienne ces données en cas de passage hors ligne.
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
        getDocs(query(barOrdersColRef(db, uid), limit(PRELOAD_LIMIT))),
      ]).catch(() => {
        warmedRef.current = false;
      });
    };

    const id = window.setTimeout(run, 1500);
    return () => clearTimeout(id);
  }, [user?.uid, profile, isOnline]);
}
