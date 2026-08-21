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
    console.log('[ensureAgentSession] Début pour agentCode:', agentCode, 'ownerUid:', ownerUid);
    let uid = auth.currentUser?.uid;
    console.log('[ensureAgentSession] UID actuel:', uid);
    
    if (uid === ownerUid) {
      console.log('[ensureAgentSession] L\'utilisateur est déjà le propriétaire, pas besoin de session agent');
      return;
    }
    
    if (!uid) {
      console.log('[ensureAgentSession] Connexion anonyme...');
      const cred = await signInAnonymously(auth);
      uid = cred.user.uid;
      console.log('[ensureAgentSession] Connecté anonymement avec UID:', uid);
    }

    const sessionRef = doc(db, "agentSessions", uid);
    const existing = await getDoc(sessionRef);
    console.log('[ensureAgentSession] Session existante:', existing.exists(), existing.data());
    const now = Date.now();
    if (!existing.exists() || existing.data()?.ownerUid !== ownerUid || existing.data()?.agentCode !== agentCode) {
      console.log('[ensureAgentSession] Création/mise à jour de la session...');
      await setDoc(sessionRef, {
        ownerUid,
        agentCode,
        role: agentCode,
        createdAt: existing.exists() ? existing.data()?.createdAt ?? now : now,
        updatedAt: now,
      }, { merge: true });
      console.log('[ensureAgentSession] Session créée avec succès pour UID:', uid);
    } else {
      console.log('[ensureAgentSession] Session déjà valide, pas de mise à jour nécessaire');
    }
  } catch (error) {
    console.error("[ensureAgentSession] Erreur:", error);
  }
}