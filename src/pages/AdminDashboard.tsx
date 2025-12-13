import { useCallback, useEffect, useMemo, useRef, useState } from "react"; // useRef importé
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { profilesColRef, notificationsColRef, paymentsColRef, productsColRef, ordersColRef, eventsColRef, teamColRef, subscriptionPlansColRef, subscriptionPlanDocRef, customersColRef } from "@/lib/collections";
import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc, where, collectionGroup, deleteDoc, getDoc, setDoc } from "firebase/firestore";
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
import { AlertCircle, Bell, CheckCircle, Clock, Gift, Search, Users, Wrench, CreditCard, Download, Package, ShoppingCart, Calendar, QrCode, Star, TrendingUp, Eye, Trash2, Settings, ArrowLeft, Edit, X, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SUBSCRIPTION_PLANS, type SubscriptionFeatures } from "@/utils/subscription";
import { 
  exportUsersPdf, 
  exportUsersCsv, 
  exportProductsCsv,
  exportProductsPdf,
  exportOrdersCsv,
  exportOrdersPdf,
  exportEventsCsv,
  exportEventsPdf,
  exportPaymentsCsv,
  exportPaymentsPdf,
  exportCustomersCsv,
  exportCustomersPdf
} from "@/utils/exportAdminData";

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
  const [allCustomers, setAllCustomers] = useState<Array<{
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    customerId?: string;
    loyaltyType?: string;
    status?: string;
    points?: number;
    totalPointsEarned?: number;
    totalAmountSpent?: number;
    totalOrders?: number;
    lastVisit?: Date;
    createdAt?: Date;
    userId: string;
    userName?: string;
    establishmentName?: string;
  }>>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  
  // Cache des données pour éviter qu'elles disparaissent
  const dataCacheRef = useRef<{
    products: typeof allProducts;
    orders: typeof allOrders;
    events: typeof allEvents;
    ratings: typeof allRatings;
    globalStats: typeof globalStats;
    payments: typeof allPayments;
  }>({
    products: [],
    orders: [],
    events: [],
    ratings: [],
    globalStats: {
      totalProducts: 0,
      totalOrders: 0,
      totalBarOrders: 0,
      totalEvents: 0,
      totalTeamMembers: 0,
      totalRatings: 0,
      avgRating: 0,
    },
    payments: [],
  });
  
  // États pour la gestion des éléments
  const [editingProduct, setEditingProduct] = useState<{ id: string; userId: string; name: string; category: string; price: number; quantity: number } | null>(null);
  const [editingOrder, setEditingOrder] = useState<{ id: string; userId: string; orderNumber: number; status: string } | null>(null);
  const [editingEvent, setEditingEvent] = useState<{ id: string; userId: string; title: string; date: string; time: string; location: string; maxCapacity: number; ticketPrice: number } | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  
  // Initialiser activeView depuis l'URL ou par défaut "menu"
  const viewParam = searchParams.get('view');
  const initialView = (viewParam && ['menu', 'users', 'products', 'events', 'orders', 'ratings', 'subscriptions', 'notifications', 'customers'].includes(viewParam)) 
    ? viewParam as typeof activeView 
    : 'menu';
  const [activeView, setActiveView] = useState<"menu" | "users" | "products" | "events" | "orders" | "ratings" | "subscriptions" | "notifications">(initialView);
  const [isSendingNotifications, setIsSendingNotifications] = useState(false);
  const [subscriptionPlans, setSubscriptionPlans] = useState<{
    transition: { name: string; price: number; features: SubscriptionFeatures };
    'transition-pro-max': { name: string; price: number; features: SubscriptionFeatures };
  }>(SUBSCRIPTION_PLANS);
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
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [planPrice, setPlanPrice] = useState<number>(2500);
  const [planEventsLimit, setPlanEventsLimit] = useState<number>(5);
  const [planEventsExtraPrice, setPlanEventsExtraPrice] = useState<number>(1500);

  // Mettre à jour activeView quand l'URL change
  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam && ['menu', 'users', 'products', 'events', 'orders', 'ratings', 'subscriptions', 'notifications', 'customers'].includes(viewParam)) {
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

  // Charger les plans d'abonnement depuis Firestore
  useEffect(() => {
    if (!isAdmin) return;
    const loadPlans = async () => {
      setIsLoadingPlans(true);
      try {
        const plansRef = subscriptionPlansColRef(db);
        const plansSnap = await getDocs(plansRef);
        
        const loadedPlans = {
          transition: { ...SUBSCRIPTION_PLANS.transition },
          'transition-pro-max': { ...SUBSCRIPTION_PLANS['transition-pro-max'] },
        };
        
        plansSnap.docs.forEach((docSnap) => {
          const planKey = docSnap.id;
          const planData = docSnap.data();
          if (planKey === 'transition') {
            loadedPlans.transition = {
              ...loadedPlans.transition,
              ...planData,
            } as typeof SUBSCRIPTION_PLANS.transition;
          } else if (planKey === 'transition-pro-max') {
            loadedPlans['transition-pro-max'] = {
              ...loadedPlans['transition-pro-max'],
              ...planData,
            } as typeof SUBSCRIPTION_PLANS['transition-pro-max'];
          }
        });
        
        setSubscriptionPlans(loadedPlans);
      } catch (error) {
        // En cas d'erreur (permissions, etc.), utiliser les plans par défaut
        // L'erreur est silencieuse car les plans par défaut sont toujours disponibles
        // Ne pas afficher d'erreur si c'est juste un problème de permissions non déployées
        setSubscriptionPlans(SUBSCRIPTION_PLANS);
      } finally {
        setIsLoadingPlans(false);
      }
    };
    
    loadPlans();
  }, [isAdmin]);

  const loadAllPayments = useCallback(async () => {
    if (allProfiles.length === 0) {
      // Si pas de profils, restaurer depuis le cache si disponible
      if (dataCacheRef.current.payments.length > 0 && allPayments.length === 0) {
        setAllPayments(dataCacheRef.current.payments);
      }
      setIsLoadingPayments(false);
      return;
    }
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
      dataCacheRef.current.payments = payments;
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
      toast({ title: "Erreur", description: "Impossible de charger les paiements", variant: "destructive" });
      // En cas d'erreur, restaurer depuis le cache si disponible
      if (dataCacheRef.current.payments.length > 0) {
        setAllPayments(dataCacheRef.current.payments);
      }
    } finally {
      setIsLoadingPayments(false);
    }
  }, [allProfiles, toast]);

  const loadGlobalStats = useCallback(async () => {
    if (allProfiles.length === 0) {
      // Si pas de profils, restaurer depuis le cache si disponible
      if ((dataCacheRef.current.globalStats.totalProducts > 0 || dataCacheRef.current.globalStats.totalOrders > 0) && 
          globalStats.totalProducts === 0 && globalStats.totalOrders === 0) {
        setGlobalStats(dataCacheRef.current.globalStats);
      }
      setIsLoadingGlobalStats(false);
      return;
    }
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

      const stats = {
        totalProducts,
        totalOrders,
        totalBarOrders,
        totalEvents,
        totalTeamMembers,
        totalRatings,
        avgRating: totalRatings > 0 ? sumRatings / totalRatings : 0,
      };
      setGlobalStats(stats);
      dataCacheRef.current.globalStats = stats;
    } catch (error) {
      console.error('Erreur chargement stats globales:', error);
      // En cas d'erreur, restaurer depuis le cache si disponible
      if (dataCacheRef.current.globalStats.totalProducts > 0 || dataCacheRef.current.globalStats.totalOrders > 0) {
        setGlobalStats(dataCacheRef.current.globalStats);
      }
    } finally {
      setIsLoadingGlobalStats(false);
    }
  }, [allProfiles]);

  const loadAllProducts = useCallback(async () => {
    if (allProfiles.length === 0) {
      // Si pas de profils, restaurer depuis le cache si disponible
      if (dataCacheRef.current.products.length > 0 && allProducts.length === 0) {
        setAllProducts(dataCacheRef.current.products);
      }
      setIsLoadingProducts(false);
      return;
    }
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
      dataCacheRef.current.products = products;
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      toast({ title: "Erreur", description: "Impossible de charger les produits", variant: "destructive" });
      // En cas d'erreur, restaurer depuis le cache si disponible
      if (dataCacheRef.current.products.length > 0) {
        setAllProducts(dataCacheRef.current.products);
      }
    } finally {
      setIsLoadingProducts(false);
    }
  }, [allProfiles, toast]);

  const loadAllOrders = useCallback(async () => {
    if (allProfiles.length === 0) {
      // Si pas de profils, restaurer depuis le cache si disponible
      if (dataCacheRef.current.orders.length > 0 && allOrders.length === 0) {
        setAllOrders(dataCacheRef.current.orders);
      }
      setIsLoadingOrders(false);
      return;
    }
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
      dataCacheRef.current.orders = orders;
    } catch (error) {
      console.error('Erreur chargement commandes:', error);
      toast({ title: "Erreur", description: "Impossible de charger les commandes", variant: "destructive" });
      // En cas d'erreur, restaurer depuis le cache si disponible
      if (dataCacheRef.current.orders.length > 0) {
        setAllOrders(dataCacheRef.current.orders);
      }
    } finally {
      setIsLoadingOrders(false);
    }
  }, [allProfiles, toast]);

  const loadAllEvents = useCallback(async () => {
    if (allProfiles.length === 0) {
      // Si pas de profils, restaurer depuis le cache si disponible
      if (dataCacheRef.current.events.length > 0 && allEvents.length === 0) {
        setAllEvents(dataCacheRef.current.events);
      }
      setIsLoadingEvents(false);
      return;
    }
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
      dataCacheRef.current.events = events;
    } catch (error) {
      console.error('Erreur chargement événements:', error);
      toast({ title: "Erreur", description: "Impossible de charger les événements", variant: "destructive" });
      // En cas d'erreur, restaurer depuis le cache si disponible
      if (dataCacheRef.current.events.length > 0) {
        setAllEvents(dataCacheRef.current.events);
      }
    } finally {
      setIsLoadingEvents(false);
    }
  }, [allProfiles, toast]);

  const loadAllCustomers = useCallback(async () => {
    if (allProfiles.length === 0) {
      setIsLoadingCustomers(false);
      return;
    }
    setIsLoadingCustomers(true);
    try {
      const customers: Array<{
        id: string;
        firstName: string;
        lastName: string;
        phone?: string;
        email?: string;
        customerId?: string;
        loyaltyType?: string;
        status?: string;
        points?: number;
        totalPointsEarned?: number;
        totalAmountSpent?: number;
        totalOrders?: number;
        lastVisit?: Date;
        createdAt?: Date;
        userId: string;
        userName?: string;
        establishmentName?: string;
      }> = [];
      
      for (const profile of allProfiles) {
        try {
          const customersRef = customersColRef(db, profile.uid);
          const customersSnap = await getDocs(customersRef);
          
          customersSnap.forEach(doc => {
            const data = doc.data();
            customers.push({
              id: doc.id,
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              phone: data.phone,
              email: data.email,
              customerId: data.customerId,
              loyaltyType: data.loyaltyType,
              status: data.status,
              points: data.points || 0,
              totalPointsEarned: data.totalPointsEarned || 0,
              totalAmountSpent: data.totalAmountSpent || 0,
              totalOrders: data.totalOrders || 0,
              lastVisit: data.lastVisit ? new Date(data.lastVisit) : undefined,
              createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
              userId: profile.uid,
              userName: profile.ownerName,
              establishmentName: profile.establishmentName,
            });
          });
        } catch (error) {
          console.error(`Erreur chargement clients pour ${profile.uid}:`, error);
        }
      }
      
      setAllCustomers(customers);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      toast({ title: "Erreur", description: "Impossible de charger les clients", variant: "destructive" });
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [allProfiles, toast]);

  const loadAllRatings = useCallback(async () => {
    if (allProfiles.length === 0) {
      // Si pas de profils, restaurer depuis le cache si disponible
      if (dataCacheRef.current.ratings.length > 0 && allRatings.length === 0) {
        setAllRatings(dataCacheRef.current.ratings);
      }
      setIsLoadingRatings(false);
      return;
    }
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
      dataCacheRef.current.ratings = ratings;
    } catch (error) {
      console.error('Erreur chargement appréciations:', error);
      toast({ title: "Erreur", description: "Impossible de charger les appréciations", variant: "destructive" });
      // En cas d'erreur, restaurer depuis le cache si disponible
      if (dataCacheRef.current.ratings.length > 0) {
        setAllRatings(dataCacheRef.current.ratings);
      }
    } finally {
      setIsLoadingRatings(false);
    }
  }, [allProfiles, toast]);

  // Suivre les vues déjà chargées pour éviter les rechargements inutiles
  const loadedViewsRef = useRef<Set<string>>(new Set());
  const prevProfilesLengthRef = useRef(0);
  const prevViewsRef = useRef<string>(activeView);
  
  // Restaurer les données depuis le cache si elles sont vides mais le cache contient des données
  useEffect(() => {
    if (!isAdmin) return;
    
    // Restaurer les données depuis le cache si elles existent et que l'état est vide
    if (dataCacheRef.current.products.length > 0 && allProducts.length === 0) {
      setAllProducts(dataCacheRef.current.products);
      setIsLoadingProducts(false);
    }
    if (dataCacheRef.current.orders.length > 0 && allOrders.length === 0) {
      setAllOrders(dataCacheRef.current.orders);
      setIsLoadingOrders(false);
    }
    if (dataCacheRef.current.events.length > 0 && allEvents.length === 0) {
      setAllEvents(dataCacheRef.current.events);
      setIsLoadingEvents(false);
    }
    if (dataCacheRef.current.ratings.length > 0 && allRatings.length === 0) {
      setAllRatings(dataCacheRef.current.ratings);
      setIsLoadingRatings(false);
    }
    if (dataCacheRef.current.payments.length > 0 && allPayments.length === 0) {
      setAllPayments(dataCacheRef.current.payments);
      setIsLoadingPayments(false);
    }
    if ((dataCacheRef.current.globalStats.totalProducts > 0 || dataCacheRef.current.globalStats.totalOrders > 0) && 
        globalStats.totalProducts === 0 && globalStats.totalOrders === 0) {
      setGlobalStats(dataCacheRef.current.globalStats);
      setIsLoadingGlobalStats(false);
    }
  }, [isAdmin, allProducts.length, allOrders.length, allEvents.length, allRatings.length, allPayments.length, globalStats.totalProducts, globalStats.totalOrders]);
  
  // Initialiser les états de chargement au démarrage et lors du changement de vue
  useEffect(() => {
    if (!isAdmin) return;
    
    // S'assurer que seuls les états de chargement de la vue active sont actifs
    const currentView = activeView;
    
    // Arrêter le chargement des vues non actives
    if (currentView !== 'products') setIsLoadingProducts(false);
    if (currentView !== 'orders') setIsLoadingOrders(false);
    if (currentView !== 'events') setIsLoadingEvents(false);
    if (currentView !== 'ratings') setIsLoadingRatings(false);
    if (currentView !== 'menu') {
      setIsLoadingGlobalStats(false);
      setIsLoadingPayments(false);
    }
  }, [isAdmin, activeView]);
  
  // Charger les données quand on change de vue ou quand les profils deviennent disponibles
  useEffect(() => {
    if (!isAdmin) return;
    
    const profilesJustLoaded = prevProfilesLengthRef.current === 0 && allProfiles.length > 0;
    const prevView = prevViewsRef.current;
    const viewChanged = prevView !== activeView;
    
    // Si on change de vue, réinitialiser les états de chargement des autres vues
    if (viewChanged) {
      // Arrêter le chargement des vues non actives
      if (activeView !== 'products') setIsLoadingProducts(false);
      if (activeView !== 'orders') setIsLoadingOrders(false);
      if (activeView !== 'events') setIsLoadingEvents(false);
      if (activeView !== 'ratings') setIsLoadingRatings(false);
      if (activeView !== 'menu') {
        setIsLoadingGlobalStats(false);
        setIsLoadingPayments(false);
      }
    }
    
    const viewAlreadyLoaded = loadedViewsRef.current.has(activeView);
    
    // Si la vue est déjà chargée et que les profils n'ont pas changé, s'assurer que le chargement est arrêté
    if (viewAlreadyLoaded && !profilesJustLoaded && !viewChanged) {
      // S'assurer que les états de chargement sont à false pour la vue active
      switch (activeView) {
        case 'products':
          setIsLoadingProducts(false);
          break;
        case 'orders':
          setIsLoadingOrders(false);
          break;
        case 'events':
          setIsLoadingEvents(false);
          break;
        case 'ratings':
          setIsLoadingRatings(false);
          break;
        case 'menu':
          setIsLoadingGlobalStats(false);
          setIsLoadingPayments(false);
          break;
      }
      prevProfilesLengthRef.current = allProfiles.length;
      prevViewsRef.current = activeView;
      return;
    }
    
    // Si on n'a pas de profils, restaurer depuis le cache si disponible
    if (allProfiles.length === 0) {
      prevProfilesLengthRef.current = 0;
      // Restaurer les données depuis le cache pour la vue active et arrêter le chargement
      switch (activeView) {
        case 'products':
          if (dataCacheRef.current.products.length > 0) {
            setAllProducts(dataCacheRef.current.products);
          }
          setIsLoadingProducts(false);
          break;
        case 'orders':
          if (dataCacheRef.current.orders.length > 0) {
            setAllOrders(dataCacheRef.current.orders);
          }
          setIsLoadingOrders(false);
          break;
        case 'events':
          if (dataCacheRef.current.events.length > 0) {
            setAllEvents(dataCacheRef.current.events);
          }
          setIsLoadingEvents(false);
          break;
        case 'ratings':
          if (dataCacheRef.current.ratings.length > 0) {
            setAllRatings(dataCacheRef.current.ratings);
          }
          setIsLoadingRatings(false);
          break;
        case 'menu':
          if (dataCacheRef.current.globalStats.totalProducts > 0 || dataCacheRef.current.globalStats.totalOrders > 0) {
            setGlobalStats(dataCacheRef.current.globalStats);
          }
          setIsLoadingGlobalStats(false);
          if (dataCacheRef.current.payments.length > 0) {
            setAllPayments(dataCacheRef.current.payments);
          }
          setIsLoadingPayments(false);
          break;
        case 'users':
          // Les utilisateurs sont déjà chargés via onSnapshot
          break;
      }
      return;
    }
    
    // Charger les données selon la vue
    if (activeView === 'menu') {
      loadGlobalStats();
      loadAllPayments();
      loadedViewsRef.current.add('menu');
    } else {
      switch (activeView) {
        case 'products':
          loadAllProducts();
          loadedViewsRef.current.add('products');
          break;
        case 'orders':
          loadAllOrders();
          loadedViewsRef.current.add('orders');
          break;
        case 'events':
          loadAllEvents();
          loadedViewsRef.current.add('events');
          break;
        case 'ratings':
          loadAllRatings();
          loadedViewsRef.current.add('ratings');
          break;
        case 'users':
          // Les utilisateurs sont déjà chargés via onSnapshot
          loadedViewsRef.current.add('users');
          break;
      }
    }
    
    prevProfilesLengthRef.current = allProfiles.length;
    prevViewsRef.current = activeView;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeView, allProfiles.length]);

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

  const saveSubscriptionPlan = async () => {
    if (!editingPlan) return;
    
    setIsLoadingPlans(true);
    try {
      const planRef = subscriptionPlanDocRef(db, editingPlan);
      const currentPlan = subscriptionPlans[editingPlan];
      
      // Préparer les données à sauvegarder
      const planData: {
        name: string;
        price: number;
        features: SubscriptionFeatures;
      } = {
        name: currentPlan.name,
        price: planPrice,
        features: {
          ...planFeatures,
        },
      };
      
      // Ajouter les paramètres spécifiques à Pro Max
      if (editingPlan === 'transition-pro-max') {
        planData.features.eventsLimit = planEventsLimit;
        planData.features.eventsExtraPrice = planEventsExtraPrice;
      }
      
      // Sauvegarder dans Firestore
      await setDoc(planRef, planData, { merge: true });
      
      // Mettre à jour l'état local
      const updatedPlans = {
        transition: editingPlan === 'transition' 
          ? { ...currentPlan, price: planPrice, features: planData.features }
          : subscriptionPlans.transition,
        'transition-pro-max': editingPlan === 'transition-pro-max'
          ? { ...currentPlan, price: planPrice, features: planData.features }
          : subscriptionPlans['transition-pro-max'],
      };
    setSubscriptionPlans(updatedPlans);
      
    setEditingPlan(null);
      toast({ 
        title: "Succès", 
        description: `Plan ${editingPlan} mis à jour et sauvegardé dans Firestore` 
      });
    } catch (error) {
      console.error('Erreur sauvegarde plan:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de sauvegarder le plan", 
        variant: "destructive" 
      });
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const openEditPlan = (planKey: "transition" | "transition-pro-max") => {
    setEditingPlan(planKey);
    const plan = subscriptionPlans[planKey];
    setPlanFeatures({ ...plan.features });
    setPlanPrice(plan.price);
    if (planKey === 'transition-pro-max') {
      setPlanEventsLimit(plan.features.eventsLimit ?? 5);
      setPlanEventsExtraPrice(plan.features.eventsExtraPrice ?? 1500);
    }
  };

  // Fonctions de gestion des produits
  const handleDeleteProduct = async (productId: string, userId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;
    
    setDeletingProductId(productId);
    try {
      const productRef = doc(db, `profiles/${userId}/products`, productId);
      await deleteDoc(productRef);
      toast({ title: "Produit supprimé", description: "Le produit a été supprimé avec succès" });
      loadAllProducts();
    } catch (error) {
      console.error('Erreur suppression produit:', error);
      toast({ title: "Erreur", description: "Impossible de supprimer le produit", variant: "destructive" });
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleUpdateProduct = async (productId: string, userId: string, updates: { name?: string; category?: string; price?: number; quantity?: number }) => {
    try {
      const productRef = doc(db, `profiles/${userId}/products`, productId);
      await updateDoc(productRef, {
        ...updates,
        updatedAt: Date.now(),
      });
      toast({ title: "Produit modifié", description: "Le produit a été mis à jour avec succès" });
      setEditingProduct(null);
      loadAllProducts();
    } catch (error) {
      console.error('Erreur modification produit:', error);
      toast({ title: "Erreur", description: "Impossible de modifier le produit", variant: "destructive" });
    }
  };

  // Fonctions de gestion des commandes
  const handleUpdateOrderStatus = async (orderId: string, userId: string, newStatus: string) => {
    try {
      // Essayer d'abord dans orders, puis dans barOrders
      const orderRef = doc(db, `profiles/${userId}/orders`, orderId);
      const barOrderRef = doc(db, `profiles/${userId}/barOrders`, orderId);
      
      try {
        await updateDoc(orderRef, { status: newStatus, updatedAt: Date.now() });
      } catch {
        await updateDoc(barOrderRef, { status: newStatus, updatedAt: Date.now() });
      }
      
      toast({ title: "Commande modifiée", description: `Le statut a été changé en "${newStatus}"` });
      setEditingOrder(null);
      loadAllOrders();
    } catch (error) {
      console.error('Erreur modification commande:', error);
      toast({ title: "Erreur", description: "Impossible de modifier la commande", variant: "destructive" });
    }
  };

  const handleDeleteOrder = async (orderId: string, userId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette commande ?")) return;
    
    setDeletingOrderId(orderId);
    try {
      const orderRef = doc(db, `profiles/${userId}/orders`, orderId);
      const barOrderRef = doc(db, `profiles/${userId}/barOrders`, orderId);
      
      try {
        await deleteDoc(orderRef);
      } catch {
        await deleteDoc(barOrderRef);
      }
      
      toast({ title: "Commande supprimée", description: "La commande a été supprimée avec succès" });
      loadAllOrders();
    } catch (error) {
      console.error('Erreur suppression commande:', error);
      toast({ title: "Erreur", description: "Impossible de supprimer la commande", variant: "destructive" });
    } finally {
      setDeletingOrderId(null);
    }
  };

  // Fonctions de gestion des événements
  const handleUpdateEvent = async (eventId: string, userId: string, updates: { title?: string; date?: string; time?: string; location?: string; maxCapacity?: number; ticketPrice?: number }) => {
    try {
      const eventRef = doc(db, `profiles/${userId}/events`, eventId);
      await updateDoc(eventRef, {
        ...updates,
        updatedAt: Date.now(),
      });
      toast({ title: "Événement modifié", description: "L'événement a été mis à jour avec succès" });
      setEditingEvent(null);
      loadAllEvents();
    } catch (error) {
      console.error('Erreur modification événement:', error);
      toast({ title: "Erreur", description: "Impossible de modifier l'événement", variant: "destructive" });
    }
  };

  const handleDeleteEvent = async (eventId: string, userId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet événement ? Cette action supprimera également tous les billets associés.")) return;
    
    setDeletingEventId(eventId);
    try {
      const eventRef = doc(db, `profiles/${userId}/events`, eventId);
      await deleteDoc(eventRef);
      toast({ title: "Événement supprimé", description: "L'événement a été supprimé avec succès" });
      loadAllEvents();
    } catch (error) {
      console.error('Erreur suppression événement:', error);
      toast({ title: "Erreur", description: "Impossible de supprimer l'événement", variant: "destructive" });
    } finally {
      setDeletingEventId(null);
    }
  };

  // Fonction pour réinitialiser les appréciations d'un produit
  const handleResetRating = async (productId: string, userId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir réinitialiser les appréciations de ce produit ?")) return;
    
    try {
      const productRef = doc(db, `profiles/${userId}/products`, productId);
      await updateDoc(productRef, {
        rating: 0,
        ratingCount: 0,
        updatedAt: Date.now(),
      });
      toast({ title: "Appréciations réinitialisées", description: "Les appréciations ont été réinitialisées avec succès" });
      loadAllRatings();
    } catch (error) {
      console.error('Erreur réinitialisation appréciations:', error);
      toast({ title: "Erreur", description: "Impossible de réinitialiser les appréciations", variant: "destructive" });
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

  // Vue Menu Principal avec de gros boutons
  const renderMenuView = () => (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
        <h1 className="text-3xl font-bold mb-2">Administration Nack</h1>
        <p className="text-muted-foreground">Gestion complète de la plateforme</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadGlobalStats} 
          disabled={isLoadingGlobalStats}
          className="flex items-center gap-2"
        >
          {isLoadingGlobalStats ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
              Chargement...
            </>
          ) : (
            <>
              <TrendingUp size={16} />
              Actualiser les stats
            </>
          )}
        </Button>
      </div>

      {/* Statistiques principales */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Statistiques globales</h2>
        <Button variant="outline" size="sm" onClick={loadGlobalStats} disabled={isLoadingGlobalStats}>
          {isLoadingGlobalStats ? "Chargement..." : "Actualiser"}
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
            <div className="text-xs text-muted-foreground mt-1">
              {globalStats.totalOrders} normales • {globalStats.totalBarOrders} bar connectée
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
      
      {/* Statistiques supplémentaires */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar size={16} className="text-orange-600"/> Événements
            </CardTitle>
            <CardDescription>Total événements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoadingGlobalStats ? "..." : globalStats.totalEvents.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users size={16} className="text-indigo-600"/> Équipe
            </CardTitle>
            <CardDescription>Membres d'équipe</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoadingGlobalStats ? "..." : globalStats.totalTeamMembers.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard size={16} className="text-green-600"/> Paiements
            </CardTitle>
            <CardDescription>Paiements complétés</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isLoadingPayments ? "..." : allPayments.length.toLocaleString()}
            </div>
            {allPayments.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {allPayments.slice(0, 5).reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()} XAF (5 derniers)
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp size={16} className="text-green-600"/> Revenus
            </CardTitle>
            <CardDescription>Revenus mensuels estimés</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.monthly.toLocaleString()} XAF
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Basé sur {stats.active} abonnements actifs
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
        <button
          onClick={() => navigate('/admin?view=customers')}
          className="relative flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
        >
          <Users size={48} className="text-teal-600 transition-transform group-hover:scale-110" />
          <h2 className="text-lg font-semibold text-gray-900">Clients</h2>
          <p className="text-sm text-muted-foreground">{allCustomers.length} total</p>
        </button>
      </div>

      {/* Paiements récents */}
      {allPayments.length > 0 && (
        <Card className="border-0 shadow-card mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard size={20} className="text-blue-600"/> Paiements récents
                </CardTitle>
                <CardDescription>Les 5 derniers paiements complétés</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportPaymentsCsv(allPayments)}>
                  <Download size={16} className="mr-2"/> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportPaymentsPdf(allPayments)}>
                  <FileText size={16} className="mr-2"/> PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allPayments.slice(0, 5).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">{payment.userName || payment.userEmail || "Utilisateur inconnu"}</div>
                    <div className="text-sm text-muted-foreground">
                      {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('fr-FR') : "Date inconnue"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">{payment.amount?.toLocaleString() || 0} XAF</div>
                    <Badge variant="outline" className="text-xs">
                      {payment.planType || "N/A"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Vue Utilisateurs
  const renderUsersView = () => (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-check')}>
          <ArrowLeft size={16} className="mr-2"/> Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">Gérer les utilisateurs et leurs abonnements</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportUsersCsv(filtered)}>
            <Download size={16} className="mr-2"/> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportUsersPdf(filtered)}>
            <FileText size={16} className="mr-2"/> PDF
          </Button>
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
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportProductsCsv(allProducts)} disabled={allProducts.length === 0}>
            <Download size={16} className="mr-2"/> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportProductsPdf(allProducts)} disabled={allProducts.length === 0}>
            <FileText size={16} className="mr-2"/> PDF
          </Button>
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
                    <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setEditingProduct({ id: product.id, userId: product.userId, name: product.name, category: product.category, price: product.price, quantity: product.quantity })}
                            title="Modifier le produit"
                          >
                            <Edit size={14} className="mr-2"/> Modifier
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDeleteProduct(product.id, product.userId)}
                            disabled={deletingProductId === product.id}
                            title="Supprimer le produit"
                          >
                            {deletingProductId === product.id ? (
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
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportOrdersCsv(allOrders)} disabled={allOrders.length === 0}>
            <Download size={16} className="mr-2"/> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportOrdersPdf(allOrders)} disabled={allOrders.length === 0}>
            <FileText size={16} className="mr-2"/> PDF
          </Button>
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
                    <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end flex-wrap">
                          <Select 
                            value={order.status} 
                            onValueChange={(newStatus) => handleUpdateOrderStatus(order.id, order.userId, newStatus)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">En attente</SelectItem>
                              <SelectItem value="sent">Envoyée</SelectItem>
                              <SelectItem value="cancelled">Annulée</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDeleteOrder(order.id, order.userId)}
                            disabled={deletingOrderId === order.id}
                            title="Supprimer la commande"
                          >
                            {deletingOrderId === order.id ? (
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
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportEventsCsv(allEvents)} disabled={allEvents.length === 0}>
            <Download size={16} className="mr-2"/> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportEventsPdf(allEvents)} disabled={allEvents.length === 0}>
            <FileText size={16} className="mr-2"/> PDF
          </Button>
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
                    <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setEditingEvent({ id: event.id, userId: event.userId, title: event.title, date: event.date, time: event.time, location: event.location, maxCapacity: event.maxCapacity, ticketPrice: event.ticketPrice })}
                            title="Modifier l'événement"
                          >
                            <Edit size={14} className="mr-2"/> Modifier
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDeleteEvent(event.id, event.userId)}
                            disabled={deletingEventId === event.id}
                            title="Supprimer l'événement"
                          >
                            {deletingEventId === event.id ? (
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
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            // Export des appréciations en CSV (format simple)
            const rows: string[][] = [
              ["Produit", "Note", "Nombre d'avis", "Établissement", "Propriétaire", "ID Produit"]
            ];
            allRatings.forEach(rating => {
              rows.push([
                rating.productName || '',
                rating.rating.toFixed(1),
                rating.ratingCount.toString(),
                rating.establishmentName || '',
                rating.userName || '',
                rating.productId
              ]);
            });
            const csvRows = rows.map(row => row.map(cell => {
              const cellStr = String(cell || '').replace(/"/g, '""');
              if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr}"`;
              }
              return cellStr;
            }).join(','));
            const csv = csvRows.join('\n');
            const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `appreciations-${new Date().toISOString().split('T')[0]}.csv`;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }} disabled={allRatings.length === 0}>
            <Download size={16} className="mr-2"/> CSV
          </Button>
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
                    <TableHead className="text-right">Actions</TableHead>
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
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleResetRating(rating.productId, rating.userId)}
                            title="Réinitialiser les appréciations"
                          >
                            <X size={14} className="mr-2"/> Réinitialiser
                          </Button>
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

  // Vue Clients
  const renderCustomersView = () => (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-check')}>
          <ArrowLeft size={16} className="mr-2"/> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble des clients de tous les utilisateurs ({allCustomers.length} total)</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCustomersCsv(allCustomers)} disabled={allCustomers.length === 0}>
            <Download size={16} className="mr-2"/> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCustomersPdf(allCustomers)} disabled={allCustomers.length === 0}>
            <FileText size={16} className="mr-2"/> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={loadAllCustomers} disabled={isLoadingCustomers}>
            {isLoadingCustomers ? "Chargement..." : "Actualiser"}
          </Button>
        </div>
      </div>
      <Card className="border-0 shadow-card">
        <CardContent>
          {isLoadingCustomers ? (
            <div className="text-center py-8 text-muted-foreground">Chargement des clients...</div>
          ) : allCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Aucun client trouvé</div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>ID Client</TableHead>
                    <TableHead>Type fidélité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Montant dépensé</TableHead>
                    <TableHead>Commandes</TableHead>
                    <TableHead>Établissement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allCustomers.map((customer) => (
                    <TableRow key={`${customer.userId}-${customer.id}`}>
                      <TableCell className="font-medium">{customer.firstName}</TableCell>
                      <TableCell>{customer.lastName}</TableCell>
                      <TableCell>{customer.phone || '-'}</TableCell>
                      <TableCell>{customer.email || '-'}</TableCell>
                      <TableCell>{customer.customerId || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{customer.loyaltyType || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>
                        {customer.status === 'vip' && <Badge className="bg-yellow-100 text-yellow-700" variant="secondary">VIP</Badge>}
                        {customer.status === 'fidel' && <Badge className="bg-blue-100 text-blue-700" variant="secondary">Fidèle</Badge>}
                        {!customer.status && <Badge variant="secondary">Standard</Badge>}
                      </TableCell>
                      <TableCell>{customer.points || 0}</TableCell>
                      <TableCell className="font-semibold">{(customer.totalAmountSpent || 0).toLocaleString()} XAF</TableCell>
                      <TableCell>{customer.totalOrders || 0}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{customer.establishmentName || customer.userName || 'N/A'}</span>
                          {customer.userName && customer.establishmentName && (
                            <span className="text-xs text-muted-foreground">{customer.userName}</span>
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
            <CardDescription>
              Les modifications seront sauvegardées dans Firestore et appliquées à tous les utilisateurs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Prix mensuel (XAF)</Label>
              <Input
                type="number"
                value={planPrice}
                onChange={(e) => setPlanPrice(Number(e.target.value))}
                placeholder="2500"
              />
            </div>
            
            <div className="space-y-3">
              <Label className="text-base font-semibold">Fonctionnalités</Label>
              {Object.entries(planFeatures).filter(([key]) => key !== 'eventsLimit' && key !== 'eventsExtraPrice').map(([feature, enabled]) => (
              <div key={feature} className="flex items-center gap-2">
                <Checkbox 
                  checked={enabled} 
                  onCheckedChange={(checked) => 
                    setPlanFeatures({ ...planFeatures, [feature]: checked as boolean })
                  }
                />
                  <Label className="capitalize">{feature === 'barConnectee' ? 'Bar Connectée' : feature}</Label>
              </div>
            ))}
            </div>
            
            {editingPlan === 'transition-pro-max' && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Limite d'événements inclus</Label>
                  <Input
                    type="number"
                    value={planEventsLimit}
                    onChange={(e) => setPlanEventsLimit(Number(e.target.value))}
                    placeholder="5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prix événement supplémentaire (XAF)</Label>
                  <Input
                    type="number"
                    value={planEventsExtraPrice}
                    onChange={(e) => setPlanEventsExtraPrice(Number(e.target.value))}
                    placeholder="1500"
                  />
                </div>
              </div>
            )}
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={saveSubscriptionPlan}
                disabled={isLoadingPlans}
              >
                {isLoadingPlans ? "Enregistrement..." : "Enregistrer dans Firestore"}
              </Button>
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
      {activeView === "customers" && renderCustomersView()}
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

      {/* Dialog de modification de produit */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le produit</DialogTitle>
            <DialogDescription>Modifiez les informations du produit</DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom du produit</Label>
                <Input
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Input
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prix (XAF)</Label>
                  <Input
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantité</Label>
                  <Input
                    type="number"
                    value={editingProduct.quantity}
                    onChange={(e) => setEditingProduct({ ...editingProduct, quantity: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Annuler
            </Button>
            <Button 
              onClick={() => {
                if (editingProduct) {
                  handleUpdateProduct(editingProduct.id, editingProduct.userId, {
                    name: editingProduct.name,
                    category: editingProduct.category,
                    price: editingProduct.price,
                    quantity: editingProduct.quantity,
                  });
                }
              }}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de modification d'événement */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'événement</DialogTitle>
            <DialogDescription>Modifiez les informations de l'événement</DialogDescription>
          </DialogHeader>
          {editingEvent && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Titre de l'événement</Label>
                <Input
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={editingEvent.date}
                    onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Heure</Label>
                  <Input
                    type="time"
                    value={editingEvent.time}
                    onChange={(e) => setEditingEvent({ ...editingEvent, time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Lieu</Label>
                <Input
                  value={editingEvent.location}
                  onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Capacité maximale</Label>
                  <Input
                    type="number"
                    value={editingEvent.maxCapacity}
                    onChange={(e) => setEditingEvent({ ...editingEvent, maxCapacity: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prix du billet (XAF)</Label>
                  <Input
                    type="number"
                    value={editingEvent.ticketPrice}
                    onChange={(e) => setEditingEvent({ ...editingEvent, ticketPrice: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEvent(null)}>
              Annuler
            </Button>
            <Button 
              onClick={() => {
                if (editingEvent) {
                  handleUpdateEvent(editingEvent.id, editingEvent.userId, {
                    title: editingEvent.title,
                    date: editingEvent.date,
                    time: editingEvent.time,
                    location: editingEvent.location,
                    maxCapacity: editingEvent.maxCapacity,
                    ticketPrice: editingEvent.ticketPrice,
                  });
                }
              }}
            >
              Enregistrer
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