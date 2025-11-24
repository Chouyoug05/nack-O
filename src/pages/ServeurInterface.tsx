import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/contexts/OrderContext";
import { Product, CartItem, OrderStatus } from "@/types/order";
import OrderHistory from "@/components/OrderHistory";
import { 
  LogOut,
  User,
  Package,
  Clock,
  Send,
  Trash2,
  Plus,
  Minus,
  Search,
  CreditCard,
  Banknote,
  Coffee,
  Wine,
  GlassWater,
  Pizza,
  Sandwich,
  Cookie,
  IceCream,
  Utensils,
  Settings,
  Box,
  Grid3x3
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { ordersColRef, productsColRef, teamColRef, notificationsColRef, agentTokensTopColRef, customersColRef } from "@/lib/collections";
import { addDoc, getDocs, limit, onSnapshot, query, where, collectionGroup, doc, getDoc, updateDoc, runTransaction, orderBy } from "firebase/firestore";
import type { Customer, CustomerDoc, Reward } from "@/types/customer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, X, Star, Crown } from "lucide-react";

interface FirestoreTeamMemberDoc {
  firstName: string;
  lastName: string;
  agentCode?: string;
  agentToken?: string;
}

interface FirestoreProductDoc {
  name: string;
  price: number;
  category: string;
  quantity: number;
  imageUrl?: string;
  icon?: string;
}

// Offline helpers
const getProductsCacheKey = (ownerUid: string) => `nack_products_${ownerUid}`;
const getOrderOutboxKey = (ownerUid: string, agentCode: string) => `nack_order_outbox_${ownerUid}_${agentCode}`;
const getServeurAuthKey = (agentCode: string) => `nack_serveur_auth_${agentCode}`;

interface OutboxOrder {
  orderNumber: number;
  tableNumber: string;
  items: Array<{ id: string; name: string; price: number; quantity: number; category?: string; stock?: number }>;
  total: number;
  status: OrderStatus;
  createdAt: number;
  agentCode: string;
  agentMemberId?: string;
  agentName?: string;
  agentToken?: string;
  customerId?: string; // ID du client favori associé
}

const ServeurInterface = () => {
  const { agentCode } = useParams();
  const { toast } = useToast();
  const { addOrder, getOrdersByAgent, updateOrderStatus, orderCounter } = useOrders();
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [activeView, setActiveView] = useState<'products' | 'pending' | 'sent'>('products');
  const [agentInfo, setAgentInfo] = useState<{ name: string; code: string; memberId?: string } | null>(() => {
    // Restaurer depuis localStorage
    if (!agentCode) return null;
    try {
      const stored = localStorage.getItem(getServeurAuthKey(agentCode));
      if (stored) {
        const data = JSON.parse(stored);
        if (data.timestamp && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          return { name: data.agentName || 'Agent', code: agentCode, memberId: data.memberId };
        } else {
          localStorage.removeItem(getServeurAuthKey(agentCode));
        }
      }
    } catch { /* ignore */ }
    return null;
  });
  const [ownerUid, setOwnerUid] = useState<string | null>(() => {
    // Restaurer depuis localStorage
    if (!agentCode) return null;
    try {
      const stored = localStorage.getItem(getServeurAuthKey(agentCode));
      if (stored) {
        const data = JSON.parse(stored);
        if (data.timestamp && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          return data.ownerUid || null;
        } else {
          localStorage.removeItem(getServeurAuthKey(agentCode));
        }
      }
    } catch { /* ignore */ }
    return null;
  });
  const [fsProducts, setFsProducts] = useState<Product[] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const resolveOwner = async () => {
      if (!agentCode) return;
      try {
        const tokenDoc = await getDoc(doc(agentTokensTopColRef(db), agentCode));
        if (tokenDoc.exists()) {
          const data = tokenDoc.data() as { ownerUid?: string; firstName?: string; lastName?: string };
          if (data.ownerUid) {
            setOwnerUid(data.ownerUid);
            const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Agent';
            setAgentInfo({ name, code: agentCode });
            // Sauvegarder dans localStorage pour persistance
            try {
              localStorage.setItem(getServeurAuthKey(agentCode), JSON.stringify({
                ownerUid: data.ownerUid,
                agentName: name,
                timestamp: Date.now(),
              }));
            } catch { /* ignore */ }
            return;
          }
        }
      } catch { /* ignore */ }
      try {
        const cg = collectionGroup(db, 'team');
        let foundOwner: string | null = null;
        let foundName: string | null = null;
        let foundMemberId: string | undefined;
        const byToken = query(cg, where('agentToken', '==', agentCode), limit(1));
        const s1 = await getDocs(byToken);
        if (!s1.empty) {
          const docSnap = s1.docs[0];
          const data = docSnap.data() as FirestoreTeamMemberDoc;
          foundOwner = docSnap.ref.parent.parent ? docSnap.ref.parent.parent.id : null;
          foundName = `${data.firstName} ${data.lastName}`;
          foundMemberId = docSnap.id;
        } else {
          const byCode = query(cg, where('agentCode', '==', agentCode), limit(1));
          const s2 = await getDocs(byCode);
          if (!s2.empty) {
            const docSnap = s2.docs[0];
            const data = docSnap.data() as FirestoreTeamMemberDoc;
            foundOwner = docSnap.ref.parent.parent ? docSnap.ref.parent.parent.id : null;
            foundName = `${data.firstName} ${data.lastName}`;
            foundMemberId = docSnap.id;
          }
        }
        if (foundOwner) {
          setOwnerUid(foundOwner);
          setAgentInfo({ name: foundName || 'Agent', code: agentCode, memberId: foundMemberId });
          // Sauvegarder dans localStorage pour persistance
          try {
            localStorage.setItem(getServeurAuthKey(agentCode), JSON.stringify({
              ownerUid: foundOwner,
              agentName: foundName || 'Agent',
              memberId: foundMemberId,
              timestamp: Date.now(),
            }));
          } catch { /* ignore */ }
        }
      } catch { /* ignore permissions */ }
    };
    resolveOwner();
  }, [agentCode]);

  useEffect(() => {
    if (!ownerUid) { setFsProducts(null); return; }
    try {
      const cached = localStorage.getItem(getProductsCacheKey(ownerUid));
      if (cached) {
        const parsed: Product[] = JSON.parse(cached);
        if (parsed && parsed.length) setFsProducts(parsed);
      }
    } catch { /* ignore cache errors */ }

    const unsub = onSnapshot(productsColRef(db, ownerUid), (snap) => {
      const list: Product[] = snap.docs.map((d) => {
        const data = d.data() as FirestoreProductDoc & { imageUrl?: string; icon?: string };
        return {
          id: d.id,
          name: data.name || '',
          price: Number(data.price || 0),
          category: data.category || '',
          stock: Number(data.quantity || 0),
          image: 'menu',
          imageUrl: data.imageUrl && data.imageUrl.trim() !== '' ? data.imageUrl : undefined,
        } as Product;
      });
      setFsProducts(list);
      try { localStorage.setItem(getProductsCacheKey(ownerUid), JSON.stringify(list)); } catch (e) { /* ignore quota errors */ }
    }, (error) => {
      // Snapshot error: stay on cache if any
      setFsProducts(prev => {
        if (!prev) {
          try {
            const cached = localStorage.getItem(getProductsCacheKey(ownerUid));
            if (cached) return JSON.parse(cached);
          } catch (e) { /* ignore parse errors */ }
        }
        return prev;
      });
    });
    return () => unsub();
  }, [ownerUid]);

  // Charger les clients favoris
  useEffect(() => {
    if (!ownerUid) { setAvailableCustomers([]); return; }
    const q = query(customersColRef(db, ownerUid), orderBy("firstName", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Customer[] = snap.docs.map((d) => {
        const data = d.data() as CustomerDoc;
        return {
          id: d.id,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          email: data.email,
          photoUrl: data.photoUrl,
          customerId: data.customerId,
          loyaltyType: data.loyaltyType,
          status: data.status,
          points: data.points || 0,
          totalPointsEarned: data.totalPointsEarned || 0,
          totalAmountSpent: data.totalAmountSpent || 0,
          totalOrders: data.totalOrders || 0,
          lastVisit: data.lastVisit ? new Date(data.lastVisit) : undefined,
          availableRewards: data.availableRewards || [],
          notes: data.notes,
          allergies: data.allergies,
          preferences: data.preferences,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        };
      });
      setAvailableCustomers(list);
    });
    return () => unsub();
  }, [ownerUid]);

  useEffect(() => {
    const flush = async () => {
      if (!ownerUid || !agentCode) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      let queued: OutboxOrder[] = [];
      try {
        const raw = localStorage.getItem(getOrderOutboxKey(ownerUid, agentCode));
        if (raw) queued = JSON.parse(raw) as OutboxOrder[];
      } catch (e) { /* ignore parse errors */ }
      if (!queued.length) return;
      const remaining: OutboxOrder[] = [];
      for (const o of queued) {
        try {
          await addDoc(ordersColRef(db, ownerUid), o);
          try {
            await addDoc(notificationsColRef(db, ownerUid), {
              title: "Nouvelle commande",
              message: `Table ${o.tableNumber} • Total ${o.total.toLocaleString()} XAF`,
              type: "info",
              createdAt: Date.now(),
              read: false,
            });
          } catch { /* ignore notifications permission errors */ }
        } catch {
          remaining.push(o);
        }
      }
      try {
        if (remaining.length) localStorage.setItem(getOrderOutboxKey(ownerUid, agentCode), JSON.stringify(remaining));
        else localStorage.removeItem(getOrderOutboxKey(ownerUid, agentCode));
      } catch (e) { /* ignore quota errors */ }
    };
    flush();
    const onOnline = () => flush();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [ownerUid, agentCode]);

  const products = fsProducts ?? [];
  // Filtrer les produits vendables : tous les produits avec prix > 0
  // Les serveurs peuvent vendre tous les produits avec un prix, même si le stock est à 0
  // (les plats peuvent être préparés à la demande, et les autres produits peuvent être réapprovisionnés)
  const sellableProducts = products.filter(product => {
    const price = Number(product.price || 0) > 0;
    return price; // Afficher tous les produits avec un prix > 0
  });
  const availableCategories = [...new Set(sellableProducts.map(p => p.category).filter(Boolean))].sort();

  useEffect(() => {
    if (activeCategoryTab !== "all" && !availableCategories.includes(activeCategoryTab)) {
      setActiveCategoryTab("all");
    }
  }, [availableCategories, activeCategoryTab]);

  if (!agentCode) {
    return <Navigate to="/not-found" replace />;
  }

  const agentOrders = getOrdersByAgent(agentCode);
  const pendingOrders = agentOrders.filter(order => order.status === 'pending');
  const sentOrders = agentOrders.filter(order => order.status === 'sent');

  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('boisson') || cat.includes('eau') || cat.includes('jus') || cat.includes('soda')) return GlassWater;
    if (cat.includes('alcool') || cat.includes('vin') || cat.includes('biere')) return Wine;
    if (cat.includes('cafe')) return Coffee;
    if (cat.includes('plat') || cat.includes('pizza') || cat.includes('sandwich')) return Pizza;
    if (cat.includes('dessert') || cat.includes('glace') || cat.includes('sucre') || cat.includes('cookie')) return IceCream;
    if (cat.includes('snack')) return Cookie;
    if (cat.includes('ustensile')) return Utensils;
    if (cat.includes('équipement') || cat.includes('equipement')) return Settings;
    if (cat.includes('fourniture')) return Box;
    return Package;
  };

  const filteredProducts = sellableProducts
    .filter(product => product.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(product => {
      if (activeCategoryTab === "all") return true;
      return product.category === activeCategoryTab;
    });

  const renderIconByName = (name?: string) => {
    switch (name) {
      case 'Beer': return <Package size={32} className="text-nack-red" />;
      case 'Wine': return <Wine size={32} className="text-nack-red" />;
      case 'Coffee': return <Coffee size={32} className="text-nack-red" />;
      case 'GlassWater': return <GlassWater size={32} className="text-nack-red" />;
      case 'Pizza': return <Pizza size={32} className="text-nack-red" />;
      case 'Sandwich': return <Sandwich size={32} className="text-nack-red" />;
      case 'Cookie': return <Cookie size={32} className="text-nack-red" />;
      case 'IceCream': return <IceCream size={32} className="text-nack-red" />;
      default: return <Package size={32} className="text-muted-foreground" />;
    }
  };

  const renderProductVisual = (product: Product) => {
    if (product.imageUrl && product.imageUrl.trim() !== '') {
      return (
        <div className="w-20 h-20 mx-auto mb-1 rounded-md overflow-hidden bg-nack-beige-light">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Si l'image ne charge pas, afficher l'icône par défaut
              const target = e.currentTarget;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.className = 'w-20 h-20 mx-auto mb-1 rounded-md bg-nack-beige-light flex items-center justify-center';
                const iconElement = document.createElement('div');
                iconElement.innerHTML = '<svg class="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>';
                parent.appendChild(iconElement);
              }
            }}
          />
        </div>
      );
    }
    const productWithIcon = product as Product & { icon?: string };
    return (
      <div className="w-20 h-20 mx-auto mb-1 rounded-md bg-nack-beige-light flex items-center justify-center">
        {renderIconByName(productWithIcon.icon)}
      </div>
    );
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    // Catégories alimentaires qui peuvent être préparées à la demande (pas de limite de stock)
    const foodCategories = ["Plat / Repas", "Snack", "Dessert", "Entrée"];
    const isFoodCategory = foodCategories.some(cat => 
      product.category?.toLowerCase().includes(cat.toLowerCase().split(' / ')[0]) ||
      product.category?.toLowerCase().includes(cat.toLowerCase()) ||
      product.category?.toLowerCase() === 'plats'
    );
    
    if (existingItem) {
      // Pour les catégories alimentaires, ignorer la vérification de stock
      if (isFoodCategory || existingItem.quantity < (product.stock || 0)) {
        updateQuantity(product.id, existingItem.quantity + 1);
      } else {
        toast({
          title: "Stock insuffisant",
          description: `Il ne reste que ${product.stock} unités en stock`,
          variant: "destructive"
        });
      }
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.id !== id));
    } else {
      setCart(cart.map(item =>
        item.id === id ? { ...item, quantity } : item
      ));
    }
  };

  // Mettre à jour les points/montants du client après une commande
  const updateCustomerLoyalty = async (customerId: string, orderTotal: number, orderId: string) => {
    if (!ownerUid) return;
    
    try {
      const customerRef = doc(customersColRef(db, ownerUid), customerId);
      const customerSnap = await getDoc(customerRef);
      
      if (!customerSnap.exists()) return;
      
      const customerData = customerSnap.data() as CustomerDoc;
      
      await runTransaction(db, async (transaction) => {
        const customerDoc = await transaction.get(customerRef);
        if (!customerDoc.exists()) return;
        
        const data = customerDoc.data() as CustomerDoc;
        const updates: Partial<CustomerDoc> = {
          totalAmountSpent: (data.totalAmountSpent || 0) + orderTotal,
          totalOrders: (data.totalOrders || 0) + 1,
          lastVisit: Date.now(),
          updatedAt: Date.now(),
        };

        // Calculer les points si mode points
        if (data.loyaltyType === 'points' && data.pointsConfig) {
          const pointsEarned = Math.floor((orderTotal / 1000) * (data.pointsConfig.pointsPer1000XAF || 10));
          const newPoints = (data.points || 0) + pointsEarned;
          const totalPointsEarned = (data.totalPointsEarned || 0) + pointsEarned;
          
          updates.points = newPoints;
          updates.totalPointsEarned = totalPointsEarned;

          // Vérifier si le seuil de bonus est atteint
          if (newPoints >= (data.pointsConfig.bonusThreshold || 100)) {
            const reward: Reward = {
              id: `REW-${Date.now()}`,
              type: 'drink',
              title: 'Boisson offerte',
              description: `Récompense pour ${data.pointsConfig.bonusThreshold} points`,
              pointsRequired: data.pointsConfig.bonusThreshold,
              used: false,
              createdAt: Date.now(),
            };
            
            const currentRewards = data.availableRewards || [];
            updates.availableRewards = [...currentRewards, reward];
            
            // Réinitialiser les points si autoReset activé
            if (data.pointsConfig.autoReset) {
              updates.points = 0;
            }
          }
        }

        // Vérifier le passage VIP si mode montant
        if (data.loyaltyType === 'amount' || data.loyaltyType === 'vip') {
          const newTotal = (data.totalAmountSpent || 0) + orderTotal;
          updates.totalAmountSpent = newTotal;
          
          // Passage automatique en VIP si seuil atteint (ex: 100000 XAF)
          if (data.status !== 'vip' && newTotal >= 100000) {
            updates.status = 'vip';
            updates.vipSince = Date.now();
          } else if (data.status !== 'fidel' && newTotal >= 50000) {
            updates.status = 'fidel';
          }
        }

        transaction.update(customerRef, updates);
      });
    } catch (error) {
      console.error('Erreur mise à jour fidélité client:', error);
    }
  };

  const createOrder = async (status: OrderStatus) => {
    if (cart.length === 0 || !tableNumber.trim()) {
      toast({
        title: "Erreur",
        description: "Le panier est vide ou le numéro de table est manquant",
        variant: "destructive"
      });
      return;
    }

    if (!ownerUid) {
      toast({
        title: "Erreur de connexion",
        description: "Impossible de déterminer l'établissement. La commande sera enregistrée localement et synchronisée dès que possible.",
        variant: "destructive"
      });
      // Même sans ownerUid, on peut quand même ajouter la commande au contexte local
      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      addOrder({ orderNumber: orderCounter, tableNumber: tableNumber.trim(), items: [...cart], total, status, agentCode: agentCode! });
      setCart([]);
      setTableNumber("");
      return;
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Ajouter la commande au contexte local immédiatement
    addOrder({ orderNumber: orderCounter, tableNumber: tableNumber.trim(), items: [...cart], total, status, agentCode: agentCode! });
    
    const orderPayload: OutboxOrder = {
      orderNumber: orderCounter,
      tableNumber: tableNumber.trim(),
      items: cart.map(ci => ({ id: ci.id, name: ci.name, price: ci.price, quantity: ci.quantity, category: ci.category, stock: ci.stock })),
      total,
      status,
      createdAt: Date.now(),
      agentCode: agentInfo?.code ?? agentCode!,
      agentMemberId: agentInfo?.memberId,
      agentName: agentInfo?.name,
      agentToken: agentCode,
      customerId: selectedCustomer?.id,
    };

    let queued = false;
    let success = false;
    let orderDocId: string | null = null;
    
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      queued = true;
    } else {
      try {
        const docRef = await addDoc(ordersColRef(db, ownerUid), orderPayload);
        orderDocId = docRef.id;
        success = true;
        
        // Mettre à jour la fidélité du client si un client est associé
        if (selectedCustomer && selectedCustomer.id) {
          await updateCustomerLoyalty(selectedCustomer.id, total, orderDocId);
        }
        
        try {
          await addDoc(notificationsColRef(db, ownerUid), {
            title: "Nouvelle commande",
            message: `Table ${tableNumber.trim()} • Total ${total.toLocaleString()} XAF${selectedCustomer ? ` • Client: ${selectedCustomer.firstName} ${selectedCustomer.lastName}` : ''}`,
            type: "info",
            createdAt: Date.now(),
            read: false,
          });
        } catch { /* ignore notifications permission errors */ }
      } catch (e) {
        console.error('Erreur lors de l\'envoi de la commande:', e);
        queued = true;
      }
    }

    if (queued && ownerUid) {
      try {
        const key = getOrderOutboxKey(ownerUid, agentCode!);
        const raw = localStorage.getItem(key);
        const list: OutboxOrder[] = raw ? JSON.parse(raw) : [];
        list.push(orderPayload);
        localStorage.setItem(key, JSON.stringify(list));
        toast({ 
          title: "Commande enregistrée hors-ligne", 
          description: "Elle sera synchronisée automatiquement dès que la connexion sera rétablie.", 
        });
      } catch (e) { 
        console.error('Erreur lors de l\'enregistrement hors-ligne:', e);
        toast({
          title: "Erreur",
          description: "Impossible d'enregistrer la commande. Veuillez réessayer.",
          variant: "destructive"
        });
        return;
      }
    }

    setCart([]);
    setTableNumber("");
    setSelectedCustomer(null);

    const statusText = status === 'pending' ? 'mise en attente' : 'envoyée à la caisse';
    if (success) {
      let description = `Commande #${orderCounter} ${statusText} avec succès`;
      if (selectedCustomer) {
        if (selectedCustomer.loyaltyType === 'points') {
          const pointsEarned = Math.floor((total / 1000) * 10); // 10 points par 1000 XAF par défaut
          description += `. ${pointsEarned} points ajoutés au client`;
        } else {
          description += `. Montant ajouté au client`;
        }
      }
      toast({
        title: `Commande ${statusText}`,
        description,
      });
    }
  };

  const clearCart = () => {
    setCart([]);
    setTableNumber("");
  };

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  const handleSendOrder = () => {
    if (cart.length === 0) {
      toast({
        title: "Panier vide",
        description: "Ajoutez des produits avant d'envoyer la commande",
        variant: "destructive"
      });
      return;
    }
    if (!tableNumber.trim()) {
      toast({
        title: "Numéro de table requis",
        description: "Veuillez saisir le numéro de table",
        variant: "destructive"
      });
      return;
    }
    if (!ownerUid) {
      toast({
        title: "Erreur de connexion",
        description: "Impossible de déterminer l'établissement. Veuillez réessayer dans quelques instants.",
        variant: "destructive"
      });
      return;
    }
    // Envoyer directement la commande avec le statut 'sent'
    createOrder('sent');
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-[#f6f8f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-[#f6f8f6]/80 p-4 md:p-6 pb-2 backdrop-blur-sm border-b border-gray-200/50">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-primary rounded-full flex items-center justify-center">
            <User className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold leading-tight tracking-[-0.015em] text-gray-900">
              {agentInfo?.name || 'Serveur'}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {agentInfo?.name ? `Code: ${agentCode?.substring(0, 8)}...` : `Code: ${agentCode}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {/* Navigation Tabs */}
          <div className="hidden md:flex gap-2">
            <Button 
              variant={activeView === 'products' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('products')}
              className={activeView === 'products' ? 'bg-gradient-primary text-white shadow-button' : 'border-gray-200'}
            >
              <Package className="mr-2 h-4 w-4" />
              Produits
            </Button>
            <Button 
              variant={activeView === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('pending')}
              className={activeView === 'pending' ? 'bg-gradient-primary text-white shadow-button' : 'border-gray-200'}
            >
              <Clock className="mr-2 h-4 w-4" />
              En attente ({pendingOrders.length})
            </Button>
            <Button 
              variant={activeView === 'sent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('sent')}
              className={activeView === 'sent' ? 'bg-gradient-primary text-white shadow-button' : 'border-gray-200'}
            >
              <Send className="mr-2 h-4 w-4" />
              Envoyées ({sentOrders.length})
            </Button>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-gray-200"
          >
            <LogOut size={16} className="mr-2" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </header>
      {/* Mobile Navigation Tabs */}
      <div className="md:hidden border-b border-gray-200/50 bg-[#f6f8f6]/80 backdrop-blur-sm">
        <div className="flex gap-2 px-4 py-2 overflow-x-auto">
          <Button 
            variant={activeView === 'products' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('products')}
            className={activeView === 'products' ? 'bg-gradient-primary text-white shadow-button' : 'border-gray-200'}
          >
            <Package className="mr-2 h-4 w-4" />
            Produits
          </Button>
          <Button 
            variant={activeView === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('pending')}
            className={activeView === 'pending' ? 'bg-gradient-primary text-white shadow-button' : 'border-gray-200'}
          >
            <Clock className="mr-2 h-4 w-4" />
            En attente ({pendingOrders.length})
          </Button>
          <Button 
            variant={activeView === 'sent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('sent')}
            className={activeView === 'sent' ? 'bg-gradient-primary text-white shadow-button' : 'border-gray-200'}
          >
            <Send className="mr-2 h-4 w-4" />
            Envoyées ({sentOrders.length})
          </Button>
        </div>
      </div>

      {activeView === 'products' ? (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
              {/* Products Grid */}
              <div className="lg:col-span-2">
                <Card className="border border-gray-200 bg-white shadow-sm">
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <CardTitle>Produits disponibles</CardTitle>
                      <CardDescription>Sélectionnez les produits pour la commande</CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                        <Input
                          placeholder="Rechercher un produit..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 w-full md:w-[300px]"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Onglets Catégories - Design professionnel épuré */}
                  <div className="w-full border-b border-[#e6dfdb] mt-4">
                    <div className="flex overflow-x-auto scrollbar-hide gap-0.5 pb-1">
                      <button
                        key="all"
                        type="button"
                        onClick={() => setActiveCategoryTab("all")}
                        className={`flex flex-col items-center justify-center gap-1 pb-2.5 pt-2.5 px-3 min-w-[70px] transition-all rounded-t-lg ${
                          activeCategoryTab === "all" 
                            ? 'bg-nack-red/10 border-b-[3px] border-b-nack-red' 
                            : 'hover:bg-gray-50 border-b-[3px] border-b-transparent'
                        }`}
                      >
                        <Grid3x3 className={`h-5 w-5 flex-shrink-0 ${activeCategoryTab === "all" ? 'text-nack-red' : 'text-gray-500'}`} />
                        <span className={`font-semibold whitespace-nowrap text-[10px] sm:text-xs ${activeCategoryTab === "all" ? 'text-nack-red' : 'text-gray-600'}`}>
                          Tout
                        </span>
                      </button>
                      {availableCategories.length > 0 ? (
                        availableCategories.map((category) => {
                          const Icon = getCategoryIcon(category);
                          // Fonction améliorée pour raccourcir les noms de catégories
                          const getShortCategoryName = (cat: string): string => {
                            const catLower = cat.toLowerCase();
                            // Mappings spécifiques pour les catégories courantes
                            if (catLower.includes('boisson alcoolisée') || catLower.includes('alcool')) return 'Alcool';
                            if (catLower.includes('boisson non alcoolisée') || catLower.includes('boisson')) return 'Boisson';
                            if (catLower.includes('plat') || catLower.includes('repas')) return 'Plat';
                            if (catLower.includes('snack') || catLower.includes('collation')) return 'Snack';
                            if (catLower.includes('dessert')) return 'Dessert';
                            if (catLower.includes('entrée') || catLower.includes('apéritif')) return 'Entrée';
                            if (catLower.includes('pizza')) return 'Pizza';
                            if (catLower.includes('gril') || catLower.includes('grill')) return 'Gril';
                            if (catLower.includes('p\'tit déj') || catLower.includes('petit déjeuner') || catLower.includes('déjeuner')) return 'Déj';
                            if (catLower.includes('soda')) return 'Soda';
                            if (catLower.includes('accompagnement')) return 'Accomp.';
                            if (catLower.includes('autre')) return 'Autre';
                            // Si le nom est court (≤ 10 caractères), le garder tel quel
                            if (cat.length <= 10) return cat;
                            // Prendre les 2 premiers mots maximum
                            const words = cat.split(' ');
                            if (words.length > 2) {
                              return words.slice(0, 2).join(' ');
                            }
                            // Si un seul mot mais trop long, tronquer
                            if (words.length === 1 && cat.length > 10) {
                              return cat.substring(0, 10) + '...';
                            }
                            return cat;
                          };
                          const shortName = getShortCategoryName(category);
                          const isActive = activeCategoryTab === category;
                          return (
                            <button
                              key={category}
                              type="button"
                              onClick={() => setActiveCategoryTab(category)}
                              className={`flex flex-col items-center justify-center gap-1 pb-2.5 pt-2.5 px-3 min-w-[70px] transition-all rounded-t-lg ${
                                isActive
                                  ? 'bg-nack-red/10 border-b-[3px] border-b-nack-red' 
                                  : 'hover:bg-gray-50 border-b-[3px] border-b-transparent'
                              }`}
                              title={category} // Tooltip avec le nom complet au survol
                            >
                              <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-nack-red' : 'text-gray-500'}`} />
                              <span className={`font-semibold whitespace-nowrap text-[10px] sm:text-xs text-center leading-tight ${isActive ? 'text-nack-red' : 'text-gray-600'}`}>
                                {shortName}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="flex items-center justify-center px-3 py-3 text-sm text-muted-foreground">
                          Aucune catégorie disponible
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
                    {filteredProducts.map((product) => {
                      const imageUrl = product.imageUrl || undefined;
                      const colorClass = (() => {
                        const c = (product.category || '').toLowerCase();
                        if (c.includes('vin') || c.includes('alcool')) return 'bg-red-500';
                        if (c.includes('biere') || c.includes('boisson')) return 'bg-yellow-500';
                        if (c.includes('cafe')) return 'bg-purple-500';
                        if (c.includes('eau')) return 'bg-blue-500';
                        if (c.includes('jus')) return 'bg-orange-500';
                        if (c.includes('soda')) return 'bg-green-500';
                        if (c.includes('dessert') || c.includes('glace')) return 'bg-pink-500';
                        return 'bg-gray-200';
                      })();
                      return (
                        <button
                          key={product.id} 
                          type="button"
                          className="relative rounded-2xl border border-gray-200 bg-white p-3 shadow-lg transition hover:shadow-2xl hover:border-gray-300 text-left"
                          onClick={() => addToCart(product)}
                        >
                          <div className={`absolute left-0 top-0 h-1 w-full rounded-t-2xl ${colorClass}`} />
                          {imageUrl && imageUrl.trim() !== '' ? (
                            <div className="w-full aspect-square rounded-xl overflow-hidden bg-nack-beige-light relative">
                              <img
                                src={imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                              <div className="hidden w-full h-full items-center justify-center bg-gradient-to-br from-nack-beige-light to-nack-beige-light">
                                {(() => {
                                  const productWithIcon = product as Product & { icon?: string };
                                  return renderIconByName(productWithIcon.icon);
                                })()}
                              </div>
                            </div>
                          ) : (
                            <div className="w-full aspect-square rounded-xl flex items-center justify-center bg-gradient-to-br from-nack-beige-light to-nack-beige-light">
                              {(() => {
                                const productWithIcon = product as Product & { icon?: string };
                                return renderIconByName(productWithIcon.icon);
                              })()}
                            </div>
                          )}
                          <div className="mt-2 space-y-0.5">
                            <h3 className="font-semibold text-base truncate">{product.name}</h3>
                            {(() => {
                              const foodCategories = ["Plat / Repas", "Snack", "Dessert", "Entrée"];
                              const isFoodCategory = foodCategories.some(cat => 
                                product.category?.toLowerCase().includes(cat.toLowerCase().split(' / ')[0]) ||
                                product.category?.toLowerCase().includes(cat.toLowerCase()) ||
                                product.category?.toLowerCase() === 'plats'
                              );
                              // Afficher le stock uniquement si ce n'est pas une catégorie alimentaire
                              if (!isFoodCategory) {
                                return <p className="text-xs text-muted-foreground">Stock: {Number(product.stock || 0)}</p>;
                              }
                              return null;
                            })()}
                            <p className="text-xl md:text-2xl font-extrabold text-nack-red" style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                              {Number(product.price || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XAF
                            </p>
                          </div>
                          {(() => {
                            const foodCategories = ["Plat / Repas", "Snack", "Dessert", "Entrée"];
                            const isFoodCategory = foodCategories.some(cat => 
                              product.category?.toLowerCase().includes(cat.toLowerCase().split(' / ')[0]) ||
                              product.category?.toLowerCase().includes(cat.toLowerCase()) ||
                              product.category?.toLowerCase() === 'plats'
                            );
                            // Afficher "Rupture" uniquement pour les produits non alimentaires avec stock 0
                            if (!isFoodCategory && (product.stock || 0) === 0) {
                              return (
                                <div className="absolute top-1 right-1 flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-white/95 backdrop-blur px-2 text-[11px] font-bold text-red-600 shadow">
                                  Rupture
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <div className="absolute bottom-2 right-2 flex h-12 w-12 items-center justify-center rounded-full bg-nack-red text-white shadow-xl">
                            <Plus className="h-7 w-7" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

              {/* Cart */}
              <div>
                <Card className="border border-gray-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Commande en cours</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Table Number Input */}
                  <div className="space-y-2">
                    <Label htmlFor="table-number" className="text-sm font-medium">
                      Numéro de table *
                    </Label>
                    <Input
                      id="table-number"
                      placeholder="Ex: T01, 15, VIP-A..."
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                    />
                  </div>

                  {/* Client Favori */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Client favori (optionnel)
                    </Label>
                    {selectedCustomer ? (
                      <div className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={selectedCustomer.photoUrl} />
                            <AvatarFallback>
                              {selectedCustomer.firstName[0]}{selectedCustomer.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {selectedCustomer.firstName} {selectedCustomer.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCustomer(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setIsCustomerDialogOpen(true)}
                      >
                        <Heart className="w-4 h-4 mr-2" />
                        Associer un client favori
                      </Button>
                    )}
                  </div>

                  {/* Cart Items */}
                  {cart.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Aucun article dans la commande
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-sm text-muted-foreground">{Number(item.price || 0).toLocaleString()} XAF</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus size={16} />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={(() => {
                                // Pour les catégories alimentaires, ne pas désactiver le bouton
                                const foodCategories = ["Plat / Repas", "Snack", "Dessert", "Entrée"];
                                const isFoodCategory = foodCategories.some(cat => 
                                  item.category?.toLowerCase().includes(cat.toLowerCase().split(' / ')[0]) ||
                                  item.category?.toLowerCase().includes(cat.toLowerCase()) ||
                                  item.category?.toLowerCase() === 'plats'
                                );
                                if (isFoodCategory) return false;
                                return item.quantity >= (item.stock || 0);
                              })()}
                            >
                              <Plus size={16} />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      <div className="border-t pt-3 space-y-3">
                        <div className="flex justify-between items-center font-bold text-lg">
                          <span>Total:</span>
                          <span className="text-nack-red" style={{ display: 'inline-block', visibility: 'visible', opacity: 1 }}>
                            {Number(cartTotal || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XAF
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <Button 
                            onClick={handleSendOrder}
                            className="w-full bg-gradient-primary text-white shadow-button h-12"
                            disabled={!tableNumber.trim()}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Envoyer à la caisse
                          </Button>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <Button 
                              variant="outline"
                              onClick={() => createOrder('pending')}
                              className="h-10"
                              disabled={!tableNumber.trim()}
                            >
                              <Clock className="mr-2 h-4 w-4" />
                              En attente
                            </Button>
                            
                            <Button 
                              variant="destructive"
                              onClick={clearCart}
                              className="h-10"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Vider
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          {/* Barre flottante total / actions */}
            <div className="pointer-events-none fixed left-0 right-0 bottom-20 z-20 px-4 md:px-6">
              {cart.length > 0 && (
                <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl bg-nack-red/95 p-3 text-white shadow-2xl">
                  <button
                    className="flex h-16 w-16 items-center justify-center rounded-xl bg-red-700/80"
                    onClick={clearCart}
                    title="Vider"
                  >
                    <Trash2 className="h-8 w-8" />
                  </button>
                  <div className="flex flex-1 flex-col items-center justify-center">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight" style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                      {Number(cartTotal || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XAF
                    </span>
                  </div>
                  <button
                    className="flex h-16 w-16 items-center justify-center rounded-xl bg-green-600/90"
                    onClick={handleSendOrder}
                    title="Envoyer"
                    disabled={!tableNumber.trim()}
                  >
                    <Send className="h-8 w-8" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            <OrderHistory 
              orders={activeView === 'pending' ? pendingOrders : sentOrders}
              onUpdateOrderStatus={updateOrderStatus}
            />
          </div>
        </main>
      )}

      {/* Dialog de sélection de client */}
      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Associer un client favori</DialogTitle>
            <DialogDescription>
              Recherchez et sélectionnez un client régulier
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Rechercher par nom ou téléphone..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {availableCustomers
                .filter(customer => {
                  const query = customerSearchQuery.toLowerCase();
                  return (
                    customer.firstName.toLowerCase().includes(query) ||
                    customer.lastName.toLowerCase().includes(query) ||
                    customer.phone.includes(query) ||
                    customer.customerId.toLowerCase().includes(query)
                  );
                })
                .map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setIsCustomerDialogOpen(false);
                      setCustomerSearchQuery("");
                    }}
                  >
                    <Avatar>
                      <AvatarImage src={customer.photoUrl} />
                      <AvatarFallback>
                        {customer.firstName[0]}{customer.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {customer.firstName} {customer.lastName}
                        </p>
                        {customer.status === 'vip' && (
                          <Crown className="w-4 h-4 text-yellow-500" />
                        )}
                        {customer.status === 'fidel' && (
                          <Star className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{customer.phone}</p>
                      {customer.loyaltyType === 'points' && customer.points > 0 && (
                        <p className="text-xs text-yellow-600 mt-1">
                          {customer.points} points
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              {availableCustomers.filter(customer => {
                const query = customerSearchQuery.toLowerCase();
                return (
                  customer.firstName.toLowerCase().includes(query) ||
                  customer.lastName.toLowerCase().includes(query) ||
                  customer.phone.includes(query) ||
                  customer.customerId.toLowerCase().includes(query)
                );
              }).length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  {customerSearchQuery ? "Aucun client trouvé" : "Aucun client favori enregistré"}
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServeurInterface;