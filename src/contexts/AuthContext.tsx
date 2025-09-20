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
  signInWithRedirect
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { UserProfile } from "@/types/profile";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  signInWithGoogle: () => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  saveProfile: (data: Omit<UserProfile, "uid" | "createdAt" | "updatedAt">) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
    return () => unsub();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const cred = await signInWithPopup(auth, provider);
      const ref = doc(db, "profiles", cred.user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
        return true; // profil présent -> dashboard
      }
      setProfile(null);
      return false; // pas de profil -> compléter profil
    } catch (e) {
      // Fallback Netlify/Popup blocked: redirect flow
      try {
        await signInWithRedirect(auth, provider);
        return false; // navigation away ou complétion ultérieure
      } catch {
        return false;
      }
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
        logoUrl: undefined,
        plan: 'trial',
        trialEndsAt: now + sevenDays,
        subscriptionEndsAt: undefined,
        lastPaymentAt: undefined,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(ref, data, { merge: true });
      setProfile(data);
    } catch (err: unknown) {
      let message = "Inscription impossible. Réessayez.";
      if (typeof err === 'object' && err && 'code' in err) {
        const code = (err as { code?: string }).code || '';
        switch (code) {
          case 'auth/email-already-in-use':
            message = "Cet email est déjà utilisé.";
            break;
          case 'auth/invalid-email':
            message = "Email invalide.";
            break;
          case 'auth/operation-not-allowed':
            message = "Inscription par email/mot de passe désactivée dans Firebase.";
            break;
          case 'auth/weak-password':
            message = "Mot de passe trop faible (>= 6 caractères).";
            break;
          default:
            message = "Une erreur est survenue lors de l'inscription. Réessayez.";
        }
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
    await setDoc(ref, payload, { merge: true });
    setProfile({ ...(profile || { uid: currentUser.uid, createdAt: now }), ...(payload as UserProfile) });
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