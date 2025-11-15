import { useState, useEffect } from "react";
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  QrCode, 
  Plus, 
  Trash2, 
  Edit, 
  Download, 
  Copy,
  Table,
  MapPin,
  CheckCircle,
  Clock,
  AlertCircle,
  ShoppingCart,
  Package
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, orderBy, where, writeBatch } from "firebase/firestore";
import QRCode from "qrcode";
import QRScanner from "@/components/QRScanner";
import { notificationsColRef } from "@/lib/collections";
import { generateTicketPDF } from "@/utils/ticketPDF";

interface TableZone {
  id: string;
  name: string;
  type: 'table' | 'zone';
  capacity?: number;
  description?: string;
}

interface BarOrder {
  id: string;
  orderNumber: string;
  tableZone: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: 'pending' | 'confirmed' | 'served';
  createdAt: number;
  receiptNumber: string;
}

interface BarConnecteePageProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const BarConnecteePage: React.FC<BarConnecteePageProps> = ({ activeTab: externalActiveTab, onTabChange: externalOnTabChange }) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  // State local pour gérer les onglets si pas fourni en props
  const [localActiveTab, setLocalActiveTab] = useState<string>("qr-code");
  
  // Utiliser le state externe si fourni, sinon le state local
  const activeTab = externalActiveTab ?? localActiveTab;
  const handleTabChange = (val: string) => {
    if (externalOnTabChange) {
      externalOnTabChange(val);
    } else {
      setLocalActiveTab(val);
    }
  };
  
  const [tables, setTables] = useState<TableZone[]>([]);
  const [orders, setOrders] = useState<BarOrder[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [newTableName, setNewTableName] = useState("");
  const [newTableType, setNewTableType] = useState<'table' | 'zone'>('table');
  const [newTableCapacity, setNewTableCapacity] = useState<number>(0);
  const [newTableDescription, setNewTableDescription] = useState("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Fonction utilitaire pour obtenir l'URL publique
  const getPublicUrl = () => {
    if (!user) return '';
    
    // Détecter l'environnement
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Utiliser l'URL appropriée selon l'environnement
    const baseUrl = isDevelopment ? 'https://nack.pro' : window.location.origin;
    const basePath = import.meta.env.BASE_URL || '';
    
    // Nettoyer le basePath pour éviter les doubles barres obliques
    const cleanBasePath = basePath.replace(/\/+$/, ''); // Supprimer les barres obliques en fin
    
    // Construire l'URL finale en évitant les doubles barres obliques
    const finalUrl = `${baseUrl}${cleanBasePath}/commande/${user.uid}`;
    
    // Nettoyer les doubles barres obliques dans l'URL finale
    const cleanUrl = finalUrl.replace(/\/+/g, '/').replace(':/', '://');
    
    console.log('🔗 Construction URL publique:', {
      isDevelopment,
      baseUrl,
      basePath,
      cleanBasePath,
      finalUrl,
      cleanUrl,
      userId: user.uid
    });
    
    return cleanUrl;
  };

  // Vérifier que l'utilisateur est connecté
  if (!user) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <AlertCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Accès non autorisé</h3>
          <p className="text-muted-foreground">
            Vous devez être connecté pour accéder à cette fonctionnalité.
          </p>
        </div>
      </div>
    );
  }

  // Gestion d'erreur globale
  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-red-600">Erreur</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setError("")}>
              Réessayer
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Recharger la page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Écran de chargement - désactivé pour éviter les blocages
  // if (isLoading) {
  //   return (
  //     <div className="space-y-6">
  //       <div className="text-center py-8">
  //         <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
  //         <h3 className="text-lg font-semibold mb-2">Chargement...</h3>
  //         <p className="text-muted-foreground">
  //           Chargement de la page Bar Connectée
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

  // Charger toutes les données
  useEffect(() => {
    if (!user) return;
    
    // Désactiver le chargement immédiatement
    setIsLoading(false);
    
    // Charger les tables (avec gestion d'erreur de permissions)
    try {
      const tablesRef = collection(db, `profiles/${user.uid}/tables`);
      const unsubscribeTables = onSnapshot(tablesRef, (snapshot) => {
        try {
          const tablesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as TableZone[];
          setTables(tablesData);
        } catch (error) {
          console.error('Erreur traitement tables:', error);
        }
      }, (error) => {
        console.error('Erreur snapshot tables:', error);
      });

      // Charger les commandes (avec gestion d'erreur de permissions)
      const ordersRef = collection(db, `profiles/${user.uid}/barOrders`);
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const unsubscribeOrders = onSnapshot(q, (snapshot) => {
        try {
          const ordersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as BarOrder[];
          
          // Vérifier s'il y a de nouvelles commandes
          const newOrders = ordersData.filter(order => 
            order.status === 'pending' && 
            order.createdAt > (Date.now() - 60000)
          );
          
          // Créer des notifications pour les nouvelles commandes
          newOrders.forEach(async (order) => {
            try {
              await addDoc(notificationsColRef(db, user.uid), {
                title: "Nouvelle commande Bar Connectée",
                message: `Commande #${order.orderNumber} - ${order.tableZone} - ${order.total.toLocaleString('fr-FR', { useGrouping: false })} XAF`,
                type: "info",
                createdAt: Date.now(),
                read: false,
              });
            } catch (error) {
              console.error('Erreur création notification:', error);
            }
          });
          
          setOrders(ordersData);
        } catch (error) {
          console.error('Erreur traitement commandes:', error);
        }
      }, (error) => {
        console.error('Erreur snapshot commandes:', error);
      });

      // Charger tous les produits d'abord pour diagnostic
      const productsRef = collection(db, `profiles/${user.uid}/products`);
      const unsubscribeProducts = onSnapshot(productsRef, (snapshot) => {
        try {
          const allProducts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log('Tous les produits chargés:', allProducts.length);
          console.log('Détails des produits:', allProducts);
          
          // Filtrer les produits avec prix > 0 (le stock n'est pas requis pour les menus/plats)
          const productsInStock = allProducts.filter(product => {
            const stock = product.quantity || product.stock || 0; // Utiliser quantity comme dans StockPage
            // Vérifier le prix de manière très stricte (gérer string, number, null, undefined, NaN, chaînes vides)
            let priceValue = 0;
            if (typeof product.price === 'number' && !isNaN(product.price)) {
              priceValue = product.price;
            } else if (typeof product.price === 'string' && product.price.trim() !== '') {
              const parsed = parseFloat(product.price.trim());
              priceValue = isNaN(parsed) ? 0 : parsed;
            }
            // Inclure les produits avec prix > 0 (stock peut être 0 pour les menus/plats)
            const isValid = priceValue > 0;
            if (!isValid) {
              console.log(`❌ Produit "${product.name}" exclu: stock=${stock}, price=${priceValue} (original: ${product.price}, type: ${typeof product.price})`);
            }
            return isValid;
          });
          
          console.log('Produits en stock après filtrage:', productsInStock.length);
          setProducts(productsInStock);
        } catch (error) {
          console.error('Erreur traitement produits:', error);
        }
      }, (error) => {
        console.error('Erreur snapshot produits:', error);
      });

      return () => {
        unsubscribeTables();
        unsubscribeOrders();
        unsubscribeProducts();
      };
    } catch (error) {
      console.error('Erreur chargement données:', error);
    }
  }, [user]);

  // Charger le QR Code existant
  useEffect(() => {
    if (!user) return;
    
    const loadExistingQRCode = async () => {
      try {
        console.log('Chargement QR Code existant pour:', user.uid);
        const configDoc = await getDoc(doc(db, `profiles/${user.uid}/barConnectee`, 'config'));
        
        if (configDoc.exists()) {
          const config = configDoc.data();
          console.log('Configuration trouvée:', config);
          
          if (config.qrCodeGenerated) {
            // Utiliser l'URL sauvegardée ou générer une nouvelle
            const publicUrl = config.publicUrl || getPublicUrl();
            
            console.log('Génération QR Code avec URL:', publicUrl);
            
            const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
              width: 300,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            setQrCodeUrl(qrCodeDataUrl);
            console.log('QR Code existant chargé');
          }
        } else {
          console.log('Aucune configuration QR Code trouvée');
        }
      } catch (error) {
        console.error('Erreur chargement QR Code:', error);
      }
    };

    loadExistingQRCode();
  }, [user]);

  // Générer le QR Code
  const generateQRCode = async () => {
    if (!user || !profile) {
      toast({
        title: "Erreur",
        description: "Utilisateur non connecté ou profil manquant.",
        variant: "destructive"
      });
      return;
    }
    
    setIsGeneratingQR(true);
    try {
      const publicUrl = getPublicUrl();
      
      console.log('Génération QR Code pour URL:', publicUrl);
      console.log('Détails URL:', {
        currentOrigin: window.location.origin,
        basePath: import.meta.env.BASE_URL || '',
        userId: user.uid,
        finalUrl: publicUrl
      });
      
      const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      console.log('QR Code généré avec succès');
      setQrCodeUrl(qrCodeDataUrl);
      
      // Sauvegarder l'URL publique dans Firestore
      try {
        await setDoc(doc(db, `profiles/${user.uid}/barConnectee`, 'config'), {
          publicUrl,
          qrCodeGenerated: true,
          establishmentName: profile.establishmentName,
          lastUpdated: Date.now()
        });
        console.log('Configuration sauvegardée dans Firestore');
      } catch (firestoreError) {
        console.warn('Erreur sauvegarde Firestore (permissions):', firestoreError);
        // Continuer même si la sauvegarde échoue
      }
      
      toast({
        title: "QR Code généré !",
        description: "Votre QR Code est prêt à être utilisé par vos clients."
      });
    } catch (error) {
      console.error('Erreur génération QR:', error);
      toast({
        title: "Erreur",
        description: `Impossible de générer le QR Code: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // Ajouter une table/zone
  const addTable = async () => {
    if (!newTableName.trim() || !user) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un nom de table.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const tableData = {
        name: newTableName.trim(),
        type: newTableType,
        ...(newTableCapacity > 0 && { capacity: newTableCapacity }),
        ...(newTableDescription.trim() && { description: newTableDescription.trim() }),
        createdAt: Date.now()
      };
      
      console.log('Ajout table:', tableData);
      console.log('Collection path:', `profiles/${user.uid}/tables`);
      
      const docRef = await addDoc(collection(db, `profiles/${user.uid}/tables`), tableData);
      console.log('Table ajoutée avec ID:', docRef.id);
      
      // Réinitialiser le formulaire
      setNewTableName("");
      setNewTableType('table');
      setNewTableCapacity(0);
      setNewTableDescription("");
      
      toast({
        title: "Table ajoutée !",
        description: `${newTableName} a été ajoutée avec succès.`
      });
    } catch (error) {
      console.error('Erreur ajout table:', error);
      console.error('Détails erreur:', error.code, error.message);
      
      let errorMessage = "Impossible d'ajouter la table.";
      if (error.code === 'permission-denied') {
        errorMessage = "Permissions insuffisantes. Contactez le support.";
      } else if (error.code === 'unavailable') {
        errorMessage = "Service temporairement indisponible. Réessayez.";
      }
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  // Supprimer une table
  const deleteTable = async (tableId: string) => {
    if (!user) return;
    
    try {
      await setDoc(doc(db, `profiles/${user.uid}/tables`, tableId), {
        deleted: true,
        deletedAt: Date.now()
      });
      
      toast({
        title: "Table supprimée !",
        description: "La table a été supprimée avec succès."
      });
    } catch (error) {
      console.error('Erreur suppression table:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la table.",
        variant: "destructive"
      });
    }
  };

  // Confirmer une commande
  const confirmOrder = async (orderId: string) => {
    if (!user) return;
    
    try {
      await setDoc(doc(db, `profiles/${user.uid}/barOrders`, orderId), {
        status: 'confirmed',
        confirmedAt: Date.now()
      }, { merge: true });
      
      toast({
        title: "Commande confirmée !",
        description: "La commande a été confirmée et est prête à être servie."
      });
    } catch (error) {
      console.error('Erreur confirmation commande:', error);
      toast({
        title: "Erreur",
        description: "Impossible de confirmer la commande.",
        variant: "destructive"
      });
    }
  };

  // Marquer comme servie (avec paiement, diminution stock et intégration ventes)
  const markAsServed = async (orderId: string) => {
    if (!user || !profile) return;
    
    try {
      // Trouver la commande
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        toast({
          title: "Erreur",
          description: "Commande introuvable.",
          variant: "destructive"
        });
        return;
      }

      // Diminuer le stock pour chaque produit
      const batch = writeBatch(db);
      
      for (const item of order.items) {
        // Trouver le produit dans la liste des produits
        const product = products.find(p => p.name === item.name);
        if (product) {
          const newStock = (product.quantity || product.stock || 0) - item.quantity;
          if (newStock < 0) {
            toast({
              title: "Stock insuffisant",
              description: `Stock insuffisant pour ${item.name}. Stock actuel: ${product.quantity || product.stock || 0}`,
              variant: "destructive"
            });
            return;
          }
          
          // Mettre à jour le stock
          const productRef = doc(db, `profiles/${user.uid}/products`, product.id);
          batch.update(productRef, { 
            quantity: newStock,
            lastStockUpdate: Date.now()
          });
        }
      }

      // Marquer la commande comme servie
      const orderRef = doc(db, `profiles/${user.uid}/barOrders`, orderId);
      batch.update(orderRef, {
        status: 'served',
        servedAt: Date.now(),
        paidAt: Date.now(),
        paymentMethod: 'cash'
      });

      // Créer une vente dans la collection sales
      const saleData = {
        type: 'bar-connectee',
        orderNumber: order.orderNumber,
        establishmentName: profile.establishmentName,
        tableZone: order.tableZone,
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        })),
        total: order.total,
        paymentMethod: 'cash',
        createdAt: Date.now(),
        servedAt: Date.now(),
        source: 'Bar Connectée'
      };

      const saleRef = doc(collection(db, `profiles/${user.uid}/sales`));
      batch.set(saleRef, saleData);

      // Exécuter toutes les opérations en batch
      await batch.commit();
      
      toast({
        title: "Commande servie et payée !",
        description: `Commande #${order.orderNumber} finalisée (${order.total.toLocaleString('fr-FR', { useGrouping: false })} XAF)`
      });
    } catch (error) {
      console.error('Erreur marquage servie:', error);
      toast({
        title: "Erreur",
        description: "Impossible de marquer la commande comme servie.",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-orange-600 border-orange-600"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case 'confirmed':
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><CheckCircle className="w-3 h-3 mr-1" />Confirmée</Badge>;
      case 'served':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="w-3 h-3 mr-1" />Servie & Payée</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" />Inconnu</Badge>;
    }
  };

  // Télécharger le ticket d'une commande
  const downloadOrderTicket = async (order: BarOrder) => {
    if (!user || !profile) return;

    try {
      const ticketData = {
        orderNumber: order.orderNumber,
        establishmentName: profile.establishmentName || 'Établissement',
        establishmentLogo: profile.logoUrl,
        tableZone: order.tableZone,
        items: order.items,
        total: order.total,
        createdAt: order.createdAt,
        receiptData: {
          orderId: order.id,
          establishmentId: user.uid,
          timestamp: order.createdAt
        }
      };

      await generateTicketPDF(ticketData);
      
      toast({
        title: "Ticket téléchargé",
        description: `Ticket de la commande #${order.orderNumber} téléchargé avec succès.`
      });
    } catch (error) {
      console.error('Erreur génération ticket:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le ticket PDF.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Bar Connectée</h2>
          <p className="text-sm text-muted-foreground">Gérez les commandes QR de vos clients</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4 gap-2">
          <TabsTrigger value="qr-code" className="text-xs sm:text-sm px-2 sm:px-4 py-2 whitespace-nowrap">QR Code</TabsTrigger>
          <TabsTrigger value="tables" className="text-xs sm:text-sm px-2 sm:px-4 py-2 whitespace-nowrap">Tables & Zones</TabsTrigger>
          <TabsTrigger value="orders" className="text-xs sm:text-sm px-2 sm:px-4 py-2 whitespace-nowrap">Commandes</TabsTrigger>
          <TabsTrigger value="scanner" className="text-xs sm:text-sm px-2 sm:px-4 py-2 whitespace-nowrap">Scanner</TabsTrigger>
        </TabsList>

        {/* QR Code Tab */}
        <TabsContent value="qr-code" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                QR Code Unique
              </CardTitle>
              <CardDescription>
                Un seul QR Code pour tout votre établissement. Vos clients peuvent commander depuis n'importe quelle table.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {qrCodeUrl ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-4 bg-white rounded-lg border-2 border-dashed border-gray-300">
                    <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground mb-1">URL du QR Code :</p>
                    <p className="text-xs text-muted-foreground break-all bg-gray-50 p-2 rounded border">
                      {getPublicUrl()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => {
                      const link = document.createElement('a');
                      link.href = qrCodeUrl;
                      link.download = `qr-code-${profile?.establishmentName || 'etablissement'}.png`;
                      link.click();
                    }}>
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger
                    </Button>
                    <Button variant="outline" onClick={() => {
                      navigator.clipboard.writeText(getPublicUrl());
                      toast({ title: "URL copiée !", description: "L'URL publique a été copiée dans le presse-papiers." });
                    }}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copier URL
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Placez ce QR Code sur chaque table ou à l'entrée de votre établissement.
                    <br />
                    Vos clients pourront commander directement depuis leur téléphone.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <QrCode className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Générer votre QR Code</h3>
                  <p className="text-muted-foreground mb-4">
                    Créez un QR Code unique pour permettre à vos clients de commander directement.
                  </p>
                  <Button onClick={generateQRCode} disabled={isGeneratingQR}>
                    {isGeneratingQR ? "Génération..." : "Générer QR Code"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Produits disponibles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Produits disponibles pour commande
              </CardTitle>
              <CardDescription>
                Ces produits seront visibles par vos clients lorsqu'ils scannent le QR Code
              </CardDescription>
            </CardHeader>
            <CardContent>
              {products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((product) => (
                    <div key={product.id} className="border rounded-lg p-4 space-y-3">
                      {/* Image du produit */}
                      <div className="aspect-square relative">
                        {product.imageUrl && product.imageUrl.trim() !== '' ? (
                          <img 
                            src={product.imageUrl} 
                            alt={product.name} 
                            className="w-full h-full object-cover rounded-lg" 
                            onError={(e) => {
                              console.log('Erreur chargement image pour', product.name, ':', product.imageUrl);
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 flex items-center justify-center rounded-lg ${product.imageUrl && product.imageUrl.trim() !== '' ? 'hidden' : ''}`}>
                          <div className="text-center">
                            <div className="w-12 h-12 bg-primary/30 rounded-full flex items-center justify-center mx-auto mb-2">
                              <span className="text-primary font-bold text-lg">
                                {product.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">Pas d'image</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Informations du produit */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{product.name}</h4>
                          <Badge variant="outline">{product.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Prix: {product.price?.toLocaleString('fr-FR', { useGrouping: false })} XAF
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Stock: {(product.quantity || product.stock || 0)} unités
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun produit disponible</h3>
                  <p className="text-muted-foreground mb-4">
                    Ajoutez des produits dans la section Stock pour qu'ils apparaissent ici.
                  </p>
                  <div className="mt-4 p-4 bg-muted rounded-lg text-left">
                    <p className="text-sm font-medium mb-2">Debug Info:</p>
                    <p className="text-xs text-muted-foreground">
                      Collection: profiles/{user?.uid}/products
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Filtre: stock &gt; 0 et prix &gt; 0
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vérifiez la console pour plus de détails
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tables & Zones Tab */}
        <TabsContent value="tables" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Table className="w-5 h-5" />
                Configuration des Tables & Zones
              </CardTitle>
              <CardDescription>
                Définissez vos tables et zones pour que les clients puissent indiquer leur position.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Formulaire d'ajout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="tableName">Nom de la table/zone</Label>
                  <Input
                    id="tableName"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="Ex: Table 1, Comptoir, Zone VIP..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tableType">Type</Label>
                  <select
                    id="tableType"
                    value={newTableType}
                    onChange={(e) => setNewTableType(e.target.value as 'table' | 'zone')}
                    className="w-full px-3 py-2 border border-input rounded-md"
                  >
                    <option value="table">Table</option>
                    <option value="zone">Zone</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tableCapacity">Capacité (optionnel)</Label>
                  <Input
                    id="tableCapacity"
                    type="number"
                    value={newTableCapacity}
                    onChange={(e) => setNewTableCapacity(parseInt(e.target.value) || 0)}
                    placeholder="Ex: 4 personnes"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tableDescription">Description (optionnel)</Label>
                  <Input
                    id="tableDescription"
                    value={newTableDescription}
                    onChange={(e) => setNewTableDescription(e.target.value)}
                    placeholder="Ex: Près de la fenêtre, Zone fumeurs..."
                  />
                </div>
                <div className="md:col-span-2">
                  <Button onClick={addTable} disabled={!newTableName.trim()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter
                  </Button>
                </div>
              </div>

              {/* Liste des tables */}
              <div className="space-y-2">
                <h3 className="font-semibold">Tables & Zones configurées</h3>
                {tables.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Aucune table configurée. Ajoutez votre première table ci-dessus.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {tables.map((table) => (
                      <div key={table.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {table.type === 'table' ? <Table className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                          <div>
                            <p className="font-medium">{table.name}</p>
                            {table.capacity && <p className="text-sm text-muted-foreground">{table.capacity} personnes</p>}
                            {table.description && <p className="text-sm text-muted-foreground">{table.description}</p>}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteTable(table.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Commandes Clients
              </CardTitle>
              <CardDescription>
                Gérez les commandes reçues via QR Code de vos clients.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucune commande</h3>
                  <p className="text-muted-foreground">
                    Les commandes de vos clients apparaîtront ici une fois qu'ils auront scanné le QR Code.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">Commande #{order.orderNumber}</h3>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(order.createdAt).toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground mb-2">
                          <MapPin className="w-4 h-4 inline mr-1" />
                          {order.tableZone}
                        </p>
                        <div className="space-y-1">
                          {order.items.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>{item.name} x{item.quantity}</span>
                              <span>{item.price.toLocaleString('fr-FR', { useGrouping: false })} XAF</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between font-semibold">
                            <span>Total</span>
                            <span>{order.total.toLocaleString('fr-FR', { useGrouping: false })} XAF</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {order.status === 'pending' && (
                          <Button size="sm" onClick={() => confirmOrder(order.id)}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Confirmer
                          </Button>
                        )}
                        {order.status === 'confirmed' && (
                          <Button size="sm" onClick={() => markAsServed(order.id)}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Servir & Payer
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => downloadOrderTicket(order)}>
                          <Download className="w-4 h-4 mr-2" />
                          Ticket PDF
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scanner Tab */}
        <TabsContent value="scanner" className="space-y-6">
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
              <QRScanner />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BarConnecteePage;
