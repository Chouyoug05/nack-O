import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Order, OrderStatus, ORDER_STATUS_LABELS } from "@/types/order";
import { Clock, CheckCircle, XCircle, Send, ChefHat, Banknote, User } from "lucide-react";

interface OrderHistoryProps {
  orders: Order[];
  onUpdateOrderStatus?: (orderId: string, status: OrderStatus) => void;
  onValidateOrder?: (order: Order) => void;
  onDeliverOrder?: (order: Order) => void;
  onSendToManager?: (order: Order) => void;
  title?: string;
  description?: string;
}

const OrderHistory = ({
  orders,
  onUpdateOrderStatus,
  onValidateOrder,
  onDeliverOrder,
  onSendToManager,
  title,
  description,
}: OrderHistoryProps) => {
  const { toast } = useToast();

  const getStatusIcon = (status: OrderStatus) => {
    const icons: Record<OrderStatus, React.ReactNode> = {
      'awaiting-validation': <Clock className="h-4 w-4" />,
      'validated': <Send className="h-4 w-4" />,
      'in-preparation': <Clock className="h-4 w-4" />,
      'ready': <CheckCircle className="h-4 w-4" />,
      'delivered': <CheckCircle className="h-4 w-4" />,
      'paid': <Banknote className="h-4 w-4" />,
      'closed': <CheckCircle className="h-4 w-4" />,
      'cancelled': <XCircle className="h-4 w-4" />,
    };
    return icons[status];
  };

  const getStatusColor = (status: OrderStatus) => {
    const colors: Record<OrderStatus, string> = {
      'awaiting-validation': "bg-accent text-accent-foreground",
      'validated': "bg-primary text-primary-foreground",
      'in-preparation': "bg-amber-100 text-amber-800",
      'ready': "bg-green-600 text-white",
      'delivered': "bg-blue-600 text-white",
      'paid': "bg-emerald-600 text-white",
      'closed': "bg-gray-600 text-white",
      'cancelled': "bg-destructive text-destructive-foreground",
    };
    return colors[status] ?? "bg-gray-600 text-white";
  };

  const getStatusText = (status: OrderStatus) => ORDER_STATUS_LABELS[status] || status;

  const handleServeOrder = (order: Order) => {
    onDeliverOrder?.(order);
    toast({
      title: "Commande livrée",
      description: `Commande #${order.orderNumber} marquée comme livrée au client`,
    });
  };

  const handleValidateOrder = (order: Order) => {
    onValidateOrder?.(order);
    toast({
      title: "Commande validée",
      description: `Commande #${order.orderNumber} envoyée en cuisine`,
    });
  };

  const handleSendOrder = (order: Order) => {
    onSendToManager?.(order);
    toast({
      title: "Encaissement gérant",
      description: `Commande #${order.orderNumber} transmise au gérant pour encaissement`,
    });
  };

  const handleCancelOrder = (order: Order) => {
    const confirmed = window.confirm(
      `⚠️ Voulez-vous vraiment annuler la commande #${order.orderNumber} ?`
    );
    if (!confirmed) return;

    onUpdateOrderStatus?.(order.id, 'cancelled');
    toast({
      title: "Commande annulée",
      description: `Commande #${order.orderNumber} annulée`,
      variant: "destructive",
    });
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle>{title || "Commandes"}</CardTitle>
        <CardDescription>
          {description || "Suivez le circuit de vos commandes"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
        {orders.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Aucune commande pour le moment
          </p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-card border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="font-semibold text-lg">#{order.orderNumber}</div>
                  <Badge variant="outline" className="text-sm">
                    Table {order.tableNumber}
                  </Badge>
                  <Badge className={`${getStatusColor(order.status)} flex items-center gap-1`}>
                    {getStatusIcon(order.status)}
                    {getStatusText(order.status)}
                  </Badge>
                  {order.status === 'ready' && (
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 flex items-center gap-1">
                      <ChefHat className="h-3 w-3" />
                      Préparation terminée
                    </Badge>
                  )}
                  {order.cookName && order.status !== 'awaiting-validation' && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <ChefHat className="h-3 w-3" />
                      Cuisinier: {order.cookName}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(order.createdAt).toLocaleTimeString()}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Articles:</div>
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm bg-muted p-2 rounded">
                    <span>{item.name} x{item.quantity}</span>
                    <span className="font-medium">{Number(item.price * item.quantity).toLocaleString()} XAF</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-nack-red">{Number(order.total || 0).toLocaleString()} XAF</span>
                </div>
                {order.paymentStatus === 'unpaid' && (order.status === 'delivered' || order.status === 'paid') && (
                  <div className="flex items-center gap-2 text-sm">
                    <Banknote className="h-4 w-4 text-amber-600" />
                    <span className="text-amber-700 font-medium">
                      {order.status === 'delivered'
                        ? "Livrée — en attente d'encaissement par le gérant"
                        : "Encaissée"}
                    </span>
                  </div>
                )}
                {order.serverName && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    Serveur: {order.serverName}
                  </div>
                )}
              </div>

              {order.status === 'awaiting-validation' && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleValidateOrder(order)}
                    className="flex-1 bg-gradient-primary text-white shadow-button"
                    disabled={!onValidateOrder}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Valider et envoyer en cuisine
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleCancelOrder(order)}
                    disabled={!onUpdateOrderStatus}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              )}
              {order.status === 'ready' && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleServeOrder(order)}
                    className="flex-1 bg-green-600 text-white shadow-button"
                    disabled={!onDeliverOrder}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marquer comme livrée
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleCancelOrder(order)}
                    disabled={!onUpdateOrderStatus}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              )}
              {order.status === 'delivered' && order.paymentStatus === 'unpaid' && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSendOrder(order)}
                    className="flex-1 bg-amber-600 text-white shadow-button"
                    disabled={!onSendToManager}
                  >
                    <Banknote className="h-4 w-4 mr-2" />
                    Transmettre au gérant
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

export default OrderHistory;