import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Order, CartItem } from "@/types/order";
import { KitchenStatus } from "@/types/order";
import { 
  LogOut,
  User,
  Clock,
  CheckCircle,
  UtensilsCrossed,
  AlertCircle
} from "lucide-react";
import { db } from "@/lib/firebase";
import { ordersColRef, agentTokensTopColRef } from "@/lib/collections";
import { onSnapshot, query, orderBy, updateDoc, doc, getDoc, collectionGroup, where, limit, getDocs } from "firebase/firestore";

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
  status?: string;
  kitchenStatus?: KitchenStatus;
  createdAt?: number;
  agentCode?: string;
  agentMemberId?: string;
  agentName?: string;
}

interface OrderWithKitchen extends Order {
  kitchenStatus?: KitchenStatus;
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
      try {
        const tokenDoc = await getDoc(doc(agentTokensTopColRef(db), agentCode));
        if (tokenDoc.exists()) {
          const data = tokenDoc.data() as { ownerUid?: string; firstName?: string; lastName?: string; role?: string };
          if (data.ownerUid && data.role === 'cuisinier') {
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
          }
        }
      } catch { /* ignore */ }
      try {
        const cg = collectionGroup(db, 'team');
        const byToken = query(cg, where('agentToken', '==', agentCode), limit(1));
        const s1 = await getDocs(byToken);
        if (!s1.empty) {
          const docSnap = s1.docs[0];
          const data = docSnap.data() as { firstName?: string; lastName?: string; role?: string };
          if (data.role === 'cuisinier') {
            const foundOwner = docSnap.ref.parent.parent ? docSnap.ref.parent.parent.id : null;
            const foundName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Cuisinier';
            if (foundOwner) {
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
          }
        }
      } catch { /* ignore permissions */ }
    };
    resolveOwner();
  }, [agentCode]);

  // Charger les commandes avec produits alimentaires uniquement
  useEffect(() => {
    if (!ownerUid) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(ordersColRef(db, ownerUid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
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
        return {
          id: d.id,
          orderNumber: data.orderNumber ?? 0,
          tableNumber: String(data.tableNumber ?? ""),
          items,
          foodItems,
          total: Number(data.total ?? 0),
          status: (data.status ?? 'pending') as string,
          kitchenStatus: (data.kitchenStatus ?? 'en-attente') as KitchenStatus,
          createdAt: new Date(createdAtMs),
          agentCode: data.agentCode ?? data.agentMemberId ?? '—',
          agentName: data.agentName,
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

  const updateKitchenStatus = async (orderId: string, status: KitchenStatus) => {
    if (!ownerUid) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut. Propriétaire non identifié.",
        variant: "destructive"
      });
      return;
    }

    try {
      const orderRef = doc(ordersColRef(db, ownerUid), orderId);
      await updateDoc(orderRef, {
        kitchenStatus: status,
        updatedAt: Date.now(),
      });

      const statusLabels: Record<KitchenStatus, string> = {
        'en-attente': 'En attente',
        'en-preparation': 'En préparation',
        'pret': 'Prêt',
        'termine': 'Terminé'
      };

      toast({
        title: "Statut mis à jour",
        description: `Commande marquée comme "${statusLabels[status]}"`,
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut de la commande.",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: KitchenStatus) => {
    switch (status) {
      case 'en-attente':
        return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case 'en-preparation':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300"><Clock className="w-3 h-3 mr-1" />En préparation</Badge>;
      case 'pret':
        return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Prêt</Badge>;
      case 'termine':
        return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300"><CheckCircle className="w-3 h-3 mr-1" />Terminé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusColor = (status: KitchenStatus): string => {
    switch (status) {
      case 'en-attente': return 'bg-gray-200 border-gray-300';
      case 'en-preparation': return 'bg-yellow-200 border-yellow-400';
      case 'pret': return 'bg-green-200 border-green-400';
      case 'termine': return 'bg-blue-200 border-blue-400';
      default: return 'bg-gray-200 border-gray-300';
    }
  };

  if (!agentCode) {
    return <Navigate to="/not-found" replace />;
  }

  // Grouper les commandes par statut
  const ordersByStatus = {
    'en-attente': orders.filter(o => o.kitchenStatus === 'en-attente'),
    'en-preparation': orders.filter(o => o.kitchenStatus === 'en-preparation'),
    'pret': orders.filter(o => o.kitchenStatus === 'pret'),
    'termine': orders.filter(o => o.kitchenStatus === 'termine'),
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
              Interface Cuisine
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
                <h3 className="text-lg font-semibold mb-2">Aucune commande</h3>
                <p className="text-muted-foreground">
                  Aucune commande contenant de la nourriture pour le moment.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* En attente */}
              {ordersByStatus['en-attente'].length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-600" />
                    En attente ({ordersByStatus['en-attente'].length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ordersByStatus['en-attente'].map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={updateKitchenStatus}
                        getStatusBadge={getStatusBadge}
                        getStatusColor={getStatusColor}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* En préparation */}
              {ordersByStatus['en-preparation'].length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    En préparation ({ordersByStatus['en-preparation'].length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ordersByStatus['en-preparation'].map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={updateKitchenStatus}
                        getStatusBadge={getStatusBadge}
                        getStatusColor={getStatusColor}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Prêt */}
              {ordersByStatus['pret'].length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Prêt ({ordersByStatus['pret'].length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ordersByStatus['pret'].map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={updateKitchenStatus}
                        getStatusBadge={getStatusBadge}
                        getStatusColor={getStatusColor}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Terminé */}
              {ordersByStatus['termine'].length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    Terminé ({ordersByStatus['termine'].length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ordersByStatus['termine'].map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={updateKitchenStatus}
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
  onStatusChange: (orderId: string, status: KitchenStatus) => void;
  getStatusBadge: (status: KitchenStatus) => JSX.Element;
  getStatusColor: (status: KitchenStatus) => string;
}

const OrderCard = ({ order, onStatusChange, getStatusBadge, getStatusColor }: OrderCardProps) => {
  const currentStatus = order.kitchenStatus || 'en-attente';
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
          {order.agentName && (
            <>
              <span>•</span>
              <Badge variant="secondary" className="w-fit text-xs font-medium flex items-center gap-1">
                <User className="w-3 h-3" />
                Serveur: {order.agentName}
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

        {/* Boutons d'actions - Gros boutons pour faciliter l'utilisation */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          {currentStatus === 'en-attente' && (
            <Button
              onClick={() => onStatusChange(order.id, 'en-preparation')}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white h-12 text-base font-bold"
            >
              <Clock className="w-5 h-5 mr-2" />
              En préparation
            </Button>
          )}
          {currentStatus === 'en-preparation' && (
            <Button
              onClick={() => onStatusChange(order.id, 'pret')}
              className="w-full bg-green-500 hover:bg-green-600 text-white h-12 text-base font-bold"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Prêt
            </Button>
          )}
          {currentStatus === 'pret' && (
            <Button
              onClick={() => onStatusChange(order.id, 'termine')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white h-12 text-base font-bold"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Terminé
            </Button>
          )}
          {(currentStatus === 'en-preparation' || currentStatus === 'pret') && (
            <Button
              variant="outline"
              onClick={() => onStatusChange(order.id, 'en-attente')}
              className="w-full h-12 text-base font-bold"
            >
              Retour
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CuisineInterface;

