import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/contexts/OrderContext";
import { Order, OrderStatus } from "@/types/order";
import { Clock, CheckCircle, XCircle, User } from "lucide-react";
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
    // validation silencieuse: pas de toast
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
          // pas de toast ici: redirection directe vers Ventes
          redirected = true;
        }
        if (redirected) {
          setProcessingIds(prev => { const s = new Set(prev); s.delete(order.id); return s; });
          return; // Stop flow ici; la vente sera créée depuis SalesPage
        }

        // 3) Marquer la commande comme validée (autorisé via agentToken même sans auth)
        // Pour les caissiers, on doit inclure agentToken dans le payload pour que les règles Firestore l'autorisent
        const updatePayload: { status: 'sent'; agentToken?: string } = { status: 'sent' };
        if (agentToken && !isOwnerAuthed) {
          updatePayload.agentToken = agentToken;
        }
        await updateDoc(fsDoc(ordersColRef(db, uidToUse), order.id), updatePayload);

        setFsOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'sent' } : o));
        updateOrderStatus(order.id, 'sent');
        toast({ title: isOwnerAuthed ? "Encaissement réussi" : "Commande validée", description: `Commande #${order.orderNumber} ${isOwnerAuthed ? 'encaissée' : 'validée'}` });
        
        // Proposer d'imprimer le reçu pour le client
        const shouldPrint = window.confirm(`Commande validée avec succès !\n\nSouhaitez-vous imprimer le reçu pour le client ?`);
        if (shouldPrint) {
          try {
            // Récupérer toutes les informations du profil pour le ticket
            const profileRef = fsDoc(db, 'profiles', uidToUse);
            const profileSnap = await getDoc(profileRef);
            const profileData = profileSnap.exists() ? profileSnap.data() as UserProfile : null;
            
            const thermalData = {
              orderNumber: String(order.orderNumber || `C-${Date.now()}`),
              establishmentName: profileData?.establishmentName || 'Établissement',
              establishmentLogo: profileData?.logoUrl,
              tableZone: order.tableNumber || 'Table',
              items: order.items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price
              })),
              total: order.total,
              createdAt: order.createdAt instanceof Date ? order.createdAt.getTime() : (order.createdAt || Date.now()),
              // Informations personnalisées du profil
              companyName: profileData?.companyName,
              fullAddress: profileData?.fullAddress,
              businessPhone: profileData?.businessPhone || profileData?.phone,
              rcsNumber: profileData?.rcsNumber,
              nifNumber: profileData?.nifNumber,
              legalMentions: profileData?.legalMentions,
              customMessage: profileData?.customMessage,
              // Paramètres avancés
              ticketLogoUrl: profileData?.ticketLogoUrl,
              showDeliveryMention: profileData?.showDeliveryMention,
              showCSSMention: profileData?.showCSSMention,
              cssPercentage: profileData?.cssPercentage,
              ticketFooterMessage: profileData?.ticketFooterMessage
            };

            const { printThermalTicket } = await import('@/utils/ticketThermal');
            printThermalTicket(thermalData);
          } catch (error) {
            console.error('Erreur impression reçu:', error);
            // Ne pas bloquer, juste logger l'erreur
          }
        }
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
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="font-semibold text-lg">#{order.orderNumber}</div>
                    <Badge variant="outline" className="text-sm font-semibold">
                      Table {order.tableNumber}
                    </Badge>
                    <Badge className={`${getStatusColor(order.status)} flex items-center gap-1`}>
                      {getStatusIcon(order.status)}
                      {getStatusText(order.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="text-muted-foreground">
                      {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {order.agentName && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <Badge variant="secondary" className="text-xs font-medium flex items-center gap-1 w-fit">
                          <User className="w-3 h-3" />
                          Serveur: {order.agentName}
                        </Badge>
                      </>
                    )}
                    {!order.agentName && (
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
                    <span className="font-medium">{Number(item.price * item.quantity).toLocaleString()} XAF</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-nack-red">{Number(order.total || 0).toLocaleString()} XAF</span>
                </div>
              </div>

              {showActions && (
                <div className="flex gap-2">
                  {isOwnerAuthed && order.status === 'pending' && (
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
                  {order.status === 'pending' && (
                  <Button
                    onClick={() => handleProcessOrder(order)}
                    className="flex-1 bg-gradient-primary text-white shadow-button"
                    disabled={processingIds.has(order.id)}
                    type="button"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isOwnerAuthed ? 'Valider et encaisser' : 'Valider la commande'}
                  </Button>
                  )}
                  {(order.status === 'pending' || order.status === 'sent') && (
                  <Button
                    variant="destructive"
                    onClick={() => handleCancelOrderClick(order)}
                    disabled={processingIds.has(order.id) || isCancelling}
                    type="button"
                      className={order.status === 'sent' ? 'flex-1' : ''}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler
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
          onClose={() => setCancelDialogOrder(null)}
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