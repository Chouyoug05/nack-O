import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Order, CartItem } from "@/types/order";
import { OrderStatus, ORDER_STATUS_LABELS } from "@/types/order";
import { 
  LogOut,
  User,
  Clock,
  CheckCircle,
  UtensilsCrossed,
  ChefHat,
  Bell
} from "lucide-react";
import { db } from "@/lib/firebase";
import { ordersColRef, agentTokensTopColRef, notificationsColRef } from "@/lib/collections";
import { ensureAgentSession } from "@/lib/agentSession";
import { onSnapshot, query, orderBy, updateDoc, doc, getDoc, collectionGroup, where, limit, getDocs, addDoc } from "firebase/firestore";

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
  cookId?: string;
  cookName?: string;
}

interface OrderWithKitchen extends Order {
  foodItems?: CartItem[];
}

// Catégories alimentaires
const FOOD_CATEGORIES = ["Plat / Repas", "Plat", "Repas", "Snack", "Dessert", "Entrée", "Entree"];

const isFoodCategory = (category?: string): boolean => {
  if (!category) return false;
  const catLower = category.toLowerCase();
  return FOOD_CATEGORIES.some(fc => 
    catLower.includes(fc.toLowerCase()) || 
    catLower === fc.toLowerCase() ||
    catLower.includes('plat') ||
    catLower.includes('repas') ||
    catLower.includes('snack') ||
    catLower.includes('dessert') ||
    catLower.includes('entrée') ||
    catLower.includes('entree')
  );
};

const getServeurAuthKey = (agentCode: string) => `nack_serveur_auth_${agentCode}`;

// Statuts que la cuisine est autorisée à voir : uniquement les commandes validées par un serveur
const KITCHEN_STATUSES: OrderStatus[] = ['validated', 'in-preparation', 'ready'];

