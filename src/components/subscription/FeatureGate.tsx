import { ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { hasFeatureAccessSync, SUBSCRIPTION_PLANS, getCurrentPlan } from "@/utils/subscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { createSubscriptionPaymentLink } from "@/lib/payments/singpay";
import { appendElectronPaymentReturn, openPaymentUrl } from "@/lib/paymentNavigation";

interface FeatureGateProps {
  feature: 'products' | 'sales' | 'stock' | 'reports' | 'team' | 'events' | 'disbursementRequest';
  children: ReactNode;
  fallback?: ReactNode;
}

const DURATIONS = [
  { value: 'month', label: '1 Mois', discount: '' },
  { value: 'quarter', label: '3 Mois', discount: '' },
  { value: 'semester', label: '6 Mois', discount: '-10%' },
  { value: 'year', label: '12 Mois', discount: '2 mois offerts' },
] as const;

type DurationType = typeof DURATIONS[number]['value'];

export const FeatureGate = ({ feature, children, fallback }: FeatureGateProps) => {
  const { profile, user } = useAuth();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<DurationType>('month');
  const [creatingLink, setCreatingLink] = useState(false);
  const hasAccess = hasFeatureAccessSync(profile, feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const featureNames: Record<string, string> = {
    products: 'Produits',
    sales: 'Ventes',
    stock: 'Stock',
    reports: 'Rapports',
    team: 'Équipiers',
    disbursementRequest: 'Demande de Disbursement ID',
    events: 'Événements',
  };

  const featureName = featureNames[feature] || feature;
  const currentPlan = getCurrentPlan(profile);
  const isExpired = currentPlan === 'expired';

  const calculatePrice = (plan: 'transition' | 'transition-pro-max', duration: DurationType) => {
    const basePrice = SUBSCRIPTION_PLANS[plan].price;
    switch (duration) {
      case 'month': return basePrice;
      case 'quarter': return basePrice * 3;
      case 'semester': return Math.round(basePrice * 6 * 0.9);
      case 'year': return basePrice * 10;
      default: return basePrice;
    }
  };

  const handleSubscribe = async (plan: 'transition' | 'transition-pro-max') => {
    if (!user) return;
    try {
      setCreatingLink(true);

      const transactionId = `TXN-${user.uid}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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

      const link = await createSubscriptionPaymentLink({
        amount,
        reference: `${reference}-${transactionId.substring(0, 8)}`,
        redirectSuccess,
        redirectError,
        logoURL,
        isTransfer: false,
      });

      await openPaymentUrl(link);
      setShowPaymentDialog(false);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Impossible de créer le lien de paiement: ${msg}`);
    } finally {
      setCreatingLink(false);
    }
  };

  return (
    <>
      <Card className="shadow-card border-0 m-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="text-nack-red" size={24} />
            {isExpired ? 'Abonnement expiré' : 'Fonctionnalité verrouillée'}
          </CardTitle>
          <CardDescription>
            {isExpired 
              ? `Votre abonnement a expiré. Renouvelez-le pour accéder à ${featureName}.`
              : `${featureName} n'est pas disponible avec votre plan actuel.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setShowPaymentDialog(true)}
            className="w-full bg-gradient-primary text-white"
          >
            {isExpired ? "Renouveler l'abonnement" : "Voir les abonnements"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="w-[90vw] max-w-[500px] sm:max-w-[520px] mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg leading-tight">
              {isExpired ? "Renouveler votre abonnement" : "Choisir un abonnement"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-tight">
              {isExpired 
                ? "Votre abonnement a expiré. Choisissez un plan pour retrouver l'accès complet."
                : `Pour accéder à ${featureName}, choisissez un abonnement.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
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

            <div className="space-y-3">
              <Button
                onClick={() => handleSubscribe('transition')}
                disabled={creatingLink}
                variant="outline"
                className="w-full h-12"
              >
                Standard ({calculatePrice('transition', selectedDuration).toLocaleString()} XAF)
              </Button>
              <Button
                onClick={() => handleSubscribe('transition-pro-max')}
                disabled={creatingLink}
                className="w-full h-12 bg-gradient-primary text-white"
              >
                Premium ({calculatePrice('transition-pro-max', selectedDuration).toLocaleString()} XAF)
              </Button>
            </div>
            <p className="text-[10px] sm:text-xs text-center text-muted-foreground">
              Standard: Produits, Ventes, Stock, Rapports • Premium: Tout + Équipiers + Événements illimités
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

