import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
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
  Clock,
  X
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, writeBatch, collection, addDoc } from 'firebase/firestore';

interface ReceiptData {
  orderId: string;
  establishmentId: string;
  timestamp: number;
}

interface BarOrder {
  id: string;
  orderNumber: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  tableZone: string;
  status: 'pending' | 'confirmed' | 'served';
  createdAt: number;
  establishmentName?: string;
}

interface Product {
  id: string;
  name: string;
  quantity?: number;
  stock?: number;
}

const QRScanner: React.FC = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedOrder, setScannedOrder] = useState<BarOrder | null>(null);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');

  // Nettoyage du scanner au démontage (doit être appelé inconditionnellement)
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch(() => {});
        } catch {
          // Ignorer les erreurs de nettoyage
        }
        scannerRef.current = null;
      }
    };
  }, []);

  // Vérifier que l'utilisateur est connecté
  if (!user) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Accès non autorisé</h3>
          <p className="text-muted-foreground">
            Vous devez être connecté pour utiliser le scanner QR.
          </p>
        </CardContent>
      </Card>
    );
  }

  const startScanner = () => {
    // Nettoyer le scanner précédent s'il existe
    if (scannerRef.current) {
      try {
        scannerRef.current.clear().catch(() => {});
      } catch (e) {
        // Ignorer les erreurs de nettoyage
      }
      scannerRef.current = null;
    }

    // D'abord, activer le mode scanning pour que l'élément DOM soit rendu
    setIsScanning(true);

    // Attendre que le DOM soit prêt avant d'initialiser le scanner
    setTimeout(() => {
      const scannerElement = document.getElementById("qr-scanner");
      if (!scannerElement) {
        setIsScanning(false);
        toast({
          title: "Erreur",
          description: "L'élément scanner n'est pas disponible. Veuillez réessayer.",
          variant: "destructive"
        });
        return;
      }

      try {
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          supportedScanTypes: [Html5QrcodeSupportedFormats.QR_CODE],
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true
        };

        scannerRef.current = new Html5QrcodeScanner(
          "qr-scanner",
          config,
          false
        );

        scannerRef.current.render(
          (decodedText) => {
            console.log('QR Code scanné:', decodedText);
            handleScannedCode(decodedText);
          },
          (error) => {
            // Ignorer les erreurs de scan continu
            if (error && !error.includes('No QR code found')) {
              console.log('Erreur de scan:', error);
            }
          }
        );
      } catch (err: unknown) {
        console.error('Erreur lors de l\'initialisation du scanner:', err);
        setIsScanning(false);
        
        let errorMessage = "Impossible de démarrer le scanner.";
        const msg = err instanceof Error ? err.message : String(err);
        if (msg) {
          if (msg.includes('camera') || msg.includes('permission')) {
            errorMessage = "Accès à la caméra refusé. Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur.";
          } else if (msg.includes('not found') || msg.includes('not available')) {
            errorMessage = "Aucune caméra détectée. Veuillez connecter une caméra et réessayer.";
          } else {
            errorMessage = `Erreur: ${msg}`;
          }
        }
        
        toast({
          title: "Erreur de scanner",
          description: errorMessage,
          variant: "destructive"
        });
      }
    }, 300);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear().catch(() => {});
      } catch (e) {
        // Ignorer les erreurs de nettoyage
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleScannedCode = async (decodedText: string) => {
    try {
      console.log('Traitement du QR Code:', decodedText);
      
      // Arrêter le scanner temporairement
      stopScanner();
      
      // Parser les données du reçu
      let receiptData: ReceiptData;
      try {
        receiptData = JSON.parse(decodedText);
      } catch (parseError) {
        console.error('Erreur parsing QR Code:', parseError);
        toast({
          title: "QR Code invalide",
          description: "Le QR Code scanné ne contient pas de données valides.",
          variant: "destructive"
        });
        return;
      }

      console.log('Données du reçu:', receiptData);

      // Vérifier que c'est bien un reçu de commande
      if (!receiptData.orderId || !receiptData.establishmentId) {
        toast({
          title: "QR Code invalide",
          description: "Ce QR Code ne semble pas être un reçu de commande.",
          variant: "destructive"
        });
        return;
      }

      // Récupérer la commande depuis Firestore
      const orderRef = doc(db, `profiles/${receiptData.establishmentId}/barOrders`, receiptData.orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) {
        toast({
          title: "Commande introuvable",
          description: "Cette commande n'existe pas ou a été supprimée.",
          variant: "destructive"
        });
        return;
      }

      const orderData = orderSnap.data() as BarOrder;
      console.log('Commande trouvée:', orderData);

      setScannedOrder(orderData);
      setShowOrderDialog(true);

    } catch (error) {
      console.error('Erreur lors du traitement:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors du traitement du QR Code.",
        variant: "destructive"
      });
    }
  };

  const finalizeOrder = async () => {
    if (!scannedOrder || !user) return;

    setIsProcessing(true);

    try {
      // Vérifier le stock avant de finaliser
      const productsRef = collection(db, `profiles/${user.uid}/products`);
      const batch = writeBatch(db);

      // Vérifier et décrémenter le stock pour chaque produit
      for (const item of scannedOrder.items) {
        const productRef = doc(productsRef, item.id);
        const productSnap = await getDoc(productRef);
        
        if (productSnap.exists()) {
          const productData = productSnap.data() as Product;
          const currentStock = productData.quantity || productData.stock || 0;
          const newStock = currentStock - item.quantity;
          
          if (newStock < 0) {
            toast({
              title: "Stock insuffisant",
              description: `Stock insuffisant pour ${item.name}. Stock actuel: ${currentStock}`,
              variant: "destructive"
            });
            setIsProcessing(false);
            return;
          }
          
          batch.update(productRef, { quantity: newStock });
        }
      }

      // Mettre à jour le statut de la commande
      const orderRef = doc(db, `profiles/${scannedOrder.id.split('/')[0]}/barOrders`, scannedOrder.id.split('/')[1] || scannedOrder.id);
      batch.update(orderRef, {
        status: 'served',
        servedAt: Date.now(),
        paidAt: Date.now(),
        paymentMethod: 'cash'
      });

      // Créer une entrée de vente
      const saleData = {
        type: 'bar-connectee',
        orderNumber: scannedOrder.orderNumber,
        establishmentName: scannedOrder.establishmentName || 'Établissement',
        tableZone: scannedOrder.tableZone,
        items: scannedOrder.items,
        total: scannedOrder.total,
        paymentMethod: 'cash' as const,
        createdAt: scannedOrder.createdAt,
        servedAt: Date.now(),
        source: 'Bar Connectée'
      };

      const salesRef = collection(db, `profiles/${user.uid}/sales`);
      batch.set(doc(salesRef), saleData);

      await batch.commit();

      toast({
        title: "Commande finalisée",
        description: "La commande a été servie et payée avec succès.",
      });

      setShowOrderDialog(false);
      setScannedOrder(null);

    } catch (error) {
      console.error('Erreur lors de la finalisation:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la finalisation de la commande.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case 'confirmed':
        return <Badge variant="outline" className="text-blue-600"><CheckCircle className="w-3 h-3 mr-1" />Confirmée</Badge>;
      case 'served':
        return <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Servie & Payée</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Scanner QR Code
          </CardTitle>
          <CardDescription>
            Scannez les QR Code des reçus clients pour valider leurs commandes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isScanning ? (
            <div className="text-center py-8">
              <QrCode className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Prêt à scanner</h3>
              <p className="text-muted-foreground mb-4">
                Cliquez sur le bouton ci-dessous pour démarrer le scanner QR Code
              </p>
              <Button onClick={startScanner} className="w-full sm:w-auto">
                <QrCode className="w-4 h-4 mr-2" />
                Démarrer le scanner
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div id="qr-scanner" className="w-full min-h-[300px]"></div>
              <Button onClick={stopScanner} variant="outline" className="w-full">
                <X className="w-4 h-4 mr-2" />
                Arrêter le scanner
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de détails de la commande */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="w-[90vw] max-w-[500px] sm:max-w-[500px] mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Détails de la commande
            </DialogTitle>
            <DialogDescription>
              Vérifiez les détails avant de finaliser la commande
            </DialogDescription>
          </DialogHeader>

          {scannedOrder && (
            <div className="space-y-4">
              {/* Informations générales */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Commande #{scannedOrder.orderNumber}</span>
                  {getStatusBadge(scannedOrder.status)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Table/Zone: {scannedOrder.tableZone}
                </p>
                <p className="text-sm text-muted-foreground">
                  Heure: {new Date(scannedOrder.createdAt).toLocaleString()}
                </p>
                {scannedOrder.establishmentName && (
                  <p className="text-sm text-blue-600 font-medium">
                    📍 {scannedOrder.establishmentName}
                  </p>
                )}
              </div>

              {/* Articles */}
              <div className="space-y-2">
                <h4 className="font-medium">Articles commandés:</h4>
                <div className="space-y-1">
                  {scannedOrder.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{item.name} x{item.quantity}</span>
                      <span>{item.price.toLocaleString('fr-FR', { useGrouping: false })} XAF</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>{scannedOrder.total.toLocaleString('fr-FR', { useGrouping: false })} XAF</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                {scannedOrder.status === 'served' ? (
                  <div className="w-full text-center py-4">
                    <CheckCircle className="w-8 h-8 mx-auto text-green-600 mb-2" />
                    <p className="text-green-600 font-medium">Commande déjà servie et payée</p>
                  </div>
                ) : (
                  <Button 
                    onClick={finalizeOrder} 
                    disabled={isProcessing}
                    className="flex-1"
                  >
                    {isProcessing ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Finalisation...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Finaliser la vente
                      </>
                    )}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => setShowOrderDialog(false)}
                  disabled={isProcessing}
                >
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