const CuisineInterface = () => {
  const { agentCode } = useParams();
  const { toast } = useToast();
  const [agentInfo, setAgentInfo] = useState<{ name: string; code: string; memberId?: string } | null>(() => {
    if (!agentCode) return null;
    try {
      const stored = localStorage.getItem(getServeurAuthKey(agentCode));
      if (stored) {
        const data = JSON.parse(stored);
        if (data.timestamp && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          return { name: data.agentName || 'Cuisinier', code: agentCode, memberId: data.memberId };
        } else {
          localStorage.removeItem(getServeurAuthKey(agentCode));
        }
      }
    } catch { /* ignore */ }
    return null;
  });
  const [ownerUid, setOwnerUid] = useState<string | null>(() => {
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
  const [orders, setOrders] = useState<OrderWithKitchen[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Résoudre le propriétaire depuis le token
  useEffect(() => {
    const resolveOwner = async () => {
      if (!agentCode) return;
      console.log('[CuisineInterface] Résolution du propriétaire pour agent:', agentCode);
      try {
        const tokenDoc = await getDoc(doc(agentTokensTopColRef(db), agentCode));
        console.log('[CuisineInterface] Token doc exists:', tokenDoc.exists());
        if (tokenDoc.exists()) {
          const data = tokenDoc.data() as { ownerUid?: string; firstName?: string; lastName?: string; role?: string };
          console.log('[CuisineInterface] Token data:', { ownerUid: data.ownerUid, role: data.role });
          if (data.ownerUid && data.role === 'cuisinier') {
            console.log('[CuisineInterface] Création session agent pour ownerUid:', data.ownerUid);
            await ensureAgentSession(agentCode, data.ownerUid);
            console.log('[CuisineInterface] Session agent créée avec succès');
            setOwnerUid(data.ownerUid);
            const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Cuisinier';
            setAgentInfo({ name, code: agentCode });
            try {
              localStorage.setItem(getServeurAuthKey(agentCode), JSON.stringify({
                ownerUid: data.ownerUid,
                agentName: name,
                timestamp: Date.now(),
              }));
            } catch { /* ignore */ }
            return;
          } else {
            console.log('[CuisineInterface] Rôle incorrect ou ownerUid manquant. Role:', data.role, 'OwnerUid:', data.ownerUid);
          }
        }
      } catch (e) {
        console.error('[CuisineInterface] Erreur lecture agentTokens:', e);
      }
      try {
        const cg = collectionGroup(db, 'team');
        const byToken = query(cg, where('agentToken', '==', agentCode), limit(1));
        const s1 = await getDocs(byToken);
        if (!s1.empty) {
          const docSnap = s1.docs[0];
          const data = docSnap.data() as { firstName?: string; lastName?: string; role?: string };
          console.log('[CuisineInterface] Team member found:', { role: data.role });
          if (data.role === 'cuisinier') {
            const foundOwner = docSnap.ref.parent.parent ? docSnap.ref.parent.parent.id : null;
            const foundName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Cuisinier';
            if (foundOwner) {
              console.log('[CuisineInterface] Création session agent (via team) pour ownerUid:', foundOwner);
              await ensureAgentSession(agentCode, foundOwner);
              console.log('[CuisineInterface] Session agent (via team) créée avec succès');
              setOwnerUid(foundOwner);
              setAgentInfo({ name: foundName, code: agentCode });
              try {
                localStorage.setItem(getServeurAuthKey(agentCode), JSON.stringify({
                  ownerUid: foundOwner,
                  agentName: foundName,
                  timestamp: Date.now(),
                }));
              } catch { /* ignore */ }
            }
          } else {
            console.log('[CuisineInterface] Rôle team incorrect:', data.role);
          }
        } else {
          console.log('[CuisineInterface] Aucun team member trouvé pour agentCode:', agentCode);
        }
      } catch (e) {
        console.error('[CuisineInterface] Erreur lecture team:', e);
      }
    };
    resolveOwner();
  }, [agentCode]);

  // Charger uniquement les commandes validées par un serveur (jamais en attente de validation)
  useEffect(() => {
    if (!ownerUid) {
      setIsLoading(false);
      return;
    }

    console.log('[CuisineInterface] Écoute des commandes sur profiles/' + ownerUid + '/orders');
    setIsLoading(true);
    const q = query(ordersColRef(db, ownerUid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      console.log('[CuisineInterface] Snapshot reçu:', snap.size, 'commandes');
      const allOrders: OrderWithKitchen[] = snap.docs.map((d) => {
        const data = d.data() as FirestoreOrderDoc;
        const items = (data.items ?? []).map((it) => ({
          id: it.id ?? it.name,
          name: it.name,
          price: Number(it.price),
          quantity: Number(it.quantity),
          category: it.category ?? '',
          stock: it.stock ?? 0,
        } as CartItem));
        
        // Filtrer uniquement les produits alimentaires
        const foodItems = items.filter(item => isFoodCategory(item.category));
        
        // Ne garder que les commandes avec au moins un produit alimentaire
        if (foodItems.length === 0) return null;

        const createdAtMs = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
        // Compatibilité : normaliser tous les anciens statuts
        const rawStatus = data.status ?? 'awaiting-validation';
        const statusMap: Record<string, OrderStatus> = {
          'pending': 'awaiting-validation',
          'sent': 'validated',
          'served': 'delivered',
          'confirmed': 'validated',
          'completed': 'closed',
          'en-attente': 'awaiting-validation',
          'en-preparation': 'in-preparation',
          'pret': 'ready',
          'prêt': 'ready',
          'termine': 'closed',
          'terminé': 'closed',
        };
        const status: OrderStatus = statusMap[rawStatus] ?? (rawStatus as OrderStatus);
        // La cuisine ne voit que les commandes validées par un serveur
        if (!KITCHEN_STATUSES.includes(status)) return null;

        return {
          id: d.id,
          orderNumber: data.orderNumber ?? 0,
          tableNumber: String(data.tableNumber ?? ""),
          items,
          foodItems,
          total: Number(data.total ?? 0),
          status,
          createdAt: new Date(createdAtMs),
          agentCode: data.agentCode ?? data.agentMemberId ?? '—',
          agentName: data.agentName,
          serverId: data.serverId,
          serverName: data.serverName,
          cookId: data.cookId,
          cookName: data.cookName,
        } as OrderWithKitchen;
      }).filter((o): o is OrderWithKitchen => o !== null);

      setOrders(allOrders);
      setIsLoading(false);
    }, (error) => {
      console.error('Erreur lors du chargement des commandes:', error);
      setIsLoading(false);
    });
    return () => unsub();
  }, [ownerUid]);

  // Le cuisinier commence la préparation (validated → in-preparation)
  const startPreparation = async (order: OrderWithKitchen) => {
    if (!ownerUid) {
      toast({ title: "Erreur", description: "Propriétaire non identifié.", variant: "destructive" });
      return;
    }
    try {
      const orderRef = doc(ordersColRef(db, ownerUid), order.id);
      await updateDoc(orderRef, {
        status: 'in-preparation',
        startedAt: Date.now(),
        cookId: agentCode,
        cookName: agentInfo?.name,
        updatedAt: Date.now(),
      });
      toast({ title: "Préparation démarrée", description: `Commande #${order.orderNumber} en cours` });
    } catch (error) {
      console.error('Erreur lors du démarrage:', error);
      toast({ title: "Erreur", description: "Impossible de démarrer la préparation.", variant: "destructive" });
    }
  };

  // Le cuisinier termine la préparation (in-preparation → ready) + notifie le serveur
  const completePreparation = async (order: OrderWithKitchen) => {
    if (!ownerUid) {
      toast({ title: "Erreur", description: "Propriétaire non identifié.", variant: "destructive" });
      return;
    }
    try {
      const orderRef = doc(ordersColRef(db, ownerUid), order.id);
      const completedByCookAt = Date.now();
      await updateDoc(orderRef, {
        status: 'ready',
        completedByCookAt,
        cookId: agentCode,
        cookName: agentInfo?.name,
        updatedAt: completedByCookAt,
      });

      // Notification ciblée au serveur qui a validé la commande (et au gérant)
      if (order.serverId) {
        try {
          await addDoc(notificationsColRef(db, ownerUid), {
            title: "Commande prête 🍽️",
            message: `Commande #${order.orderNumber} — Table ${order.tableNumber} est prête à servir`,
            type: "success",
            targetAgentCode: order.serverId,
            targetRole: "server",
            orderId: order.id,
            orderNumber: order.orderNumber,
            read: false,
            createdAt: completedByCookAt,
          });
        } catch { /* ignore notification errors */ }
      }

      toast({ title: "Préparation terminée", description: `Commande #${order.orderNumber} prête. Le serveur a été notifié.` });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast({ title: "Erreur", description: "Impossible de finaliser la préparation.", variant: "destructive" });
    }
  };

  // Revenir à la liste (in-preparation → validated) si besoin
  const revertToValidated = async (order: OrderWithKitchen) => {
    if (!ownerUid) return;
    try {
      const orderRef = doc(ordersColRef(db, ownerUid), order.id);
      await updateDoc(orderRef, {
        status: 'validated',
        updatedAt: Date.now(),
      });
      toast({ title: "Retour", description: `Commande #${order.orderNumber} remise en attente de préparation` });
    } catch (error) {
      console.error('Erreur lors du retour:', error);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'validated':
        return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300"><Clock className="w-3 h-3 mr-1" />À préparer</Badge>;
      case 'in-preparation':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300"><Clock className="w-3 h-3 mr-1" />En préparation</Badge>;
      case 'ready':
        return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Prête</Badge>;
      default:
        return <Badge variant="outline">{ORDER_STATUS_LABELS[status] || status}</Badge>;
    }
  };

  const getStatusColor = (status: OrderStatus): string => {
    switch (status) {
      case 'validated': return 'bg-gray-200 border-gray-300';
      case 'in-preparation': return 'bg-yellow-200 border-yellow-400';
      case 'ready': return 'bg-green-200 border-green-400';
      default: return 'bg-gray-200 border-gray-300';
    }
  };

  if (!agentCode) {
    return <Navigate to="/not-found" replace />;
  }

  // Grouper les commandes par statut
  const ordersByStatus = {
    'validated': orders.filter(o => o.status === 'validated'),
    'in-preparation': orders.filter(o => o.status === 'in-preparation'),
    'ready': orders.filter(o => o.status === 'ready'),
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-[#f6f8f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-[#f6f8f6]/80 p-4 md:p-6 pb-2 backdrop-blur-sm border-b border-gray-200/50">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-primary rounded-full flex items-center justify-center">
            <UtensilsCrossed className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold leading-tight tracking-[-0.015em] text-gray-900">
              {agentInfo?.name || 'Cuisine'}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Interface Cuisine — commandes validées par le serveur
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-gray-200"
        >
          <LogOut size={16} className="mr-2" />
          <span className="hidden sm:inline">Déconnexion</span>
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-pulse text-muted-foreground">Chargement des commandes...</div>
            </div>
          ) : orders.length === 0 ? (
            <Card className="border border-gray-200 bg-white shadow-sm">
              <CardContent className="text-center py-12">
                <UtensilsCrossed className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune commande à préparer</h3>
                <p className="text-muted-foreground">
                  Les commandes validées par un serveur apparaîtront ici.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* À préparer */}
              {ordersByStatus['validated'].length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-600" />
                    À préparer ({ordersByStatus['validated'].length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ordersByStatus['validated'].map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStart={startPreparation}
                        onComplete={completePreparation}
                        onRevert={revertToValidated}
                        getStatusBadge={getStatusBadge}
                        getStatusColor={getStatusColor}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* En préparation */}
              {ordersByStatus['in-preparation'].length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    En préparation ({ordersByStatus['in-preparation'].length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ordersByStatus['in-preparation'].map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStart={startPreparation}
                        onComplete={completePreparation}
                        onRevert={revertToValidated}
                        getStatusBadge={getStatusBadge}
                        getStatusColor={getStatusColor}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Prêtes */}
              {ordersByStatus['ready'].length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-green-600" />
                    Prêtes ({ordersByStatus['ready'].length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ordersByStatus['ready'].map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStart={startPreparation}
                        onComplete={completePreparation}
                        onRevert={revertToValidated}
                        getStatusBadge={getStatusBadge}
                        getStatusColor={getStatusColor}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

interface OrderCardProps {
  order: OrderWithKitchen;
  onStart: (order: OrderWithKitchen) => void;
  onComplete: (order: OrderWithKitchen) => void;
  onRevert: (order: OrderWithKitchen) => void;
  getStatusBadge: (status: OrderStatus) => JSX.Element;
  getStatusColor: (status: OrderStatus) => string;
}

const OrderCard = ({ order, onStart, onComplete, onRevert, getStatusBadge, getStatusColor }: OrderCardProps) => {
  const currentStatus = order.status || 'validated';
  const foodItems = order.foodItems || order.items.filter(item => isFoodCategory(item.category));

  return (
    <Card className={`border-2 ${getStatusColor(currentStatus)} shadow-lg`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Commande #{order.orderNumber}</CardTitle>
          {getStatusBadge(currentStatus)}
        </div>
        <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span>Table: {order.tableNumber}</span>
          <span>•</span>
          <span>{new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          {order.serverName && (
            <>
              <span>•</span>
              <Badge variant="secondary" className="w-fit text-xs font-medium flex items-center gap-1">
                <User className="w-3 h-3" />
                Serveur: {order.serverName}
              </Badge>
            </>
          )}
          {order.cookName && (
            <>
              <span>•</span>
              <Badge variant="secondary" className="w-fit text-xs font-medium flex items-center gap-1">
                <ChefHat className="w-3 h-3" />
                {order.cookName}
              </Badge>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Liste des plats */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Plats à préparer:</h4>
          <div className="space-y-1">
            {foodItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm bg-white/50 p-2 rounded">
                <span className="font-medium">{item.name}</span>
                <Badge variant="outline" className="ml-2">x{item.quantity}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Boutons d'actions */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          {currentStatus === 'validated' && (
            <Button
              onClick={() => onStart(order)}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white h-12 text-base font-bold col-span-2"
            >
              <Clock className="w-5 h-5 mr-2" />
              Commencer la préparation
            </Button>
          )}
          {currentStatus === 'in-preparation' && (
            <>
              <Button
                onClick={() => onComplete(order)}
                className="w-full bg-green-500 hover:bg-green-600 text-white h-12 text-base font-bold"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Préparation terminée
              </Button>
              <Button
                variant="outline"
                onClick={() => onRevert(order)}
                className="w-full h-12 text-base font-bold"
              >
                Retour
              </Button>
            </>
          )}
          {currentStatus === 'ready' && (
            <Button
              disabled
              className="w-full bg-green-100 text-green-700 h-12 text-base font-bold col-span-2"
            >
              <Bell className="w-5 h-5 mr-2" />
              Prête — le serveur a été notifié
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CuisineInterface;