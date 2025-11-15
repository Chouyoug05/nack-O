import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { profilesColRef, notificationsColRef, paymentsColRef, productsColRef, ordersColRef, eventsColRef, teamColRef } from "@/lib/collections";
import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc, where, collectionGroup, deleteDoc } from "firebase/firestore";
import type { UserProfile } from "@/types/profile";
import type { PaymentTransaction } from "@/types/payment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { AlertCircle, Bell, CheckCircle, Clock, Gift, Search, Users, Wrench, CreditCard, Download, Package, ShoppingCart, Calendar, QrCode, Star, TrendingUp, Eye, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NotificationForm {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  target: "all" | "filtered" | "selected";
}

const AdminDashboard = () => {
  const { isAdmin, isAdminLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "trial" | "active" | "expired">("all");
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [notif, setNotif] = useState<NotificationForm>({ title: "", message: "", type: "info", target: "all" });
  const [activationDays, setActivationDays] = useState<number>(30);
  const [extendEmail, setExtendEmail] = useState<string>("");
  const [extendDays, setExtendDays] = useState<number>(1);
  const [isFixingAbnormal, setIsFixingAbnormal] = useState(false);
  const [isFixingPastDates, setIsFixingPastDates] = useState(false);
  const [allPayments, setAllPayments] = useState<Array<PaymentTransaction & { userEmail?: string; userName?: string }>>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [globalStats, setGlobalStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalBarOrders: 0,
    totalEvents: 0,
    totalTeamMembers: 0,
    totalRatings: 0,
    avgRating: 0,
  });
  const [isLoadingGlobalStats, setIsLoadingGlobalStats] = useState(false);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<{ uid: string; name: string } | null>(null);

  // Si pas admin, rediriger (sécurité supplémentaire)
  useEffect(() => {
    if (!isAdminLoading && !isAdmin) {
      window.location.href = '/admin-check';
    }
  }, [isAdmin, isAdminLoading]);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(profilesColRef(db), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: UserProfile[] = snap.docs.map(d => ({ ...(d.data() as UserProfile) }));
      setAllProfiles(list);
    });
    return () => unsub();
  }, [isAdmin]);

  const loadAllPayments = useCallback(async () => {
    setIsLoadingPayments(true);
    try {
      const payments: Array<PaymentTransaction & { userEmail?: string; userName?: string }> = [];
      
      // Parcourir tous les profils pour récupérer leurs paiements
      for (const profile of allProfiles) {
        try {
          const paymentsRef = paymentsColRef(db, profile.uid);
          const paymentsQuery = query(paymentsRef, where('status', '==', 'completed'));
          const paymentsSnapshot = await getDocs(paymentsQuery);
          
          paymentsSnapshot.docs.forEach(doc => {
            const paymentData = { id: doc.id, ...doc.data() } as PaymentTransaction;
            payments.push({
              ...paymentData,
              userEmail: profile.email,
              userName: profile.ownerName || profile.establishmentName,
            });
          });
        } catch (error) {
          console.error(`Erreur chargement paiements pour ${profile.uid}:`, error);
        }
      }
      
      // Trier par date de paiement (plus récent en premier)
      payments.sort((a, b) => (b.paidAt || b.createdAt || 0) - (a.paidAt || a.createdAt || 0));
      setAllPayments(payments);
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
      toast({ title: "Erreur", description: "Impossible de charger les paiements", variant: "destructive" });
    } finally {
      setIsLoadingPayments(false);
    }
  }, [allProfiles, toast]);

  const loadGlobalStats = useCallback(async () => {
    setIsLoadingGlobalStats(true);
    try {
      let totalProducts = 0;
      let totalOrders = 0;
      let totalBarOrders = 0;
      let totalEvents = 0;
      let totalTeamMembers = 0;
      let totalRatings = 0;
      let sumRatings = 0;

      // Parcourir tous les profils pour agréger les statistiques
      for (const profile of allProfiles) {
        try {
          // Produits
          const productsRef = productsColRef(db, profile.uid);
          const productsSnap = await getDocs(productsRef);
          totalProducts += productsSnap.size;
          
          // Compter les ratings
          productsSnap.forEach(doc => {
            const data = doc.data();
            if (data.ratingCount) {
              totalRatings += data.ratingCount;
              if (data.rating) {
                sumRatings += data.rating * data.ratingCount;
              }
            }
          });

          // Commandes normales
          const ordersRef = ordersColRef(db, profile.uid);
          const ordersSnap = await getDocs(ordersRef);
          totalOrders += ordersSnap.size;

          // Commandes Bar Connectée
          const barOrdersRef = collection(db, `profiles/${profile.uid}/barOrders`);
          const barOrdersSnap = await getDocs(barOrdersRef);
          totalBarOrders += barOrdersSnap.size;

          // Événements
          const eventsRef = eventsColRef(db, profile.uid);
          const eventsSnap = await getDocs(eventsRef);
          totalEvents += eventsSnap.size;

          // Membres d'équipe
          const teamRef = teamColRef(db, profile.uid);
          const teamSnap = await getDocs(teamRef);
          totalTeamMembers += teamSnap.size;
        } catch (error) {
          console.error(`Erreur chargement stats pour ${profile.uid}:`, error);
        }
      }

      setGlobalStats({
        totalProducts,
        totalOrders,
        totalBarOrders,
        totalEvents,
        totalTeamMembers,
        totalRatings,
        avgRating: totalRatings > 0 ? sumRatings / totalRatings : 0,
      });
    } catch (error) {
      console.error('Erreur chargement stats globales:', error);
    } finally {
      setIsLoadingGlobalStats(false);
    }
  }, [allProfiles]);

  useEffect(() => {
    if (isAdmin && allProfiles.length > 0) {
      loadAllPayments();
      loadGlobalStats();
    }
  }, [isAdmin, allProfiles.length, loadAllPayments, loadGlobalStats]);

  const now = Date.now();
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return allProfiles.filter(p => {
      const matchSearch = !s || [p.ownerName, p.email, p.establishmentName].some(v => (v || "").toLowerCase().includes(s));
      const plan = p.plan || "trial";
      const isExpired = plan === "expired" || (p.subscriptionEndsAt ? p.subscriptionEndsAt < now : false);
      const status = plan === "active" && !isExpired ? "active" : plan === "trial" ? "trial" : "expired";
      const matchStatus = statusFilter === "all" || status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [allProfiles, search, statusFilter, now]);

  const stats = useMemo(() => {
    const total = allProfiles.length;
    const active = allProfiles.filter(p => (p.plan === "active") && (typeof p.subscriptionEndsAt === 'number' ? p.subscriptionEndsAt > now : true)).length;
    const trial = allProfiles.filter(p => (p.plan || "trial") === "trial").length;
    const expired = total - active - trial;
    const price = Number(import.meta.env.VITE_SUB_PRICE_XAF || 5000);
    const monthly = active * price;
    return { total, active, trial, expired, price, monthly };
  }, [allProfiles, now]);

  const toggleSelect = (uid: string) => {
    setSelectedUids(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const getTargetUids = (): string[] => {
    if (notif.target === "all") return allProfiles.map(p => p.uid);
    if (notif.target === "filtered") return filtered.map(p => p.uid);
    return Array.from(selectedUids);
  };

  const sendNotifications = async () => {
    if (!notif.title || !notif.message) {
      toast({ 
        title: "Erreur", 
        description: "Veuillez remplir le titre et le message", 
        variant: "destructive" 
      });
      return;
    }

    const uids = getTargetUids();
    if (uids.length === 0) {
      toast({ 
        title: "Erreur", 
        description: "Aucun utilisateur ciblé. Sélectionnez des utilisateurs ou utilisez 'Tous'", 
        variant: "destructive" 
      });
      return;
    }

    const createdAt = Date.now();
    let successCount = 0;
    let errorCount = 0;

    for (const uid of uids) {
      try {
        await addDoc(notificationsColRef(db, uid), {
          title: notif.title,
          message: notif.message,
          type: notif.type,
          createdAt,
          read: false,
        });
        successCount++;
      } catch (error) {
        console.error(`Erreur envoi notification à ${uid}:`, error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast({ 
        title: "Notifications envoyées", 
        description: `${successCount} notification${successCount > 1 ? 's' : ''} envoyée${successCount > 1 ? 's' : ''}${errorCount > 0 ? `, ${errorCount} erreur${errorCount > 1 ? 's' : ''}` : ''}` 
      });
    setNotif(prev => ({ ...prev, title: "", message: "" }));
    } else {
      toast({ 
        title: "Erreur", 
        description: "Aucune notification n'a pu être envoyée", 
        variant: "destructive" 
      });
    }
  };

  const activateForDays = async (uid: string, days: number) => {
    const ms = Math.max(1, days) * 24 * 60 * 60 * 1000;
    const until = Date.now() + ms;
    try {
      await updateDoc(doc(db, "profiles", uid), {
        plan: 'active',
        subscriptionEndsAt: until,
        updatedAt: Date.now(),
      });
      toast({ title: "Succès", description: `Abonnement activé pour ${days} jours` });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'activer l'abonnement", variant: "destructive" });
    }
  };

  const extendSubscriptionByEmail = async (email: string, days: number = 1) => {
    const profile = allProfiles.find(p => p.email?.toLowerCase() === email.toLowerCase());
    if (!profile) {
      toast({ title: "Erreur", description: `Utilisateur non trouvé: ${email}`, variant: "destructive" });
      return;
    }

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const daysToAddMs = days * oneDayMs;
    
    // Obtenir la date de fin actuelle ou utiliser maintenant si pas de date
    const currentEndDate = profile.subscriptionEndsAt || now;
    
    // Ajouter les jours
    const newEndDate = currentEndDate + daysToAddMs;
    const newDaysRemaining = (newEndDate - now) / oneDayMs;

    try {
      await updateDoc(doc(db, "profiles", profile.uid), {
        subscriptionEndsAt: newEndDate,
        plan: 'active',
        updatedAt: now,
      });
      toast({ 
        title: "Abonnement prolongé", 
        description: `${email}: +${days} jour(s) ajouté(s). Nouveaux jours restants: ${Math.floor(newDaysRemaining)}` 
      });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de prolonger l'abonnement", variant: "destructive" });
    }
  };

  const fixAbnormalSubscription = async (uid: string) => {
    const profile = allProfiles.find(p => p.uid === uid);
    if (!profile || profile.plan !== 'active' || !profile.subscriptionEndsAt) return;
    
    const now = Date.now();
    const daysRemaining = (profile.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000);
    
    if (daysRemaining <= 30) {
      toast({ title: "Info", description: "Cet abonnement est normal (≤ 30 jours)" });
      return;
    }
    
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const newSubscriptionEndsAt = now + thirtyDaysMs;
    
    try {
      await updateDoc(doc(db, "profiles", uid), {
        subscriptionEndsAt: newSubscriptionEndsAt,
        updatedAt: now,
      });
      toast({ 
        title: "Corrigé", 
        description: `Abonnement corrigé: ${Math.floor(daysRemaining)}j → 30j` 
      });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de corriger l'abonnement", variant: "destructive" });
    }
  };

  const fixAllAbnormalSubscriptions = async () => {
    setIsFixingAbnormal(true);
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    let fixed = 0;
    let errors = 0;
    
    try {
      for (const profile of allProfiles) {
        if (profile.plan !== 'active' || !profile.subscriptionEndsAt) continue;
        
        const daysRemaining = (profile.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000);
        if (daysRemaining > 30) {
          try {
            await updateDoc(doc(db, "profiles", profile.uid), {
              subscriptionEndsAt: now + thirtyDaysMs,
              updatedAt: now,
            });
            fixed++;
          } catch {
            errors++;
          }
        }
      }
      
      toast({ 
        title: "Correction terminée", 
        description: `${fixed} abonnement(s) corrigé(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}` 
      });
    } catch (error) {
      toast({ title: "Erreur", description: "Erreur lors de la correction", variant: "destructive" });
    } finally {
      setIsFixingAbnormal(false);
    }
  };

  const fixAllPastSubscriptionDates = async () => {
    setIsFixingPastDates(true);
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const year2025Start = new Date('2025-01-01').getTime();
    let fixed = 0;
    let errors = 0;
    
    try {
      for (const profile of allProfiles) {
        if (!profile.subscriptionEndsAt) continue;
        
        // Vérifier si la date est en 2024 ou dans le passé
        const subscriptionEndsAt = profile.subscriptionEndsAt;
        const isIn2024 = subscriptionEndsAt < year2025Start;
        const isExpired = subscriptionEndsAt < now;
        
        if (isIn2024 || isExpired) {
          try {
            await updateDoc(doc(db, "profiles", profile.uid), {
              subscriptionEndsAt: now + thirtyDaysMs,
              plan: 'active',
              updatedAt: now,
            });
            fixed++;
          } catch {
            errors++;
          }
        }
      }
      
      toast({ 
        title: "Correction terminée", 
        description: `${fixed} date(s) d'abonnement corrigée(s) (2024 → 2025)${errors > 0 ? `, ${errors} erreur(s)` : ''}` 
      });
    } catch (error) {
      toast({ title: "Erreur", description: "Erreur lors de la correction", variant: "destructive" });
    } finally {
      setIsFixingPastDates(false);
    }
  };

  const handleDeleteClient = (uid: string, clientName: string) => {
    setClientToDelete({ uid, name: clientName });
    setShowDeleteDialog(true);
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;
    
    setDeletingUid(clientToDelete.uid);
    try {
      await deleteDoc(doc(db, "profiles", clientToDelete.uid));
      toast({ 
        title: "Client supprimé", 
        description: `Le client "${clientToDelete.name}" a été supprimé avec succès` 
      });
      setShowDeleteDialog(false);
      setClientToDelete(null);
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de supprimer le client", 
        variant: "destructive" 
      });
    } finally {
      setDeletingUid(null);
    }
  };

  // Afficher un loader si en cours de vérification ou pas admin
  if (isAdminLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Vérification des droits d'accès...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Administration</h1>
            <p className="text-sm text-muted-foreground">Gestion des utilisateurs, abonnements, notifications et promotions</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users size={16}/> Utilisateurs</CardTitle><CardDescription>Total inscrits</CardDescription></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle size={16} className="text-green-600"/> Actifs</CardTitle><CardDescription>Abonnés en cours</CardDescription></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.active}</div></CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock size={16} className="text-amber-600"/> Essai</CardTitle><CardDescription>En période d'essai</CardDescription></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.trial}</div></CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertCircle size={16} className="text-red-600"/> Expirés</CardTitle><CardDescription>Abonnements expirés</CardDescription></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.expired}</div></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package size={16} className="text-blue-600"/> Produits
              </CardTitle>
              <CardDescription>Total produits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingGlobalStats ? "..." : globalStats.totalProducts.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart size={16} className="text-purple-600"/> Commandes
              </CardTitle>
              <CardDescription>Total commandes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingGlobalStats ? "..." : (globalStats.totalOrders + globalStats.totalBarOrders).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {globalStats.totalOrders} normales + {globalStats.totalBarOrders} QR
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar size={16} className="text-orange-600"/> Événements
              </CardTitle>
              <CardDescription>Total événements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingGlobalStats ? "..." : globalStats.totalEvents.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star size={16} className="text-yellow-600"/> Appréciations
              </CardTitle>
              <CardDescription>Notes moyennes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingGlobalStats ? "..." : globalStats.avgRating > 0 ? globalStats.avgRating.toFixed(1) : "0.0"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {globalStats.totalRatings} avis
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Revenus estimés</CardTitle>
            <CardDescription>Basé sur les abonnements actifs × prix mensuel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary">Prix: {stats.price.toLocaleString()} XAF</Badge>
              <Badge variant="default">Actifs: {stats.active}</Badge>
              <div className="text-xl font-semibold ml-auto">≈ {stats.monthly.toLocaleString()} XAF/mois</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><Bell size={18}/> Notifications</CardTitle>
            <CardDescription>Envoyer un message à tous, aux filtrés ou aux sélectionnés</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input placeholder="Titre" value={notif.title} onChange={e => setNotif({ ...notif, title: e.target.value })} />
              <Select value={notif.type} onValueChange={(v) => setNotif({ ...notif, type: v as NotificationForm["type"] })}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Succès</SelectItem>
                  <SelectItem value="warning">Avertissement</SelectItem>
                  <SelectItem value="error">Erreur</SelectItem>
                </SelectContent>
              </Select>
              <Select value={notif.target} onValueChange={(v) => setNotif({ ...notif, target: v as NotificationForm["target"] })}>
                <SelectTrigger><SelectValue placeholder="Cible" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="filtered">Filtrés</SelectItem>
                  <SelectItem value="selected">Sélectionnés</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={sendNotifications} className="w-full">Envoyer</Button>
            </div>
            <Input placeholder="Message" value={notif.message} onChange={e => setNotif({ ...notif, message: e.target.value })} />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Utilisateurs</CardTitle>
            <CardDescription>Rechercher, filtrer, sélectionner et activer gratuitement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-7 w-64" placeholder="Rechercher (nom, email, établissement)" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="trial">Essai</SelectItem>
                  <SelectItem value="expired">Expirés</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <Input 
                  type="text" 
                  className="w-48" 
                  placeholder="Rechercher par email..." 
                  onChange={e => {
                    const email = e.target.value.trim();
                    if (email) {
                      const found = allProfiles.find(p => p.email?.toLowerCase() === email.toLowerCase());
                      if (found) {
                        setSearch(found.email || found.ownerName || '');
                        setStatusFilter('all');
                      }
                    }
                  }}
                />
                <Input type="number" className="w-28" min={1} value={activationDays} onChange={e => setActivationDays(Number(e.target.value || 0))} />
                <Button 
                  variant="destructive" 
                  onClick={fixAllAbnormalSubscriptions}
                  disabled={isFixingAbnormal || isFixingPastDates}
                  title="Corriger tous les abonnements avec plus de 30 jours"
                >
                  <Wrench size={16} className="mr-2"/>
                  {isFixingAbnormal ? "Correction..." : "Corriger tous les anormaux"}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={fixAllPastSubscriptionDates}
                  disabled={isFixingAbnormal || isFixingPastDates}
                  title="Corriger toutes les dates d'abonnement en 2024"
                >
                  <Wrench size={16} className="mr-2"/>
                  {isFixingPastDates ? "Correction..." : "Corriger dates 2024"}
                </Button>
                <Button variant="outline" onClick={async () => {
                  const uids = Array.from(selectedUids);
                  for (const uid of uids) await activateForDays(uid, activationDays);
                }}><Gift size={16} className="mr-2"/>Activer {activationDays} j</Button>
              </div>
              
              {/* Prolonger abonnement par email */}
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">Prolonger l'abonnement d'un utilisateur</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="email"
                    placeholder="Email de l'utilisateur"
                    value={extendEmail}
                    onChange={(e) => setExtendEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Jours"
                    value={extendDays}
                    onChange={(e) => setExtendDays(Number(e.target.value) || 1)}
                    min={1}
                    className="w-24"
                  />
                  <Button 
                    onClick={() => {
                      if (extendEmail.trim()) {
                        extendSubscriptionByEmail(extendEmail.trim(), extendDays);
                        setExtendEmail("");
                      } else {
                        toast({ title: "Erreur", description: "Veuillez saisir un email", variant: "destructive" });
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Gift size={16} className="mr-2"/>
                    Prolonger de {extendDays} jour(s)
                  </Button>
                  <Button 
                    onClick={async () => {
                      try {
                        await extendSubscriptionByEmail("sericsackerkoumba@gmail.com", 1);
                      } catch (error) {
                        console.error('Erreur:', error);
                      }
                    }}
                    variant="outline"
                    className="border-green-500 text-green-600 hover:bg-green-50"
                    title="Ajouter 1 jour à sericsackerkoumba@gmail.com"
                  >
                    <Gift size={16} className="mr-2"/>
                    +1j sericsackerkoumba@gmail.com
                  </Button>
                </div>
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Établissement</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Fin d'abonnement</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const isExpired = (p.plan === 'expired') || (typeof p.subscriptionEndsAt === 'number' ? p.subscriptionEndsAt < now : false);
                    const status = p.plan === 'active' && !isExpired ? 'active' : p.plan === 'trial' ? 'trial' : 'expired';
                    return (
                      <TableRow key={p.uid}>
                        <TableCell>
                          <input type="checkbox" checked={selectedUids.has(p.uid)} onChange={() => toggleSelect(p.uid)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{p.ownerName || p.email}</span>
                            <span className="text-xs text-muted-foreground">{p.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>{p.establishmentName || "—"}</TableCell>
                        <TableCell>
                          {status === 'active' && <Badge className="bg-green-100 text-green-700" variant="secondary">Actif</Badge>}
                          {status === 'trial' && <Badge className="bg-amber-100 text-amber-700" variant="secondary">Essai</Badge>}
                          {status === 'expired' && <Badge className="bg-red-100 text-red-700" variant="secondary">Expiré</Badge>}
                        </TableCell>
                        <TableCell>
                          {p.subscriptionEndsAt ? (
                            <div className="flex flex-col">
                              <span>{new Date(p.subscriptionEndsAt).toLocaleDateString()}</span>
                              {p.plan === 'active' && p.subscriptionEndsAt > now && (
                                <span className={`text-xs ${((p.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000)) > 30 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                                  {Math.floor((p.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000))} jours restants
                                  {((p.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000)) > 30 && (
                                    <span className="ml-1 text-red-500">⚠️ Anormal</span>
                                  )}
                                </span>
                              )}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end flex-wrap">
                            {p.plan === 'active' && p.subscriptionEndsAt && p.subscriptionEndsAt > now && 
                             ((p.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000)) > 30 && (
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                onClick={() => fixAbnormalSubscription(p.uid)}
                                title="Corriger l'abonnement anormal"
                              >
                                <Wrench size={14} className="mr-1"/> Corriger
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => activateForDays(p.uid, activationDays)}>
                              <Gift size={14} className="mr-2"/> Activer {activationDays} j
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => navigate(`/admin/client/${p.uid}`)}
                              title="Voir les détails du client"
                            >
                              <Eye size={14} className="mr-2"/> Voir
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => handleDeleteClient(p.uid, p.establishmentName || p.ownerName || p.email || 'Client')}
                              disabled={deletingUid === p.uid}
                              title="Supprimer le client"
                            >
                              {deletingUid === p.uid ? (
                                <>...</>
                              ) : (
                                <>
                                  <Trash2 size={14} className="mr-2"/> Supprimer
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard size={18}/> Liste des paiements
                </CardTitle>
                <CardDescription>Tous les paiements d'abonnement complétés</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadAllPayments} disabled={isLoadingPayments}>
                {isLoadingPayments ? "Chargement..." : "Actualiser"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingPayments ? (
              <div className="text-center py-8 text-muted-foreground">Chargement des paiements...</div>
            ) : allPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Aucun paiement trouvé</div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Méthode</TableHead>
                      <TableHead>Date de paiement</TableHead>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Référence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPayments.map((payment) => (
                      <TableRow key={`${payment.userId}-${payment.id}`}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{payment.userName || payment.userEmail || payment.userId}</span>
                            {payment.userEmail && payment.userName && (
                              <span className="text-xs text-muted-foreground">{payment.userEmail}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {payment.subscriptionType === 'transition-pro-max' ? 'Pro Max' : 'Transition'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">{payment.amount?.toLocaleString() || 'N/A'} XAF</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {payment.paymentMethod === 'airtel-money' ? 'Airtel Money' : 
                             payment.paymentMethod === 'moov-money' ? 'Moov Money' : 
                             payment.paymentMethod || 'Autre'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {payment.paidAt ? new Date(payment.paidAt).toLocaleString('fr-FR') : 
                           payment.createdAt ? new Date(payment.createdAt).toLocaleString('fr-FR') : 
                           'N/A'}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground">
                            {payment.transactionId || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {payment.reference || 'N/A'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {allPayments.length > 0 && (
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>Total: {allPayments.length} paiement(s)</span>
                <span>
                  Total montant: {allPayments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()} XAF
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données du client ({clientToDelete?.name}) seront supprimées définitivement.
              <br /><br />
              <strong>Attention :</strong> Cette action supprimera également tous les produits, commandes, ventes et autres données associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false);
              setClientToDelete(null);
            }}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteClient}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {deletingUid ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard; 