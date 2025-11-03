import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { db } from "@/lib/firebase";
import { doc, getDoc, addDoc, collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, ShoppingBag, MapPin, CheckCircle, Package } from "lucide-react";
import QRCodeLib from "qrcode";
import { generateTicketPDF } from "@/utils/ticketPDF";

interface Product {
  id: string;
  name: string;
  price: number | string;
  imageUrl?: string;
  category?: string;
  available?: boolean;
  quantity?: number;
  stock?: number;
}

interface TableZone {
  id: string;
  name: string;
  type: 'table' | 'zone';
}

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Establishment {
  establishmentName: string;
  logoUrl?: string;
}

const PublicOrderingPage = () => {
  // ==========================================
  // TOUS LES HOOKS EN PREMIER - ORDRE FIXE
  // ==========================================
  
  // 1. Hooks de routing
  const params = useParams<{ establishmentId: string }>();
  const establishmentId = useMemo(() => params?.establishmentId ?? null, [params?.establishmentId]);
  
  // 2. useState - toujours dans le même ordre
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<TableZone[]>([]);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [receiptQR, setReceiptQR] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // 3. useRef
  const isMountedRef = useRef<boolean>(true);
  const unsubscribeProductsRef = useRef<(() => void) | null>(null);
  const unsubscribeTablesRef = useRef<(() => void) | null>(null);

  // 4. useMemo
  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cart]);

  // 5. useEffect - toujours avant les returns
  useEffect(() => {
    // Réinitialiser le flag
    isMountedRef.current = true;
    
    // Nettoyer les anciens abonnements
    if (unsubscribeProductsRef.current) {
      try {
        unsubscribeProductsRef.current();
      } catch (e) {
        // Ignore
      }
      unsubscribeProductsRef.current = null;
    }
    if (unsubscribeTablesRef.current) {
      try {
        unsubscribeTablesRef.current();
      } catch (e) {
        // Ignore
      }
      unsubscribeTablesRef.current = null;
    }

    // Fonction de nettoyage
    const cleanup = () => {
      isMountedRef.current = false;
      if (unsubscribeProductsRef.current) {
        try {
          unsubscribeProductsRef.current();
        } catch (e) {
          // Ignore
        }
        unsubscribeProductsRef.current = null;
      }
      if (unsubscribeTablesRef.current) {
        try {
          unsubscribeTablesRef.current();
        } catch (e) {
          // Ignore
        }
        unsubscribeTablesRef.current = null;
      }
    };

    // Si pas d'ID
    if (!establishmentId) {
      setIsLoading(false);
      return cleanup;
    }

    // Charger l'établissement
    getDoc(doc(db, 'profiles', establishmentId))
      .then((profileDoc) => {
        if (!isMountedRef.current) return;
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          setEstablishment({
            establishmentName: profileData.establishmentName || 'Établissement',
            logoUrl: profileData.logoUrl
          });
        }
      })
      .catch(() => {
        if (!isMountedRef.current) return;
        setIsLoading(false);
      });

    // Charger les produits
    const productsRef = collection(db, `profiles/${establishmentId}/products`);
    
    // Fonction pour traiter les produits
    const handleProductsSnapshot = (snapshot: any) => {
      if (!isMountedRef.current) return;
      
      const productsData = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          price: data.price || 0,
          category: data.category || '',
          available: data.available !== false,
          quantity: data.quantity || data.stock || 0,
          stock: data.quantity || data.stock || 0,
          // S'assurer que imageUrl est bien récupéré
          imageUrl: (data.imageUrl && typeof data.imageUrl === 'string' && data.imageUrl.trim() !== '') 
            ? data.imageUrl.trim() 
            : undefined,
        } as Product;
      });
      
      // Filtrer les produits :
      // - Prix > 0 (exclure les produits gratuits/à 0 XAF)
      // - available !== false (inclure si undefined/null)
      // - Stock non obligatoire (on affiche même si stock = 0 ou undefined)
      const availableProducts = productsData.filter(p => {
        const priceValue = typeof p.price === 'number' 
          ? p.price 
          : parseFloat(String(p.price || '0')) || 0;
        
        // Produit disponible si prix > 0 et pas explicitement désactivé
        return priceValue > 0 && p.available !== false;
      });
      
      // Trier par nom manuellement
      availableProducts.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      console.log('📦 Produits disponibles:', availableProducts.length, 'sur', productsData.length);
      console.log('📦 Exemple produit avec image:', availableProducts.find(p => p.imageUrl)?.name, availableProducts.find(p => p.imageUrl)?.imageUrl);
      
      setProducts(availableProducts);
      setIsLoading(false);
    };
    
    // Essayer avec orderBy, mais si ça échoue, charger sans tri
    let unsubscribeProducts: (() => void) | null = null;
    
    try {
      const productsQuery = query(productsRef, orderBy('name'));
      unsubscribeProducts = onSnapshot(
        productsQuery,
        handleProductsSnapshot,
        (error) => {
          // Si orderBy échoue (champ name manquant), charger sans tri
          console.warn('⚠️ Erreur avec orderBy, chargement sans tri:', error);
          if (unsubscribeProducts) {
            unsubscribeProducts();
            unsubscribeProducts = null;
          }
          const simpleQuery = query(productsRef);
          unsubscribeProducts = onSnapshot(
            simpleQuery,
            handleProductsSnapshot,
            (err) => {
              if (!isMountedRef.current) return;
              console.error('❌ Erreur produits:', err);
              setIsLoading(false);
            }
          );
          unsubscribeProductsRef.current = unsubscribeProducts;
        }
      );
      unsubscribeProductsRef.current = unsubscribeProducts;
    } catch (error) {
      // Si la création de la query échoue, charger directement
      console.warn('⚠️ Erreur création query, chargement direct:', error);
      unsubscribeProducts = onSnapshot(
        productsRef,
        handleProductsSnapshot,
        (err) => {
          if (!isMountedRef.current) return;
          console.error('❌ Erreur produits:', err);
          setIsLoading(false);
        }
      );
      unsubscribeProductsRef.current = unsubscribeProducts;
    }

    // Charger les tables
    const tablesRef = collection(db, `profiles/${establishmentId}/tables`);
    const unsubscribeTables = onSnapshot(
      tablesRef,
      (snapshot) => {
        if (!isMountedRef.current) return;
        const tablesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TableZone[];
        
        const filteredTables = tablesData.filter(t => !(t as any).deleted);
        setTables(filteredTables);
        setIsLoading(false);
      },
      (error) => {
        if (!isMountedRef.current) return;
        console.error('Erreur tables:', error);
        setIsLoading(false);
      }
    );
    unsubscribeTablesRef.current = unsubscribeTables;

    // Toujours retourner cleanup
    return cleanup;
  }, [establishmentId]);

  // ==========================================
  // FONCTIONS - APRÈS TOUS LES HOOKS
  // ==========================================

  const addToCart = (product: Product) => {
    const priceValue = typeof product.price === 'number' 
      ? product.price 
      : parseFloat(String(product.price)) || 0;
    
    setCart(prev => {
      const existingItem = prev.find(item => item.productId === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, {
          productId: product.id,
          name: product.name,
          price: priceValue,
          quantity: 1
        }];
      }
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.productId === productId);
      if (existingItem && existingItem.quantity > 1) {
        return prev.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      } else {
        return prev.filter(item => item.productId !== productId);
      }
    });
  };

  const placeOrder = async () => {
    if (!establishmentId || cart.length === 0 || !selectedTable) {
      alert('Veuillez sélectionner une table avant de commander.');
      return;
    }

    try {
      const orderNumberValue = `CMD${Date.now().toString().slice(-6)}`;
      const receiptNumber = `RCP${Date.now().toString().slice(-6)}`;

      const orderData = {
        orderNumber: orderNumberValue,
        receiptNumber,
        tableZone: selectedTable,
        items: cart,
        total,
        status: 'pending',
        createdAt: Date.now(),
        customerInfo: {
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        }
      };

      await addDoc(collection(db, `profiles/${establishmentId}/barOrders`), orderData);

      const receiptData = {
        orderNumber: orderNumberValue,
        receiptNumber,
        establishmentId,
        total,
        items: cart,
        tableZone: selectedTable,
        createdAt: Date.now()
      };

      const receiptQRDataUrl = await QRCodeLib.toDataURL(JSON.stringify(receiptData), {
        width: 200,
        margin: 2
      });

      setOrderNumber(orderNumberValue);
      setReceiptQR(receiptQRDataUrl);
      setOrderComplete(true);

    } catch (error) {
      console.error('Erreur lors de la commande:', error);
      alert('Erreur lors de la commande. Veuillez réessayer.');
    }
  };

  const downloadReceipt = async () => {
    if (!establishment || !orderNumber) return;

    try {
      const ticketData = {
        orderNumber,
        establishmentName: establishment.establishmentName,
        establishmentLogo: establishment.logoUrl,
        tableZone: selectedTable,
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total,
        createdAt: Date.now(),
        receiptData: {
          orderId: orderNumber,
          establishmentId: establishmentId || '',
          timestamp: Date.now()
        }
      };

      await generateTicketPDF(ticketData);
    } catch (error) {
      console.error('Erreur génération ticket PDF:', error);
    }
  };

  // ==========================================
  // RENDU CONDITIONNEL - APRÈS TOUS LES HOOKS
  // ==========================================

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du menu...</p>
        </div>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white">
            <CheckCircle className="w-10 h-10" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold">Commande validée !</h2>
            <p className="text-gray-600">
              Merci pour votre commande. Elle est en cours de préparation.
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl w-full">
            <img src={receiptQR} alt="QR Code reçu" className="w-32 h-32 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              Montrez ce QR Code au serveur
            </p>
          </div>
          <Button onClick={downloadReceipt} className="w-full">
            Télécharger mon Reçu
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              setOrderComplete(false);
              setCart([]);
              setSelectedTable("");
            }}
            className="w-full"
          >
            Nouvelle commande
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {establishment?.logoUrl && (
              <img 
                src={establishment.logoUrl} 
                alt={establishment.establishmentName} 
                className="w-10 h-10 rounded-full"
              />
            )}
            <h1 className="text-xl font-bold">
              {establishment?.establishmentName || "Menu"}
            </h1>
          </div>
          <div className="relative">
            <ShoppingBag className="w-6 h-6" />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => {
            const priceValue = typeof product.price === 'number' 
              ? product.price 
              : parseFloat(String(product.price)) || 0;
            
            return (
              <Card key={product.id} className="overflow-hidden">
                {product.imageUrl ? (
                  <div className="w-full h-48 bg-gray-100 overflow-hidden">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        // Si l'image ne charge pas, afficher l'icône par défaut
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('svg')) {
                          parent.className = 'w-full h-48 bg-gray-100 flex items-center justify-center';
                          parent.innerHTML = '<svg class="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>';
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                    <Package className="w-16 h-16 text-gray-400" />
                  </div>
                )}
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg mb-2">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-primary">
                      {priceValue.toLocaleString('fr-FR')} XAF
                    </span>
                    <Button
                      size="sm"
                      onClick={() => addToCart(product)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {products.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">Aucun produit disponible pour le moment.</p>
          </div>
        )}
      </main>

      {cart.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="container mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold">
                {total.toLocaleString('fr-FR')} XAF
              </p>
            </div>
            <Button
              onClick={() => {
                if (!selectedTable) {
                  setShowTableDialog(true);
                } else {
                  placeOrder();
                }
              }}
              className="px-8"
            >
              Commander
            </Button>
          </div>
        </footer>
      )}

      {cart.length > 0 && (
        <div className="fixed bottom-24 right-4 bg-white rounded-lg shadow-xl p-4 max-w-xs max-h-64 overflow-y-auto">
          <h3 className="font-bold mb-2">Panier</h3>
          {cart.map((item) => (
            <div key={item.productId} className="flex items-center justify-between mb-2 pb-2 border-b">
              <div className="flex-1">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-gray-600">
                  {(item.price * item.quantity).toLocaleString('fr-FR')} XAF
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => removeFromCart(item.productId)}
                  className="h-6 w-6 p-0"
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const product = products.find(p => p.id === item.productId);
                    if (product) addToCart(product);
                  }}
                  className="h-6 w-6 p-0"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Votre position
            </DialogTitle>
            <DialogDescription>
              Sélectionnez votre table ou zone pour finaliser votre commande
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {tables.length === 0 ? (
              <div className="space-y-2">
                <Label>Table ou zone</Label>
                <Input
                  placeholder="Ex: Table 3, Comptoir..."
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Table ou zone</Label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Sélectionnez votre table/zone</option>
                  {tables.map((table) => (
                    <option key={table.id} value={table.name}>
                      {table.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowTableDialog(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={() => {
                  if (selectedTable) {
                    setShowTableDialog(false);
                    placeOrder();
                  }
                }}
                disabled={!selectedTable}
                className="flex-1"
              >
                Confirmer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicOrderingPage;