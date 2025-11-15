import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { 
  productsColRef, 
  salesColRef, 
  ordersColRef, 
  eventsColRef, 
  teamColRef,
  paymentsColRef,
  notificationsColRef
} from "@/lib/collections";
import { 
  doc, 
  getDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  getDocs,
  collection,
  where
} from "firebase/firestore";
import type { UserProfile } from "@/types/profile";
import type { PaymentTransaction } from "@/types/payment";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, 
  Trash2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Package, 
  ShoppingCart, 
  CreditCard,
  Users,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle,
  Clock,
  Building2,
  TrendingUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ClientDetailsPage = () => {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Statistiques
  const [stats, setStats] = useState({
    productsCount: 0,
    salesCount: 0,
    ordersCount: 0,
    barOrdersCount: 0,
    eventsCount: 0,
    teamCount: 0,
    paymentsCount: 0,
    totalSales: 0,
    totalPayments: 0,
  });

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin');
      return;
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (!uid) {
      navigate('/admin');
      return;
    }

    // Charger le profil
    const profileRef = doc(db, "profiles", uid);
    const unsubProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
        setLoading(false);
      } else {
        toast({ title: "Erreur", description: "Client non trouvé", variant: "destructive" });
        navigate('/admin');
      }
    }, (error) => {
      console.error('Erreur chargement profil:', error);
      toast({ title: "Erreur", description: "Impossible de charger le profil", variant: "destructive" });
      setLoading(false);
    });

    // Charger les statistiques
    const loadStats = async () => {
      try {
        // Produits
        const productsSnap = await getDocs(productsColRef(db, uid));
        const productsCount = productsSnap.size;

        // Ventes
        const salesSnap = await getDocs(query(salesColRef(db, uid), orderBy("createdAt", "desc")));
        const salesCount = salesSnap.size;
        const totalSales = salesSnap.docs.reduce((sum, d) => {
          const data = d.data();
          return sum + (Number(data.total) || 0);
        }, 0);

        // Commandes normales
        const ordersSnap = await getDocs(query(ordersColRef(db, uid), orderBy("createdAt", "desc")));
        const ordersCount = ordersSnap.size;

        // Commandes Bar Connectée
        const barOrdersRef = collection(db, `profiles/${uid}/barOrders`);
        const barOrdersSnap = await getDocs(barOrdersRef);
        const barOrdersCount = barOrdersSnap.size;

        // Événements
        const eventsSnap = await getDocs(eventsColRef(db, uid));
        const eventsCount = eventsSnap.size;

        // Équipe
        const teamSnap = await getDocs(teamColRef(db, uid));
        const teamCount = teamSnap.size;

        // Paiements
        const paymentsSnap = await getDocs(query(paymentsColRef(db, uid), where('status', '==', 'completed')));
        const paymentsCount = paymentsSnap.size;
        const totalPayments = paymentsSnap.docs.reduce((sum, d) => {
          const data = d.data() as PaymentTransaction;
          return sum + (Number(data.amount) || 0);
        }, 0);

        setStats({
          productsCount,
          salesCount,
          ordersCount,
          barOrdersCount,
          eventsCount,
          teamCount,
          paymentsCount,
          totalSales,
          totalPayments,
        });
      } catch (error) {
        console.error('Erreur chargement stats:', error);
      }
    };

    if (uid) {
      loadStats();
    }

    return () => {
      unsubProfile();
    };
  }, [uid, navigate, toast]);

  const handleDelete = async () => {
    if (!uid) return;
    setIsDeleting(true);
    try {
      // Supprimer le profil
      await deleteDoc(doc(db, "profiles", uid));
      toast({ 
        title: "Succès", 
        description: "Client supprimé avec succès" 
      });
      navigate('/admin');
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de supprimer le client", 
        variant: "destructive" 
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Client non trouvé</p>
            <Button onClick={() => navigate('/admin')} className="w-full mt-4">
              Retour au tableau de bord
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const now = Date.now();
  const isExpired = profile.plan === 'expired' || (profile.subscriptionEndsAt ? profile.subscriptionEndsAt < now : false);
  const status = profile.plan === 'active' && !isExpired ? 'active' : profile.plan === 'trial' ? 'trial' : 'expired';
  const daysRemaining = profile.subscriptionEndsAt 
    ? Math.floor((profile.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000))
    : 0;

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Détails du client</h1>
              <p className="text-sm text-muted-foreground">Informations complètes et statistiques</p>
            </div>
          </div>
          <Button 
            variant="destructive" 
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Supprimer
          </Button>
        </div>

        {/* Informations principales */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informations personnelles */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Informations personnelles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nom du propriétaire</label>
                  <p className="text-lg font-semibold">{profile.ownerName || "—"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-lg font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {profile.email || "—"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Téléphone</label>
                  <p className="text-lg font-semibold flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {profile.phone || "—"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">UID</label>
                  <p className="text-sm font-mono text-muted-foreground break-all">{uid}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nom de l'établissement</label>
                <p className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {profile.establishmentName || "—"}
                </p>
              </div>
              
              {profile.latitude && profile.longitude && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Localisation</label>
                  <p className="text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {profile.latitude.toFixed(6)}, {profile.longitude.toFixed(6)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statut et abonnement */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Abonnement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Statut</label>
                <div className="mt-2">
                  {status === 'active' && (
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Actif
                    </Badge>
                  )}
                  {status === 'trial' && (
                    <Badge className="bg-amber-100 text-amber-700">
                      <Clock className="w-3 h-3 mr-1" />
                      Essai
                    </Badge>
                  )}
                  {status === 'expired' && (
                    <Badge className="bg-red-100 text-red-700">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Expiré
                    </Badge>
                  )}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Plan</label>
                <p className="text-lg font-semibold capitalize">{profile.plan || "trial"}</p>
              </div>
              
              {profile.subscriptionEndsAt && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Fin d'abonnement</label>
                  <p className="text-lg font-semibold">
                    {new Date(profile.subscriptionEndsAt).toLocaleDateString('fr-FR')}
                  </p>
                  {status === 'active' && daysRemaining > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
              
              {profile.trialEndsAt && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Fin de l'essai</label>
                  <p className="text-sm">
                    {new Date(profile.trialEndsAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Date d'inscription</label>
                <p className="text-sm">
                  {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('fr-FR') : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4" />
                Produits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.productsCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Commandes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.ordersCount + stats.barOrdersCount}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.ordersCount} normales + {stats.barOrdersCount} QR
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Ventes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSales.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.salesCount} transaction{stats.salesCount > 1 ? 's' : ''}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Événements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.eventsCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Statistiques supplémentaires */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Équipe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.teamCount}</div>
              <p className="text-sm text-muted-foreground mt-2">Membres d'équipe</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Paiements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalPayments.toLocaleString()} XAF</div>
              <p className="text-sm text-muted-foreground mt-2">
                {stats.paymentsCount} paiement{stats.paymentsCount > 1 ? 's' : ''} complété{stats.paymentsCount > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données du client ({profile.establishmentName || profile.email}) seront supprimées définitivement.
              <br /><br />
              <strong>Attention :</strong> Cette action supprimera également tous les produits, commandes, ventes et autres données associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientDetailsPage;

