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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { uploadLogo } from "@/lib/upload";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { deleteImageByToken } from "@/lib/cloudinary";
import { uploadImageToCloudinaryDetailed } from "@/lib/cloudinary";
import { createSubscriptionPaymentLink } from "@/lib/payments/singpay";

function formatCountdown(ms: number) {
  if (!ms || ms <= 0) return "—";
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

  const [securitySettings, setSecuritySettings] = useState({
    twoFactor: false,
    autoLogout: true,
    sessionTimeout: "30"
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
        amount: 1500,
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
          <TabsTrigger value="security" className="text-xs sm:text-sm px-2 py-3 h-auto">Sécurité</TabsTrigger>
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
                      <p className="text-2xl font-bold text-nack-red">{profile?.plan === 'trial' ? '0 XAF' : '1,500 XAF / 30 jours'}</p>
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

                  <div className="pt-2">
                    <Button onClick={payNow} className="w-full bg-gradient-primary text-white">
                      {profile?.plan === 'trial' || profile?.plan === 'expired' ? 'Activer mon abonnement (1500 XAF)' : 'Renouveler (1500 XAF)'}
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
                  <div className="bg-nack-beige-light p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Méthode de paiement</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      À définir après le premier paiement.
                    </p>
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

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield size={20} />
                  Sécurité du compte
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Authentification à deux facteurs</p>
                      <p className="text-sm text-muted-foreground">Sécurité renforcée pour votre compte</p>
                    </div>
                    <Switch
                      checked={securitySettings.twoFactor}
                      onCheckedChange={(checked) => setSecuritySettings({...securitySettings, twoFactor: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Déconnexion automatique</p>
                      <p className="text-sm text-muted-foreground">Se déconnecter après une période d'inactivité</p>
                    </div>
                    <Switch
                      checked={securitySettings.autoLogout}
                      onCheckedChange={(checked) => setSecuritySettings({...securitySettings, autoLogout: checked})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">Délai de déconnexion (minutes)</Label>
                    <Input
                      id="session-timeout"
                      type="number"
                      value={securitySettings.sessionTimeout}
                      onChange={(e) => setSecuritySettings({...securitySettings, sessionTimeout: e.target.value})}
                    />
                  </div>
                  <Button variant="outline" className="w-full">
                    Changer le mot de passe
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Sessions actives</CardTitle>
                <CardDescription>Gérez vos connexions actives</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { device: "Chrome sur Windows", location: "Dakar, Sénégal", current: true, lastActive: "Maintenant" },
                    { device: "Safari sur iPhone", location: "Dakar, Sénégal", current: false, lastActive: "Il y a 2h" },
                    { device: "Firefox sur Mac", location: "Thiès, Sénégal", current: false, lastActive: "Hier" }
                  ].map((session, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{session.device}</p>
                        <p className="text-xs text-muted-foreground">{session.location}</p>
                        <p className="text-xs text-muted-foreground">
                          {session.current ? "Session actuelle" : session.lastActive}
                        </p>
                      </div>
                      {!session.current && (
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          Déconnecter
                        </Button>
                      )}
                    </div>
                  ))}
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
                      <p>• Devise: XAF (Franc CFA)</p>
                      <p>• Fuseau horaire: GMT+0 (Dakar)</p>
                      <p>• Format de date: DD/MM/YYYY</p>
                      <p>• Langue: Français</p>
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
