import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { AlertCircle, Bell, CheckCircle, Clock, Gift, Search, Users, Wrench, CreditCard, Download, Package, ShoppingCart, Calendar, QrCode, Star, TrendingUp, Eye, Trash2, Settings, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SUBSCRIPTION_PLANS, type SubscriptionFeatures } from "@/utils/subscription";

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
  const [searchParams] = useSearchParams();
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "trial" | "active" | "expired">("all");
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [notif, setNotif] = useState<NotificationForm>({ title: "", message: "", type: "info", target: "all" });
  const [activationDays, setActivationDays] = useState<number>(30);
  const [activationType, setActivationType] = useState<'transition' | 'transition-pro-max'>('transition');
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
  const [showChangeSubscriptionDialog, setShowChangeSubscriptionDialog] = useState(false);
  const [userToChangeSubscription, setUserToChangeSubscription] = useState<{ uid: string; name: string; currentType?: 'transition' | 'transition-pro-max' } | null>(null);
  const [newSubscriptionType, setNewSubscriptionType] = useState<'transition' | 'transition-pro-max'>('transition-pro-max');
  
  // États pour les données détaillées
  const [allProducts, setAllProducts] = useState<Array<{ id: string; name: string; category: string; price: number; quantity: number; userId: string; userName?: string; establishmentName?: string }>>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [allOrders, setAllOrders] = useState<Array<{ id: string; orderNumber: number; tableNumber: string; total: number; status: string; createdAt: number; userId: string; userName?: string; establishmentName?: string }>>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [allEvents, setAllEvents] = useState<Array<{ id: string; title: string; date: string; time: string; location: string; maxCapacity: number; ticketPrice: number; ticketsSold: number; userId: string; userName?: string; establishmentName?: string }>>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [allRatings, setAllRatings] = useState<Array<{ productId: string; productName: string; rating: number; ratingCount: number; userId: string; userName?: string; establishmentName?: string }>>([]);
  const [isLoadingRatings, setIsLoadingRatings] = useState(false);
  
  // Initialiser activeView depuis l'URL ou par défaut "menu"
  const viewParam = searchParams.get('view');
  const initialView = (viewParam && ['menu', 'users', 'products', 'events', 'orders', 'ratings', 'subscriptions', 'notifications'].includes(viewParam)) 
    ? viewParam as typeof activeView 
    : 'menu';
  const [activeView, setActiveView] = useState<"menu" | "users" | "products" | "events" | "orders" | "ratings" | "subscriptions" | "notifications">(initialView);
  const [isSendingNotifications, setIsSendingNotifications] = useState(false);
  const [subscriptionPlans, setSubscriptionPlans] = useState(SUBSCRIPTION_PLANS);
  const [editingPlan, setEditingPlan] = useState<"transition" | "transition-pro-max" | null>(null);
  const [planFeatures, setPlanFeatures] = useState<SubscriptionFeatures>({
    products: true,
    sales: true,
    stock: true,
    reports: true,
    team: false,
    barConnectee: false,
    events: false,
  });

  // Mettre à jour activeView quand l'URL change
  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam && ['menu', 'users', 'products', 'events', 'orders', 'ratings', 'subscriptions', 'notifications'].includes(viewParam)) {
      setActiveView(viewParam as typeof activeView);
    }
  }, [searchParams]);

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

  const loadAllProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const products: Array<{ id: string; name: string; category: string; price: number; quantity: number; userId: string; userName?: string; establishmentName?: string }> = [];
      
      for (const profile of allProfiles) {
        try {
          const productsRef = productsColRef(db, profile.uid);
          const productsSnap = await getDocs(productsRef);
          
          productsSnap.forEach(doc => {
            const data = doc.data();
            products.push({
              id: doc.id,
              name: data.name || '',
              category: data.category || '',
              price: Number(data.price || 0),
              quantity: Number(data.quantity || 0),
              userId: profile.uid,
              userName: profile.ownerName,
              establishmentName: profile.establishmentName,
            });
          });
        } catch (error) {
          console.error(`Erreur chargement produits pour ${profile.uid}:`, error);
        }
      }
      
      setAllProducts(products);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      toast({ title: "Erreur", description: "Impossible de charger les produits", variant: "destructive" });
    } finally {
      setIsLoadingProducts(false);
    }
  }, [allProfiles, toast]);

  const loadAllOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const orders: Array<{ id: string; orderNumber: number; tableNumber: string; total: number; status: string; createdAt: number; userId: string; userName?: string; establishmentName?: string }> = [];
      
      for (const profile of allProfiles) {
        try {
          // Commandes normales
          const ordersRef = ordersColRef(db, profile.uid);
          const ordersSnap = await getDocs(ordersRef);
          
          ordersSnap.forEach(doc => {
            const data = doc.data();
            orders.push({
              id: doc.id,
              orderNumber: data.orderNumber || 0,
              tableNumber: data.tableNumber || '',
              total: Number(data.total || 0),
              status: data.status || 'pending',
              createdAt: data.createdAt || Date.now(),
              userId: profile.uid,
              userName: profile.ownerName,
              establishmentName: profile.establishmentName,
            });
          });

          // Commandes Bar Connectée
          const barOrdersRef = collection(db, `profiles/${profile.uid}/barOrders`);
          const barOrdersSnap = await getDocs(barOrdersRef);
          
          barOrdersSnap.forEach(doc => {
            const data = doc.data();
            orders.push({
              id: doc.id,
              orderNumber: data.orderNumber || 0,
              tableNumber: data.tableNumber || data.tableName || '',
              total: Number(data.total || 0),
              status: data.status || 'pending',
              createdAt: data.createdAt || Date.now(),
              userId: profile.uid,
              userName: profile.ownerName,
              establishmentName: profile.establishmentName,
            });
          });
        } catch (error) {
          console.error(`Erreur chargement commandes pour ${profile.uid}:`, error);
        }
      }
      
      // Trier par date (plus récent en premier)
      orders.sort((a, b) => b.createdAt - a.createdAt);
      setAllOrders(orders);
    } catch (error) {
      console.error('Erreur chargement commandes:', error);
      toast({ title: "Erreur", description: "Impossible de charger les commandes", variant: "destructive" });
    } finally {
      setIsLoadingOrders(false);
    }
  }, [allProfiles, toast]);

  const loadAllEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const events: Array<{ id: string; title: string; date: string; time: string; location: string; maxCapacity: number; ticketPrice: number; ticketsSold: number; userId: string; userName?: string; establishmentName?: string }> = [];
      
      for (const profile of allProfiles) {
        try {
          const eventsRef = eventsColRef(db, profile.uid);
          const eventsSnap = await getDocs(eventsRef);
          
          eventsSnap.forEach(doc => {
            const data = doc.data();
            events.push({
              id: doc.id,
              title: data.title || '',
              date: data.date || '',
              time: data.time || '',
              location: data.location || '',
              maxCapacity: Number(data.maxCapacity || 0),
              ticketPrice: Number(data.ticketPrice || 0),
              ticketsSold: Number(data.ticketsSold || 0),
              userId: profile.uid,
              userName: profile.ownerName,
              establishmentName: profile.establishmentName,
            });
          });
        } catch (error) {
          console.error(`Erreur chargement événements pour ${profile.uid}:`, error);
        }
      }
      
      // Trier par date (plus récent en premier)
      events.sort((a, b) => {
        const dateA = new Date(a.date + ' ' + a.time).getTime();
        const dateB = new Date(b.date + ' ' + b.time).getTime();
        return dateB - dateA;
      });
      setAllEvents(events);
    } catch (error) {
      console.error('Erreur chargement événements:', error);
      toast({ title: "Erreur", description: "Impossible de charger les événements", variant: "destructive" });
    } finally {
      setIsLoadingEvents(false);
    }
  }, [allProfiles, toast]);

  const loadAllRatings = useCallback(async () => {
    setIsLoadingRatings(true);
    try {
      const ratings: Array<{ productId: string; productName: string; rating: number; ratingCount: number; userId: string; userName?: string; establishmentName?: string }> = [];
      
      for (const profile of allProfiles) {
        try {
          const productsRef = productsColRef(db, profile.uid);
          const productsSnap = await getDocs(productsRef);
          
          productsSnap.forEach(doc => {
            const data = doc.data();
            if (data.ratingCount && data.ratingCount > 0) {
              ratings.push({
                productId: doc.id,
                productName: data.name || '',
                rating: Number(data.rating || 0),
                ratingCount: Number(data.ratingCount || 0),
                userId: profile.uid,
                userName: profile.ownerName,
                establishmentName: profile.establishmentName,
              });
            }
          });
        } catch (error) {
          console.error(`Erreur chargement appréciations pour ${profile.uid}:`, error);
        }
      }
      
      // Trier par nombre d'avis (plus d'avis en premier)
      ratings.sort((a, b) => b.ratingCount - a.ratingCount);
      setAllRatings(ratings);
    } catch (error) {
      console.error('Erreur chargement appréciations:', error);
      toast({ title: "Erreur", description: "Impossible de charger les appréciations", variant: "destructive" });
    } finally {
      setIsLoadingRatings(false);
    }
  }, [allProfiles, toast]);

  useEffect(() => {
    if (isAdmin && allProfiles.length > 0) {
      loadAllPayments();
      loadGlobalStats();
      loadAllProducts();
      loadAllOrders();
      loadAllEvents();
      loadAllRatings();
    }
  }, [isAdmin, allProfiles.length, loadAllPayments, loadGlobalStats, loadAllProducts, loadAllOrders, loadAllEvents, loadAllRatings]);

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
    const active = allProfiles.filter(p => {
      if (p.plan !== "active") return false;
      if (typeof p.subscriptionEndsAt === 'number' && p.subscriptionEndsAt <= now) return false;
      // Seulement compter les abonnements de 30 jours pour les revenus
      if (p.subscriptionEndsAt && typeof p.subscriptionEndsAt === 'number') {
        const daysRemaining = (p.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000);
        // Compter seulement si c'est exactement 30 jours (ou proche, avec une marge de 1 jour)
        return daysRemaining >= 29 && daysRemaining <= 31;
      }
      return true;
    }).length;
    const trial = allProfiles.filter(p => (p.plan || "trial") === "trial").length;
    const expired = total - active - trial;
    
    // Calculer les revenus basés sur les abonnements actifs de 30 jours
    let monthlyRevenue = 0;
    allProfiles.forEach(p => {
      if (p.plan === "active" && p.subscriptionEndsAt && typeof p.subscriptionEndsAt === 'number' && p.subscriptionEndsAt > now) {
        const daysRemaining = (p.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000);
        // Seulement si c'est un abonnement de 30 jours
        if (daysRemaining >= 29 && daysRemaining <= 31) {
          const planType = p.subscriptionType || 'transition';
          const planPrice = subscriptionPlans[planType]?.price || 2500;
          monthlyRevenue += planPrice;
        }
      }
    });
    
    return { total, active, trial, expired, monthly: monthlyRevenue };
  }, [allProfiles, now, subscriptionPlans]);

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

    setIsSendingNotifications(true);
    const createdAt = Date.now();
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      for (const uid of uids) {
        try {
          const notificationRef = notificationsColRef(db, uid);
          await addDoc(notificationRef, {
            title: notif.title.trim(),
            message: notif.message.trim(),
            type: notif.type,
            createdAt,
            read: false,
          });
          successCount++;
        } catch (error: unknown) {
          console.error(`Erreur envoi notification à ${uid}:`, error);
          errorCount++;
          const message = error instanceof Error ? error.message : 'Erreur inconnue';
          errors.push(`UID ${uid}: ${message}`);
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
          description: `Aucune notification n'a pu être envoyée. Erreurs: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`, 
          variant: "destructive" 
        });
      }
    } catch (error: unknown) {
      console.error('Erreur générale envoi notifications:', error);
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast({ 
        title: "Erreur", 
        description: `Erreur lors de l'envoi: ${message}`, 
        variant: "destructive" 
      });
    } finally {
      setIsSendingNotifications(false);
    }
  };

  const activateForDays = async (uid: string, days: number, subscriptionType: 'transition' | 'transition-pro-max' = 'transition') => {
    const ms = Math.max(1, days) * 24 * 60 * 60 * 1000;
    const until = Date.now() + ms;
    try {
      const updateData: {
        plan: 'active';
        subscriptionEndsAt: number;
        subscriptionType: 'transition' | 'transition-pro-max';
        updatedAt: number;
        lastPaymentAt?: number;
      } = {
        plan: 'active',
        subscriptionEndsAt: until,
        subscriptionType,
        updatedAt: Date.now(),
      };
      
      // Si c'est un abonnement de 30 jours, enregistrer le paiement pour les revenus
      if (days === 30) {
        updateData.lastPaymentAt = Date.now();
      }
      
      await updateDoc(doc(db, "profiles", uid), updateData);
      toast({ title: "Succès", description: `Abonnement ${subscriptionType === 'transition-pro-max' ? 'Pro Max' : 'Transition'} activé pour ${days} jours` });
    } catch (error) {
      console.error('Erreur activation abonnement:', error);
      toast({ title: "Erreur", description: "Impossible d'activer l'abonnement", variant: "destructive" });
    }
  };

  const changeSubscriptionType = async (uid: string, newType: 'transition' | 'transition-pro-max') => {
    try {
      const profile = allProfiles.find(p => p.uid === uid);
      if (!profile) {
        toast({ title: "Erreur", description: "Utilisateur non trouvé", variant: "destructive" });
        return;
      }

      // Si l'utilisateur n'a pas d'abonnement actif, on ne peut pas changer le type
      if (profile.plan !== 'active' || !profile.subscriptionEndsAt || profile.subscriptionEndsAt < Date.now()) {
        toast({ 
          title: "Erreur", 
          description: "L'utilisateur doit avoir un abonnement actif pour changer de type", 
          variant: "destructive" 
        });
        return;
      }

      const updateData: {
        subscriptionType: 'transition' | 'transition-pro-max';
        updatedAt: number;
        eventsResetAt?: number;
        eventsCount?: number;
      } = {
        subscriptionType: newType,
        updatedAt: Date.now(),
      };

      // Si on passe à Pro Max, réinitialiser le compteur d'événements si nécessaire
      if (newType === 'transition-pro-max' && profile.subscriptionEndsAt) {
        const now = Date.now();
        const eventsResetAt = profile.eventsResetAt ?? profile.subscriptionEndsAt;
        if (!eventsResetAt || now > eventsResetAt) {
          // Réinitialiser le compteur d'événements
          updateData.eventsResetAt = profile.subscriptionEndsAt;
          updateData.eventsCount = 0;
        }
      }

      await updateDoc(doc(db, "profiles", uid), updateData);
      toast({ 
        title: "Succès", 
        description: `Type d'abonnement changé vers ${newType === 'transition-pro-max' ? 'Transition Pro Max' : 'Transition'}. L'utilisateur a maintenant accès à toutes les fonctionnalités de ce plan.` 
      });
      setShowChangeSubscriptionDialog(false);
      setUserToChangeSubscription(null);
    } catch (error) {
      console.error('Erreur changement type abonnement:', error);
      toast({ title: "Erreur", description: "Impossible de changer le type d'abonnement", variant: "destructive" });
    }
  };

  const openChangeSubscriptionDialog = (profile: UserProfile) => {
    if (profile.plan !== 'active' || !profile.subscriptionEndsAt || profile.subscriptionEndsAt < Date.now()) {
      toast({ 
        title: "Information", 
        description: "L'utilisateur doit avoir un abonnement actif pour changer de type" 
      });
      return;
    }
    setUserToChangeSubscription({
      uid: profile.uid,
      name: profile.ownerName || profile.establishmentName || profile.email,
      currentType: profile.subscriptionType || 'transition',
    });
    setNewSubscriptionType(profile.subscriptionType || 'transition');
    setShowChangeSubscriptionDialog(true);
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
      const updateData: {
        subscriptionEndsAt: number;
        plan: 'active';
        updatedAt: number;
        lastPaymentAt?: number;
      } = {
        subscriptionEndsAt: newEndDate,
        plan: 'active',
        updatedAt: now,
      };
      
      // Si on ajoute exactement 30 jours et que le total fait 30 jours, enregistrer le paiement
      if (days === 30 && newDaysRemaining >= 29 && newDaysRemaining <= 31) {
        updateData.lastPaymentAt = now;
      }
      
      await updateDoc(doc(db, "profiles", profile.uid), updateData);
      toast({ 
        title: "Abonnement prolongé", 
        description: `${email}: +${days} jour(s) ajouté(s). Nouveaux jours restants: ${Math.floor(newDaysRemaining)}` 
      });
    } catch (error) {
      console.error('Erreur prolongation abonnement:', error);
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

  const saveSubscriptionPlan = () => {
    if (!editingPlan) return;
    
    const updatedPlans = { ...subscriptionPlans };
    if (editingPlan === 'transition') {
      updatedPlans.transition = {
        ...updatedPlans.transition,
        features: { ...planFeatures },
      };
    } else if (editingPlan === 'transition-pro-max') {
      updatedPlans['transition-pro-max'] = {
        ...updatedPlans['transition-pro-max'],
        features: { ...planFeatures },
      };
    }
    setSubscriptionPlans(updatedPlans);
    setEditingPlan(null);
    toast({ title: "Succès", description: `Plan ${editingPlan} mis à jour` });
  };

  const openEditPlan = (planKey: "transition" | "transition-pro-max") => {
    setEditingPlan(planKey);
    setPlanFeatures({ ...subscriptionPlans[planKey].features });
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

  // Vue Menu Principal avec de gros boutons
  const renderMenuView = () => (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Administration Nack</h1>
        <p className="text-muted-foreground">Gestion complète de la plateforme</p>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users size={16} className="text-blue-600"/> Utilisateurs
            </CardTitle>
            <CardDescription>Total inscrits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.active} actifs • {stats.trial} essais • {stats.expired} expirés
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package size={16} className="text-purple-600"/> Produits
            </CardTitle>
            <CardDescription>Total produits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoadingGlobalStats ? "..." : globalStats.totalProducts.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingCart size={16} className="text-green-600"/> Commandes
            </CardTitle>
            <CardDescription>Total commandes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoadingGlobalStats ? "..." : (globalStats.totalOrders + globalStats.totalBarOrders).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star size={16} className="text-yellow-600"/> Appréciations
            </CardTitle>
            <CardDescription>Note moyenne</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoadingGlobalStats ? "..." : globalStats.avgRating > 0 ? globalStats.avgRating.toFixed(1) : "0.0"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {globalStats.totalRatings} avis
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Boutons principaux */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
        <button
          onClick={() => navigate('/admin?view=users')}
          className="relative flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
        >
          <Users size={48} className="text-blue-600 transition-transform group-hover:scale-110" />
          <h2 className="text-lg font-semibold text-gray-900">Utilisateurs</h2>
          <p className="text-sm text-muted-foreground">{stats.total} total</p>
        </button>
        <button
          onClick={() => navigate('/admin?view=products')}
          className="relative flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
        >
          <Package size={48} className="text-purple-600 transition-transform group-hover:scale-110" />
          <h2 className="text-lg font-semibold text-gray-900">Produits</h2>
          <p className="text-sm text-muted-foreground">{globalStats.totalProducts} total</p>
        </button>
        <button
          onClick={() => navigate('/admin?view=orders')}
          className="relative flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
        >
          <ShoppingCart size={48} className="text-green-600 transition-transform group-hover:scale-110" />
          <h2 className="text-lg font-semibold text-gray-900">Commandes</h2>
          <p className="text-sm text-muted-foreground">{(globalStats.totalOrders + globalStats.totalBarOrders).toLocaleString()} total</p>
        </button>
        <button
          onClick={() => navigate('/admin?view=events')}
          className="relative flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
        >
          <Calendar size={48} className="text-orange-600 transition-transform group-hover:scale-110" />
          <h2 className="text-lg font-semibold text-gray-900">Événements</h2>
          <p className="text-sm text-muted-foreground">{globalStats.totalEvents} total</p>
        </button>
        <button
          onClick={() => navigate('/admin?view=ratings')}
          className="relative flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
        >
          <Star size={48} className="text-yellow-600 transition-transform group-hover:scale-110" />
          <h2 className="text-lg font-semibold text-gray-900">Appréciations</h2>
          <p className="text-sm text-muted-foreground">{globalStats.totalRatings} avis</p>
        </button>
        <button
          onClick={() => navigate('/admin?view=subscriptions')}
          className="relative flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
        >
          <CreditCard size={48} className="text-indigo-600 transition-transform group-hover:scale-110" />
          <h2 className="text-lg font-semibold text-gray-900">Abonnements</h2>
          <p className="text-sm text-muted-foreground">2 plans</p>
        </button>
        <button
          onClick={() => navigate('/admin?view=notifications')}
          className="relative flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
        >
          <Bell size={48} className="text-red-600 transition-transform group-hover:scale-110" />
          <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          <p className="text-sm text-muted-foreground">Envoyer</p>
        </button>
      </div>

      {/* Revenus estimés */}
      <Card className="border-0 shadow-card mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={20} className="text-green-600"/> Revenus estimés
          </CardTitle>
          <CardDescription>Basé sur les abonnements actifs de 30 jours</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            ≈ {stats.monthly.toLocaleString()} XAF/mois
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Vue Utilisateurs
  const renderUsersView = () => (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-check')}>
          <ArrowLeft size={16} className="mr-2"/> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">Gérer les utilisateurs et leurs abonnements</p>
        </div>
      </div>
      
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle>Utilisateurs</CardTitle>
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
              <Input type="number" className="w-28" min={1} value={activationDays} onChange={e => setActivationDays(Number(e.target.value || 0))} />
              <Select value={activationType} onValueChange={(v) => setActivationType(v as 'transition' | 'transition-pro-max')}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transition">Transition (2500 XAF)</SelectItem>
                  <SelectItem value="transition-pro-max">Pro Max (7500 XAF)</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={async () => {
                const uids = Array.from(selectedUids);
                for (const uid of uids) await activateForDays(uid, activationDays, activationType);
              }}><Gift size={16} className="mr-2"/>Activer {activationDays} j</Button>
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
                        <div className="flex flex-col gap-1">
                          {status === 'active' && <Badge className="bg-green-100 text-green-700" variant="secondary">Actif</Badge>}
                          {status === 'trial' && <Badge className="bg-amber-100 text-amber-700" variant="secondary">Essai</Badge>}
                          {status === 'expired' && <Badge className="bg-red-100 text-red-700" variant="secondary">Expiré</Badge>}
                          {status === 'active' && p.subscriptionType && (
                            <Badge className="bg-blue-100 text-blue-700 text-xs" variant="secondary">
                              {p.subscriptionType === 'transition-pro-max' ? 'Pro Max' : 'Transition'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.subscriptionEndsAt ? (
                          <div className="flex flex-col">
                            <span>{new Date(p.subscriptionEndsAt).toLocaleDateString()}</span>
                            {p.plan === 'active' && p.subscriptionEndsAt > now && (
                              <span className="text-xs text-muted-foreground">
                                {Math.floor((p.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000))} jours restants
                              </span>
                            )}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end flex-wrap">
                          {status === 'active' && p.subscriptionType && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => openChangeSubscriptionDialog(p)}
                              title="Changer le type d'abonnement"
                            >
                              <Settings size={14} className="mr-2"/> Changer plan
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => activateForDays(p.uid, activationDays, activationType)}>
                            <Gift size={14} className="mr-2"/> Activer {activationDays} j ({activationType === 'transition' ? '2500 XAF' : '7500 XAF'})
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
    </div>
  );

  // Vue Produits
  const renderProductsView = () => (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-check')}>
          <ArrowLeft size={16} className="mr-2"/> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Produits</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble des produits de tous les utilisateurs ({allProducts.length} total)</p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={loadAllProducts} disabled={isLoadingProducts}>
            {isLoadingProducts ? "Chargement..." : "Actualiser"}
          </Button>
        </div>
      </div>
      <Card className="border-0 shadow-card">
        <CardContent>
          {isLoadingProducts ? (
            <div className="text-center py-8 text-muted-foreground">Chargement des produits...</div>
          ) : allProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Aucun produit trouvé</div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Établissement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allProducts.map((product) => (
                    <TableRow key={`${product.userId}-${product.id}`}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell><Badge variant="secondary">{product.category}</Badge></TableCell>
                      <TableCell>{product.price.toLocaleString()} XAF</TableCell>
                      <TableCell>{product.quantity}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{product.establishmentName || product.userName || 'N/A'}</span>
                          {product.userName && product.establishmentName && (
                            <span className="text-xs text-muted-foreground">{product.userName}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Vue Commandes
  const renderOrdersView = () => (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-check')}>
          <ArrowLeft size={16} className="mr-2"/> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Commandes</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble des commandes de tous les utilisateurs ({allOrders.length} total)</p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={loadAllOrders} disabled={isLoadingOrders}>
            {isLoadingOrders ? "Chargement..." : "Actualiser"}
          </Button>
        </div>
      </div>
      <Card className="border-0 shadow-card">
        <CardContent>
          {isLoadingOrders ? (
            <div className="text-center py-8 text-muted-foreground">Chargement des commandes...</div>
          ) : allOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Aucune commande trouvée</div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Commande</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Établissement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allOrders.map((order) => (
                    <TableRow key={`${order.userId}-${order.id}`}>
                      <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                      <TableCell>{order.tableNumber}</TableCell>
                      <TableCell className="font-semibold">{order.total.toLocaleString()} XAF</TableCell>
                      <TableCell>
                        {order.status === 'pending' && <Badge className="bg-amber-100 text-amber-700" variant="secondary">En attente</Badge>}
                        {order.status === 'sent' && <Badge className="bg-green-100 text-green-700" variant="secondary">Envoyée</Badge>}
                        {order.status === 'cancelled' && <Badge className="bg-red-100 text-red-700" variant="secondary">Annulée</Badge>}
                        {!['pending', 'sent', 'cancelled'].includes(order.status) && <Badge variant="secondary">{order.status}</Badge>}
                      </TableCell>
                      <TableCell>{new Date(order.createdAt).toLocaleString('fr-FR')}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{order.establishmentName || order.userName || 'N/A'}</span>
                          {order.userName && order.establishmentName && (
                            <span className="text-xs text-muted-foreground">{order.userName}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Vue Événements
  const renderEventsView = () => (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-check')}>
          <ArrowLeft size={16} className="mr-2"/> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Événements</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble des événements de tous les utilisateurs ({allEvents.length} total)</p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={loadAllEvents} disabled={isLoadingEvents}>
            {isLoadingEvents ? "Chargement..." : "Actualiser"}
          </Button>
        </div>
      </div>
      <Card className="border-0 shadow-card">
        <CardContent>
          {isLoadingEvents ? (
            <div className="text-center py-8 text-muted-foreground">Chargement des événements...</div>
          ) : allEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Aucun événement trouvé</div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Heure</TableHead>
                    <TableHead>Lieu</TableHead>
                    <TableHead>Capacité</TableHead>
                    <TableHead>Billets vendus</TableHead>
                    <TableHead>Prix billet</TableHead>
                    <TableHead>Établissement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allEvents.map((event) => (
                    <TableRow key={`${event.userId}-${event.id}`}>
                      <TableCell className="font-medium">{event.title}</TableCell>
                      <TableCell>{new Date(event.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{event.time}</TableCell>
                      <TableCell>{event.location}</TableCell>
                      <TableCell>{event.maxCapacity}</TableCell>
                      <TableCell>
                        <Badge variant={event.ticketsSold >= event.maxCapacity ? "destructive" : "secondary"}>
                          {event.ticketsSold}/{event.maxCapacity}
                        </Badge>
                      </TableCell>
                      <TableCell>{event.ticketPrice.toLocaleString()} XAF</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{event.establishmentName || event.userName || 'N/A'}</span>
                          {event.userName && event.establishmentName && (
                            <span className="text-xs text-muted-foreground">{event.userName}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Vue Appréciations
  const renderRatingsView = () => (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-check')}>
          <ArrowLeft size={16} className="mr-2"/> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Appréciations</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble des appréciations de tous les utilisateurs ({allRatings.length} produits notés)</p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={loadAllRatings} disabled={isLoadingRatings}>
            {isLoadingRatings ? "Chargement..." : "Actualiser"}
          </Button>
        </div>
      </div>
      <Card className="border-0 shadow-card">
        <CardContent>
          {isLoadingRatings ? (
            <div className="text-center py-8 text-muted-foreground">Chargement des appréciations...</div>
          ) : allRatings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Aucune appréciation trouvée</div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Nombre d'avis</TableHead>
                    <TableHead>Établissement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allRatings.map((rating) => (
                    <TableRow key={`${rating.userId}-${rating.productId}`}>
                      <TableCell className="font-medium">{rating.productName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Star size={16} className="text-yellow-500 fill-yellow-500" />
                          <span className="font-semibold">{rating.rating.toFixed(1)}/5</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{rating.ratingCount} avis</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{rating.establishmentName || rating.userName || 'N/A'}</span>
                          {rating.userName && rating.establishmentName && (
                            <span className="text-xs text-muted-foreground">{rating.userName}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Vue Abonnements
  const renderSubscriptionsView = () => (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-check')}>
          <ArrowLeft size={16} className="mr-2"/> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Abonnements</h1>
          <p className="text-sm text-muted-foreground">Gérer les plans d'abonnement</p>
        </div>
      </div>
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle>Plans d'abonnement</CardTitle>
          <CardDescription>Modifier les fonctionnalités des plans</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(subscriptionPlans).map(([key, plan]) => (
            <Card key={key} className="border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  <Badge>{plan.price.toLocaleString()} XAF/mois</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(plan.features).map(([feature, enabled]) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Checkbox checked={enabled} disabled />
                      <Label>{feature}</Label>
                    </div>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => openEditPlan(key as "transition" | "transition-pro-max")}
                >
                  <Settings size={16} className="mr-2" />
                  Modifier
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {editingPlan && (
        <Card className="border-0 shadow-card mt-4">
          <CardHeader>
            <CardTitle>Modifier {subscriptionPlans[editingPlan].name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(planFeatures).map(([feature, enabled]) => (
              <div key={feature} className="flex items-center gap-2">
                <Checkbox 
                  checked={enabled} 
                  onCheckedChange={(checked) => 
                    setPlanFeatures({ ...planFeatures, [feature]: checked as boolean })
                  }
                />
                <Label>{feature}</Label>
              </div>
            ))}
            <div className="flex gap-2">
              <Button onClick={saveSubscriptionPlan}>Enregistrer</Button>
              <Button variant="outline" onClick={() => setEditingPlan(null)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Vue Notifications
  const renderNotificationsView = () => (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-check')}>
          <ArrowLeft size={16} className="mr-2"/> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">Envoyer des notifications aux utilisateurs</p>
        </div>
      </div>
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle>Envoyer une notification</CardTitle>
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
            <Button onClick={sendNotifications} disabled={isSendingNotifications} className="w-full">
              {isSendingNotifications ? "Envoi..." : "Envoyer"}
            </Button>
          </div>
          <Input placeholder="Message" value={notif.message} onChange={e => setNotif({ ...notif, message: e.target.value })} />
        </CardContent>
      </Card>
    </div>
  );

  // Rendu principal
  return (
    <div className="min-h-screen bg-gradient-secondary">
      {activeView === "menu" && renderMenuView()}
      {activeView === "users" && renderUsersView()}
      {activeView === "products" && renderProductsView()}
      {activeView === "orders" && renderOrdersView()}
      {activeView === "events" && renderEventsView()}
      {activeView === "ratings" && renderRatingsView()}
      {activeView === "subscriptions" && renderSubscriptionsView()}
      {activeView === "notifications" && renderNotificationsView()}

      {/* Dialog de changement de type d'abonnement */}
      <Dialog open={showChangeSubscriptionDialog} onOpenChange={setShowChangeSubscriptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le type d'abonnement</DialogTitle>
            <DialogDescription>
              Changer le type d'abonnement pour {userToChangeSubscription?.name}
              <br />
              <span className="text-xs text-muted-foreground">
                Type actuel: <strong>{userToChangeSubscription?.currentType === 'transition-pro-max' ? 'Transition Pro Max' : 'Transition'}</strong>
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nouveau type d'abonnement</Label>
              <Select value={newSubscriptionType} onValueChange={(v) => setNewSubscriptionType(v as 'transition' | 'transition-pro-max')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transition">
                    <div className="flex flex-col">
                      <span className="font-medium">Transition (2500 XAF)</span>
                      <span className="text-xs text-muted-foreground">Produits, Ventes, Stock, Rapports</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="transition-pro-max">
                    <div className="flex flex-col">
                      <span className="font-medium">Transition Pro Max (7500 XAF)</span>
                      <span className="text-xs text-muted-foreground">Toutes les fonctionnalités : Équipe, Bar Connectée, Événements</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newSubscriptionType === 'transition-pro-max' && (
              <div className="rounded-lg bg-green-50 p-3 border border-green-200">
                <p className="text-sm font-medium text-green-900 mb-1">✓ Accès à toutes les fonctionnalités</p>
                <ul className="text-xs text-green-800 space-y-1 list-disc list-inside">
                  <li>Gestion des équipiers</li>
                  <li>Bar Connectée</li>
                  <li>Création d'événements (5 inclus par période)</li>
                </ul>
              </div>
            )}
            {newSubscriptionType === 'transition' && (
              <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
                <p className="text-sm font-medium text-amber-900 mb-1">⚠ Fonctionnalités limitées</p>
                <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                  <li>Pas d'accès à la gestion des équipiers</li>
                  <li>Pas d'accès à la Bar Connectée</li>
                  <li>Pas de création d'événements</li>
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              La date d'expiration de l'abonnement restera inchangée. Seul le type d'abonnement sera modifié.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowChangeSubscriptionDialog(false);
              setUserToChangeSubscription(null);
            }}>
              Annuler
            </Button>
            <Button 
              onClick={() => {
                if (userToChangeSubscription) {
                  changeSubscriptionType(userToChangeSubscription.uid, newSubscriptionType);
                }
              }}
              disabled={newSubscriptionType === userToChangeSubscription?.currentType}
            >
              Confirmer le changement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              disabled={deletingUid !== null}
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