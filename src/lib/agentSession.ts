import { signInAnonymously } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

/**
 * Authentifie anonymement l'agent (cuisinier/serveur/caissier) et enregistre
 * un document de session liant son uid anonyme au propriétaire.
 * Les règles Firestore s'appuient sur cette session pour autoriser la
 * lecture des commandes sans exposer la donnée publiquement.
 * Throws si l'échec est irrécupérable pour bloquer l'accès.
 */
export async function ensureAgentSession(agentCode: string, ownerUid: string): Promise<void> {
  let uid = auth.currentUser?.uid;

  if (uid === ownerUid) {
    return;
  }

  if (!uid) {
    const cred = await signInAnonymously(auth);
    uid = cred.user.uid;
  }

  if (!uid) {
    throw new Error("Impossible de s'authentifier anonymement.");
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
}