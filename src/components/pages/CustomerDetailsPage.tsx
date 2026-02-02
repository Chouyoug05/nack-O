import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { customersColRef, ordersColRef } from "@/lib/collections";
import { 
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  Calendar,
  Star,
  Crown,
  TrendingUp,
  Gift,
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  User,
  FileText
} from "lucide-react";
import { 
  doc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  onSnapshot,
  updateDoc,
  runTransaction
} from "firebase/firestore";
import type { Customer, CustomerDoc, Reward } from "@/types/customer";
import type { Order } from "@/types/order";

interface FirestoreOrderDoc {
  orderNumber?: number;
  tableNumber?: string;
  items?: Array<{ id?: string; name: string; price: number; quantity: number }>;
  total?: number;
  status?: string;
  createdAt?: number;
  customerId?: string;
}

const CustomerDetailsPage = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Charger les informations du client
  useEffect(() => {
    if (!user || !customerId) return;

    const loadCustomer = async () => {
      try {
        const customerRef = doc(customersColRef(db, user.uid), customerId);
        const customerSnap = await getDoc(customerRef);
        
        if (!customerSnap.exists()) {
          toast({
            title: "Client introuvable",
            description: "Ce client n'existe pas",
            variant: "destructive"
          });
          navigate("/dashboard");
          return;
        }

        const data = customerSnap.data() as CustomerDoc;
        const customerData: Customer = {
          id: customerSnap.id,
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
        setCustomer(customerData);
        setIsLoading(false);
      } catch (error) {
        console.error("Erreur chargement client:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les informations du client",
          variant: "destructive"
        });
        setIsLoading(false);
      }
    };

    loadCustomer();
  }, [user, customerId, navigate, toast]);

  // Charger l'historique des commandes
  useEffect(() => {
    if (!user || !customerId) return;

    const q = query(
      ordersColRef(db, user.uid),
      where("customerId", "==", customerId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const ordersList: Order[] = snap.docs.map((d) => {
        const data = d.data() as FirestoreOrderDoc;
        const createdAtMs = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
        return {
          id: d.id,
          orderNumber: data.orderNumber || 0,
          tableNumber: String(data.tableNumber || ""),
          items: (data.items || []).map((it) => ({
            id: it.id || it.name,
            name: it.name,
            price: Number(it.price),
            quantity: Number(it.quantity),
            category: '',
            stock: 0,
          })),
          total: Number(data.total || 0),
          status: (data.status || 'pending') as string,
          createdAt: new Date(createdAtMs),
          agentCode: '',
        };
      });
      setOrders(ordersList);
    }, (error) => {
      console.error("Erreur chargement commandes:", error);
    });

    return () => unsub();
  }, [user, customerId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "vip":
        return <Badge className="bg-yellow-500 text-white"><Crown className="w-3 h-3 mr-1" />VIP</Badge>;
      case "fidel":
        return <Badge className="bg-blue-500 text-white"><Star className="w-3 h-3 mr-1" />Fidèle</Badge>;
      default:
        return <Badge variant="outline">Classique</Badge>;
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case "sent":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Envoyée</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="w-3 h-3 mr-1" />Annulée</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLoyaltyTypeLabel = (type: string) => {
    switch (type) {
      case "points":
        return "Carte à points";
      case "amount":
        return "Montant cumulé";
      case "vip":
        return "VIP";
      default:
        return type;
    }
  };

  const handleUseReward = async (rewardId: string) => {
    if (!user || !customer) return;
    
    if (!window.confirm("Marquer cette récompense comme utilisée ?")) return;

    try {
      const customerRef = doc(customersColRef(db, user.uid), customer.id);
      
      await runTransaction(db, async (transaction) => {
        const customerDoc = await transaction.get(customerRef);
        if (!customerDoc.exists()) throw new Error("Client introuvable");
        
        const data = customerDoc.data() as CustomerDoc;
        const rewards = data.availableRewards || [];
        const rewardIndex = rewards.findIndex(r => r.id === rewardId);
        
        if (rewardIndex === -1) throw new Error("Récompense introuvable");
        
        const reward = rewards[rewardIndex];
        const updatedRewards = [...rewards];
        updatedRewards[rewardIndex] = {
          ...reward,
          used: true,
          usedAt: Date.now(),
        };
        
        const rewardHistory = data.rewardHistory || [];
        rewardHistory.push({
          rewardId: reward.id,
          rewardTitle: reward.title,
          usedAt: Date.now(),
        });
        
        transaction.update(customerRef, {
          availableRewards: updatedRewards,
          rewardHistory: rewardHistory,
          updatedAt: Date.now(),
        });
      });

      toast({
        title: "Récompense utilisée",
        description: "La récompense a été marquée comme utilisée",
      });

      // Recharger les données du client
      const customerSnap = await getDoc(customerRef);
      if (customerSnap.exists()) {
        const data = customerSnap.data() as CustomerDoc;
        setCustomer({
          ...customer,
          availableRewards: data.availableRewards || [],
        });
      }
    } catch (error) {
      console.error("Erreur utilisation récompense:", error);
      toast({
        title: "Erreur",
        description: "Impossible de marquer la récompense comme utilisée",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Client introuvable</p>
          <Button onClick={() => navigate("/dashboard")} variant="outline">
            Retour au tableau de bord
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#f6f8f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Naviguer vers le dashboard avec l'action customers et ouvrir le modal d'édition
                navigate(`/dashboard?action=customers&edit=${customerId}`);
              }}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Modifier
            </Button>
          </div>
          
          {/* Client Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Avatar className="w-20 h-20 sm:w-24 sm:h-24">
              <AvatarImage src={customer.photoUrl} />
              <AvatarFallback className="text-2xl sm:text-3xl">
                {customer.firstName[0]}{customer.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold">
                  {customer.firstName} {customer.lastName}
                </h1>
                {getStatusBadge(customer.status)}
              </div>
              <p className="text-sm text-muted-foreground mb-2">ID: {customer.customerId}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  <span>{customer.phone}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    <span>{customer.email}</span>
                  </div>
                )}
                {customer.lastVisit && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Dernière visite: {customer.lastVisit.toLocaleDateString("fr-FR")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total commandes</p>
                    <p className="text-2xl font-bold">{customer.totalOrders}</p>
                  </div>
                  <ShoppingCart className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            {customer.loyaltyType === "points" && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Points actuels</p>
                      <p className="text-2xl font-bold text-yellow-500">{customer.points}</p>
                    </div>
                    <Star className="w-8 h-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total dépensé</p>
                    <p className="text-2xl font-bold text-green-500">
                      {customer.totalAmountSpent.toLocaleString()} XAF
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            {customer.loyaltyType === "points" && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Points totaux</p>
                      <p className="text-2xl font-bold text-purple-500">{customer.totalPointsEarned}</p>
                    </div>
                    <Star className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne gauche - Informations */}
            <div className="lg:col-span-1 space-y-6">
              {/* Système de fidélité */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Système de fidélité</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Type:</span>
                    <span className="font-medium">{getLoyaltyTypeLabel(customer.loyaltyType)}</span>
                  </div>
                  {customer.loyaltyType === "points" && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Points totaux gagnés:</span>
                        <span className="font-medium">{customer.totalPointsEarned}</span>
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Progression</span>
                          <span>{customer.points}/100 points</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-yellow-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min((customer.points / 100) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </>
                  )}
                  {customer.loyaltyType === "amount" && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Progression VIP</span>
                        <span>{customer.totalAmountSpent.toLocaleString()}/100 000 XAF</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min((customer.totalAmountSpent / 100000) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Récompenses */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    Récompenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customer.availableRewards && customer.availableRewards.length > 0 ? (
                    <div className="space-y-3">
                      {/* Récompenses disponibles */}
                      {customer.availableRewards.filter((r) => !r.used).length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground mb-2 block">Disponibles:</Label>
                          <div className="space-y-2">
                            {customer.availableRewards
                              .filter((r) => !r.used)
                              .map((reward) => (
                                <div
                                  key={reward.id}
                                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                                >
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{reward.title}</p>
                                    <p className="text-xs text-muted-foreground">{reward.description}</p>
                                    {reward.createdAt && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Obtenue le {new Date(reward.createdAt).toLocaleDateString("fr-FR")}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-green-500">Disponible</Badge>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleUseReward(reward.id)}
                                      className="text-xs"
                                    >
                                      Utiliser
                                    </Button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Récompenses utilisées */}
                      {customer.availableRewards.filter((r) => r.used).length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground mb-2 block">Utilisées:</Label>
                          <div className="space-y-2">
                            {customer.availableRewards
                              .filter((r) => r.used)
                              .map((reward) => (
                                <div
                                  key={reward.id}
                                  className="flex items-center justify-between p-3 bg-muted rounded-lg opacity-75"
                                >
                                  <div>
                                    <p className="font-medium text-sm line-through">{reward.title}</p>
                                    <p className="text-xs text-muted-foreground">{reward.description}</p>
                                    {reward.usedAt && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Utilisée le {new Date(reward.usedAt).toLocaleDateString("fr-FR")}
                                      </p>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="text-xs">Utilisée</Badge>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      {customer.availableRewards.filter((r) => !r.used).length === 0 && 
                       customer.availableRewards.filter((r) => r.used).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Aucune récompense
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucune récompense
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Notes et préférences */}
              {(customer.notes || customer.allergies?.length || customer.preferences?.length) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Notes et préférences</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {customer.notes && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Notes:</Label>
                        <p className="text-sm mt-1">{customer.notes}</p>
                      </div>
                    )}
                    {customer.allergies && customer.allergies.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Allergies:</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {customer.allergies.map((allergy, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {allergy}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {customer.preferences && customer.preferences.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Préférences:</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {customer.preferences.map((pref, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {pref}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Colonne droite - Historique */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Historique des commandes
                  </CardTitle>
                  <CardDescription>
                    {orders.length} commande{orders.length > 1 ? "s" : ""} au total
                    {orders.length > 0 && (
                      <span className="ml-2">
                        • Moyenne: {Math.round(customer.totalAmountSpent / customer.totalOrders).toLocaleString()} XAF/commande
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {orders.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Aucune commande pour le moment</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div
                          key={order.id}
                          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-semibold text-lg">Commande #{order.orderNumber}</p>
                                <p className="text-sm text-muted-foreground">
                                  {order.createdAt.toLocaleDateString("fr-FR", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getOrderStatusBadge(order.status)}
                              <Badge variant="outline" className="text-sm">
                                Table {order.tableNumber}
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-2 mb-3">
                            {order.items.length > 0 ? (
                              order.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between items-center text-sm bg-muted p-2 rounded"
                                >
                                  <span className="flex-1">
                                    {item.name} x{item.quantity}
                                  </span>
                                  <span className="font-medium ml-2">
                                    {(item.price * item.quantity).toLocaleString()} XAF
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-2">
                                Aucun détail disponible
                              </p>
                            )}
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t">
                            <span className="font-bold text-lg">Total:</span>
                            <span className="font-bold text-lg text-nack-red">
                              {order.total.toLocaleString()} XAF
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CustomerDetailsPage;

