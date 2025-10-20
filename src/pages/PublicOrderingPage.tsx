import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  MapPin, 
  CheckCircle,
  Download,
  QrCode
} from "lucide-react";
import { useParams } from "react-router-dom";
import { db } from "@/lib/firebase";
import { doc, getDoc, addDoc, collection, onSnapshot, query, orderBy } from "firebase/firestore";
import QRCode from "qrcode";
import { generateTicketPDF } from "@/utils/ticketPDF";

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  category?: string;
  available?: boolean;
  quantity?: number;
  stock?: number;
  icon?: string;
}

interface TableZone {
  id: string;
  name: string;
  type: 'table' | 'zone';
  capacity?: number;
  description?: string;
}

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Establishment {
  establishmentName: string;
  establishmentType?: string;
  logoUrl?: string;
}

const PublicOrderingPage = () => {
  const { establishmentId } = useParams<{ establishmentId: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<TableZone[]>([]);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [receiptQR, setReceiptQR] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Fallback pour Safari: extraire l'ID depuis les paramètres de recherche
  const getEstablishmentIdFromSearch = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const routeParam = urlParams.get('route');
    const idParam = urlParams.get('id');
    
    if (routeParam === 'commande' && idParam) {
      console.log('ID trouvé dans les paramètres de recherche:', idParam);
      return idParam;
    }
    return null;
  };

  // Utiliser l'ID depuis les paramètres si pas d'ID dans l'URL
  const effectiveEstablishmentId = establishmentId || getEstablishmentIdFromSearch();

  // Debug: Vérifier l'extraction de l'ID depuis l'URL
  console.log('=== EXTRACTION URL ===');
  console.log('URL complète:', window.location.href);
  console.log('Pathname:', window.location.pathname);
  console.log('Search:', window.location.search);
  console.log('Hash:', window.location.hash);
  console.log('establishmentId extrait:', establishmentId);
  console.log('effectiveEstablishmentId:', effectiveEstablishmentId);
  console.log('Type establishmentId:', typeof establishmentId);
  
  // Détection Safari spécifique
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isMobileSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  console.log('Is Safari:', isSafari);
  console.log('Is Mobile Safari:', isMobileSafari);

  // Vérifier si on a une erreur 404 ou problème de route
  useEffect(() => {
    if (!effectiveEstablishmentId) {
      console.log('❌ Pas d\'effectiveEstablishmentId - Possible erreur 404');
      console.log('Vérification des segments d\'URL...');
      
      // Essayer d'extraire manuellement l'ID depuis l'URL
      const pathSegments = window.location.pathname.split('/').filter(segment => segment);
      console.log('Segments d\'URL:', pathSegments);
      
      // Chercher le segment après 'commande'
      const commandeIndex = pathSegments.indexOf('commande');
      if (commandeIndex !== -1 && pathSegments[commandeIndex + 1]) {
        const manualId = pathSegments[commandeIndex + 1];
        console.log('ID trouvé manuellement:', manualId);
        
        // Solutions spécifiques pour Safari mobile
        if (isMobileSafari) {
          console.log('🔧 Correction spécifique Safari mobile...');
          
          // Méthode 1: Utiliser hash routing temporairement
          const hashUrl = `#/commande/${manualId}`;
          console.log('Tentative avec hash routing:', hashUrl);
          window.location.hash = hashUrl;
          
          // Méthode 2: Si hash ne fonctionne pas, utiliser search params
          setTimeout(() => {
            if (!effectiveEstablishmentId) {
              console.log('Hash routing échoué, tentative avec search params...');
              const searchUrl = `/?route=commande&id=${manualId}`;
              window.location.href = searchUrl;
            }
          }, 1000);
        } else {
          // Pour les autres navigateurs, méthode standard
          window.history.replaceState(null, '', `/commande/${manualId}`);
          window.location.reload();
        }
      } else if (isMobileSafari) {
        // Fallback spécifique Safari: essayer de récupérer depuis l'URL complète
        console.log('🔍 Recherche dans URL complète pour Safari...');
        const urlMatch = window.location.href.match(/\/commande\/([^\/\?#]+)/);
        if (urlMatch && urlMatch[1]) {
          const extractedId = urlMatch[1];
          console.log('ID extrait depuis URL complète:', extractedId);
          
          // Essayer de naviguer avec hash
          window.location.hash = `#/commande/${extractedId}`;
          
          // Si ça ne marche pas, utiliser une approche différente
          setTimeout(() => {
            if (!effectiveEstablishmentId) {
              console.log('Tentative de navigation directe...');
              window.location.href = `${window.location.origin}/#/commande/${extractedId}`;
            }
          }, 500);
        }
      }
    }
  }, [effectiveEstablishmentId, isMobileSafari]);

  // Charger les données de l'établissement
  useEffect(() => {
    if (!effectiveEstablishmentId) {
      console.log('❌ Pas d\'effectiveEstablishmentId fourni');
      return;
    }

    console.log('=== DIAGNOSTIC MOBILE ===');
    console.log('User Agent:', navigator.userAgent);
    console.log('Is Mobile:', /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    console.log('Window location:', window.location.href);
    console.log('✅ Chargement des données pour l\'établissement:', effectiveEstablishmentId);
    console.log('Type effectiveEstablishmentId:', typeof effectiveEstablishmentId);
    console.log('Longueur effectiveEstablishmentId:', effectiveEstablishmentId.length);

    const loadEstablishmentData = async () => {
      try {
        console.log('🚀 Début chargement données établissement');
        console.log('📋 ID établissement:', effectiveEstablishmentId);
        console.log('🔗 URL Firestore:', `profiles/${effectiveEstablishmentId}`);
        
        // Charger les infos de l'établissement
        console.log('📡 Tentative de récupération du profil...');
        const profileDoc = await getDoc(doc(db, 'profiles', effectiveEstablishmentId));
        
        console.log('📄 Résultat getDoc:', {
          exists: profileDoc.exists(),
          id: profileDoc.id,
          hasData: profileDoc.data() ? 'Oui' : 'Non'
        });
        
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          console.log('✅ Profil trouvé:', profileData);
          console.log('🏪 Nom établissement:', profileData.establishmentName);
          console.log('🖼️ Logo URL:', profileData.logoUrl);
          setEstablishment(profileData as Establishment);
        } else {
          console.log('❌ Profil non trouvé pour l\'ID:', effectiveEstablishmentId);
          console.log('🔍 Vérification Firestore - Collection profiles existe-t-elle ?');
          console.log('📊 Détails de debug:', {
            establishmentId: effectiveEstablishmentId,
            url: window.location.href,
            pathname: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash
          });
          setEstablishment(null);
        }

        // Charger les produits
        console.log('Chargement des produits depuis:', `profiles/${effectiveEstablishmentId}/products`);
        const productsRef = collection(db, `profiles/${effectiveEstablishmentId}/products`);
        const productsQuery = query(productsRef, orderBy('name'));
        const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
          console.log('Snapshot produits reçu:', snapshot.size, 'documents');
          const productsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Product[];
          // Filtrer les produits en stock (quantity > 0)
          const availableProducts = productsData.filter(p => {
            const stock = p.quantity || p.stock || 0;
            return stock > 0 && p.available !== false;
          });
          console.log('Produits chargés pour commande publique:', availableProducts.length);
          console.log('Détails des produits:', availableProducts.map(p => ({
            name: p.name,
            imageUrl: p.imageUrl,
            hasImage: !!p.imageUrl
          })));
          setProducts(availableProducts);
        }, (error) => {
          console.error('Erreur lors du chargement des produits:', error);
        });

        // Charger les tables/zones
        console.log('Chargement des tables depuis:', `profiles/${effectiveEstablishmentId}/tables`);
        const tablesRef = collection(db, `profiles/${effectiveEstablishmentId}/tables`);
        const unsubscribeTables = onSnapshot(tablesRef, (snapshot) => {
          console.log('Snapshot tables reçu:', snapshot.size, 'documents');
          const tablesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as TableZone[];
          const filteredTables = tablesData.filter(t => !t.deleted);
          console.log('Tables chargées:', filteredTables.length);
          setTables(filteredTables);
        }, (error) => {
          console.error('Erreur lors du chargement des tables:', error);
        });

        setIsLoading(false);

        return () => {
          unsubscribeProducts();
          unsubscribeTables();
        };
      } catch (error) {
        console.error('❌ Erreur chargement données:', error);
        console.error('Détails de l\'erreur:', {
          effectiveEstablishmentId,
          errorMessage: error instanceof Error ? error.message : 'Erreur inconnue',
          errorCode: error instanceof Error ? (error as any).code : 'N/A',
          userAgent: navigator.userAgent,
          isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
          url: window.location.href,
          timestamp: new Date().toISOString()
        });
        
        // En cas d'erreur, essayer de récupérer au moins le profil
        if (effectiveEstablishmentId) {
          try {
            console.log('🔄 Tentative de récupération directe du profil...');
            const profileDoc = await getDoc(doc(db, 'profiles', effectiveEstablishmentId));
            if (profileDoc.exists()) {
              console.log('✅ Profil récupéré en fallback');
              const profileData = profileDoc.data();
              console.log('📋 Données profil fallback:', {
                establishmentName: profileData.establishmentName,
                hasLogo: !!profileData.logoUrl,
                plan: profileData.plan
              });
              setEstablishment(profileData as Establishment);
            } else {
              console.log('❌ Profil non trouvé même en fallback');
              console.log('🔍 Vérifiez que l\'ID existe dans Firestore:', effectiveEstablishmentId);
            }
          } catch (fallbackError) {
            console.error('❌ Fallback échoué:', fallbackError);
          }
        }
        
        setIsLoading(false);
      }
    };

    loadEstablishmentData();
  }, [effectiveEstablishmentId]);

  // Ajouter un produit au panier
  const addToCart = (product: Product) => {
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
          price: product.price,
          quantity: 1
        }];
      }
    });
  };

  // Retirer un produit du panier
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

  // Calculer le total
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Passer la commande
  const placeOrder = async () => {
    if (!establishmentId || cart.length === 0 || !selectedTable) return;

    try {
      const orderNumber = `CMD${Date.now().toString().slice(-6)}`;
      const receiptNumber = `RCP${Date.now().toString().slice(-6)}`;

      // Créer la commande
      const orderData = {
        orderNumber,
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

      // Générer le QR du reçu
      const receiptData = {
        orderNumber,
        receiptNumber,
        establishmentId,
        total,
        items: cart,
        tableZone: selectedTable,
        createdAt: Date.now()
      };

      const receiptQRDataUrl = await QRCode.toDataURL(JSON.stringify(receiptData), {
        width: 200,
        margin: 2
      });

      setOrderNumber(orderNumber);
      setReceiptQR(receiptQRDataUrl);
      setOrderComplete(true);

    } catch (error) {
      console.error('Erreur commande:', error);
      alert('Erreur lors de la commande. Veuillez réessayer.');
    }
  };

  // Télécharger le ticket PDF
  const downloadReceipt = async () => {
    if (!establishment || !orderNumber) return;

    try {
      // Données du ticket
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
          establishmentId: effectiveEstablishmentId || '',
          timestamp: Date.now()
        }
      };

      // Générer et télécharger le PDF
      await generateTicketPDF(ticketData);
      
      console.log('Ticket PDF généré avec succès');
    } catch (error) {
      console.error('Erreur génération ticket PDF:', error);
      
      // Fallback vers l'ancienne méthode si erreur
      const receiptContent = `
RECU DE COMMANDE
${establishment?.establishmentName || 'Établissement'}

Commande: #${orderNumber}
Table/Zone: ${selectedTable}
Date: ${new Date().toLocaleString()}

DÉTAIL:
${cart.map(item => `${item.name} x${item.quantity} = ${(item.price * item.quantity).toLocaleString('fr-FR', { useGrouping: false })} XAF`).join('\n')}

TOTAL: ${total.toLocaleString('fr-FR', { useGrouping: false })} XAF

Merci pour votre commande !
      `.trim();

      const blob = new Blob([receiptContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `recu-${orderNumber}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement du menu...</p>
        </div>
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-destructive mb-2">Établissement introuvable</h1>
          <p className="text-muted-foreground mb-4">Ce QR Code ne semble pas valide.</p>
          
          {/* Informations de debug pour mobile */}
          <div className="text-xs text-muted-foreground bg-gray-50 p-3 rounded border text-left">
            <p><strong>Debug Info:</strong></p>
            <p>ID: {effectiveEstablishmentId || 'Non fourni'}</p>
            <p>URL: {window.location.href}</p>
            <p>Pathname: {window.location.pathname}</p>
            <p>Mobile: {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'Oui' : 'Non'}</p>
            <p className="mt-2 text-xs">
              {!effectiveEstablishmentId ? 
                '❌ Erreur 404: Route non trouvée. Vérifiez la configuration du serveur.' : 
                'Vérifiez la console pour plus de détails'
              }
            </p>
          </div>
          
          {/* Instructions pour corriger l'erreur 404 */}
          {!effectiveEstablishmentId && (
            <div className="mt-4 text-xs text-muted-foreground bg-blue-50 p-3 rounded border">
              <p><strong>Solution erreur 404:</strong></p>
              <p>1. Vérifiez que le serveur redirige toutes les routes vers index.html</p>
              <p>2. Pour Vercel: ajoutez vercel.json</p>
              <p>3. Pour Netlify: ajoutez _redirects</p>
              <p>4. Pour Apache: ajoutez .htaccess</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto">
          <Card className="text-center">
            <CardHeader>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-green-600">Commande confirmée !</CardTitle>
              <CardDescription>
                Votre commande #{orderNumber} a été transmise à l'établissement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <img src={receiptQR} alt="QR Code reçu" className="w-32 h-32 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Montrez ce QR Code au serveur pour valider votre commande
                </p>
              </div>
              
              <div className="space-y-2">
                <Button onClick={downloadReceipt} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger le ticket PDF
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
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3">
            {establishment.logoUrl && (
              <img src={establishment.logoUrl} alt="Logo" className="w-10 h-10 rounded-full object-cover" />
            )}
            <div>
              <h1 className="font-bold text-lg">{establishment.establishmentName}</h1>
              <p className="text-sm text-muted-foreground">Commande en ligne</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Panier */}
        {cart.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Votre commande
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {cart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.price.toLocaleString('fr-FR', { useGrouping: false })} XAF
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFromCart(item.productId)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addToCart({ id: item.productId, name: item.name, price: item.price } as Product)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="border-t pt-2">
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{total.toLocaleString('fr-FR', { useGrouping: false })} XAF</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sélection de table */}
        {cart.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Votre position
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="table">Table ou zone</Label>
                <select
                  id="table"
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md"
                >
                  <option value="">Sélectionnez votre table/zone</option>
                  {tables.map((table) => (
                    <option key={table.id} value={table.name}>
                      {table.name} {table.description && `- ${table.description}`}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bouton commander */}
        {cart.length > 0 && selectedTable && (
          <Button onClick={placeOrder} className="w-full" size="lg">
            <CheckCircle className="w-5 h-5 mr-2" />
            Commander ({total.toLocaleString('fr-FR', { useGrouping: false })} XAF)
          </Button>
        )}

        {/* Menu des produits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>🍽️</span>
              Notre Menu
            </CardTitle>
            <CardDescription>
              Sélectionnez vos produits et ajoutez-les à votre commande
            </CardDescription>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-2">
                  Aucun produit disponible pour le moment.
                </p>
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  Debug: Collection profiles/{establishmentId}/products
                  <br />
                  Vérifiez la console pour plus de détails
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {products.map((product) => (
                  <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-0 shadow-sm">
                    <div className="aspect-square relative group">
                      {product.imageUrl && product.imageUrl.trim() !== '' ? (
                        <img 
                          src={product.imageUrl} 
                          alt={product.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                          onError={(e) => {
                            console.log('Erreur chargement image pour', product.name, ':', product.imageUrl);
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 flex items-center justify-center ${product.imageUrl && product.imageUrl.trim() !== '' ? 'hidden' : ''}`}>
                        <div className="text-center">
                          <div className="w-16 h-16 bg-primary/30 rounded-full flex items-center justify-center mx-auto mb-2">
                            <span className="text-primary font-bold text-xl">
                              {product.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">Pas d'image</p>
                        </div>
                      </div>
                      <div className="absolute top-3 right-3">
                        <Button
                          size="sm"
                          className="h-9 w-9 rounded-full bg-white/95 hover:bg-white shadow-lg hover:shadow-xl transition-all duration-200 border-0"
                          onClick={() => addToCart(product)}
                        >
                          <Plus className="w-4 h-4 text-primary" />
                        </Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                        <p className="text-white font-bold text-sm">
                          {product.price.toLocaleString('fr-FR', { useGrouping: false })} XAF
                        </p>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-semibold text-sm mb-2 line-clamp-2 leading-tight">{product.name}</h3>
                      {product.category && (
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                          {product.category}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicOrderingPage;
