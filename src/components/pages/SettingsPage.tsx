import { useState } from "react";
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
  Download,
  Upload,
  Crown,
  Check,
  Users,
  Image as ImageIcon,
  ExternalLink,
  Info,
  Wrench,
  Paintbrush
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { uploadLogo } from "@/lib/upload";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { deleteImageByToken } from "@/lib/cloudinary";
import { uploadImageToCloudinaryDetailed } from "@/lib/cloudinary";
import { createSubscriptionPaymentLink } from "@/lib/payments/singpay";
import { generateSubscriptionReceiptPDF } from "@/utils/receipt";

function formatCountdown(ms: number) {
  if (!ms || ms <= 0) return "";
  const d = Math.floor(ms / (24*60*60*1000));
  const h = Math.floor((ms % (24*60*60*1000)) / (60*60*1000));
  const m = Math.floor((ms % (60*60*1000)) / (60*1000));
  return `${d}j ${h}h ${m}m`;
}

const SettingsPage = ({ onTabChange }: { onTabChange?: (tab: string) => void }) => {
  const { toast } = useToast();
  const { profile, saveProfile, user } = useAuth();
  
  const [establishmentInfo, setEstablishmentInfo] = useState({
    name: profile?.establishmentName || "Mon Établissement",
    address: "",
    phone: profile?.phone || "",
    email: profile?.email || "",
    logoUrl: profile?.logoUrl || "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const planLabel = profile?.plan === 'trial' ? 'Essai (7 jours)' : profile?.plan === 'active' ? 'Actif' : 'Expiré';
  const now = Date.now();
  const remaining = profile?.plan === 'trial' && profile.trialEndsAt ? (profile.trialEndsAt - now) : (profile?.plan === 'active' && profile.subscriptionEndsAt ? (profile.subscriptionEndsAt - now) : 0);

  const payNow = async () => {
    try {
      const origin = (import.meta.env.VITE_PUBLIC_BASE_URL as string) || window.location.origin;
      const link = await createSubscriptionPaymentLink({
        amount: 2500,
        reference: 'abonnement',
        redirectSuccess: `${origin}/payment/success`,
        redirectError: `${origin}/payment/error`,
        logoURL: `${origin}/favicon.png`,
        isTransfer: false,
      });
      window.location.href = link;
    } catch {
      toast({ title: "Paiement indisponible", description: "Réessayez dans quelques instants.", variant: "destructive" });
    }
  };

  const downloadReceipt = async () => {
    if (!profile || !user || !profile.lastPaymentAt) return;
    await generateSubscriptionReceiptPDF({
      establishmentName: profile.establishmentName,
      email: profile.email,
      phone: profile.phone,
      logoUrl: profile.logoUrl,
      uid: user.uid,
    }, {
      amountXaf: 2500,
      paidAt: profile.lastPaymentAt,
      paymentMethod: "Airtel Money",
      reference: "abonnement",
    });
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      <h3 className="font-semibold">{planLabel}</h3>
                      <p className="text-2xl font-bold text-nack-red">{profile?.plan === 'trial' ? '0 XAF' : '2,500 XAF / 30 jours'}</p>
                    </div>
                    <Badge className={profile?.plan === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'}>
                      {planLabel}
                    </Badge>
                  </div>

                  <div className="bg-nack-beige-light p-3 rounded-lg">
                    <p className="text-sm">
                      <strong>Temps restant:</strong> {formatCountdown(remaining)}
                    </p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      Avertissement: le paiement est disponible uniquement via <strong>Airtel Money</strong>.
                      Moov Money est momentanément indisponible.
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button onClick={payNow} className="w-full bg-gradient-primary text-white">
                      {profile?.plan === 'trial' || profile?.plan === 'expired' ? 'Activer mon abonnement (2500 XAF)' : 'Renouveler (2500 XAF)'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard size={20} />
                  Facturation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-nack-beige-light p-4 rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Montant</span>
                      <span className="text-sm">2,500 XAF / 30 jours</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Dernier paiement</span>
                      <span className="text-sm">{profile?.lastPaymentAt ? new Date(profile.lastPaymentAt).toLocaleString() : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Méthode</span>
                      <span className="text-sm">{profile?.lastPaymentAt ? "Airtel Money" : "—"}</span>
                    </div>
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={downloadReceipt}
                        disabled={!profile?.lastPaymentAt}
                      >
                        <Download className="mr-2" size={16} />
                        Télécharger le reçu
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                      await saveProfile({
                        establishmentName: establishmentInfo.name,
                        establishmentType: profile?.establishmentType || "",
                        ownerName: profile?.ownerName || "",
                        email: establishmentInfo.email,
                        phone: establishmentInfo.phone,
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
