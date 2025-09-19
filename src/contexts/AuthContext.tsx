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
        return true;
      }
      setProfile(null);
      return true;
    } catch (e) {
      // Fallback Netlify/Popup blocked: redirect flow
      try {
        await signInWithRedirect(auth, provider);
        return false; // navigation away
      } catch {
        return false;
      }
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
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
    await setDoc(ref, data);
    setProfile(data);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const saveProfile = async (data: Omit<UserProfile, "uid" | "createdAt" | "updatedAt">) => {
    if (!user) throw new Error("Not authenticated");
    const ref = doc(db, "profiles", user.uid);
    const payload: UserProfile = {
      uid: user.uid,
      ...data,
      createdAt: profile?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    await setDoc(ref, payload);
    setProfile(payload);
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