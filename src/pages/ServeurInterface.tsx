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
import { ordersColRef, productsColRef, teamColRef, notificationsColRef, agentTokensTopColRef } from "@/lib/collections";
import { addDoc, getDocs, limit, onSnapshot, query, where, collectionGroup, doc, getDoc } from "firebase/firestore";

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
  // Filtrer les produits avec stock > 0 ET prix > 0
  const sellableProducts = products.filter(product => {
    const stock = (product.stock || 0) > 0;
    const price = Number(product.price || 0) > 0;
    return stock && price;
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
    const isPlat = product.category?.toLowerCase() === 'plats';
    
    if (existingItem) {
      // Pour les plats, ignorer la vérification de stock
      if (isPlat || existingItem.quantity < product.stock) {
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

  const createOrder = async (status: OrderStatus) => {
    if (cart.length === 0 || !tableNumber.trim()) return;

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    addOrder({ orderNumber: orderCounter, tableNumber: tableNumber.trim(), items: [...cart], total, status, agentCode: agentCode! });
    
    const orderPayload: OutboxOrder = {
      orderNumber: orderCounter,
      tableNumber: tableNumber.trim(),
      items: cart.map(ci => ({ id: ci.id, name: ci.name, price: ci.price, quantity: ci.quantity, category: ci.category, stock: ci.stock })),
      total,
      status,
      createdAt: Date.now(),
      agentCode: agentInfo?.code ?? agentCode,
      agentMemberId: agentInfo?.memberId,
      agentName: agentInfo?.name,
      agentToken: agentCode,
    };

    let queued = false;
    if (!ownerUid || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      queued = true;
    } else {
      try {
        await addDoc(ordersColRef(db, ownerUid), orderPayload);
        try {
          await addDoc(notificationsColRef(db, ownerUid), {
            title: "Nouvelle commande",
            message: `Table ${tableNumber.trim()} • Total ${total.toLocaleString()} XAF`,
            type: "info",
            createdAt: Date.now(),
            read: false,
          });
        } catch { /* ignore notifications permission errors */ }
      } catch (e) {
        queued = true;
      }
    }

    if (queued && ownerUid) {
      try {
        const key = getOrderOutboxKey(ownerUid, agentCode);
        const raw = localStorage.getItem(key);
        const list: OutboxOrder[] = raw ? JSON.parse(raw) : [];
        list.push(orderPayload);
        localStorage.setItem(key, JSON.stringify(list));
        toast({ title: "Commande enregistrée hors-ligne", description: "Elle sera synchronisée automatiquement.", });
      } catch (e) { /* ignore quota errors */ }
    }

    setCart([]);
    setTableNumber("");
    setIsCheckoutOpen(false);

    const statusText = status === 'pending' ? 'mise en attente' : 'envoyée à la caisse';
    toast({
      title: `Commande ${statusText}`,
      description: `Commande #${orderCounter} ${statusText}`,
    });
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
    setIsCheckoutOpen(true);
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
              Interface Serveur
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">Code: {agentCode}</p>
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
                  {/* Onglets Catégories dynamiques */}
                  <div className="w-full border-b border-[#e6dfdb] mt-4">
                    <div className="flex overflow-x-auto scrollbar-hide">
                      <button
                        key="all"
                        type="button"
                        onClick={() => setActiveCategoryTab("all")}
                        className={`flex items-center justify-center gap-2 pb-3 pt-3 border-b-[4px] text-base min-w-[80px] px-3 ${
                          activeCategoryTab === "all" ? 'border-b-nack-red text-nack-red' : 'border-b-transparent text-muted-foreground'
                        }`}
                      >
                        <Grid3x3 className="h-6 w-6 flex-shrink-0" />
                        <span className="hidden sm:inline font-semibold whitespace-nowrap">Tout</span>
                      </button>
                      {availableCategories.length > 0 ? (
                        availableCategories.map((category) => {
                          const Icon = getCategoryIcon(category);
                          return (
                            <button
                              key={category}
                              type="button"
                              onClick={() => setActiveCategoryTab(category)}
                              className={`flex items-center justify-center gap-2 pb-3 pt-3 border-b-[4px] text-base min-w-[80px] px-3 ${
                                activeCategoryTab === category ? 'border-b-nack-red text-nack-red' : 'border-b-transparent text-muted-foreground'
                              }`}
                            >
                              <Icon className="h-6 w-6 flex-shrink-0" />
                              <span className="hidden sm:inline font-semibold whitespace-nowrap">{category}</span>
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
                            <p className="text-xs text-muted-foreground">Stock: {Number(product.stock || 0)}</p>
                            <p className="text-xl md:text-2xl font-extrabold text-nack-red" style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                              {Number(product.price || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XAF
                            </p>
                          </div>
                          {(product.stock || 0) === 0 && (
                            <div className="absolute top-1 right-1 flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-white/95 backdrop-blur px-2 text-[11px] font-bold text-red-600 shadow">
                              Rupture
                            </div>
                          )}
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
                              disabled={item.quantity >= item.stock}
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
    </div>
  );
};

export default ServeurInterface;