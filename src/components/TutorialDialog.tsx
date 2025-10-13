import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, 
  Shield, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  X,
  Target,
  ShoppingCart,
  FileDown
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStepComplete: (step: string) => void;
}

const TutorialDialog = ({ open, onOpenChange, onStepComplete }: Props) => {
  const { profile, saveProfile } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<'stock' | 'first-product' | 'sales' | 'report' | 'security' | 'completed'>('stock');

  useEffect(() => {
    if (profile?.tutorialStep) {
      setCurrentStep(profile.tutorialStep);
    }
  }, [profile]);

  const steps = [
    {
      id: 'stock' as const,
      title: "Étape 1: Gestion des stocks",
      description: "Apprenez à gérer vos produits et stocks",
      icon: Package,
      content: (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Pourquoi gérer vos stocks ?</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Éviter les ruptures de stock</li>
              <li>• Optimiser vos achats</li>
              <li>• Suivre vos produits les plus vendus</li>
              <li>• Calculer automatiquement vos bénéfices</li>
            </ul>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Cliquez sur l'onglet <strong>"Stock"</strong> dans le menu pour commencer
            </p>
            <p className="text-xs text-muted-foreground">
              Remplissez tous les champs requis lors de l'ajout d'un produit (nom, prix, quantité). Les champs non obligatoires peuvent être laissés vides.
            </p>
            <Badge variant="outline" className="text-blue-600 border-blue-600">
              <Target className="w-3 h-3 mr-1" />
              Action requise
            </Badge>
          </div>
        </div>
      )
    },
    {
      id: 'first-product' as const,
      title: "Étape 2: Ajouter votre premier produit",
      description: "Créez votre premier produit dans le stock",
      icon: Package,
      content: (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">Comment ajouter un produit ?</h4>
            <ol className="text-sm text-green-700 space-y-1">
              <li>1. Allez dans l'onglet "Stock"</li>
              <li>2. Cliquez sur "Ajouter un produit"</li>
              <li>3. Remplissez les informations (nom, prix, quantité)</li>
              <li>4. Sauvegardez votre produit</li>
            </ol>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Ajoutez au moins <strong>un produit</strong> pour continuer
            </p>
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Target className="w-3 h-3 mr-1" />
              Action requise
            </Badge>
          </div>
        </div>
      )
    },
    {
      id: 'sales' as const,
      title: "Étape 3: Découvrir la vente",
      description: "Effectuez une vente test pour vous familiariser",
      icon: ShoppingCart,
      content: (
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
            <h4 className="font-semibold text-purple-800 mb-2">Première vente</h4>
            <ol className="text-sm text-purple-700 space-y-1">
              <li>1. Ouvrez l'onglet "Point de Vente"</li>
              <li>2. Ajoutez un produit au panier</li>
              <li>3. Finalisez la vente</li>
            </ol>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Réalisez une <strong>vente test</strong> pour débloquer la suite
            </p>
            <Badge variant="outline" className="text-purple-600 border-purple-600">
              <Target className="w-3 h-3 mr-1" />
              Action requise
            </Badge>
          </div>
        </div>
      )
    },
    {
      id: 'report' as const,
      title: "Étape 4: Exporter un rapport",
      description: "Téléchargez votre premier rapport PDF/CSV",
      icon: FileDown,
      content: (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg">
            <h4 className="font-semibold text-indigo-800 mb-2">Télécharger un rapport</h4>
            <ol className="text-sm text-indigo-700 space-y-1">
              <li>1. Ouvrez l'onglet "Rapports"</li>
              <li>2. Choisissez une période</li>
              <li>3. Cliquez sur Export CSV ou PDF</li>
            </ol>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Téléchargez au moins <strong>un rapport</strong> pour terminer
            </p>
            <Badge variant="outline" className="text-indigo-600 border-indigo-600">
              <Target className="w-3 h-3 mr-1" />
              Action requise
            </Badge>
          </div>
        </div>
      )
    },
    {
      id: 'security' as const,
      title: "Étape 3: Sécuriser votre compte",
      description: "Configurez un code PIN pour protéger votre compte",
      icon: Shield,
      content: (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
            <h4 className="font-semibold text-orange-800 mb-2">Pourquoi sécuriser ?</h4>
            <ul className="text-sm text-orange-700 space-y-1">
              <li>• Protéger vos données sensibles</li>
              <li>• Éviter l'accès non autorisé</li>
              <li>• Sécuriser les transactions</li>
              <li>• Contrôler l'accès de votre équipe</li>
            </ul>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Configurez un <strong>code PIN</strong> dans les paramètres (optionnel)
            </p>
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              <Shield className="w-3 h-3 mr-1" />
              Recommandé
            </Badge>
          </div>
        </div>
      )
    }
  ];

  const currentStepData = steps.find(step => step.id === currentStep);
  const currentIndex = steps.findIndex(step => step.id === currentStep);

  const handleNext = async () => {
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1].id;
      setCurrentStep(nextStep);
      await saveProfile({
        establishmentName: profile?.establishmentName || "",
        establishmentType: profile?.establishmentType || "",
        ownerName: profile?.ownerName || "",
        email: profile?.email || "",
        phone: profile?.phone || "",
        whatsapp: profile?.whatsapp,
        logoUrl: profile?.logoUrl,
        tutorialStep: nextStep,
      });
    } else {
      // Tutoriel terminé
      await saveProfile({
        establishmentName: profile?.establishmentName || "",
        establishmentType: profile?.establishmentType || "",
        ownerName: profile?.ownerName || "",
        email: profile?.email || "",
        phone: profile?.phone || "",
        whatsapp: profile?.whatsapp,
        logoUrl: profile?.logoUrl,
        tutorialCompleted: true,
        tutorialStep: 'completed',
      });
      onStepComplete('completed');
      onOpenChange(false);
      toast({
        title: "Tutoriel terminé !",
        description: "Félicitations ! Vous maîtrisez maintenant les bases de NACK.",
      });
    }
  };

  const handleSkip = async () => {
    await saveProfile({
      establishmentName: profile?.establishmentName || "",
      establishmentType: profile?.establishmentType || "",
      ownerName: profile?.ownerName || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      whatsapp: profile?.whatsapp,
      logoUrl: profile?.logoUrl,
      tutorialCompleted: true,
      tutorialStep: 'completed',
    });
    onStepComplete('completed');
    onOpenChange(false);
    toast({
      title: "Tutoriel ignoré",
      description: "Vous pouvez toujours consulter l'aide dans les paramètres.",
    });
  };

  const handlePrevious = async () => {
    if (currentIndex > 0) {
      const prevStep = steps[currentIndex - 1].id;
      setCurrentStep(prevStep);
      await saveProfile({
        establishmentName: profile?.establishmentName || "",
        establishmentType: profile?.establishmentType || "",
        ownerName: profile?.ownerName || "",
        email: profile?.email || "",
        phone: profile?.phone || "",
        whatsapp: profile?.whatsapp,
        logoUrl: profile?.logoUrl,
        tutorialStep: prevStep,
      });
    }
  };

  if (!currentStepData) return null;

  const IconComponent = currentStepData.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <IconComponent className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-lg">{currentStepData.title}</DialogTitle>
                <DialogDescription>{currentStepData.description}</DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <Card className="border-0 shadow-none bg-transparent">
          <CardContent className="p-0 space-y-4">
            {currentStepData.content}
            
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progression</span>
                <span>{currentIndex + 1} / {steps.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Précédent
              </Button>
              
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-muted-foreground"
                >
                  Ignorer le tutoriel
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex items-center gap-2"
                >
                  {currentIndex === steps.length - 1 ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Terminer
                    </>
                  ) : (
                    <>
                      Suivant
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default TutorialDialog;
