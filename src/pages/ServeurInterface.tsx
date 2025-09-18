import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/contexts/OrderContext";
import { Product, CartItem, OrderStatus } from "@/types/order";
import ProductGrid from "@/components/ProductGrid";
import OrderHistory from "@/components/OrderHistory";
import { 
  LogOut,
  User,
  Package,
  Clock,
  Send,
  Trash2,
  ShoppingCart
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
}

// Offline helpers
const getProductsCacheKey = (ownerUid: string) => `nack_products_${ownerUid}`;
const getOrderOutboxKey = (ownerUid: string, agentCode: string) => `nack_order_outbox_${ownerUid}_${agentCode}`;

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
  const [agentInfo, setAgentInfo] = useState<{ name: string; code: string; memberId?: string } | null>(null);
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [fsProducts, setFsProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    // Resolve ownerUid via agentTokens first, then collectionGroup as fallback
    const resolveOwner = async () => {
      if (!agentCode) return;
      // Try public token mapping first
      try {
        const tokenDoc = await getDoc(doc(agentTokensTopColRef(db), agentCode));
        if (tokenDoc.exists()) {
          const data = tokenDoc.data() as { ownerUid?: string; firstName?: string; lastName?: string };
          if (data.ownerUid) {
            setOwnerUid(data.ownerUid);
            const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Agent';
            setAgentInfo({ name, code: agentCode });
            return;
          }
        }
      } catch { /* ignore */ }
      // Fallback to collectionGroup if permitted
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
        }
      } catch { /* ignore permissions */ }
    };
    resolveOwner();
  }, [agentCode]);

  // Load products from Firestore and cache locally; fallback to cache if offline or unavailable
  useEffect(() => {
    if (!ownerUid) { setFsProducts(null); return; }
    // Try loading from cache first for faster UI
    try {
      const cached = localStorage.getItem(getProductsCacheKey(ownerUid));
      if (cached) {
        const parsed: Product[] = JSON.parse(cached);
        if (parsed && parsed.length) setFsProducts(parsed);
      }
    } catch { /* ignore cache errors */ }

    const unsub = onSnapshot(productsColRef(db, ownerUid), (snap) => {
      const list: Product[] = snap.docs.map((d) => {
        const data = d.data() as FirestoreProductDoc & { imageUrl?: string };
        return {
          id: d.id,
          name: data.name,
          price: Number(data.price),
          category: data.category,
          stock: Number(data.quantity),
          image: 'menu',
          imageUrl: (data as unknown as { imageUrl?: string }).imageUrl,
        } as Product;
      });
      setFsProducts(list);
      try { localStorage.setItem(getProductsCacheKey(ownerUid), JSON.stringify(list)); } catch (e) { /* ignore quota errors */ }
    }, () => {
      // Snapshot error: stay on cache if any
      if (!fsProducts) {
        try {
          const cached = localStorage.getItem(getProductsCacheKey(ownerUid));
          if (cached) setFsProducts(JSON.parse(cached));
        } catch (e) { /* ignore parse errors */ }
      }
    });
    return () => unsub();
  }, [ownerUid]);

  // Flush outbox when back online or when ownerUid is ready
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
          // Try to notify the manager, but ignore permission errors for agents
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

  if (!agentCode) {
    return <Navigate to="/not-found" replace />;
  }

  const agentOrders = getOrdersByAgent(agentCode);
  const pendingOrders = agentOrders.filter(order => order.status === 'pending');
  const sentOrders = agentOrders.filter(order => order.status === 'sent');

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
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
    // local context for UI responsiveness
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
        // Try to create a notification; ignore if forbidden for agents
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

    createOrder('pending');
  };

  const handleSaveAsDraft = () => {
    if (cart.length === 0) {
      toast({
        title: "Panier vide",
        description: "Ajoutez des produits avant de sauvegarder",
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

    createOrder('pending');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-nack-beige-light to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center">
                <User className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Interface Serveur</h1>
                <p className="text-sm text-muted-foreground">Code: {agentCode}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
              <LogOut size={16} className="mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <Button 
            variant={activeView === 'products' ? 'default' : 'outline'}
            onClick={() => setActiveView('products')}
            className={activeView === 'products' ? 'bg-gradient-primary text-white shadow-button' : ''}
          >
            <Package className="mr-2 h-4 w-4" />
            Produits
          </Button>
          <Button 
            variant={activeView === 'pending' ? 'default' : 'outline'}
            onClick={() => setActiveView('pending')}
            className={activeView === 'pending' ? 'bg-gradient-primary text-white shadow-button' : ''}
          >
            <Clock className="mr-2 h-4 w-4" />
            En attente ({pendingOrders.length})
          </Button>
          <Button 
            variant={activeView === 'sent' ? 'default' : 'outline'}
            onClick={() => setActiveView('sent')}
            className={activeView === 'sent' ? 'bg-gradient-primary text-white shadow-button' : ''}
          >
            <Send className="mr-2 h-4 w-4" />
            Envoyées ({sentOrders.length})
          </Button>
        </div>

        {activeView === 'products' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Products Grid */}
            <div className="lg:col-span-2">
              <ProductGrid 
                cart={cart}
                onAddToCart={addToCart}
                onUpdateQuantity={updateQuantity}
                productsOverride={fsProducts ?? []}
              />
            </div>

            {/* Current Order */}
            <div className="space-y-4">
              {/* Table Number Input */}
              <div className="bg-card p-4 rounded-lg border shadow-card">
                <Label htmlFor="table-number" className="text-sm font-medium">
                  Numéro de table *
                </Label>
                <Input
                  id="table-number"
                  placeholder="Ex: T01, 15, VIP-A..."
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="mt-2"
                />
              </div>

              {/* Cart Summary */}
              <div className="bg-card p-4 rounded-lg border shadow-card">
                <h3 className="font-semibold mb-3">Commande en cours</h3>
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
                          <p className="text-sm text-muted-foreground">{item.price.toLocaleString()} XAF</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            -
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.stock}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="border-t pt-3 space-y-3">
                      <div className="flex justify-between items-center font-bold text-lg">
                        <span>Total:</span>
                        <span className="text-nack-red">{cartTotal.toLocaleString()} XAF</span>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <Button 
                          onClick={handleSendOrder}
                          className="w-full bg-gradient-primary text-white shadow-button h-12"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Envoyer à la caisse
                        </Button>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            variant="outline"
                            onClick={handleSaveAsDraft}
                            className="h-10"
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
              </div>
            </div>
          </div>
        ) : (
          <OrderHistory 
            orders={activeView === 'pending' ? pendingOrders : sentOrders}
            onUpdateOrderStatus={updateOrderStatus}
          />
        )}
      </div>
    </div>
  );
};

export default ServeurInterface;