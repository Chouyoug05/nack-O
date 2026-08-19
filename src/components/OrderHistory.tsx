import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Order, OrderStatus } from "@/types/order";
import { Clock, CheckCircle, XCircle, Send, Eye, ChefHat } from "lucide-react";

interface OrderHistoryProps {
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  title?: string;
  description?: string;
}

const OrderHistory = ({ orders, onUpdateOrderStatus, title, description }: OrderHistoryProps) => {
  const { toast } = useToast();

  const getStatusIcon = (status: OrderStatus) => {
    const icons = {
      pending: <Clock className="h-4 w-4" />,
      sent: <CheckCircle className="h-4 w-4" />,
      cancelled: <XCircle className="h-4 w-4" />,
      confirmed: <CheckCircle className="h-4 w-4" />,
      served: <CheckCircle className="h-4 w-4" />
    };
    return icons[status];
  };

  const getStatusColor = (status: OrderStatus) => {
    const colors = {
      pending: "bg-accent text-accent-foreground",
      sent: "bg-primary text-primary-foreground", 
      cancelled: "bg-destructive text-destructive-foreground",
      confirmed: "bg-primary text-primary-foreground",
      served: "bg-green-600 text-white"
    };
    return colors[status];
  };

  const getStatusText = (status: OrderStatus) => {
    const texts = {
      pending: "En attente",
      sent: "Envoyée",
      cancelled: "Annulée",
      confirmed: "Confirmée",
      served: "Servie"
    };
    return texts[status];
  };

  const getKitchenBadge = (order: Order) => {
    const ks = order.kitchenStatus;
    if (!ks) return null;
    const styles: Record<string, { className: string; text: string }> = {
      'en-attente': { className: "bg-gray-100 text-gray-700 border-gray-200", text: "En attente cuisine" },
      'en-preparation': { className: "bg-amber-100 text-amber-700 border-amber-300", text: "En préparation" },
      'pret': { className: "bg-green-100 text-green-700 border-green-300", text: "✅ Prêt à servir" },
      'termine': { className: "bg-blue-100 text-blue-700 border-blue-300", text: "Terminé" },
    };
    const style = styles[ks];
    if (!style) return null;
    return (
      <Badge variant="outline" className={`${style.className} flex items-center gap-1`}>
        <ChefHat className="h-3 w-3" />
        {style.text}
      </Badge>
    );
  };

  const handleServeOrder = (order: Order) => {
    onUpdateOrderStatus(order.id, 'served');
    toast({
      title: "Commande servie",
      description: `Commande #${order.orderNumber} marquée comme servie`,
    });
  };

  const handleSendOrder = (order: Order) => {
    onUpdateOrderStatus(order.id, 'sent');
    toast({
      title: "Commande envoyée",
      description: `Commande #${order.orderNumber} envoyée à la caisse`,
    });
  };

  const handleCancelOrder = (order: Order) => {
    // Demander confirmation pour les commandes 'sent' (possiblement payées)
    if (order.status === 'sent') {
      const confirmed = window.confirm(
        `⚠️ ATTENTION : Cette commande a été envoyée à la caisse.\n\n` +
        `Il est possible que l'argent ait déjà été reçu.\n\n` +
        `Voulez-vous vraiment annuler cette commande ?`
      );
      if (!confirmed) {
        return;
      }
    }
    
    onUpdateOrderStatus(order.id, 'cancelled');
    toast({
      title: "Commande annulée",
      description: `Commande #${order.orderNumber} annulée`,
      variant: "destructive"
    });
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle>{title || "Mes commandes"}</CardTitle>
        <CardDescription>
          {description || "Gérez vos commandes en cours et passées"}
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
                <div className="flex items-center gap-3">
                  <div className="font-semibold text-lg">#{order.orderNumber}</div>
                  <Badge variant="outline" className="text-sm">
                    Table {order.tableNumber}
                  </Badge>
                  <Badge className={`${getStatusColor(order.status)} flex items-center gap-1`}>
                    {getStatusIcon(order.status)}
                    {getStatusText(order.status)}
                  </Badge>
                  {getKitchenBadge(order)}
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
              </div>

              {order.status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSendOrder(order)}
                    className="flex-1 bg-gradient-primary text-white shadow-button"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer à la caisse
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleCancelOrder(order)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              )}
              {order.status === 'sent' && (
                <div className="flex gap-2">
                  {order.kitchenStatus === 'pret' && (
                    <Button
                      onClick={() => handleServeOrder(order)}
                      className="flex-1 bg-green-600 text-white shadow-button"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Marquer comme servi
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => handleCancelOrder(order)}
                    className={order.kitchenStatus === 'pret' ? '' : 'flex-1'}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler la commande
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