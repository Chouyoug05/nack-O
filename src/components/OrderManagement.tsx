import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/contexts/OrderContext";
import { Order, OrderStatus } from "@/types/order";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { ordersColRef, productsColRef, salesColRef } from "@/lib/collections";
import { onSnapshot, orderBy, query, updateDoc, doc as fsDoc, runTransaction, addDoc } from "firebase/firestore";
import type { SaleDoc, SaleItem, PaymentMethod } from "@/types/inventory";

interface FirestoreOrderItem {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  stock?: number;
}

interface FirestoreOrderDoc {
  orderNumber?: number;
  tableNumber?: string;
  items?: FirestoreOrderItem[];
  total?: number;
  status?: OrderStatus;
  createdAt?: number;
  agentCode?: string;
  agentMemberId?: string;
  agentName?: string;
}

interface OrderManagementProps {
  showActions?: boolean;
  title?: string;
  description?: string;
  ownerOverrideUid?: string;
  agentToken?: string;
  onGoToSales?: () => void;
}

const getManagerOrdersCacheKey = (uid: string) => `nack_m_orders_${uid}`;
const getManagerOutboxKey = (uid: string) => `nack_m_outbox_${uid}`;

interface OutboxUpdate { id: string; status: OrderStatus; }

const normalizeOrdersFromCache = (input: unknown): Order[] => {
  if (!Array.isArray(input)) return [] as Order[];
  return (input as unknown[]).map((o) => {
    const maybe = o as Partial<Order> & { createdAt?: unknown };
    const createdAtRaw = maybe.createdAt;
    const dateObj = createdAtRaw instanceof Date
      ? createdAtRaw
      : new Date(typeof createdAtRaw === 'number' ? createdAtRaw : String(createdAtRaw));
    return {
      ...(maybe as Order),
      createdAt: dateObj,
    } as Order;
  });
};

