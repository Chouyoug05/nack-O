import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/contexts/OrderContext";
import { Order, OrderStatus, ORDER_STATUS_LABELS, PaymentMethod as OrderPaymentMethod } from "@/types/order";
import { Clock, CheckCircle, XCircle, User, Pencil, Banknote, ChefHat } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { ordersColRef, productsColRef, salesColRef } from "@/lib/collections";
import { onSnapshot, orderBy, query, updateDoc, doc as fsDoc, getDoc, runTransaction, addDoc, getDocs } from "firebase/firestore";
import type { SaleDoc, SaleItem, PaymentMethod } from "@/types/inventory";
import type { UserProfile } from "@/types/profile";
import { OrderCancelDialog } from "@/components/OrderCancelDialog";
import { cancelOrderWithLogging, canCancelOrder, checkRefundRequired } from "@/utils/orderCancellation";

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
  serverId?: string;
  serverName?: string;
  cookName?: string;
  managerId?: string;
  paymentStatus?: 'unpaid' | 'paid';
  paymentMethod?: string;
  paidBy?: 'server' | 'manager';
  paidAt?: number;
  deliveredAt?: number;
}

interface OrderManagementProps {
  showActions?: boolean;
  title?: string;
  description?: string;
  ownerOverrideUid?: string;
  agentToken?: string;
  onGoToSales?: () => void;
  onLoadOrderToCart?: (order: Order) => void;
  onPayOrder?: (order: Order) => void;
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
      status: normalizeStatus(maybe.status),
      createdAt: dateObj,
    } as Order;
  });
};

// Compatibilité : statuts legacy → nouveaux statuts
const normalizeStatus = (status?: string): OrderStatus => {
  if (status === 'pending') return 'awaiting-validation';
  if (status === 'sent') return 'validated';
  if (status === 'served') return 'delivered';
  if (status === 'confirmed') return 'validated';
  if (status === 'completed') return 'closed';
  if (status === 'en-attente') return 'awaiting-validation';
  if (status === 'en-preparation') return 'in-preparation';
  if (status === 'pret' || status === 'prêt') return 'ready';
  if (status === 'termine' || status === 'terminé') return 'closed';
  const validStatuses: OrderStatus[] = ['awaiting-validation', 'validated', 'in-preparation', 'ready', 'delivered', 'paid', 'closed', 'cancelled'];
  const candidate = (status ?? 'awaiting-validation') as OrderStatus;
  return validStatuses.includes(candidate) ? candidate : 'awaiting-validation';
};

const ORDER_STATUS_STYLES: Record<OrderStatus, { badge: string; text: string }> = {
  'awaiting-validation': { badge: "bg-accent text-accent-foreground", text: "En attente de validation" },
  'validated': { badge: "bg-primary text-primary-foreground", text: "Validée — en cuisine" },
  'in-preparation': { badge: "bg-amber-100 text-amber-800", text: "En préparation" },
  'ready': { badge: "bg-green-600 text-white", text: "Prête" },
  'delivered': { badge: "bg-blue-600 text-white", text: "Livrée" },
  'paid': { badge: "bg-emerald-600 text-white", text: "Payée" },
  'closed': { badge: "bg-gray-600 text-white", text: "Clôturée" },
  'cancelled': { badge: "bg-destructive text-destructive-foreground", text: "Annulée" },
};

const getStatusStyle = (status: OrderStatus) =>
  ORDER_STATUS_STYLES[status] ?? { badge: "bg-gray-600 text-white", text: status };

