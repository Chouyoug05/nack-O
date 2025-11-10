import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  CreditCard, 
  Building, 
  Shield, 
  Database,
  Bell,
  Upload,
  Crown,
  Check,
  Users,
  Image as ImageIcon,
  ExternalLink,
  Info,
  Wrench,
  Paintbrush,
  Download
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { uploadLogo } from "@/lib/upload";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { deleteImageByToken } from "@/lib/cloudinary";
import { uploadImageToCloudinaryDetailed } from "@/lib/cloudinary";
import { createSubscriptionPaymentLink } from "@/lib/payments/singpay";
import { generateSubscriptionReceiptPDF } from "@/utils/receipt";
import { validateWhatsApp, getWhatsAppErrorMessage } from "@/utils/whatsapp";
import { getCurrentPlan, SUBSCRIPTION_PLANS, getCurrentEventsCount } from "@/utils/subscription";
import { receiptsColRef, paymentsColRef } from "@/lib/collections";
import { db } from "@/lib/firebase";
import { getDocs, query, orderBy } from "firebase/firestore";

function formatCountdown(ms: number) {
  if (!ms || ms <= 0) return "0 jour";
  const d = Math.floor(ms / (24*60*60*1000));
  // Afficher seulement les jours pour plus de clarté
  if (d === 0) {
    const h = Math.floor((ms % (24*60*60*1000)) / (60*60*1000));
    return h > 0 ? `${h} heure${h > 1 ? 's' : ''}` : "Moins d'une heure";
  }
  return `${d} jour${d > 1 ? 's' : ''}`;
}