const OrderManagement = ({ 
  showActions = true, 
  title = "Commandes reçues",
  description = "Gérez les commandes des serveurs",
  ownerOverrideUid,
  agentToken,
  onGoToSales,
}: OrderManagementProps) => {
  const { orders: localOrders, updateOrderStatus } = useOrders();
  const { toast } = useToast();
  const { user } = useAuth();
  const [fsOrders, setFsOrders] = useState<Order[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [paymentMethodByOrder, setPaymentMethodByOrder] = useState<Record<string, PaymentMethod>>({});

  // Determine which uid to use for Firestore operations
  const uidToUse = ownerOverrideUid || user?.uid;
  const isOwnerAuthed = !!user && user.uid === uidToUse;

  // Load orders from Firestore with cache fallback
  useEffect(() => {
    if (!uidToUse) return;
    // Warm cache first
    try {
      const cached = localStorage.getItem(getManagerOrdersCacheKey(uidToUse));
      if (cached) {
        const parsed = JSON.parse(cached) as unknown;
        const normalized = normalizeOrdersFromCache(parsed);
        if (normalized && normalized.length) setFsOrders(normalized);
      }
    } catch (e) { /* ignore */ }

    const q = query(ordersColRef(db, uidToUse), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Order[] = snap.docs.map((d, idx) => {
        const data = d.data() as FirestoreOrderDoc;
        const items = (data.items ?? []).map((it) => ({
          id: it.id ?? it.name,
          name: it.name,
          price: Number(it.price),
          quantity: Number(it.quantity),
          category: it.category ?? '',
          stock: it.stock ?? 0,
        }));
        const createdAtMs = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
        return {
          id: d.id,
          orderNumber: data.orderNumber ?? (snap.size - idx),
          tableNumber: String(data.tableNumber ?? ""),
          items,
          total: Number(data.total ?? 0),
          status: (data.status ?? 'pending') as OrderStatus,
          createdAt: new Date(createdAtMs),
          agentCode: data.agentCode ?? data.agentMemberId ?? '—',
          agentName: data.agentName,
        } as Order;
      });
      setFsOrders(list);
      try { localStorage.setItem(getManagerOrdersCacheKey(uidToUse), JSON.stringify(list)); } catch (e) { /* ignore */ }
    }, () => {
      // Snapshot error → fallback to cache
      try {
        const cached = localStorage.getItem(getManagerOrdersCacheKey(uidToUse));
        if (cached) {
          const normalized = normalizeOrdersFromCache(JSON.parse(cached));
          setFsOrders(normalized);
        }
      } catch (e) { /* ignore */ }
    });
    return () => unsub();
  }, [uidToUse]);

  // Flush outbox when online
  useEffect(() => {
    const flush = async () => {
      if (!uidToUse) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      let queued: OutboxUpdate[] = [];
      try {
        const raw = localStorage.getItem(getManagerOutboxKey(uidToUse));
        if (raw) queued = JSON.parse(raw) as OutboxUpdate[];
      } catch (e) { /* ignore */ }
      if (!queued.length) return;
      const remaining: OutboxUpdate[] = [];
      for (const u of queued) {
        try {
          await updateDoc(fsDoc(ordersColRef(db, uidToUse), u.id), agentToken ? { status: u.status, agentToken } : { status: u.status });
        } catch (e) {
          remaining.push(u);
        }
      }
      try {
        if (remaining.length) localStorage.setItem(getManagerOutboxKey(uidToUse), JSON.stringify(remaining));
        else localStorage.removeItem(getManagerOutboxKey(uidToUse));
      } catch (e) { /* ignore */ }
    };
    flush();
    const onOnline = () => flush();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [uidToUse, agentToken]);

  const orders = useMemo(() => (uidToUse ? fsOrders : localOrders), [uidToUse, fsOrders, localOrders]);

  const setPaymentMethodFor = (orderId: string, method: PaymentMethod) => {
    setPaymentMethodByOrder(prev => ({ ...prev, [orderId]: method }));
  };

  const getStatusIcon = (status: OrderStatus) => {
    const icons = {
      pending: <Clock className="h-4 w-4" />,
      sent: <CheckCircle className="h-4 w-4" />,
      cancelled: <XCircle className="h-4 w-4" />
    };
    return icons[status];
  };

  const getStatusColor = (status: OrderStatus) => {
    const colors = {
      pending: "bg-accent text-accent-foreground",
      sent: "bg-primary text-primary-foreground", 
      cancelled: "bg-destructive text-destructive-foreground"
    };
    return colors[status];
  };

  const getStatusText = (status: OrderStatus) => {
    const texts = {
      pending: "En attente",
      sent: "Validée",
      cancelled: "Annulée"
    };
    return texts[status];
  };

  const queueManagerUpdate = (id: string, status: OrderStatus) => {
    if (!uidToUse) return;
    try {
      const key = getManagerOutboxKey(uidToUse);
      const raw = localStorage.getItem(key);
      const list: OutboxUpdate[] = raw ? JSON.parse(raw) : [];
      list.push({ id, status });
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) { /* ignore */ }
  };

  const handleProcessOrder = async (order: Order) => {
    if (processingIds.has(order.id)) return;
    setProcessingIds(prev => new Set(prev).add(order.id));
    toast({ title: "Validation en cours...", description: `Commande #${order.orderNumber}` });
    if (uidToUse && (typeof navigator === 'undefined' || navigator.onLine)) {
      try {
        let redirected = false;
        if (onGoToSales) {
          // Pré-remplir le panier de la page Ventes et y naviguer
          try {
            const prefill = order.items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity }));
            localStorage.setItem('nack_prefill_cart', JSON.stringify(prefill));
            localStorage.setItem('nack_prefill_order_meta', JSON.stringify({ orderId: order.id, ownerUid: uidToUse }));
          } catch { /* ignore */ }
          onGoToSales();
          toast({ title: "Panier pré-rempli", description: "Rendez-vous dans Point de Vente pour encaisser." });
          redirected = true;
        }
        if (redirected) {
          setProcessingIds(prev => { const s = new Set(prev); s.delete(order.id); return s; });
          return; // Stop flow ici; la vente sera créée depuis SalesPage
        }

        // 3) Marquer la commande comme validée (autorisé via agentToken même sans auth)
        const updatePayload = agentToken && !isOwnerAuthed ? { status: 'sent', agentToken } : { status: 'sent' };
        await updateDoc(fsDoc(ordersColRef(db, uidToUse), order.id), updatePayload);

        setFsOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'sent' } : o));
        updateOrderStatus(order.id, 'sent');
        toast({ title: isOwnerAuthed ? "Encaissement réussi" : "Commande validée", description: `Commande #${order.orderNumber} ${isOwnerAuthed ? 'encaissée' : 'validée'}` });
      } catch (e: unknown) {
        // Si l'agent n'est pas le gérant, on met en file et on met à jour l'UI pour ne pas bloquer
        if (!isOwnerAuthed && agentToken && uidToUse) {
          queueManagerUpdate(order.id, 'sent');
          setFsOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'sent' } : o));
          updateOrderStatus(order.id, 'sent');
          toast({ title: "Validation en file", description: "La commande sera validée dès que possible.", });
        } else {
          const message = e instanceof Error ? e.message : 'Erreur lors de la validation';
          toast({ title: 'Erreur', description: message, variant: 'destructive' });
        }
      } finally {
        setProcessingIds(prev => { const s = new Set(prev); s.delete(order.id); return s; });
      }
    } else {
      queueManagerUpdate(order.id, 'sent');
      setFsOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'sent' } : o));
    updateOrderStatus(order.id, 'sent');
      toast({ title: "Validation hors-ligne", description: "La commande sera validée dès le retour en ligne." });
      setProcessingIds(prev => { const s = new Set(prev); s.delete(order.id); return s; });
    }
  };

  const handleCancelOrder = (order: Order) => {
    if (uidToUse && (typeof navigator === 'undefined' || navigator.onLine)) {
      const updatePayload = agentToken && !isOwnerAuthed ? { status: 'cancelled', agentToken } : { status: 'cancelled' };
      updateDoc(fsDoc(ordersColRef(db, uidToUse), order.id), updatePayload).catch(() => {
        queueManagerUpdate(order.id, 'cancelled');
        toast({ title: "Annulation mise en file", description: "La commande sera annulée dès le retour en ligne." });
      });
    } else {
      queueManagerUpdate(order.id, 'cancelled');
      toast({ title: "Annulation hors-ligne", description: "La commande sera annulée dès le retour en ligne." });
    }
    setFsOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o));
    updateOrderStatus(order.id, 'cancelled');
    toast({
      title: "Commande annulée",
      description: `Commande #${order.orderNumber} annulée`,
      variant: "destructive"
    });
  };

  // Trier les commandes : en attente d'abord, puis par date
  const sortedOrders = [...orders].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="flex gap-2 text-sm">
          <Badge variant="outline" className="text-accent-foreground">
            En attente: {orders.filter(o => o.status === 'pending').length}
          </Badge>
          <Badge variant="outline" className="text-primary">
            Traitées: {orders.filter(o => o.status === 'sent').length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
        {sortedOrders.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Aucune commande pour le moment
          </p>
        ) : (
          sortedOrders.map((order) => (
            <div key={order.id} className="bg-card border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="font-semibold text-lg">#{order.orderNumber}</div>
                  <Badge variant="outline" className="text-sm font-semibold">
                    Table {order.tableNumber}
                  </Badge>
                  <Badge className={`${getStatusColor(order.status)} flex items-center gap-1`}>
                    {getStatusIcon(order.status)}
                    {getStatusText(order.status)}
                  </Badge>
                </div>
                <div className="text-right text-sm">
                  <div className="text-muted-foreground">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Agent: {order.agentName ? `${order.agentName} (${order.agentCode})` : order.agentCode}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Articles:</div>
                {order.items.map((item, index) => (
                  <div 
                    key={index} 
                    className="flex justify-between text-sm bg-muted p-2 rounded cursor-pointer"
                    onClick={() => {
                      if (onGoToSales) {
                        try {
                          const prefill = [{ id: item.id, name: item.name, price: item.price, quantity: item.quantity }];
                          localStorage.setItem('nack_prefill_cart', JSON.stringify(prefill));
                        } catch { /* ignore */ }
                        onGoToSales();
                      }
                    }}
                  >
                    <span>{item.name} x{item.quantity}</span>
                    <span className="font-medium">{(item.price * item.quantity).toLocaleString()} XAF</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-nack-red">{order.total.toLocaleString()} XAF</span>
                </div>
              </div>

              {showActions && (
                <div className="flex gap-2">
                  {isOwnerAuthed && (
                    <select
                      className="border rounded px-2 text-sm h-9"
                      value={paymentMethodByOrder[order.id] || 'cash'}
                      onChange={(e) => setPaymentMethodFor(order.id, e.target.value as PaymentMethod)}
                    >
                      <option value="cash">Espèces</option>
                      <option value="mobile">Mobile Money</option>
                      <option value="card">Carte</option>
                    </select>
                  )}
                  <Button
                    onClick={() => handleProcessOrder(order)}
                    className="flex-1 bg-gradient-primary text-white shadow-button"
                    disabled={processingIds.has(order.id)}
                    type="button"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isOwnerAuthed ? 'Valider et encaisser' : 'Valider la commande'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleCancelOrder(order)}
                    disabled={processingIds.has(order.id)}
                    type="button"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default OrderManagement;