const OrderManagement = ({ 
  showActions = true, 
  title = "Commandes reçues",
  description = "Suivi complet du circuit des commandes (serveur → cuisine → encaissement)",
  ownerOverrideUid,
  agentToken,
  onGoToSales,
  onLoadOrderToCart,
  onPayOrder,
}: OrderManagementProps) => {
  const { orders: localOrders, updateOrderStatus } = useOrders();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [fsOrders, setFsOrders] = useState<Order[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [paymentMethodByOrder, setPaymentMethodByOrder] = useState<Record<string, PaymentMethod>>({});
  const [cancelDialogOrder, setCancelDialogOrder] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

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
          status: normalizeStatus(data.status),
          paymentStatus: (data.paymentStatus ?? 'unpaid') as 'unpaid' | 'paid',
          paymentMethod: (data.paymentMethod as OrderPaymentMethod) || undefined,
          paidBy: data.paidBy,
          createdAt: new Date(createdAtMs),
          agentCode: data.agentCode ?? data.agentMemberId ?? '—',
          agentName: data.agentName,
          serverId: data.serverId,
          serverName: data.serverName,
          cookName: data.cookName,
          managerId: data.managerId,
          deliveredAt: data.deliveredAt,
          paidAt: data.paidAt,
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
    const icons: Record<OrderStatus, React.ReactNode> = {
      'awaiting-validation': <Clock className="h-4 w-4" />,
      'validated': <CheckCircle className="h-4 w-4" />,
      'in-preparation': <Clock className="h-4 w-4" />,
      'ready': <CheckCircle className="h-4 w-4" />,
      'delivered': <CheckCircle className="h-4 w-4" />,
      'paid': <Banknote className="h-4 w-4" />,
      'closed': <CheckCircle className="h-4 w-4" />,
      'cancelled': <XCircle className="h-4 w-4" />,
    };
    return icons[status] ?? <Clock className="h-4 w-4" />;
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

  // Le gérant/caissier valide une commande en attente (les assigne à la cuisine)
  const handleValidateOrder = async (order: Order) => {
    if (processingIds.has(order.id)) return;
    setProcessingIds(prev => new Set(prev).add(order.id));
    if (!uidToUse) {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(order.id); return s; });
      return;
    }
    try {
      await updateDoc(fsDoc(ordersColRef(db, uidToUse), order.id), {
        status: 'validated',
        serverId: order.serverId || (agentToken || undefined),
        serverName: order.serverName || profile?.ownerName || user?.email || undefined,
        validatedByServerAt: Date.now(),
        updatedAt: Date.now(),
      });
      setFsOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'validated' } : o));
      updateOrderStatus(order.id, 'validated');
      toast({ title: "Commande validée", description: `Commande #${order.orderNumber} envoyée en cuisine` });
    } catch (e) {
      toast({ title: 'Erreur', description: 'Impossible de valider la commande.', variant: 'destructive' });
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(order.id); return s; });
    }
  };

  // Encaissement d'une commande livrée : via la caisse (SalesPage) ou directement
  const handleCashInOrder = async (order: Order) => {
    if (processingIds.has(order.id)) return;
    setProcessingIds(prev => new Set(prev).add(order.id));

    if (!uidToUse) {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(order.id); return s; });
      return;
    }

    // Si une page caisse est fournie (SalesPage), charger la commande dans le panier d'encaissement
    if (onPayOrder) {
      try {
        localStorage.setItem('nack_prefill_cart', JSON.stringify(
          order.items.map(it => ({ id: it.id, name: it.name, price: it.price, quantity: it.quantity }))
        ));
        localStorage.setItem('nack_prefill_order_meta', JSON.stringify({
          orderId: order.id,
          ownerUid: uidToUse,
          tableNumber: order.tableNumber,
        }));
      } catch { /* ignore */ }
      onPayOrder(order);
      setProcessingIds(prev => { const s = new Set(prev); s.delete(order.id); return s; });
      return;
    }

    const paymentMethod = paymentMethodByOrder[order.id] || 'cash';
    const managerId = user?.uid;
    const paidAt = Date.now();
    try {
      await updateDoc(fsDoc(ordersColRef(db, uidToUse), order.id), {
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod,
        paidBy: 'manager',
        managerId,
        paidAt,
        updatedAt: paidAt,
      });
      setFsOrders(prev => prev.map(o => o.id === order.id ? {
        ...o,
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: paymentMethod as OrderPaymentMethod,
        paidBy: 'manager' as const,
        managerId,
        paidAt,
      } : o));
      updateOrderStatus(order.id, 'paid');
      toast({
        title: "Encaissement enregistré",
        description: `Commande #${order.orderNumber} encaissée (${paymentMethod === 'cash' ? 'espèces' : paymentMethod === 'mobile' ? 'mobile money' : 'carte'})`,
      });
    } catch (e) {
      if (agentToken && uidToUse) {
        queueManagerUpdate(order.id, 'paid');
        setFsOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'paid', paymentStatus: 'paid' } : o));
        updateOrderStatus(order.id, 'paid');
        toast({ title: "Encaissement en file", description: "Sera synchronisé dès que possible." });
      } else {
        toast({ title: 'Erreur', description: 'Impossible de procéder à l\'encaissement.', variant: 'destructive' });
      }
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(order.id); return s; });
    }
  };

  // Clôture une commande payée
  const handleCloseOrder = async (order: Order) => {
    if (!uidToUse) return;
    try {
      await updateDoc(fsDoc(ordersColRef(db, uidToUse), order.id), {
        status: 'closed',
        closedAt: Date.now(),
        updatedAt: Date.now(),
      });
      setFsOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'closed' } : o));
      updateOrderStatus(order.id, 'closed');
      toast({ title: "Commande clôturée", description: `Commande #${order.orderNumber} clôturée` });
    } catch (e) {
      toast({ title: 'Erreur', description: 'Impossible de clôturer la commande.', variant: 'destructive' });
    }
  };

  const handleCancelOrderClick = async (order: Order) => {
    if (!uidToUse || !user) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté pour annuler une commande.",
        variant: "destructive"
      });
      return;
    }

    // Vérifier si l'annulation est possible
    const canCancel = await canCancelOrder(order.id, uidToUse, order.status, order.createdAt);
    if (!canCancel.canCancel) {
      toast({
        title: "Annulation impossible",
        description: canCancel.reason || "Cette commande ne peut pas être annulée.",
        variant: "destructive"
      });
      return;
    }

    // Vérifier si un remboursement est nécessaire
    const refundCheck = await checkRefundRequired(order.id, uidToUse, order.total, order.createdAt);
    
    // Ouvrir le dialog d'annulation
    setCancelDialogOrder({
      ...order,
      // Ajouter paymentMethod si trouvé
      ...(refundCheck.paymentMethod && { paymentMethod: refundCheck.paymentMethod as PaymentMethod })
    } as Order & { paymentMethod?: PaymentMethod });
  };

  const handleConfirmCancel = async (reason: string, refundRequired: boolean) => {
    if (!cancelDialogOrder || !uidToUse || !user) return;

    setIsCancelling(true);
    try {
      // Récupérer le paymentMethod de la commande ou de la vérification
      let paymentMethod: PaymentMethod | undefined;
      if (refundRequired) {
        const refundCheck = await checkRefundRequired(
          cancelDialogOrder.id,
          uidToUse,
          cancelDialogOrder.total,
          cancelDialogOrder.createdAt
        );
        paymentMethod = refundCheck.paymentMethod as PaymentMethod | undefined;
      }

      // Annuler avec journalisation
      await cancelOrderWithLogging(
        cancelDialogOrder.id,
        uidToUse,
        cancelDialogOrder.orderNumber,
        cancelDialogOrder.status,
        cancelDialogOrder.total,
        cancelDialogOrder.createdAt,
        user.uid,
        profile?.ownerName || user.email || 'Utilisateur',
        reason,
        refundRequired,
        paymentMethod,
        {
          flowType: 'table_order',
          agentCode: cancelDialogOrder.agentCode,
          agentName: cancelDialogOrder.agentName,
          tableNumber: cancelDialogOrder.tableNumber
        }
      );

      // Mettre à jour l'état local
      setFsOrders(prev => prev.map(o => o.id === cancelDialogOrder.id ? { ...o, status: 'cancelled' } : o));
      updateOrderStatus(cancelDialogOrder.id, 'cancelled');

      toast({
        title: "Commande annulée",
        description: `Commande #${cancelDialogOrder.orderNumber} annulée${refundRequired ? '. Remboursement requis.' : '.'}`,
        variant: refundRequired ? "default" : "destructive"
      });

      setCancelDialogOrder(null);
    } catch (error) {
      console.error('Erreur lors de l\'annulation:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'annuler la commande.",
        variant: "destructive"
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const loadOrderForSales = (order: Order, openCheckout: boolean) => {
    if (onLoadOrderToCart && !openCheckout) {
      onLoadOrderToCart(order);
      return;
    }
    if (onPayOrder && openCheckout) {
      onPayOrder(order);
      return;
    }
    try {
      localStorage.setItem('nack_prefill_cart', JSON.stringify(
        order.items.map(it => ({ id: it.id, name: it.name, price: it.price, quantity: it.quantity }))
      ));
      localStorage.setItem('nack_prefill_order_meta', JSON.stringify({
        orderId: order.id,
        ownerUid: uidToUse,
        tableNumber: order.tableNumber,
      }));
    } catch { /* ignore */ }
    onGoToSales?.();
  };

  const sortedOrders = [...orders].sort((a, b) => {
    const rank: Record<OrderStatus, number> = {
      'awaiting-validation': 0,
      'validated': 1,
      'in-preparation': 2,
      'ready': 3,
      'delivered': 4,
      'paid': 5,
      'closed': 6,
      'cancelled': 7,
    };
    const rDiff = (rank[a.status] ?? 8) - (rank[b.status] ?? 8);
    if (rDiff !== 0) return rDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Résumé pour le gérant : montants à encaisser vs encaissés
  const summary = useMemo(() => {
    const toCashIn = orders.filter(o => o.status === 'delivered' && o.paymentStatus !== 'paid');
    const paid = orders.filter(o => o.status === 'paid' || o.status === 'closed');
    const toCashInTotal = toCashIn.reduce((s, o) => s + Number(o.total || 0), 0);
    const paidTotal = paid.reduce((s, o) => s + Number(o.total || 0), 0);
    // Montants encaissés par le serveur (à reverser au gérant)
    const serverPaid = orders.filter(o => o.paidBy === 'server' && (o.status === 'paid' || o.status === 'closed'));
    const serverPaidTotal = serverPaid.reduce((s, o) => s + Number(o.total || 0), 0);
    return { toCashInCount: toCashIn.length, toCashInTotal, paidTotal, serverPaidCount: serverPaid.length, serverPaidTotal };
  }, [orders]);

  const canCancelOrderStatus = (s: OrderStatus) =>
    s === 'awaiting-validation' || s === 'validated' || s === 'in-preparation';

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <Badge variant="outline" className="text-accent-foreground justify-center">
            À valider: {orders.filter(o => o.status === 'awaiting-validation').length}
          </Badge>
          <Badge variant="outline" className="text-amber-700 justify-center">
            À encaisser: {summary.toCashInCount} ({summary.toCashInTotal.toLocaleString()} XAF)
          </Badge>
          <Badge variant="outline" className="text-emerald-700 justify-center">
            Encaissés: {summary.paidTotal.toLocaleString()} XAF
          </Badge>
          <Badge variant="outline" className="text-blue-700 justify-center">
            Serveurs à reverser: {summary.serverPaidTotal.toLocaleString()} XAF
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
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="font-semibold text-lg">#{order.orderNumber}</div>
                    <Badge variant="outline" className="text-sm font-semibold">
                      Table {order.tableNumber}
                    </Badge>
                    <Badge className={`${getStatusStyle(order.status).badge} flex items-center gap-1`}>
                      {getStatusIcon(order.status)}
                      {getStatusStyle(order.status).text}
                    </Badge>
                    {order.status === 'paid' && order.paymentMethod && (
                      <Badge variant="outline" className="text-xs">
                        {order.paymentMethod === 'cash' ? 'Espèces' : order.paymentMethod === 'mobile' ? 'Mobile Money' : order.paymentMethod === 'card' ? 'Carte' : order.paymentMethod}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="text-muted-foreground">
                      {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {order.serverName && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <Badge variant="secondary" className="text-xs font-medium flex items-center gap-1 w-fit">
                          <User className="w-3 h-3" />
                          Serveur: {order.serverName}
                        </Badge>
                      </>
                    )}
                    {order.cookName && order.status !== 'awaiting-validation' && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <Badge variant="secondary" className="text-xs font-medium flex items-center gap-1 w-fit">
                          <ChefHat className="w-3 h-3" />
                          Cuisinier: {order.cookName}
                        </Badge>
                      </>
                    )}
                    {order.paidBy === 'server' && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <Badge variant="secondary" className="text-xs font-medium text-blue-700 bg-blue-50">
                          <Banknote className="w-3 h-3" />
                          Encaissé par serveur — à reverser
                        </Badge>
                      </>
                    )}
                    {!order.serverName && !order.cookName && (
                      <span className="text-xs text-muted-foreground">
                        Code: {order.agentCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Articles:</div>
                {order.items.map((item, index) => (
                  <div 
                    key={index} 
                    className="flex justify-between text-sm bg-muted p-2 rounded"
                  >
                    <span>{item.name} x{item.quantity}</span>
                    <span className="font-medium">{Number(item.price * item.quantity).toLocaleString()} XAF</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-nack-red">{Number(order.total || 0).toLocaleString()} XAF</span>
                </div>
              </div>

              {showActions && (
                <div className="flex flex-wrap gap-2">
                  {order.status === 'awaiting-validation' && (
                    <>
                      <Button
                        onClick={() => handleValidateOrder(order)}
                        className="flex-1 bg-gradient-primary text-white shadow-button min-w-[140px]"
                        disabled={processingIds.has(order.id)}
                        type="button"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Valider et envoyer en cuisine
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleCancelOrderClick(order)}
                        disabled={processingIds.has(order.id) || isCancelling}
                        type="button"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Annuler
                      </Button>
                    </>
                  )}

                  {order.status === 'delivered' && order.paymentStatus !== 'paid' && (
                    <>
                      <select
                        className="border rounded px-2 text-sm h-9"
                        value={paymentMethodByOrder[order.id] || 'cash'}
                        onChange={(e) => setPaymentMethodFor(order.id, e.target.value as PaymentMethod)}
                      >
                        <option value="cash">Espèces</option>
                        <option value="mobile">Mobile Money</option>
                        <option value="card">Carte</option>
                      </select>
                      <Button
                        onClick={() => handleCashInOrder(order)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-button min-w-[140px]"
                        disabled={processingIds.has(order.id)}
                        type="button"
                      >
                        <Banknote className="h-4 w-4 mr-2" />
                        Encaisser {Number(order.total || 0).toLocaleString()} XAF
                      </Button>
                    </>
                  )}

                  {order.status === 'paid' && (
                    <Button
                      onClick={() => handleCloseOrder(order)}
                      variant="outline"
                      className="flex-1"
                      type="button"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Clôturer la commande
                    </Button>
                  )}

                  {canCancelOrderStatus(order.status) && (
                    <Button
                      variant="destructive"
                      onClick={() => handleCancelOrderClick(order)}
                      disabled={processingIds.has(order.id) || isCancelling}
                      type="button"
                      className={order.status === 'awaiting-validation' ? '' : 'flex-1'}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Annuler
                    </Button>
                  )}

                  {isOwnerAuthed && order.status === 'delivered' && order.paymentStatus !== 'paid' && onGoToSales && (
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => loadOrderForSales(order, false)}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Modifier
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>

      {/* Dialog d'annulation */}
      {cancelDialogOrder && (
        <OrderCancelDialog
          isOpen={!!cancelDialogOrder}
          onClose={() => {
            // Utiliser requestAnimationFrame pour éviter les problèmes de timing avec React DOM
            requestAnimationFrame(() => {
              setTimeout(() => {
                setCancelDialogOrder(null);
              }, 0);
            });
          }}
          onConfirm={handleConfirmCancel}
          orderNumber={String(cancelDialogOrder.orderNumber)}
          orderTotal={cancelDialogOrder.total}
          orderStatus={cancelDialogOrder.status}
          paymentMethod={(cancelDialogOrder as Order & { paymentMethod?: PaymentMethod }).paymentMethod}
          isLoading={isCancelling}
        />
      )}
    </Card>
  );
};

export default OrderManagement;