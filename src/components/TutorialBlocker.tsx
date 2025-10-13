import { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Lock, 
  Package, 
  Shield, 
  ShoppingCart,
  BarChart3,
  Users,
  Calendar,
  Settings
} from "lucide-react";

interface Props {
  children: ReactNode;
  feature: string;
}

const TutorialBlocker = ({ children, feature }: Props) => {
  const { profile } = useAuth();

  // Si le tutoriel est terminé, afficher le contenu normal
  if (profile?.tutorialCompleted) {
    return <>{children}</>;
  }

  // Définir les étapes requises pour chaque fonctionnalité
  const featureRequirements: Record<string, string[]> = {
    'stock': ['stock'],
    'sales': ['stock', 'first-product'],
    'reports': ['stock', 'first-product'],
    'events': ['stock', 'first-product'],
    'team': ['stock', 'first-product'],
    'settings': ['stock', 'first-product', 'security'],
  };

  const requiredSteps = featureRequirements[feature] || [];
  const currentStep = profile?.tutorialStep || 'stock';
  
  // Vérifier si l'utilisateur peut accéder à cette fonctionnalité
  const canAccess = requiredSteps.every(step => {
    const stepOrder = ['stock', 'first-product', 'security'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const requiredIndex = stepOrder.indexOf(step);
    return currentIndex >= requiredIndex;
  });

  if (canAccess) {
    return <>{children}</>;
  }

  // Définir les informations pour chaque fonctionnalité bloquée
  const featureInfo: Record<string, { title: string; description: string; icon: any; nextStep: string }> = {
    'sales': {
      title: "Point de Vente",
      description: "Vendez vos produits et gérez vos commandes",
      icon: ShoppingCart,
      nextStep: "Ajoutez d'abord des produits dans Stock"
    },
    'reports': {
      title: "Rapports",
      description: "Analysez vos ventes et performances",
      icon: BarChart3,
      nextStep: "Ajoutez d'abord des produits dans Stock"
    },
    'events': {
      title: "Événements",
      description: "Organisez et gérez vos événements",
      icon: Calendar,
      nextStep: "Ajoutez d'abord des produits dans Stock"
    },
    'team': {
      title: "Équipe",
      description: "Gérez votre équipe et les permissions",
      icon: Users,
      nextStep: "Ajoutez d'abord des produits dans Stock"
    },
    'settings': {
      title: "Paramètres",
      description: "Configurez votre compte et vos préférences",
      icon: Settings,
      nextStep: "Terminez d'abord le tutoriel de base"
    }
  };

  const info = featureInfo[feature];
  if (!info) return <>{children}</>;

  const IconComponent = info.icon;

  return (
    <Dialog open={true}>
      <DialogContent className="w-[95vw] max-w-[400px] sm:max-w-[400px] mx-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Lock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">{info.title} verrouillé</DialogTitle>
              <DialogDescription>{info.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <Card className="border-0 shadow-none bg-transparent">
          <CardContent className="p-0 space-y-4">
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <IconComponent className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-orange-800 mb-1">Fonctionnalité verrouillée</h4>
                  <p className="text-sm text-orange-700">{info.nextStep}</p>
                </div>
              </div>
            </div>

            <div className="text-center space-y-3">
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                <Lock className="w-3 h-3 mr-1" />
                Tutoriel en cours
              </Badge>
              <p className="text-sm text-muted-foreground">
                Terminez le tutoriel pour débloquer toutes les fonctionnalités
              </p>
            </div>

            <div className="pt-2">
              <Button 
                className="w-full" 
                onClick={() => window.location.reload()}
              >
                Retour au tutoriel
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default TutorialBlocker;
