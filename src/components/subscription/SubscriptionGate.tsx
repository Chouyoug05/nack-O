import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { createSubscriptionPaymentLink } from "@/lib/payments/singpay";
import { appendElectronPaymentReturn, openPaymentUrl } from "@/lib/paymentNavigation";
import { SUBSCRIPTION_PLANS } from "@/utils/subscription";

interface Props {
  children: React.ReactNode;
}

const DURATIONS = [
  { value: 'month', label: '1 Mois', discount: '' },
  { value: 'quarter', label: '3 Mois', discount: '' },
  { value: 'semester', label: '6 Mois', discount: '-10%' },
  { value: 'year', label: '12 Mois', discount: '2 mois offerts' },
] as const;

type DurationType = typeof DURATIONS[number]['value'];

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
  const [selectedDuration, setSelectedDuration] = useState<DurationType>('month');
  const [trialOpen, setTrialOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('nack_trial_popup_dismissed') !== '1'; } catch { return true; }
  });
  useEffect(() => {
    try { if (!trialOpen) localStorage.setItem('nack_trial_popup_dismissed', '1'); } catch (e) { void e; }
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
      const plan = trialEndsAt > Date.now() ? 'trial' : 'free';
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
    
    // Le nouveau système est freemium, on ne bloque plus l'utilisateur.
    // Il a toujours accès, les fonctionnalités sont limitées par le FeatureGate
    // et les limites (10 produits max en gratuit).
    
    return { status: 'active' as const, remaining: 0 };
  }, [profile, now]);

  const calculatePrice = (plan: 'transition' | 'transition-pro-max', duration: DurationType) => {
    const basePrice = SUBSCRIPTION_PLANS[plan].price;
    switch (duration) {
      case 'month': return basePrice;
      case 'quarter': return basePrice * 3;
      case 'semester': return Math.round(basePrice * 6 * 0.9); // 10% discount
      case 'year': return basePrice * 10; // 12 for 10
      default: return basePrice;
    }
  };

  const handleSubscribe = async (plan: 'transition' | 'transition-pro-max') => {
    if (!user) return;
    try {
      setCreatingLink(true);

      const transactionId = `TXN-${user.uid}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const now = Date.now();
      const base = (
        (import.meta.env.VITE_PUBLIC_BASE_URL as string)
        || window.location.origin
      ).replace(/\/+$/, '');

      const reference = `abonnement-${plan}`;
      const redirectSuccess = appendElectronPaymentReturn(
        `${base}/payment/success?reference=${reference}&transactionId=${transactionId}&duration=${selectedDuration}`,
      );
      const redirectError = appendElectronPaymentReturn(`${base}/payment/error?transactionId=${transactionId}`);
      const logoURL = `${base}/favicon.png`;

      const amount = calculatePrice(plan, selectedDuration);

      // Enregistrer la transaction en attente
      try {
        const { paymentsColRef } = await import('@/lib/collections');
        const { db } = await import('@/lib/firebase');
        const { addDoc } = await import('firebase/firestore');
        const paymentsRef = paymentsColRef(db, user.uid);

        await addDoc(paymentsRef, {
          userId: user.uid,
          transactionId,
          subscriptionType: plan,
          duration: selectedDuration,
          amount,
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
        amount,
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

      await openPaymentUrl(link);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Impossible de créer le lien de paiement: ${msg}`);
    } finally {
      setCreatingLink(false);
    }
  };

  const DurationSelector = () => (
    <div className="space-y-2 mb-4">
      <Label className="text-sm font-medium">Durée de l'abonnement</Label>
      <Select value={selectedDuration} onValueChange={(v) => setSelectedDuration(v as DurationType)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choisir une durée" />
        </SelectTrigger>
        <SelectContent>
          {DURATIONS.map((d) => (
            <SelectItem key={d.value} value={d.value}>
              <div className="flex items-center justify-between w-full gap-2">
                <span>{d.label}</span>
                {d.discount && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] ml-2">
                    {d.discount}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (state.status === 'loading') return null;

  const isExpired = state.status === 'expired';
  const showTrial = state.status === 'trial';
  const trialRemaining = showTrial ? state.remaining : 0;
  const activeRemaining = state.status === 'active' ? state.remaining : 0;

  // Freemium: l'accès n'est plus bloqué

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
              <DurationSelector />

              <div className="pt-2 space-y-4">
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => handleSubscribe('transition')}
                    disabled={creatingLink}
                    variant="outline"
                    className="w-full h-12"
                  >
                    Transition ({calculatePrice('transition', selectedDuration).toLocaleString()} XAF)
                  </Button>
                  <Button
                    onClick={() => handleSubscribe('transition-pro-max')}
                    disabled={creatingLink}
                    className="w-full h-12 bg-gradient-primary text-white"
                  >
                    Pro Max ({calculatePrice('transition-pro-max', selectedDuration).toLocaleString()} XAF)
                  </Button>
                </div>
                <p className="text-[10px] sm:text-xs text-center text-muted-foreground">
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