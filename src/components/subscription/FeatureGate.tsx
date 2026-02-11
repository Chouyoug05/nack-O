import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { hasFeatureAccessSync } from "@/utils/subscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SUBSCRIPTION_PLANS } from "@/utils/subscription";

interface FeatureGateProps {
  feature: 'products' | 'sales' | 'stock' | 'reports' | 'team' | 'barConnectee' | 'events';
  children: ReactNode;
  fallback?: ReactNode;
}

export const FeatureGate = ({ feature, children, fallback }: FeatureGateProps) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const hasAccess = hasFeatureAccessSync(profile, feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Déterminer le nom de la fonctionnalité
  const featureNames: Record<string, string> = {
    products: 'Produits',
    sales: 'Ventes',
    stock: 'Stock',
    reports: 'Rapports',
    team: 'Équipiers',
    barConnectee: 'Bar Connectée',
    events: 'Événements',
  };

  const featureName = featureNames[feature] || feature;

  // Déterminer les plans qui ont accès
  const availablePlans = Object.entries(SUBSCRIPTION_PLANS)
    .filter(([_, plan]) => plan.features[feature])
    .map(([key, plan]) => ({ key, name: plan.name, price: plan.price }));

  return (
    <Card className="shadow-card border-0 m-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="text-nack-red" size={24} />
          Fonctionnalité verrouillée
        </CardTitle>
        <CardDescription>
          {featureName} n'est pas disponible avec votre plan actuel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-nack-beige-light p-4 rounded-lg">
          <p className="text-sm font-medium mb-2">Plans disponibles :</p>
          <ul className="space-y-2">
            {availablePlans.map((plan) => (
              <li key={plan.key} className="flex items-center justify-between text-sm">
                <span>{plan.name}</span>
                <span className="font-bold text-nack-red">à partir de {plan.price.toLocaleString()} XAF</span>
              </li>
            ))}
          </ul>
        </div>
        <Button
          onClick={() => navigate('/dashboard?tab=subscription')}
          className="w-full bg-gradient-primary text-white"
        >
          Voir les abonnements
        </Button>
      </CardContent>
    </Card>
  );
};

