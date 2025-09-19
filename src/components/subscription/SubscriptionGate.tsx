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

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000); // update toutes les 30s
    return () => window.clearInterval(id);
  }, []);

  const state = useMemo(() => {
    if (!profile) return { status: 'loading' as const };
    const plan = profile.plan ?? 'active';
    const trialEndsAt = profile.trialEndsAt ?? 0;
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
      // plan marqué actif mais expiré
      return { status: 'expired' as const };
    }
    return { status: 'expired' as const };
  }, [profile, now]);

  const startPayment = async () => {
    if (!user) return;
    try {
      setCreatingLink(true);
      const origin = window.location.origin;
      const link = await createSubscriptionPaymentLink({
        amount: 1500,
        reference: 'abonnement',
        redirectSuccess: `${origin}/payment/success`,
        redirectError: `${origin}/payment/error`,
        logoURL: `${origin}/favicon.png`,
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

  // Affichage:
  // - trial: popup non bloquant (guide + compte à rebours) + accès autorisé
  // - active: rien (accès)
  // - expired: popup bloquant (paiement)

  if (state.status === 'loading') return null;

  const isExpired = state.status === 'expired';
  const showTrial = state.status === 'trial';
  const trialRemaining = showTrial ? state.remaining : 0;
  const activeRemaining = state.status === 'active' ? state.remaining : 0;

  return (
    <>
      {/* Contenu de l'app */}
      <div aria-hidden={isExpired} className={isExpired ? 'pointer-events-none select-none opacity-60' : ''}>
        {children}
      </div>

      {/* Popup essai: non bloquant */}
      <Dialog open={showTrial} onOpenChange={() => {}}>
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