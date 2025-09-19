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
  if (ms <= 0) return "00j 00h 00m";
  const days = Math.floor(ms / msInDay);
  const hours = Math.floor((ms % msInDay) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return `${String(days).padStart(2, '0')}j ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
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
      const base = (
        (import.meta.env.VITE_PUBLIC_BASE_URL as string)
        || (window.location.origin + import.meta.env.BASE_URL)
      ).replace(/\/+$/, '/');
      const redirectSuccess = new URL('payment/success', base).toString();
      const redirectError = new URL('payment/error', base).toString();
      const logoURL = new URL('favicon.png', base).toString();
      const link = await createSubscriptionPaymentLink({
        amount: 1500,
        reference: 'abonnement',
        redirectSuccess,
        redirectError,
        logoURL,
        isTransfer: false,
      });
      window.location.href = link;
    } catch (e) {
      console.error(e);
      alert("Impossible de créer le lien de paiement. Réessayez.");
    } finally {
      setCreatingLink(false);
    }
  };

  if (state.status === 'loading') return null;

  const isExpired = state.status === 'expired';
  const showTrial = state.status === 'trial';
  const trialRemaining = showTrial ? state.remaining : 0;
  const activeRemaining = state.status === 'active' ? state.remaining : 0;

  return (
    <>
      {/* Contenu de l'app (non rendu si expiré) */}
      {!isExpired && (
        <>
          {children}
        </>
      )}

      {/* Popup essai: non bloquant */}
      <Dialog open={trialOpen && showTrial} onOpenChange={setTrialOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Essai gratuit de 7 jours</DialogTitle>
            <DialogDescription>
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
                  <li>Invitez votre équipe (disponible en novembre)</li>
                </ul>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">Temps restant</Badge>
                <span className="font-medium">{formatCountdown(trialRemaining)}</span>
              </div>
              <div className="pt-2">
                <Button onClick={startPayment} disabled={creatingLink} className="bg-gradient-primary text-white">
                  {creatingLink ? 'Ouverture du paiement…' : 'Passer à l’abonnement (1500 XAF)'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      {/* Popup expiré: bloquant */}
      <Dialog open={isExpired} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Abonnement requis</DialogTitle>
            <DialogDescription>
              Votre période d’essai est terminée. Veuillez vous abonner pour continuer à utiliser Nack.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">Bloqué</Badge>
              <span>Accès restreint jusqu’au paiement.</span>
            </div>
            <Button onClick={startPayment} disabled={creatingLink} className="bg-gradient-primary text-white w-full">
              {creatingLink ? 'Ouverture du paiement…' : 'Payer 1500 XAF'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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