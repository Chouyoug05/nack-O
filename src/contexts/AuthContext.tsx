import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { getRememberedTabletImei, touchTabletLastSeen } from "@/lib/tabletsSupport";
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
import { doc, getDoc, setDoc, addDoc, onSnapshot, updateDoc, collection, query, where, getDocs, type DocumentSnapshot } from "firebase/firestore";
import type { UserProfile } from "@/types/profile";
import type { EstablishmentDoc, EstablishmentRef } from "@/types/establishment";
import { notificationsColRef, establishmentsColRef, establishmentDocRef } from "@/lib/collections";
import { adminDocRef } from "@/lib/collections";
import { getFriendlyErrorMessage } from "@/utils/authErrors";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  isAdmin: boolean;
  isAdminLoading: boolean;
  activeEstablishment: EstablishmentDoc | null;
  establishments: EstablishmentRef[];
  switchEstablishment: (eid: string) => Promise<void>;
  createEstablishment: (data: Partial<EstablishmentDoc>) => Promise<string>;
  removeEstablishment: (eid: string) => Promise<void>;
  refreshEstablishments: () => Promise<void>;
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

/** CrÃ©e l'Ã©tablissement principal pour un nouvel utilisateur ou un utilisateur legacy */
const ensureFirstEstablishment = async (profile: UserProfile, dbInstance: typeof db): Promise<{ eid: string; establishment: EstablishmentDoc }> => {
  const now = Date.now();
  const eid = profile.uid; // Premier Ã©tablissement = uid de l'utilisateur
  const estRef = establishmentDocRef(dbInstance, eid);
  const estSnap = await getDoc(estRef);

  if (estSnap.exists()) {
    return { eid, establishment: estSnap.data() as EstablishmentDoc };
  }

  const establishment: EstablishmentDoc = {
    id: eid,
    ownerUid: profile.uid,
    name: profile.establishmentName || "",
    type: profile.establishmentType || "",
    ownerName: profile.ownerName || "",
    email: profile.email || "",
    phone: profile.phone || "",
    whatsapp: profile.whatsapp,
    logoUrl: profile.logoUrl,
    logoDeleteToken: profile.logoDeleteToken,
    managerPinHash: profile.managerPinHash,
    address: profile.address,
    latitude: profile.latitude,
    longitude: profile.longitude,
    locationAsked: profile.locationAsked,
    companyName: profile.companyName,
    rcsNumber: profile.rcsNumber,
    nifNumber: profile.nifNumber,
    businessPhone: profile.businessPhone,
    fullAddress: profile.fullAddress,
    customMessage: profile.customMessage,
    legalMentions: profile.legalMentions,
    ticketLogoUrl: profile.ticketLogoUrl,
    showDeliveryMention: profile.showDeliveryMention,
    showCSSMention: profile.showCSSMention,
    cssPercentage: profile.cssPercentage,
    ticketFooterMessage: profile.ticketFooterMessage,
    airtelMoneyNumber: profile.airtelMoneyNumber,
    deliveryEnabled: profile.deliveryEnabled,
    deliveryPrice: profile.deliveryPrice,
    plan: profile.plan,
    subscriptionType: profile.subscriptionType,
    trialEndsAt: profile.trialEndsAt,
    subscriptionEndsAt: profile.subscriptionEndsAt,
    lastPaymentAt: profile.lastPaymentAt,
    eventsCount: profile.eventsCount,
    extraEventsBilled: profile.extraEventsBilled,
    eventsResetAt: profile.eventsResetAt,
    tutorialCompleted: profile.tutorialCompleted,
    tutorialStep: profile.tutorialStep,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(estRef, removeUndefinedFields(establishment));
  return { eid, establishment };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Safety net : forcer loading=false après 10s si Firebase Auth ne répond pas
  // (évite l'écran blanc infini sur les anciens appareils)
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) console.warn("[NACK] Auth loading timeout — forcing resolution");
        return false;
      });
    }, 10000);
    return () => clearTimeout(timer);
  }, []);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [activeEstablishment, setActiveEstablishment] = useState<EstablishmentDoc | null>(null);
  const [establishments, setEstablishments] = useState<EstablishmentRef[]>([]);

  // RÃ©cupÃ©rer la liste des Ã©tablissements d'un utilisateur depuis la collection establishments
  const fetchUserEstablishments = useCallback(async (uid: string): Promise<EstablishmentRef[]> => {
    try {
      const q = query(establishmentsColRef(db), where("ownerUid", "==", uid));
      const snap = await getDocs(q);
      return snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: (data as Record<string, unknown>).name as string || "",
          type: (data as Record<string, unknown>).type as string || "",
          logoUrl: (data as Record<string, unknown>).logoUrl as string | undefined,
        };
      });
    } catch {
      return [];
    }
  }, []);

  // Charger un document Ã©tablissement + s'abonner aux changements
  const loadEstablishment = useCallback((eid: string | undefined) => {
    if (!eid) {
      setActiveEstablishment(null);
      return () => {};
    }
    const ref = establishmentDocRef(db, eid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setActiveEstablishment(snap.data() as EstablishmentDoc);
      }
    }, () => {
      setActiveEstablishment(null);
    });
    return unsub;
  }, []);

  // Mettre Ã  jour le profil avec la liste des Ã©tablissements
  const syncEstablishmentList = useCallback(async (uid: string, refs: EstablishmentRef[]) => {
    try {
      const profileRef = doc(db, "profiles", uid);
      const existingSnap = await getDoc(profileRef);
      const existingData = existingSnap.data() as UserProfile | undefined;
      const existingRefs = existingData?.establishments || [];

      const merged = [...refs];
      for (const existing of existingRefs) {
        if (!merged.find(r => r.id === existing.id)) {
          merged.push(existing);
        }
      }

      await updateDoc(profileRef, {
        establishments: merged,
        updatedAt: Date.now(),
      }).catch(() => {});
      setProfile(prev => prev ? { ...prev, establishments: merged, updatedAt: Date.now() } : prev);
    } catch {
      // silencieux
    }
  }, []);

  // Migration legacy : crÃ©er le premier Ã©tablissement si nÃ©cessaire
  const migrateLegacyProfile = useCallback(async (profileData: UserProfile) => {
    const needsMigration = !profileData.activeEstablishmentId || !profileData.establishments?.length;
    if (!needsMigration) return profileData;

    const { eid } = await ensureFirstEstablishment(profileData, db);

    const profileRef = doc(db, "profiles", profileData.uid);
    const estRef: EstablishmentRef = {
      id: eid,
      name: profileData.establishmentName || eid,
      type: profileData.establishmentType || "",
      logoUrl: profileData.logoUrl,
    };

    const payload: Record<string, unknown> = {
      activeEstablishmentId: eid,
      updatedAt: Date.now(),
    };
    if (!profileData.establishments?.length) {
      payload.establishments = [estRef];
    }

    await updateDoc(profileRef, payload).catch(() => {});

    const updatedProfile = {
      ...profileData,
      activeEstablishmentId: eid,
      establishments: profileData.establishments?.length ? profileData.establishments : [estRef],
    };
    setProfile(updatedProfile);
    return updatedProfile;
  }, []);

  useEffect(() => {
    let expectRedirect = false;
    try {
      expectRedirect = sessionStorage.getItem('nack_oauth_redirect') === '1';
    } catch { /* ignore */ }
    let redirectChecked = !expectRedirect;

    const unsub = onAuthStateChanged(auth, async (current) => {
      setUser(current);
      if (current) {
        setProfileLoading(true);
        setIsAdminLoading(true);
        try {
          const ref = doc(db, "profiles", current.uid);
          const snap = await getDoc(ref);
          let profileData: UserProfile | null = null;
          if (snap.exists()) {
            profileData = snap.data() as UserProfile;
            // Migration legacy
            profileData = await migrateLegacyProfile(profileData);
            setProfile(profileData);

            // Charger la liste des Ã©tablissements
            const estRefs = profileData.establishments || [];
            if (estRefs.length === 0) {
              const refs = await fetchUserEstablishments(current.uid);
              setEstablishments(refs);
              if (refs.length > 0) {
                syncEstablishmentList(current.uid, refs);
              } else if (profileData.activeEstablishmentId) {
                const single: EstablishmentRef[] = [{
                  id: profileData.activeEstablishmentId,
                  name: profileData.establishmentName || profileData.activeEstablishmentId,
                  type: profileData.establishmentType || "",
                  logoUrl: profileData.logoUrl,
                }];
                setEstablishments(single);
                syncEstablishmentList(current.uid, single);
              }
            } else {
              setEstablishments(estRefs);
            }
          } else {
            setProfile(null);
            setEstablishments([]);
          }
          try {
            const aSnap = await getDoc(adminDocRef(db, current.uid));
            setIsAdmin(!!aSnap.exists());
          } catch {
            setIsAdmin(false);
          }
        } finally {
          setProfileLoading(false);
          setIsAdminLoading(false);
        }
      } else {
        setProfile(null);
        setActiveEstablishment(null);
        setEstablishments([]);
        setIsAdmin(false);
        setIsAdminLoading(false);
      }
      if (redirectChecked) {
        setLoading(false);
      }
    });

    if (expectRedirect) {
      (async () => {
        try {
          const res = await getRedirectResult(auth);
          if (res?.user) {
            setUser(res.user);
            try {
              const rref = doc(db, "profiles", res.user.uid);
              const rsnap = await getDoc(rref);
              const base = import.meta.env.BASE_URL || '/';
              const join = (p: string) => {
                const baseTrim = base.endsWith('/') ? base.slice(0, -1) : base;
                const path = p.startsWith('/') ? p : `/${p}`;
                return `${baseTrim}${path}`;
              };
              try {
                const aSnap = await getDoc(adminDocRef(db, res.user.uid));
                if (aSnap.exists()) {
                  window.location.replace(join('/admin'));
                  return;
                }
              } catch { /* ignore */ }
              if (rsnap.exists()) {
                window.location.replace(join('/dashboard'));
                return;
              } else {
                window.location.replace(join('/complete-profile'));
                return;
              }
            } catch (redirErr) {
              console.error('Post-redirect profile load error:', redirErr);
            }
          }
        } catch (err) {
          console.error('Google redirect result error:', err);
        } finally {
          try { sessionStorage.removeItem('nack_oauth_redirect'); } catch { /* ignore */ }
          redirectChecked = true;
          setLoading(false);
        }
      })();
    }

    return () => unsub();
  }, [migrateLegacyProfile, fetchUserEstablishments, syncEstablishmentList]);

  // Ã‰couter en temps rÃ©el le profil utilisateur
  useEffect(() => {
    if (!user) return;
    const unsubProfile = onSnapshot(doc(db, "profiles", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setProfile(data);
        if (data.establishments) {
          setEstablishments(data.establishments);
        }
      } else {
        setProfile(null);
      }
      setProfileLoading(false);
    }, () => setProfileLoading(false));

    const unsubAdmin = onSnapshot(adminDocRef(db, user.uid), (snap) => {
      setIsAdmin(!!snap.exists());
      setIsAdminLoading(false);
    }, () => setIsAdminLoading(false));

    return () => {
      unsubProfile();
      unsubAdmin();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const imei = getRememberedTabletImei(user.uid);
    if (!imei) return;
    touchTabletLastSeen(db, imei, user.uid).catch(() => undefined);
  }, [user]);

  // Ã‰couter l'Ã©tablissement actif en temps rÃ©el
  useEffect(() => {
    if (!profile?.activeEstablishmentId) {
      setActiveEstablishment(null);
      return;
    }
    const unsub = loadEstablishment(profile.activeEstablishmentId);
    return unsub;
  }, [profile?.activeEstablishmentId, loadEstablishment]);

  // Notifications systÃ¨me
  useEffect(() => {
    const pushSystemNotifications = async () => {
      if (!user || !profile) return;
      const uid = user.uid;
      try {
        const now = Date.now();
        const baseKey = (k: string) => `nack_sys_notif_${k}_${uid}`;
        if (profile.plan === 'trial' && profile.trialEndsAt) {
          const msLeft = profile.trialEndsAt - now;
          const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
          if (daysLeft > 0 && daysLeft <= 2) {
            const dayKey = baseKey(`trial_${daysLeft}`);
            if (!localStorage.getItem(dayKey)) {
              try {
                await addDoc(notificationsColRef(db, uid), {
                  title: "Essai bientÃ´t terminÃ©",
                  message: `Il vous reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''} pour utiliser la plateforme. Passez Ã  l'abonnement.`,
                  type: "warning",
                  createdAt: now,
                  read: false,
                });
                localStorage.setItem(dayKey, '1');
              } catch { /* ignore trial notif failure */ }
            }
          }
        }
      } catch { /* ignore sys notif orchestration errors */ }
    };
    pushSystemNotifications();
  }, [user, profile]);

  const signInWithGoogle = async (): Promise<void> => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      try { sessionStorage.setItem('nack_oauth_redirect', '1'); } catch { /* ignore */ }
      await signInWithRedirect(auth, provider);
    } catch (e) {
      console.error('Google redirect error:', e);
      throw new Error("Connexion Google indisponible pour le moment. RÃ©essayez.");
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      // CrÃ©er le premier Ã©tablissement
      const eid = cred.user.uid;
      const est: EstablishmentDoc = {
        id: eid,
        ownerUid: cred.user.uid,
        name: "",
        type: "",
        ownerName: "",
        email,
        phone: "",
        plan: 'trial',
        trialEndsAt: now + sevenDays,
        tutorialCompleted: false,
        tutorialStep: 'stock',
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(establishmentDocRef(db, eid), removeUndefinedFields(est));

      // CrÃ©er le profil utilisateur
      const profileData: UserProfile = {
        uid: cred.user.uid,
        establishmentName: "",
        establishmentType: "",
        ownerName: "",
        email,
        phone: "",
        plan: 'trial',
        trialEndsAt: now + sevenDays,
        tutorialCompleted: false,
        tutorialStep: 'stock',
        activeEstablishmentId: eid,
        establishments: [{ id: eid, name: "", type: "" }],
        createdAt: now,
        updatedAt: now,
      };
      const ref = doc(db, "profiles", cred.user.uid);
      await setDoc(ref, removeUndefinedFields(profileData), { merge: true });
      setProfile(profileData);
      setActiveEstablishment(est);
      setEstablishments([{ id: eid, name: "", type: "" }]);
    } catch (err: unknown) {
      throw new Error(getFriendlyErrorMessage(err));
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
    if (!currentUser) throw new Error("Authentification en cours. Veuillez rÃ©essayer dans un instant.");
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

    // Sync avec l'Ã©tablissement actif
    const eid = payload.activeEstablishmentId || profile?.activeEstablishmentId;
    if (eid) {
      const estRef = establishmentDocRef(db, eid);
      const estPayload: Partial<EstablishmentDoc> = {
        name: data.establishmentName ?? activeEstablishment?.name,
        type: data.establishmentType ?? activeEstablishment?.type,
        ownerName: data.ownerName ?? activeEstablishment?.ownerName,
        phone: data.phone ?? activeEstablishment?.phone,
        whatsapp: data.whatsapp ?? activeEstablishment?.whatsapp,
        email: data.email ?? activeEstablishment?.email,
        logoUrl: data.logoUrl ?? activeEstablishment?.logoUrl,
        address: data.address ?? activeEstablishment?.address,
        latitude: data.latitude ?? activeEstablishment?.latitude,
        longitude: data.longitude ?? activeEstablishment?.longitude,
        updatedAt: now,
      };
      await updateDoc(estRef, removeUndefinedFields(estPayload)).catch(() => {});
    }
  };

  const switchEstablishment = async (eid: string) => {
    if (!user) return;
    const ref = doc(db, "profiles", user.uid);
    await updateDoc(ref, { activeEstablishmentId: eid, updatedAt: Date.now() });
  };

  const createEstablishment = async (data: Partial<EstablishmentDoc>): Promise<string> => {
    if (!user) throw new Error("Non authentifiÃ©");
    const now = Date.now();
    const colRef = establishmentsColRef(db);
    const docRef = await addDoc(colRef, {
      ...data,
      ownerUid: user.uid,
      createdAt: now,
      updatedAt: now,
    });
    const eid = docRef.id;

    // Mettre Ã  jour la liste dans le profil
    const newRef: EstablishmentRef = {
      id: eid,
      name: data.name || "Nouvel Ã©tablissement",
      type: data.type || "",
      logoUrl: data.logoUrl,
    };
    const currentEsts = establishments;
    const updatedEsts = [...currentEsts, newRef];
    const profileRef = doc(db, "profiles", user.uid);
    await updateDoc(profileRef, {
      establishments: updatedEsts,
      updatedAt: now,
    });
    setEstablishments(updatedEsts);
    setProfile(prev => prev ? { ...prev, establishments: updatedEsts, updatedAt: now } : prev);

    return eid;
  };

  const removeEstablishment = async (eid: string) => {
    if (!user) throw new Error("Non authentifié");
    if (eid === user.uid) throw new Error("Impossible de supprimer l'établissement principal");
    if (profile?.activeEstablishmentId === eid) throw new Error("Supprimez d'abord l'établissement actif");

    await setDoc(establishmentDocRef(db, eid), {
      archived: true,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    }, { merge: true });

    const updatedEsts = establishments.filter(e => e.id !== eid);
    const profileRef = doc(db, "profiles", user.uid);
    await updateDoc(profileRef, { establishments: updatedEsts, updatedAt: Date.now() });
    setEstablishments(updatedEsts);
    setProfile(prev => prev ? { ...prev, establishments: updatedEsts } : prev);
  };

  const refreshEstablishments = async () => {
    if (!user) return;
    const refs = await fetchUserEstablishments(user.uid);
    setEstablishments(refs);
    const profileRef = doc(db, "profiles", user.uid);
    await updateDoc(profileRef, { establishments: refs, updatedAt: Date.now() }).catch(() => {});
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    profile,
    profileLoading,
    isAdmin,
    isAdminLoading,
    activeEstablishment,
    establishments,
    switchEstablishment,
    createEstablishment,
    removeEstablishment,
    refreshEstablishments,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    saveProfile,
    logout,
  }), [user, loading, profile, profileLoading, isAdmin, isAdminLoading, activeEstablishment, establishments]);

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


