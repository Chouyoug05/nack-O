import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  QrCode, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  CreditCard,
  Banknote,
  MapPin,
  Clock
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';

interface ScannedOrder {
  orderNumber: string;
  receiptNumber: string;
  establishmentId: string;
  total: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  tableZone: string;
  createdAt: number;
}

const QRScanner: React.FC = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<ScannedOrder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [isOrderPaid, setIsOrderPaid] = useState(false);

  // Simuler le scan QR (en attendant l'implémentation réelle)
  const simulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      // Simuler des données QR d'une commande
      const mockOrderData = {
        orderNumber: 'CMD123456',
        receiptNumber: 'RCP123456',
        establishmentId: user?.uid || 'test',
        total: 2500,
        items: [
          { name: 'Regab', quantity: 2, price: 1000 },
          { name: 'Brochette', quantity: 1, price: 500 }
        ],
        tableZone: 'Table 1',
        createdAt: Date.now() - 300000 // 5 minutes ago
      };
      
      setScannedData(JSON.stringify(mockOrderData));
      setOrderDetails(mockOrderData);
      setIsScanning(false);
      setShowOrderDialog(true);
    }, 2000);
  };

  // Vérifier si la commande est déjà payée
  const checkOrderStatus = async (orderNumber: string) => {
    if (!user) return false;
    
    try {
      const orderDoc = await getDoc(doc(db, `profiles/${user.uid}/barOrders`, orderNumber));
      if (orderDoc.exists()) {
        const orderData = orderDoc.data();
        return orderData.status === 'served' && orderData.paidAt;
      }
      return false;
    } catch (error) {
      console.error('Erreur vérification commande:', error);
      return false;
    }
  };

  // Finaliser la vente (marquer comme payée et diminuer stock)
  const finalizeSale = async () => {
    if (!user || !orderDetails || !profile) return;
    
    setIsProcessing(true);
    try {
      // Trouver la commande dans barOrders
      const orderDoc = await getDoc(doc(db, `profiles/${user.uid}/barOrders`, orderDetails.orderNumber));
      
      if (orderDoc.exists()) {
        const orderData = orderDoc.data();
        
        // Vérifier si déjà payée
        if (orderData.status === 'served' && orderData.paidAt) {
          setIsOrderPaid(true);
          toast({
            title: "Commande déjà payée",
            description: "Cette commande a déjà été finalisée.",
            variant: "destructive"
          });
          return;
        }

        // Diminuer le stock et finaliser la vente
        const batch = writeBatch(db);
        
        // Mettre à jour la commande
        batch.update(doc(db, `profiles/${user.uid}/barOrders`, orderDetails.orderNumber), {
          status: 'served',
          servedAt: Date.now(),
          paidAt: Date.now(),
          paymentMethod: 'cash'
        });

        // Créer une vente dans la collection sales
        const saleData = {
          type: 'bar-connectee',
          orderNumber: orderDetails.orderNumber,
          establishmentName: profile.establishmentName,
          tableZone: orderDetails.tableZone,
          items: orderDetails.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity
          })),
          total: orderDetails.total,
          paymentMethod: 'cash',
          createdAt: Date.now(),
          servedAt: Date.now(),
          source: 'Bar Connectée - Scanner QR'
        };

        const saleRef = doc(db, `profiles/${user.uid}/sales`);
        batch.set(saleRef, saleData);

        await batch.commit();
        
        toast({
          title: "Vente finalisée !",
          description: `Commande #${orderDetails.orderNumber} marquée comme payée (${orderDetails.total.toLocaleString('fr-FR', { useGrouping: false })} XAF)`
        });
        
        setIsOrderPaid(true);
      } else {
        toast({
          title: "Commande introuvable",
          description: "Cette commande n'existe pas dans le système.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erreur finalisation:', error);
      toast({
        title: "Erreur",
        description: "Impossible de finaliser la vente.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScanner = () => {
    setScannedData(null);
    setOrderDetails(null);
    setShowOrderDialog(false);
    setIsOrderPaid(false);
    setIsScanning(false);
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Accès non autorisé</h3>
        <p className="text-muted-foreground">
          Vous devez être connecté pour utiliser le scanner QR.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Scanner QR Code
          </CardTitle>
          <CardDescription>
            Scannez le QR Code du reçu client pour valider et finaliser la commande
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isScanning && !scannedData && (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <QrCode className="w-12 h-12 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Scanner un reçu</h3>
              <p className="text-muted-foreground mb-4">
                Placez le QR Code du reçu client dans le cadre pour scanner
              </p>
              <Button onClick={simulateScan} className="w-full">
                <QrCode className="w-4 h-4 mr-2" />
                Démarrer le scan
              </Button>
            </div>
          )}

          {isScanning && (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Scan en cours...</h3>
              <p className="text-muted-foreground">
                Positionnez le QR Code dans le cadre
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog pour afficher les détails de la commande */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="w-[90vw] max-w-[500px] sm:max-w-[500px] mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isOrderPaid ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-orange-600" />
              )}
              Détails de la commande
            </DialogTitle>
            <DialogDescription>
              {isOrderPaid ? 'Cette commande a déjà été payée' : 'Commande en attente de paiement'}
            </DialogDescription>
          </DialogHeader>

          {orderDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Numéro de commande</p>
                  <p className="font-semibold">#{orderDetails.orderNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reçu</p>
                  <p className="font-semibold">#{orderDetails.receiptNumber}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{orderDetails.tableZone}</span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(orderDetails.createdAt).toLocaleString()}
                </span>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Articles commandés</h4>
                <div className="space-y-2">
                  {orderDetails.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">x{item.quantity}</p>
                      </div>
                      <p className="font-semibold">
                        {(item.price * item.quantity).toLocaleString('fr-FR', { useGrouping: false })} XAF
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-lg font-bold text-primary">
                    {orderDetails.total.toLocaleString('fr-FR', { useGrouping: false })} XAF
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                {!isOrderPaid ? (
                  <Button 
                    onClick={finalizeSale} 
                    disabled={isProcessing}
                    className="flex-1"
                  >
                    <Banknote className="w-4 h-4 mr-2" />
                    {isProcessing ? 'Finalisation...' : 'Finaliser la vente'}
                  </Button>
                ) : (
                  <div className="flex-1">
                    <Badge className="w-full justify-center bg-green-600">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Déjà payée
                    </Badge>
                  </div>
                )}
                
                <Button variant="outline" onClick={resetScanner}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QRScanner;