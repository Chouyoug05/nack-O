import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type User,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { UserProfile } from "@/types/profile";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  saveProfile: (data: Omit<UserProfile, "uid" | "createdAt" | "updatedAt">) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function removeUndefinedFields<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const value = obj[key];
    if (value !== undefined) {
      result[key] = value as T[typeof key];
    }
  }
  return result;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (current) => {
      setUser(current);
      setLoading(false);
      if (current) {
        setProfileLoading(true);
        try {
          const ref = doc(db, "profiles", current.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          } else {
            setProfile(null);
          }
        } finally {
          setProfileLoading(false);
        }
      } else {
        setProfile(null);
      }
    });

    // Tenter de compléter le flux de redirection Google si présent
    (async () => {
      try {
        const res = await getRedirectResult(auth);
        if (res?.user) {
          setUser(res.user);
          // Le onAuthStateChanged ci-dessus chargera le profil
        }
      } catch (err) {
        console.error('Google redirect result error:', err);
        // ignorer les erreurs de retour redirect
      }
    })();

    return () => unsub();
  }, []);

  const signInWithGoogle = async (): Promise<void> => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithRedirect(auth, provider);
    } catch (e) {
      console.error('Google redirect error:', e);
      throw new Error("Connexion Google indisponible pour le moment. Réessayez.");
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const ref = doc(db, "profiles", cred.user.uid);
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const data: UserProfile = {
        uid: cred.user.uid,
        establishmentName: "",
        establishmentType: "",
        ownerName: "",
        email,
        phone: "",
        // logoUrl omis si non défini
        plan: 'trial',
        trialEndsAt: now + sevenDays,
        // subscriptionEndsAt omis si non défini
        // lastPaymentAt omis si non défini
        createdAt: now,
        updatedAt: now,
      } as unknown as UserProfile; // champs optionnels non requis
      await setDoc(ref, removeUndefinedFields(data), { merge: true });
      setProfile(data);
    } catch (err: unknown) {
      let message = "Inscription impossible. Réessayez.";
      let code = '';
      if (typeof err === 'object' && err && 'code' in err) {
        code = (err as { code?: string }).code || '';
      }
      if (code === 'auth/email-already-in-use') {
        // Tentative de connexion automatique si le compte existe déjà
        try {
          const login = await signInWithEmailAndPassword(auth, email, password);
          const userUid = login.user.uid;
          const ref = doc(db, "profiles", userUid);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            const data: UserProfile = {
              uid: userUid,
              establishmentName: "",
              establishmentType: "",
              ownerName: "",
              email,
              phone: "",
              plan: 'trial',
              trialEndsAt: now + sevenDays,
              createdAt: now,
              updatedAt: now,
            } as unknown as UserProfile;
            await setDoc(ref, removeUndefinedFields(data), { merge: true });
            setProfile(data);
          } else {
            setProfile(snap.data() as UserProfile);
          }
          return; // Succès: on est connecté et profil prêt/créé
        } catch (loginErr: unknown) {
          // Connexion impossible (ex: mauvais mot de passe): on renvoie un message simple
          throw new Error("Cet email est déjà utilisé. Veuillez vous connecter.");
        }
      }
      switch (code) {
        case 'auth/invalid-email':
          message = "Email invalide.";
          break;
        case 'auth/operation-not-allowed':
          message = "Inscription par email/mot de passe indisponible. Contactez le support.";
          break;
        case 'auth/weak-password':
          message = "Mot de passe trop faible (>= 6 caractères).";
          break;
        case 'auth/network-request-failed':
          message = "Problème de réseau. Vérifiez votre connexion et réessayez.";
          break;
        default:
          message = "Une erreur est survenue lors de l'inscription. Réessayez.";
      }
      throw new Error(message);
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const saveProfile = async (data: Omit<UserProfile, "uid" | "createdAt" | "updatedAt">) => {
    let currentUser = user ?? auth.currentUser;
    if (!currentUser) {
      currentUser = await new Promise<User | null>((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
          unsubscribe();
          resolve(u);
        });
        setTimeout(() => {
          unsubscribe();
          resolve(null);
        }, 5000);
      });
    }
    if (!currentUser) throw new Error("Authentification en cours. Veuillez réessayer dans un instant.");
    const ref = doc(db, "profiles", currentUser.uid);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const shouldSetTrialDefaults = !profile?.plan;
    const payload: Partial<UserProfile> = {
      uid: currentUser.uid,
      ...data,
      createdAt: profile?.createdAt ?? now,
      updatedAt: now,
      ...(shouldSetTrialDefaults ? { plan: 'trial', trialEndsAt: now + sevenDays } : {}),
    };
    const clean = removeUndefinedFields(payload);
    await setDoc(ref, clean, { merge: true });
    setProfile({ ...(profile || { uid: currentUser.uid, createdAt: now }), ...(clean as UserProfile) });
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    profile,
    profileLoading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    saveProfile,
    logout,
  }), [user, loading, profile, profileLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}; 