const SettingsPage = ({ onTabChange }: { onTabChange?: (tab: string) => void }) => {
  const { toast } = useToast();
  const { profile, saveProfile, user } = useAuth();
  
  const [establishmentInfo, setEstablishmentInfo] = useState({
    name: profile?.establishmentName || "Mon Établissement",
    address: "",
    phone: profile?.phone || "",
    email: profile?.email || "",
    whatsapp: profile?.whatsapp || "",
    logoUrl: profile?.logoUrl || "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [receipts, setReceipts] = useState<Array<{ id: string; transactionId: string; amount: number; paidAt: number; reference: string; subscriptionType: string }>>([]);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState({
    lowStock: true,
    dailyReport: true,
    newSales: false,
    teamUpdates: true
  });

  const handleSaveEstablishment = () => {
    toast({
      title: "Informations sauvegardées",
      description: "Les informations de l'établissement ont été mises à jour",
    });
  };

  const handleExportData = () => {
    toast({
      title: "Export en cours",
      description: "Vos données sont en cours d'export. Vous recevrez un email quand ce sera prêt.",
    });
  };

  const handleBackup = () => {
    toast({
      title: "Sauvegarde créée",
      description: "Une sauvegarde complète de vos données a été créée",
    });
  };

  const currentPlan = getCurrentPlan(profile);
  const planLabel = currentPlan === 'trial' ? 'Essai (7 jours)' 
    : currentPlan === 'transition' ? 'Transition' 
    : currentPlan === 'transition-pro-max' ? 'Transition Pro Max'
    : 'Expiré';
  const now = Date.now();
  const remaining = profile?.plan === 'trial' && profile.trialEndsAt ? (profile.trialEndsAt - now) : (profile?.plan === 'active' && profile.subscriptionEndsAt ? (profile.subscriptionEndsAt - now) : 0);
  const eventsCount = getCurrentEventsCount(profile);
  const eventsLimit = currentPlan === 'transition-pro-max' ? SUBSCRIPTION_PLANS['transition-pro-max'].features.eventsLimit : undefined;

  const payNow = async (planType: 'transition' | 'transition-pro-max' = 'transition') => {
    if (!user) return;
    try {
      // Créer un ID unique pour cette transaction
      const transactionId = `TXN-${user.uid}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const now = Date.now();
      
      // Utiliser la même méthode que SubscriptionGate pour garantir la cohérence
      const base = (
        (import.meta.env.VITE_PUBLIC_BASE_URL as string)
        || window.location.origin
      ).replace(/\/+$/, '');
      
      const plan = SUBSCRIPTION_PLANS[planType];
      const reference = `abonnement-${planType}`;
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
          subscriptionType: planType,
          amount: plan.price,
          status: 'pending' as const,
          paymentMethod: 'airtel-money' as const,
          reference,
          paymentLink: '', // Sera rempli après génération
          redirectSuccess,
          redirectError,
          createdAt: now,
        });
      } catch (error) {
        console.error('Erreur enregistrement transaction pending:', error);
        // Continuer même si l'enregistrement échoue
      }
      
      // Générer le lien de paiement
      const link = await createSubscriptionPaymentLink({
        amount: plan.price,
        reference: `${reference}-${transactionId.substring(0, 8)}`, // Inclure un court ID dans la référence
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
    } catch (error) {
      console.error('Erreur création lien paiement:', error);
      toast({ 
        title: "Paiement indisponible", 
        description: "Réessayez dans quelques instants.", 
        variant: "destructive" 
      });
    }
  };

  useEffect(() => {
    const loadReceipts = async () => {
      if (!user) return;
      setIsLoadingReceipts(true);
      try {
        const receiptsRef = receiptsColRef(db, user.uid);
        const receiptsQuery = query(receiptsRef, orderBy('paidAt', 'desc'));
        const receiptsSnapshot = await getDocs(receiptsQuery);
        const receiptsList = receiptsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as { id: string; transactionId: string; amount: number; paidAt: number; reference: string; subscriptionType: string }));
        setReceipts(receiptsList);
      } catch (error) {
        console.error('Erreur chargement reçus:', error);
      } finally {
        setIsLoadingReceipts(false);
      }
    };
    loadReceipts();
  }, [user]);

  const downloadReceipt = async (receipt?: { transactionId: string; amount: number; paidAt: number; reference: string; subscriptionType: string }) => {
    if (!profile || !user) return;
    
    // Si un reçu spécifique est fourni, l'utiliser
    if (receipt) {
      await generateSubscriptionReceiptPDF({
        establishmentName: profile.establishmentName,
        email: profile.email,
        phone: profile.phone,
        logoUrl: profile.logoUrl,
        uid: user.uid,
      }, {
        amountXaf: receipt.amount,
        paidAt: receipt.paidAt,
        paymentMethod: "Airtel Money",
        reference: receipt.reference,
      });
      return;
    }
    
    // Sinon, utiliser le dernier paiement depuis le profil
    if (!profile.lastPaymentAt) {
      toast({ title: "Aucun reçu", description: "Aucun paiement trouvé", variant: "destructive" });
      return;
    }
    
    // Essayer de trouver le paiement correspondant
    try {
      const paymentsRef = paymentsColRef(db, user.uid);
      const paymentsQuery = query(paymentsRef, orderBy('paidAt', 'desc'), orderBy('createdAt', 'desc'));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      if (!paymentsSnapshot.empty) {
        const lastPayment = paymentsSnapshot.docs[0].data();
        await generateSubscriptionReceiptPDF({
          establishmentName: profile.establishmentName,
          email: profile.email,
          phone: profile.phone,
          logoUrl: profile.logoUrl,
          uid: user.uid,
        }, {
          amountXaf: lastPayment.amount || SUBSCRIPTION_PLANS[profile.subscriptionType || 'transition'].price,
          paidAt: lastPayment.paidAt || profile.lastPaymentAt,
          paymentMethod: lastPayment.paymentMethod === 'airtel-money' ? "Airtel Money" : "Airtel Money",
          reference: lastPayment.reference || "abonnement",
        });
      } else {
        // Fallback avec les données du profil
        await generateSubscriptionReceiptPDF({
          establishmentName: profile.establishmentName,
          email: profile.email,
          phone: profile.phone,
          logoUrl: profile.logoUrl,
          uid: user.uid,
        }, {
          amountXaf: SUBSCRIPTION_PLANS[profile.subscriptionType || 'transition'].price,
          paidAt: profile.lastPaymentAt,
          paymentMethod: "Airtel Money",
          reference: "abonnement",
        });
      }
    } catch (error) {
      console.error('Erreur génération reçu:', error);
      toast({ title: "Erreur", description: "Impossible de générer le reçu", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings size={24} />
            Paramètres de l'application
          </CardTitle>
          <CardDescription>
            Configurez votre établissement et vos préférences
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="subscription" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="subscription" className="text-xs sm:text-sm px-2 py-3 h-auto">Abonnement</TabsTrigger>
          <TabsTrigger value="establishment" className="text-xs sm:text-sm px-2 py-3 h-auto">Établissement</TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm px-2 py-3 h-auto">À propos</TabsTrigger>
          <TabsTrigger value="data" className="text-xs sm:text-sm px-2 py-3 h-auto">Données</TabsTrigger>
        </TabsList>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <div className="space-y-6">
            {/* Plan Actuel */}
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="text-nack-red" size={20} />
                  Plan Actuel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{planLabel}</h3>
                      {currentPlan === 'trial' ? (
                        <p className="text-2xl font-bold text-nack-red">Gratuit (7 jours)</p>
                      ) : currentPlan === 'transition' ? (
                        <p className="text-2xl font-bold text-nack-red">2,500 XAF / 30 jours</p>
                      ) : currentPlan === 'transition-pro-max' ? (
                        <p className="text-2xl font-bold text-nack-red">7,500 XAF / 30 jours</p>
                      ) : (
                        <p className="text-2xl font-bold text-red-600">Expiré</p>
                      )}
                    </div>
                    <Badge className={
                      (currentPlan === 'transition' || currentPlan === 'transition-pro-max' || currentPlan === 'trial')
                        ? 'bg-green-100 text-green-800 hover:bg-green-100'
                        : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                    }>
                      {planLabel}
                    </Badge>
                  </div>

                  {remaining > 0 && (
                    <div className="bg-nack-beige-light p-3 rounded-lg">
                      <p className="text-sm">
                        <strong>Temps restant:</strong> {formatCountdown(remaining)}
                      </p>
                    </div>
                  )}

                  {currentPlan === 'transition-pro-max' && eventsLimit !== undefined && (
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 mb-1">Événements créés</p>
                      <p className="text-sm text-blue-800">
                        {eventsCount} / {eventsLimit} événements inclus
                        {eventsCount >= eventsLimit && (
                          <span className="block mt-1 text-xs">
                            Chaque événement supplémentaire: {SUBSCRIPTION_PLANS['transition-pro-max'].features.eventsExtraPrice?.toLocaleString()} XAF
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      Avertissement: le paiement est disponible uniquement via <strong>Airtel Money</strong>.
                      Moov Money est momentanément indisponible.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Offres disponibles */}
            {(currentPlan === 'trial' || currentPlan === 'expired') && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Offre Transition */}
                <Card className="shadow-card border-0">
                  <CardHeader>
                    <CardTitle>Transition</CardTitle>
                    <CardDescription>Plan de base</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-nack-red">{SUBSCRIPTION_PLANS.transition.price.toLocaleString()} XAF</p>
                      <p className="text-sm text-muted-foreground">par mois</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-600" />
                        <span className="text-sm">Produits</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-600" />
                        <span className="text-sm">Ventes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-600" />
                        <span className="text-sm">Stock</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-600" />
                        <span className="text-sm">Rapports</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => payNow('transition')}
                      variant="outline"
                      className="w-full"
                    >
                      Choisir Transition
                    </Button>
                  </CardContent>
                </Card>

                {/* Offre Transition Pro Max */}
                <Card className="shadow-card border-0 border-2 border-nack-red">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Transition Pro Max
                      <Badge className="bg-nack-red text-white">Recommandé</Badge>
                    </CardTitle>
                    <CardDescription>Plan complet</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-nack-red">{SUBSCRIPTION_PLANS['transition-pro-max'].price.toLocaleString()} XAF</p>
                      <p className="text-sm text-muted-foreground">par mois</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-600" />
                        <span className="text-sm">Tout de Transition</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-600" />
                        <span className="text-sm">Équipiers</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-600" />
                        <span className="text-sm">Bar Connectée</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-600" />
                        <span className="text-sm">5 Événements inclus</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check size={14} className="text-gray-500" />
                        <span>+1,500 XAF par événement supplémentaire</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => payNow('transition-pro-max')}
                      className="w-full bg-gradient-primary text-white"
                    >
                      Choisir Pro Max
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Si déjà abonné, afficher option de renouvellement */}
            {(currentPlan === 'transition' || currentPlan === 'transition-pro-max') && (
              <Card className="shadow-card border-0">
                <CardHeader>
                  <CardTitle>Renouveler l'abonnement</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      onClick={() => payNow('transition')}
                      variant="outline"
                      className="w-full flex flex-col items-center justify-center py-4 h-auto"
                    >
                      <span className="font-semibold text-base">Renouveler Transition</span>
                      <span className="text-sm text-muted-foreground mt-1">{SUBSCRIPTION_PLANS.transition.price.toLocaleString()} XAF</span>
                    </Button>
                    <Button
                      onClick={() => payNow('transition-pro-max')}
                      className="w-full bg-gradient-primary text-white flex flex-col items-center justify-center py-4 h-auto"
                    >
                      <span className="font-semibold text-base">Renouveler Pro Max</span>
                      <span className="text-sm opacity-90 mt-1">{SUBSCRIPTION_PLANS['transition-pro-max'].price.toLocaleString()} XAF</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Section des reçus */}
            {receipts.length > 0 && (
              <Card className="shadow-card border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download size={18} />
                    Mes reçus de paiement
                  </CardTitle>
                  <CardDescription>Téléchargez vos reçus d'abonnement</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingReceipts ? (
                    <div className="text-center py-4 text-muted-foreground">Chargement des reçus...</div>
                  ) : (
                    <div className="space-y-2">
                      {receipts.map((receipt) => (
                        <div key={receipt.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {receipt.subscriptionType === 'transition-pro-max' ? 'Transition Pro Max' : 'Transition'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(receipt.paidAt).toLocaleDateString('fr-FR', { 
                                day: 'numeric', 
                                month: 'long', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {receipt.reference}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            <span className="font-semibold text-nack-red">
                              {receipt.amount.toLocaleString()} XAF
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadReceipt(receipt)}
                            >
                              <Download size={14} className="mr-1" />
                              Télécharger
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Establishment Tab */}
        <TabsContent value="establishment">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building size={20} />
                  Informations de l'établissement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg border bg-white flex items-center justify-center overflow-hidden">
                      {establishmentInfo.logoUrl ? (
                        <img src={establishmentInfo.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 grid grid-cols-1 gap-2">
                      <Label htmlFor="logoUrl">Logo (URL)</Label>
                      <Input
                        id="logoUrl"
                        value={establishmentInfo.logoUrl}
                        onChange={(e) => setEstablishmentInfo({...establishmentInfo, logoUrl: e.target.value})}
                        placeholder="https://.../logo.png"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                        <Button
                          variant="outline"
                          disabled={!logoFile || !user || isSaving}
                          onClick={async () => {
                            if (!logoFile || !user) return;
                            try {
                              setIsSaving(true);
                              let url: string;
                              let deleteToken: string | undefined;
                              try {
                                const up = await uploadImageToCloudinaryDetailed(logoFile, "logos");
                                url = up.url;
                                deleteToken = up.deleteToken;
                              } catch {
                                url = await uploadLogo(logoFile, user.uid);
                              }
                              if (profile?.logoDeleteToken) {
                                try { await deleteImageByToken(profile.logoDeleteToken); } catch { /* ignore */ }
                              }
                              setEstablishmentInfo((prev) => ({ ...prev, logoUrl: url }));
                              await saveProfile({
                                establishmentName: establishmentInfo.name,
                                establishmentType: profile?.establishmentType || "",
                                ownerName: profile?.ownerName || "",
                                email: establishmentInfo.email,
                                phone: establishmentInfo.phone,
                                whatsapp: establishmentInfo.whatsapp,
                                logoUrl: url,
                                logoDeleteToken: deleteToken,
                              });
                              toast({ title: "Logo mis à jour", description: "Votre logo a été téléchargé." });
                            } catch {
                              toast({ title: "Échec de l'upload", description: "Veuillez réessayer avec une image différente.", variant: "destructive" });
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                        >
                          Importer et enregistrer
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="establishment-name">Nom de l'établissement</Label>
                    <Input
                      id="establishment-name"
                      value={establishmentInfo.name}
                      onChange={(e) => setEstablishmentInfo({...establishmentInfo, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="establishment-phone">Téléphone</Label>
                    <Input
                      id="establishment-phone"
                      value={establishmentInfo.phone}
                      onChange={(e) => setEstablishmentInfo({...establishmentInfo, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="establishment-whatsapp">WhatsApp <span className="text-red-500">*</span></Label>
                    <Input
                      id="establishment-whatsapp"
                      type="tel"
                      value={establishmentInfo.whatsapp}
                      onChange={(e) => setEstablishmentInfo({...establishmentInfo, whatsapp: e.target.value})}
                      placeholder="+241 XX XX XX XX"
                      className={establishmentInfo.whatsapp && !validateWhatsApp(establishmentInfo.whatsapp) ? "border-red-500" : ""}
                    />
                    {establishmentInfo.whatsapp && !validateWhatsApp(establishmentInfo.whatsapp) && (
                      <p className="text-xs text-red-500">{getWhatsAppErrorMessage(establishmentInfo.whatsapp)}</p>
                    )}
                    {establishmentInfo.whatsapp && validateWhatsApp(establishmentInfo.whatsapp) && (
                      <p className="text-xs text-green-600">✓ Format WhatsApp valide</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="establishment-email">Email</Label>
                    <Input
                      id="establishment-email"
                      type="email"
                      value={establishmentInfo.email}
                      onChange={(e) => setEstablishmentInfo({...establishmentInfo, email: e.target.value})}
                    />
                  </div>
                  <Button onClick={async () => {
                    try {
                      setIsSaving(true);
                      // Validation WhatsApp avant sauvegarde
                      if (establishmentInfo.whatsapp && !validateWhatsApp(establishmentInfo.whatsapp)) {
                        toast({
                          title: "Format WhatsApp invalide",
                          description: getWhatsAppErrorMessage(establishmentInfo.whatsapp),
                          variant: "destructive"
                        });
                        return;
                      }
                      await saveProfile({
                        establishmentName: establishmentInfo.name,
                        establishmentType: profile?.establishmentType || "",
                        ownerName: profile?.ownerName || "",
                        email: establishmentInfo.email,
                        phone: establishmentInfo.phone,
                        whatsapp: establishmentInfo.whatsapp,
                        logoUrl: establishmentInfo.logoUrl || undefined,
                      });
                      toast({ title: "Informations sauvegardées", description: "Profil mis à jour" });
                    } catch {
                      toast({ title: "Erreur", description: "Impossible d'enregistrer pour le moment.", variant: "destructive" });
                    } finally {
                      setIsSaving(false);
                    }
                  }} className="w-full bg-gradient-primary text-white" disabled={isSaving}>
                    {isSaving ? 'Sauvegarde...' : 'Sauvegarder les informations'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell size={20} />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Alertes de stock faible</p>
                      <p className="text-sm text-muted-foreground">Être notifié quand les stocks sont faibles</p>
                    </div>
                    <Switch
                      checked={notificationSettings.lowStock}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, lowStock: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Rapport quotidien</p>
                      <p className="text-sm text-muted-foreground">Recevoir un résumé des ventes quotidiennes</p>
                    </div>
                    <Switch
                      checked={notificationSettings.dailyReport}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, dailyReport: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Nouvelles ventes</p>
                      <p className="text-sm text-muted-foreground">Notification pour chaque nouvelle vente</p>
                    </div>
                    <Switch
                      checked={notificationSettings.newSales}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, newSales: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Mises à jour équipe</p>
                      <p className="text-sm text-muted-foreground">Notifications des changements d'équipe</p>
                    </div>
                    <Switch
                      checked={notificationSettings.teamUpdates}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, teamUpdates: checked})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Team Management Section */}
          <Card className="shadow-card border-0 mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users size={20} />
                Gestion de l'équipe
              </CardTitle>
              <CardDescription>
                Fonction disponible en novembre. Les compteurs et statistiques seront affichés ici.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-nack-beige-light rounded-lg">
                <p className="text-sm text-muted-foreground">
                  En attendant, vous pouvez préparer votre inventaire et vos ventes.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* About Tab (formerly Security) */}
        <TabsContent value="security">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="text-nack-red" size={20} />
                  À propos de Nack!
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-nack-red/10 to-nack-beige-light p-4 rounded-lg">
                    <h3 className="font-semibold text-lg mb-2">Notre histoire</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Nack! est née d'une demande suite aux lourdes commandes d'un bar. 
                      Face aux défis de gestion des stocks, des ventes et de l'équipe, 
                      nous avons créé une solution complète et intuitive pour tous les 
                      établissements du Gabon.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Aujourd'hui, Nack! accompagne des dizaines d'établissements dans 
                      leur gestion quotidienne, leur permettant de se concentrer sur 
                      l'essentiel : servir leurs clients.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-nack-beige-light rounded-lg">
                      <div className="w-10 h-10 bg-nack-red rounded-full flex items-center justify-center">
                        <Wrench className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">Développé par l'équipe Bwitix</p>
                        <p className="text-sm text-muted-foreground">Solutions technologiques innovantes</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-nack-beige-light rounded-lg">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                        <Paintbrush className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">Design par Chouyoug</p>
                        <p className="text-sm text-muted-foreground">Interface utilisateur moderne et intuitive</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button 
                      onClick={() => window.open("http://wa.me/24104746847", "_blank")}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Nous contacter sur WhatsApp
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield size={20} />
                  Informations techniques
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">Version actuelle</h4>
                    <p className="text-sm text-blue-700">Nack! v1.0.0 - Version stable</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                      <div>
                        <p className="font-medium">Sécurité des données</p>
                        <p className="text-sm text-muted-foreground">Chiffrement end-to-end</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Sécurisé
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                      <div>
                        <p className="font-medium">Sauvegarde automatique</p>
                        <p className="text-sm text-muted-foreground">Données protégées 24/7</p>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Actif
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                      <div>
                        <p className="font-medium">Support technique</p>
                        <p className="text-sm text-muted-foreground">Disponible via WhatsApp</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Disponible
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button 
                      onClick={() => window.open("https://chouyoug.netlify.app/", "_blank")}
                      variant="outline" 
                      className="w-full"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Visiter Chouyoug Design
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data">
          {/* Section UID */}
          <Card className="shadow-card border-0 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database size={20} />
                Votre UID Firebase
              </CardTitle>
              <CardDescription>
                Utilisez cet UID pour créer votre compte admin dans Firebase Console
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900 mb-2">Votre UID :</p>
                    <code className="block bg-blue-100 px-3 py-2 rounded text-xs font-mono text-blue-900 border border-blue-300 break-all">
                      {user?.uid || "Non disponible"}
                    </code>
                    <p className="text-xs text-blue-700 mt-2">
                      Copiez cet UID et utilisez-le comme ID de document dans la collection <code className="bg-blue-200 px-1 rounded">admins</code> de Firestore
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (user?.uid) {
                        navigator.clipboard.writeText(user.uid);
                        toast({ 
                          title: "UID copié !", 
                          description: "L'UID a été copié dans le presse-papiers" 
                        });
                      }
                    }}
                    className="shrink-0"
                  >
                    📋 Copier
                  </Button>
                </div>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-900 mb-2">Instructions rapides :</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-green-800">
                  <li>Allez sur <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Firebase Console</a></li>
                  <li>Projet : <strong>nack-8c299</strong></li>
                  <li>Firestore Database → Collection <code className="bg-green-100 px-1 rounded">admins</code></li>
                  <li>Créez un document avec ID = votre UID (copié ci-dessus)</li>
                  <li>Ajoutez : <code className="bg-green-100 px-1 rounded">role: "admin"</code>, <code className="bg-green-100 px-1 rounded">createdAt</code>, <code className="bg-green-100 px-1 rounded">updatedAt</code></li>
                </ol>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database size={20} />
                  Gestion des données
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                      <div>
                        <p className="font-medium">Sauvegarde automatique</p>
                        <p className="text-sm text-muted-foreground">Dernière sauvegarde: Aujourd'hui à 14:30</p>
                      </div>
                      <Button onClick={handleBackup} variant="outline" size="sm">
                        <Upload className="mr-2" size={16} />
                        Sauvegarder
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                      <div>
                        <p className="font-medium">Export des données</p>
                        <p className="text-sm text-muted-foreground">Télécharger toutes vos données</p>
                      </div>
                      <Button onClick={handleExportData} variant="outline" size="sm">
                        <Download className="mr-2" size={16} />
                        Exporter
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800">Configuration système</p>
                    <div className="mt-2 space-y-1 text-sm text-yellow-700">
                      <p> Devise: XAF (Franc CFA)</p>
                      <p> Fuseau horaire: GMT+0 (Dakar)</p>
                      <p> Format de date: DD/MM/YYYY</p>
                      <p> Langue: Français</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Zone de danger</CardTitle>
                <CardDescription>Actions irréversibles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border border-red-200 p-4 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">Réinitialiser les données</h4>
                    <p className="text-sm text-red-600 mb-3">
                      Supprime toutes les données (ventes, stock, équipe) sauf les paramètres de base.
                    </p>
                    <Button variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                      Réinitialiser les données
                    </Button>
                  </div>
                  
                  <div className="border border-red-200 p-4 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">Supprimer le compte</h4>
                    <p className="text-sm text-red-600 mb-3">
                      Supprime définitivement votre compte et toutes les données associées.
                    </p>
                    <Button variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                      Supprimer le compte
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
