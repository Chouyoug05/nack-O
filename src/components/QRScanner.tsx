import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  QrCode, 
  Camera, 
  CheckCircle, 
  AlertCircle,
  MapPin,
  Clock,
  User
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

interface ReceiptData {
  orderNumber: string;
  receiptNumber: string;
  establishmentId: string;
  total: number;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  tableZone: string;
  createdAt: number;
}

interface OrderDetails {
  orderNumber: string;
  receiptNumber: string;
  tableZone: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: string;
  createdAt: number;
}

const QRScanner = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<ReceiptData | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");

  // Démarrer le scanner
  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);
        setError("");
      }
    } catch (err) {
      console.error('Erreur accès caméra:', err);
      setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
    }
  };

  // Arrêter le scanner
  const stopScanner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  // Scanner le QR Code
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Ici on utiliserait une vraie librairie de détection QR comme jsQR
    // Pour la démo, on simule la détection
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Simulation de détection QR (à remplacer par vraie détection)
    setTimeout(() => {
      // Simuler un QR Code scanné
      const mockReceiptData: ReceiptData = {
        orderNumber: "CMD123456",
        receiptNumber: "RCP123456",
        establishmentId: user?.uid || "",
        total: 2500,
        items: [
          { productId: "1", name: "Regab", price: 1000, quantity: 2 },
          { productId: "2", name: "Brochette", price: 500, quantity: 1 }
        ],
        tableZone: "Table 3",
        createdAt: Date.now() - 300000 // Il y a 5 minutes
      };
      
      setScannedData(mockReceiptData);
      setIsScanning(false);
      stopScanner();
    }, 2000);
  };

  // Charger les détails de la commande
  const loadOrderDetails = async (receiptData: ReceiptData) => {
    if (!user) return;

    try {
      setIsProcessing(true);
      
      // Chercher la commande dans Firestore
      const orderRef = doc(db, `establishments/${user.uid}/barOrders`, receiptData.orderNumber);
      const orderDoc = await getDoc(orderRef);
      
      if (orderDoc.exists()) {
        const orderData = orderDoc.data() as OrderDetails;
        setOrderDetails(orderData);
      } else {
        setError("Commande introuvable dans le système.");
      }
    } catch (err) {
      console.error('Erreur chargement commande:', err);
      setError("Erreur lors du chargement de la commande.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirmer la commande
  const confirmOrder = async () => {
    if (!user || !scannedData) return;

    try {
      setIsProcessing(true);
      
      const orderRef = doc(db, `establishments/${user.uid}/barOrders`, scannedData.orderNumber);
      await updateDoc(orderRef, {
        status: 'confirmed',
        confirmedAt: Date.now(),
        confirmedBy: user.uid
      });

      toast({
        title: "Commande confirmée !",
        description: `La commande ${scannedData.orderNumber} a été confirmée.`
      });

      // Réinitialiser
      setScannedData(null);
      setOrderDetails(null);
      setError("");
    } catch (err) {
      console.error('Erreur confirmation:', err);
      setError("Erreur lors de la confirmation de la commande.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Marquer comme servie
  const markAsServed = async () => {
    if (!user || !scannedData) return;

    try {
      setIsProcessing(true);
      
      const orderRef = doc(db, `establishments/${user.uid}/barOrders`, scannedData.orderNumber);
      await updateDoc(orderRef, {
        status: 'served',
        servedAt: Date.now(),
        servedBy: user.uid
      });

      toast({
        title: "Commande servie !",
        description: `La commande ${scannedData.orderNumber} a été marquée comme servie.`
      });

      // Réinitialiser
      setScannedData(null);
      setOrderDetails(null);
      setError("");
    } catch (err) {
      console.error('Erreur marquage servie:', err);
      setError("Erreur lors du marquage de la commande comme servie.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Réinitialiser
  const reset = () => {
    setScannedData(null);
    setOrderDetails(null);
    setError("");
    stopScanner();
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Scanner QR Code
          </CardTitle>
          <CardDescription>
            Scannez le QR Code du reçu client pour valider sa commande
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isScanning && !scannedData && (
            <div className="text-center py-8">
              <Camera className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Scanner un reçu</h3>
              <p className="text-muted-foreground mb-4">
                Cliquez sur "Démarrer le scanner" pour scanner le QR Code du reçu client.
              </p>
              <Button onClick={startScanner}>
                <Camera className="w-4 h-4 mr-2" />
                Démarrer le scanner
              </Button>
            </div>
          )}

          {isScanning && (
            <div className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full h-64 bg-black rounded-lg"
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none">
                  <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-primary"></div>
                  <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-primary"></div>
                  <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-primary"></div>
                  <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-primary"></div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={scanQRCode} className="flex-1">
                  <QrCode className="w-4 h-4 mr-2" />
                  Scanner maintenant
                </Button>
                <Button variant="outline" onClick={stopScanner}>
                  Arrêter
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {scannedData && !orderDetails && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-semibold">QR Code scanné avec succès !</span>
                </div>
                <p className="text-sm text-green-700">
                  Commande: {scannedData.orderNumber}
                </p>
              </div>
              
              <div className="space-y-2">
                <Button 
                  onClick={() => loadOrderDetails(scannedData)} 
                  disabled={isProcessing}
                  className="w-full"
                >
                  {isProcessing ? "Chargement..." : "Charger les détails"}
                </Button>
                <Button variant="outline" onClick={reset} className="w-full">
                  Nouveau scan
                </Button>
              </div>
            </div>
          )}

          {orderDetails && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Commande #{orderDetails.orderNumber}</h3>
                  {orderDetails.status === 'pending' && (
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      <Clock className="w-3 h-3 mr-1" />
                      En attente
                    </Badge>
                  )}
                  {orderDetails.status === 'confirmed' && (
                    <Badge variant="outline" className="text-blue-600 border-blue-600">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Confirmée
                    </Badge>
                  )}
                  {orderDetails.status === 'served' && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Servie
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{orderDetails.tableZone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{new Date(orderDetails.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  {orderDetails.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{item.name} x{item.quantity}</span>
                      <span>{item.price.toLocaleString('fr-FR', { useGrouping: false })} XAF</span>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{orderDetails.total.toLocaleString('fr-FR', { useGrouping: false })} XAF</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {orderDetails.status === 'pending' && (
                  <Button 
                    onClick={confirmOrder} 
                    disabled={isProcessing}
                    className="w-full"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmer la commande
                  </Button>
                )}
                {orderDetails.status === 'confirmed' && (
                  <Button 
                    onClick={markAsServed} 
                    disabled={isProcessing}
                    className="w-full"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marquer comme servie
                  </Button>
                )}
                <Button variant="outline" onClick={reset} className="w-full">
                  Nouveau scan
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QRScanner;
