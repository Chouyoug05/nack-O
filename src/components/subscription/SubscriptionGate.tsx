import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSubscriptionPaymentLink } from "@/lib/payments/singpay";

interface Props {
  children: React.ReactNode;
}

const msInDay = 24 * 60 * 60 * 1000;
const sevenDays = 7 * msInDay;

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0 jour";
  const days = Math.floor(ms / msInDay);
  // Afficher seulement les jours pour plus de clarté
  if (days === 0) {
    const hours = Math.floor((ms % msInDay) / (60 * 60 * 1000));
    return hours > 0 ? `${hours}h` : "Moins d'1h";
  }
  return `${days} jour${days > 1 ? 's' : ''}`;
}

const SubscriptionGate = ({ children }: Props) => {
  const { user, profile } = useAuth();
  const [now, setNow] = useState<number>(() => Date.now());
  const [creatingLink, setCreatingLink] = useState(false);
  const [trialOpen, setTrialOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('nack_trial_popup_dismissed') !== '1'; } catch { return true; }
  });
  useEffect(() => {
    try { if (!trialOpen) localStorage.setItem('nack_trial_popup_dismissed','1'); } catch (e) { void e; }
  }, [trialOpen]); // persist dismissal

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Fermer automatiquement le popup d’essai si l’utilisateur l’a déjà masqué
  useEffect(() => {
    const dismissed = (() => { try { return localStorage.getItem('nack_trial_popup_dismissed') === '1'; } catch { return false; } })();
    if (dismissed) setTrialOpen(false);
  }, []);

  // Normaliser les anciens profils sans plan: les placer en essai 7j à partir de createdAt
  useEffect(() => {
    const normalize = async () => {
      if (!user || !profile) return;
      const needsPlan = profile.plan === undefined;
      const needsTrial = profile.trialEndsAt === undefined;
      if (!needsPlan && !needsTrial) return;
      const createdAt = profile.createdAt || Date.now();
      const trialEndsAt = (profile.trialEndsAt ?? (createdAt + sevenDays));
      const plan = trialEndsAt > Date.now() ? 'trial' : 'expired';
      try {
        await updateDoc(doc(db, 'profiles', user.uid), {
          plan,
          trialEndsAt,
          updatedAt: Date.now(),
        });
      } catch {
        // ignore
      }
    };
    normalize();
  }, [user, profile]);

  const state = useMemo(() => {
    if (!profile) return { status: 'loading' as const };
    // Fallback: si plan manquant, reconstituer essai basé sur createdAt
    const plan = profile.plan ?? 'trial';
    const trialEndsAtFallback = (profile.trialEndsAt ?? ((profile.createdAt || 0) + sevenDays));
    const trialEndsAt = trialEndsAtFallback;
    const subEndsAt = profile.subscriptionEndsAt ?? 0;

    if (plan === 'trial') {
      const remaining = trialEndsAt - now;
      if (remaining > 0) return { status: 'trial' as const, remaining };
      return { status: 'expired' as const };
    }
    if (plan === 'active') {
      if (subEndsAt && subEndsAt > now) {
        const remaining = subEndsAt - now;
        return { status: 'active' as const, remaining };
      }
      return { status: 'expired' as const };
    }
    return { status: 'expired' as const };
  }, [profile, now]);

  const startPayment = async () => {
    if (!user) return;
    try {
      setCreatingLink(true);
      
      // Créer un ID unique pour cette transaction
      const transactionId = `TXN-${user.uid}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const now = Date.now();
      
      const base = (
        (import.meta.env.VITE_PUBLIC_BASE_URL as string)
        || window.location.origin
      ).replace(/\/+$/, '');
      
      const reference = 'abonnement-transition';
      const redirectSuccess = `${base}/payment/success?reference=${reference}&transactionId=${transactionId}`;
      const redirectError = `${base}/payment/error?transactionId=${transactionId}`;
      const logoURL = `${base}/favicon.png`;
      
      // Enregistrer la transaction en attente
      try {
        const { paymentsColRef } = await import('@/lib/collections');
        const { db } = await import('@/lib/firebase');
        const { addDoc } = await import('firebase/firestore');
        const paymentsRef = paymentsColRef(db, user.uid);
        
        await addDoc(paymentsRef, {
          userId: user.uid,
          transactionId,
          subscriptionType: 'transition',
          amount: SUBSCRIPTION_PLANS.transition.price,
          status: 'pending',
          paymentMethod: 'airtel-money',
          reference,
          paymentLink: '', // Sera rempli après génération
          redirectSuccess,
          redirectError,
          createdAt: now,
        });
      } catch (error) {
        console.error('Erreur enregistrement transaction pending:', error);
      }
      
      const link = await createSubscriptionPaymentLink({
        amount: SUBSCRIPTION_PLANS.transition.price,
        reference: `${reference}-${transactionId.substring(0, 8)}`,
        redirectSuccess,
        redirectError,
        logoURL,
        isTransfer: false,
      });
      
      // Mettre à jour la transaction avec le lien généré
      try {
        const { paymentsColRef } = await import('@/lib/collections');
        const { db } = await import('@/lib/firebase');
        const { query, where, getDocs, updateDoc, doc } = await import('firebase/firestore');
        const paymentsRef = paymentsColRef(db, user.uid);
        const q = query(paymentsRef, where('transactionId', '==', transactionId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          await updateDoc(doc(paymentsRef, snapshot.docs[0].id), { paymentLink: link });
        }
      } catch (error) {
        console.error('Erreur mise à jour lien paiement:', error);
      }
      
      window.location.href = link;
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Impossible de créer le lien de paiement: ${msg}`);
    } finally {
      setCreatingLink(false);
    }
  };

  if (state.status === 'loading') return null;

  const isExpired = state.status === 'expired';
  const showTrial = state.status === 'trial';
  const trialRemaining = showTrial ? state.remaining : 0;
  const activeRemaining = state.status === 'active' ? state.remaining : 0;

  // BLOQUER l'accès si l'essai est expiré ou l'abonnement est expiré
  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Accès bloqué</h2>
              <p className="text-gray-600 mb-4">
                Votre période d'essai gratuite est terminée ou votre abonnement a expiré.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Pour continuer à utiliser l'application, veuillez vous abonner à l'un de nos forfaits.
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Transition - {SUBSCRIPTION_PLANS.transition.price.toLocaleString()} XAF/mois</h3>
                <ul className="text-sm text-blue-800 space-y-1 mb-3">
                  <li>✓ Gestion des produits</li>
                  <li>✓ Point de vente</li>
                  <li>✓ Gestion du stock</li>
                  <li>✓ Rapports</li>
                </ul>
                <Button
                  onClick={async () => {
                    if (!user) return;
                    try {
                      setCreatingLink(true);
                      
                      const transactionId = `TXN-${user.uid}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                      const now = Date.now();
                      const base = (
                        (import.meta.env.VITE_PUBLIC_BASE_URL as string)
                        || window.location.origin
                      ).replace(/\/+$/, '');
                      
                      const reference = 'abonnement-transition';
                      const redirectSuccess = `${base}/payment/success?reference=${reference}&transactionId=${transactionId}`;
                      const redirectError = `${base}/payment/error?transactionId=${transactionId}`;
                      const logoURL = `${base}/favicon.png`;
                      
                      try {
                        const { paymentsColRef } = await import('@/lib/collections');
                        const { db } = await import('@/lib/firebase');
                        const { addDoc } = await import('firebase/firestore');
                        const paymentsRef = paymentsColRef(db, user.uid);
                        
                        await addDoc(paymentsRef, {
                          userId: user.uid,
                          transactionId,
                          subscriptionType: 'transition',
                          amount: SUBSCRIPTION_PLANS.transition.price,
                          status: 'pending',
                          paymentMethod: 'airtel-money',
                          reference,
                          paymentLink: '',
                          redirectSuccess,
                          redirectError,
                          createdAt: now,
                        });
                      } catch (error) {
                        console.error('Erreur enregistrement transaction pending:', error);
                      }
                      
                      const link = await createSubscriptionPaymentLink({
                        amount: SUBSCRIPTION_PLANS.transition.price,
                        reference: `${reference}-${transactionId.substring(0, 8)}`,
                        redirectSuccess,
                        redirectError,
                        logoURL,
                        isTransfer: false,
                      });
                      
                      try {
                        const { paymentsColRef } = await import('@/lib/collections');
                        const { db } = await import('@/lib/firebase');
                        const { query, where, getDocs, updateDoc, doc } = await import('firebase/firestore');
                        const paymentsRef = paymentsColRef(db, user.uid);
                        const q = query(paymentsRef, where('transactionId', '==', transactionId));
                        const snapshot = await getDocs(q);
                        if (!snapshot.empty) {
                          await updateDoc(doc(paymentsRef, snapshot.docs[0].id), { paymentLink: link });
                        }
                      } catch (error) {
                        console.error('Erreur mise à jour lien paiement:', error);
                      }
                      
                      window.location.href = link;
                    } catch (e) {
                      console.error(e);
                      const msg = e instanceof Error ? e.message : String(e);
                      alert(`Impossible de créer le lien de paiement: ${msg}`);
                    } finally {
                      setCreatingLink(false);
                    }
                  }}
                  disabled={creatingLink}
                  variant="outline"
                  className="w-full"
                >
                  {creatingLink ? 'Chargement...' : `S'abonner - Transition (${SUBSCRIPTION_PLANS.transition.price.toLocaleString()} XAF)`}
                </Button>
              </div>

              <div className="bg-gradient-to-r from-red-600 to-red-700 border border-red-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">Transition Pro Max - {SUBSCRIPTION_PLANS['transition-pro-max'].price.toLocaleString()} XAF/mois</h3>
                <ul className="text-sm text-red-100 space-y-1 mb-3">
                  <li>✓ Toutes les fonctionnalités Transition</li>
                  <li>✓ Gestion des équipiers</li>
                  <li>✓ Bar Connectée</li>
                  <li>✓ Événements (5 inclus, puis 1 500 XAF/événement)</li>
                </ul>
                <Button
                  onClick={async () => {
                    if (!user) return;
                    try {
                      setCreatingLink(true);
                      
                      const transactionId = `TXN-${user.uid}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                      const now = Date.now();
                      const base = (
                        (import.meta.env.VITE_PUBLIC_BASE_URL as string)
                        || window.location.origin
                      ).replace(/\/+$/, '');
                      
                      const reference = 'abonnement-transition-pro-max';
                      const redirectSuccess = `${base}/payment/success?reference=${reference}&transactionId=${transactionId}`;
                      const redirectError = `${base}/payment/error?transactionId=${transactionId}`;
                      const logoURL = `${base}/favicon.png`;
                      
                      try {
                        const { paymentsColRef } = await import('@/lib/collections');
                        const { db } = await import('@/lib/firebase');
                        const { addDoc } = await import('firebase/firestore');
                        const paymentsRef = paymentsColRef(db, user.uid);
                        
                        await addDoc(paymentsRef, {
                          userId: user.uid,
                          transactionId,
                          subscriptionType: 'transition-pro-max',
                          amount: SUBSCRIPTION_PLANS['transition-pro-max'].price,
                          status: 'pending',
                          paymentMethod: 'airtel-money',
                          reference,
                          paymentLink: '',
                          redirectSuccess,
                          redirectError,
                          createdAt: now,
                        });
                      } catch (error) {
                        console.error('Erreur enregistrement transaction pending:', error);
                      }
                      
                      const link = await createSubscriptionPaymentLink({
                        amount: SUBSCRIPTION_PLANS['transition-pro-max'].price,
                        reference: `${reference}-${transactionId.substring(0, 8)}`,
                        redirectSuccess,
                        redirectError,
                        logoURL,
                        isTransfer: false,
                      });
                      
                      try {
                        const { paymentsColRef } = await import('@/lib/collections');
                        const { db } = await import('@/lib/firebase');
                        const { query, where, getDocs, updateDoc, doc } = await import('firebase/firestore');
                        const paymentsRef = paymentsColRef(db, user.uid);
                        const q = query(paymentsRef, where('transactionId', '==', transactionId));
                        const snapshot = await getDocs(q);
                        if (!snapshot.empty) {
                          await updateDoc(doc(paymentsRef, snapshot.docs[0].id), { paymentLink: link });
                        }
                      } catch (error) {
                        console.error('Erreur mise à jour lien paiement:', error);
                      }
                      
                      window.location.href = link;
                    } catch (e) {
                      console.error(e);
                      const msg = e instanceof Error ? e.message : String(e);
                      alert(`Impossible de créer le lien de paiement: ${msg}`);
                    } finally {
                      setCreatingLink(false);
                    }
                  }}
                  disabled={creatingLink}
                  className="w-full bg-white text-red-600 hover:bg-red-50"
                >
                  {creatingLink ? 'Chargement...' : `S'abonner - Pro Max (${SUBSCRIPTION_PLANS['transition-pro-max'].price.toLocaleString()} XAF)`}
                </Button>
              </div>
            </div>

            <p className="text-xs text-center text-gray-500 mt-4">
              Le paiement est disponible uniquement via <strong>Airtel Money</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Contenu de l'app - uniquement si l'utilisateur a un essai actif ou un abonnement actif */}
      {children}

      {/* Popup essai: non bloquant */}
      <Dialog open={trialOpen && showTrial} onOpenChange={setTrialOpen}>
        <DialogContent className="w-[90vw] max-w-[500px] sm:max-w-[520px] mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg leading-tight">Essai gratuit de 7 jours</DialogTitle>
            <DialogDescription className="text-sm leading-tight">
              Bienvenue sur Nack. Profitez de 7 jours gratuits pour découvrir la plateforme.
            </DialogDescription>
          </DialogHeader>
          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="p-0 space-y-3">
              <div className="text-sm text-muted-foreground">
                Guide rapide:
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li>Ajoutez vos produits dans Stock</li>
                  <li>Réalisez une vente dans Point de Vente</li>
                  <li>Invitez votre équipe</li>
                </ul>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">Temps restant</Badge>
                <span className="font-medium">{formatCountdown(trialRemaining)}</span>
              </div>
              <div className="pt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={async () => {
                      if (!user) return;
                      try {
                        setCreatingLink(true);
                        
                        const transactionId = `TXN-${user.uid}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                        const now = Date.now();
                        const base = (
                          (import.meta.env.VITE_PUBLIC_BASE_URL as string)
                          || window.location.origin
                        ).replace(/\/+$/, '');
                        
                        const reference = 'abonnement-transition';
                        const redirectSuccess = `${base}/payment/success?reference=${reference}&transactionId=${transactionId}`;
                        const redirectError = `${base}/payment/error?transactionId=${transactionId}`;
                        const logoURL = `${base}/favicon.png`;
                        
                        try {
                          const { paymentsColRef } = await import('@/lib/collections');
                          const { db } = await import('@/lib/firebase');
                          const { addDoc } = await import('firebase/firestore');
                          const paymentsRef = paymentsColRef(db, user.uid);
                          
                          await addDoc(paymentsRef, {
                            userId: user.uid,
                            transactionId,
                            subscriptionType: 'transition',
                            amount: SUBSCRIPTION_PLANS.transition.price,
                            status: 'pending',
                            paymentMethod: 'airtel-money',
                            reference,
                            paymentLink: '',
                            redirectSuccess,
                            redirectError,
                            createdAt: now,
                          });
                        } catch (error) {
                          console.error('Erreur enregistrement transaction pending:', error);
                        }
                        
                        const link = await createSubscriptionPaymentLink({
                          amount: SUBSCRIPTION_PLANS.transition.price,
                          reference: `${reference}-${transactionId.substring(0, 8)}`,
                          redirectSuccess,
                          redirectError,
                          logoURL,
                          isTransfer: false,
                        });
                        
                        try {
                          const { paymentsColRef } = await import('@/lib/collections');
                          const { db } = await import('@/lib/firebase');
                          const { query, where, getDocs, updateDoc, doc } = await import('firebase/firestore');
                          const paymentsRef = paymentsColRef(db, user.uid);
                          const q = query(paymentsRef, where('transactionId', '==', transactionId));
                          const snapshot = await getDocs(q);
                          if (!snapshot.empty) {
                            await updateDoc(doc(paymentsRef, snapshot.docs[0].id), { paymentLink: link });
                          }
                        } catch (error) {
                          console.error('Erreur mise à jour lien paiement:', error);
                        }
                        
                        window.location.href = link;
                      } catch (e) {
                        console.error(e);
                        const msg = e instanceof Error ? e.message : String(e);
                        alert(`Impossible de créer le lien de paiement: ${msg}`);
                      } finally {
                        setCreatingLink(false);
                      }
                    }}
                    disabled={creatingLink}
                    variant="outline"
                    className="w-full"
                  >
                    Transition ({SUBSCRIPTION_PLANS.transition.price.toLocaleString()} XAF)
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!user) return;
                      try {
                        setCreatingLink(true);
                        
                        const transactionId = `TXN-${user.uid}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                        const now = Date.now();
                        const base = (
                          (import.meta.env.VITE_PUBLIC_BASE_URL as string)
                          || window.location.origin
                        ).replace(/\/+$/, '');
                        
                        const reference = 'abonnement-transition-pro-max';
                        const redirectSuccess = `${base}/payment/success?reference=${reference}&transactionId=${transactionId}`;
                        const redirectError = `${base}/payment/error?transactionId=${transactionId}`;
                        const logoURL = `${base}/favicon.png`;
                        
                        try {
                          const { paymentsColRef } = await import('@/lib/collections');
                          const { db } = await import('@/lib/firebase');
                          const { addDoc } = await import('firebase/firestore');
                          const paymentsRef = paymentsColRef(db, user.uid);
                          
                          await addDoc(paymentsRef, {
                            userId: user.uid,
                            transactionId,
                            subscriptionType: 'transition-pro-max',
                            amount: SUBSCRIPTION_PLANS['transition-pro-max'].price,
                            status: 'pending',
                            paymentMethod: 'airtel-money',
                            reference,
                            paymentLink: '',
                            redirectSuccess,
                            redirectError,
                            createdAt: now,
                          });
                        } catch (error) {
                          console.error('Erreur enregistrement transaction pending:', error);
                        }
                        
                        const link = await createSubscriptionPaymentLink({
                          amount: SUBSCRIPTION_PLANS['transition-pro-max'].price,
                          reference: `${reference}-${transactionId.substring(0, 8)}`,
                          redirectSuccess,
                          redirectError,
                          logoURL,
                          isTransfer: false,
                        });
                        
                        try {
                          const { paymentsColRef } = await import('@/lib/collections');
                          const { db } = await import('@/lib/firebase');
                          const { query, where, getDocs, updateDoc, doc } = await import('firebase/firestore');
                          const paymentsRef = paymentsColRef(db, user.uid);
                          const q = query(paymentsRef, where('transactionId', '==', transactionId));
                          const snapshot = await getDocs(q);
                          if (!snapshot.empty) {
                            await updateDoc(doc(paymentsRef, snapshot.docs[0].id), { paymentLink: link });
                          }
                        } catch (error) {
                          console.error('Erreur mise à jour lien paiement:', error);
                        }
                        
                        window.location.href = link;
                      } catch (e) {
                        console.error(e);
                        const msg = e instanceof Error ? e.message : String(e);
                        alert(`Impossible de créer le lien de paiement: ${msg}`);
                      } finally {
                        setCreatingLink(false);
                      }
                    }}
                    disabled={creatingLink}
                    className="w-full bg-gradient-primary text-white"
                  >
                    Pro Max ({SUBSCRIPTION_PLANS['transition-pro-max'].price.toLocaleString()} XAF)
                  </Button>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Transition: Produits, Ventes, Stock, Rapports • Pro Max: Tout + Équipiers + Bar Connectée + 5 Événements
                </p>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      {/* Popup expiré: désactivé (non bloquant) - fonctionnalités débloquées */}

      {/* Info abonnement actif: discret, non bloquant */}
      {activeRemaining > 0 && (
        <div className="fixed bottom-3 right-3 z-40">
          <div className="text-xs px-3 py-2 rounded-full bg-black/70 text-white">
            Abonnement: {formatCountdown(activeRemaining)} restants
          </div>
        </div>
      )}
    </>
  );
};

export default SubscriptionGate; 