import { signInAnonymously } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

/**
 * Authentifie anonymement l'agent (cuisinier/serveur/caissier) et enregistre
 * un document de session liant son uid anonyme au propriétaire.
 * Les règles Firestore s'appuient sur cette session pour autoriser la
 * lecture des commandes sans exposer la donnée publiquement.
 */
export async function ensureAgentSession(agentCode: string, ownerUid: string): Promise<void> {
  try {
    let uid = auth.currentUser?.uid;
    if (!uid) {
      const cred = await signInAnonymously(auth);
      uid = cred.user.uid;
    }

    const sessionRef = doc(db, "agentSessions", uid);
    const existing = await getDoc(sessionRef);
    const now = Date.now();
    if (!existing.exists() || existing.data()?.ownerUid !== ownerUid || existing.data()?.agentCode !== agentCode) {
      await setDoc(sessionRef, {
        ownerUid,
        agentCode,
        role: agentCode,
        createdAt: existing.exists() ? existing.data()?.createdAt ?? now : now,
        updatedAt: now,
      }, { merge: true });
    }
  } catch (error) {
    // En mode hors-ligne ou sans réseau, on ne peut pas créer la session.
    // La lecture des commandes échouera, mais la commande locale reste possible.
    console.warn("ensureAgentSession:", error);
  }
}