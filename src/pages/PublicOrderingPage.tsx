import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import "./PublicOrderingPage.css";
import { 
  ShoppingBag, 
  Plus, 
  Minus,
  MapPin, 
  CheckCircle,
  Download,
  UtensilsCrossed,
  Menu as MenuIcon,
  Wine,
  Cake,
  Coffee,
  IceCream,
  Pizza
} from "lucide-react";
import { useParams } from "react-router-dom";
import { db } from "@/lib/firebase";
import { doc, getDoc, addDoc, collection, onSnapshot, query, orderBy } from "firebase/firestore";
import QRCodeLib from "qrcode";
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
  description?: string;
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

// Couleurs et icônes pour les catégories (exactement comme le HTML)
const categoryConfig: Record<string, { color: string; icon: any }> = {
  'Plats': { color: '#f26c0d', icon: UtensilsCrossed },
  'Boissons': { color: '#4A90E2', icon: Wine },
  'Desserts': { color: '#50E3C2', icon: Cake },
  'Snacks': { color: '#F5A623', icon: Pizza },
  'Brunch': { color: '#BD10E0', icon: Coffee },
};

const getCategoryConfig = (cat: string) => {
  return categoryConfig[cat] || { color: '#f26c0d', icon: UtensilsCrossed };
};

const PublicOrderingPage = () => {
  const { establishmentId } = useParams<{ establishmentId: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<TableZone[]>([]);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous");
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [receiptQR, setReceiptQR] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [profilePermissionDenied, setProfilePermissionDenied] = useState(false);
  const [productsPermissionDenied, setProductsPermissionDenied] = useState(false);
  const [tablesPermissionDenied, setTablesPermissionDenied] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

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

  // Catégories disponibles
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ['Tous', ...Array.from(cats)];
  }, [products]);

  // Produits filtrés par catégorie
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'Tous') return products;
    return products.filter(p => p.category === selectedCategory);
  }, [products, selectedCategory]);

  // Charger les données de l'établissement
  useEffect(() => {
    if (!effectiveEstablishmentId) {
      console.log('❌ Pas d\'effectiveEstablishmentId fourni');
      return;
    }

    const loadEstablishmentData = async () => {
      try {
        // Charger les infos de l'établissement
        let profileDoc;
        try {
          profileDoc = await getDoc(doc(db, 'profiles', effectiveEstablishmentId));
        } catch (err: any) {
          if (err?.code === 'permission-denied') {
            console.log('🔒 Accès refusé au profil (permission-denied)');
            setProfilePermissionDenied(true);
          }
          throw err;
        }
        
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          setEstablishment(profileData as Establishment);
        }

        // Charger les produits
        const productsRef = collection(db, `profiles/${effectiveEstablishmentId}/products`);
        const productsQuery = query(productsRef, orderBy('name'));
        const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
          const productsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Product[];
          // Filtrer les produits en stock (quantity > 0) et avec prix > 0
          const availableProducts = productsData.filter(p => {
            const stock = p.quantity || p.stock || 0;
            let priceValue = 0;
            if (typeof p.price === 'number' && !isNaN(p.price)) {
              priceValue = p.price;
            } else if (typeof p.price === 'string' && p.price.trim() !== '') {
              const parsed = parseFloat(p.price.trim());
              priceValue = isNaN(parsed) ? 0 : parsed;
            }
            return stock > 0 && priceValue > 0 && p.available !== false;
          });
          setProducts(availableProducts);
        }, (error) => {
          console.error('Erreur lors du chargement des produits:', error);
          if ((error as any)?.code === 'permission-denied') {
            setProductsPermissionDenied(true);
          }
        });

        // Charger les tables/zones
        const tablesRef = collection(db, `profiles/${effectiveEstablishmentId}/tables`);
        const unsubscribeTables = onSnapshot(tablesRef, (snapshot) => {
          const tablesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as TableZone[];
          const filteredTables = tablesData.filter(t => !t.deleted);
          setTables(filteredTables);
        }, (error) => {
          console.error('Erreur lors du chargement des tables:', error);
          if ((error as any)?.code === 'permission-denied') {
            setTablesPermissionDenied(true);
          }
        });

        setIsLoading(false);

        return () => {
          unsubscribeProducts();
          unsubscribeTables();
        };
      } catch (error) {
        console.error('❌ Erreur chargement données:', error);
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
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Passer la commande
  const placeOrder = async () => {
    if (!effectiveEstablishmentId || cart.length === 0 || !selectedTable) {
      alert('Veuillez sélectionner une table avant de commander.');
      return;
    }

    try {
      const orderNumber = `CMD${Date.now().toString().slice(-6)}`;
      const receiptNumber = `RCP${Date.now().toString().slice(-6)}`;

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

      await addDoc(collection(db, `profiles/${effectiveEstablishmentId}/barOrders`), orderData);

      const receiptData = {
        orderNumber,
        receiptNumber,
        establishmentId: effectiveEstablishmentId,
        total,
        items: cart,
        tableZone: selectedTable,
        createdAt: Date.now()
      };

      const receiptQRDataUrl = await QRCodeLib.toDataURL(JSON.stringify(receiptData), {
        width: 200,
        margin: 2
      });

      setOrderNumber(orderNumber);
      setReceiptQR(receiptQRDataUrl);
      setOrderComplete(true);

    } catch (error: any) {
      console.error('❌ Erreur lors de la commande:', error);
      alert(error?.code === 'permission-denied' 
        ? 'Permission refusée. Vérifiez que les règles Firestore permettent la création de commandes publiques.'
        : 'Erreur lors de la commande. Veuillez réessayer.');
    }
  };

  // Télécharger le ticket PDF
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
          establishmentId: effectiveEstablishmentId || '',
          timestamp: Date.now()
        }
      };

      await generateTicketPDF(ticketData);
    } catch (error) {
      console.error('Erreur génération ticket PDF:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-[#8a7260]">Chargement du menu...</p>
        </div>
      </div>
    );
  }

  if ((productsPermissionDenied) || (products.length === 0 && (!establishment || profilePermissionDenied))) {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-destructive mb-2">
            {profilePermissionDenied || productsPermissionDenied ? 'Accès restreint' : 'Établissement introuvable'}
          </h1>
          <p className="text-[#8a7260] mb-4">
            {profilePermissionDenied || productsPermissionDenied
              ? "L'établissement existe mais ses données ne sont pas publiques. Contactez le gérant."
              : 'Ce QR Code ne semble pas valide.'}
          </p>
        </div>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl bg-[#f8f7f5] dark:bg-[#221710] p-8 text-center shadow-2xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white">
            <CheckCircle className="w-10 h-10" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-[#181411] dark:text-white">Commande validée !</h2>
            <p className="text-[#8a7260] dark:text-white/70">
              Merci pour votre commande. Elle est en cours de préparation.
            </p>
              </div>
          <div className="p-4 bg-white dark:bg-[#221710]/50 rounded-xl w-full">
                <img src={receiptQR} alt="QR Code reçu" className="w-32 h-32 mx-auto mb-2" />
            <p className="text-sm text-[#8a7260] dark:text-white/70">
              Montrez ce QR Code au serveur
                </p>
              </div>
          <button
            onClick={downloadReceipt}
            className="flex w-full min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full h-12 px-6 bg-[#f26c0d] text-white text-base font-medium leading-normal"
          >
            <span className="truncate">Télécharger mon Reçu</span>
            <Download className="w-5 h-5" />
          </button>
          <button 
                  onClick={() => {
                    setOrderComplete(false);
                    setCart([]);
                    setSelectedTable("");
                  }}
            className="flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full h-12 px-6 bg-white dark:bg-[#221710] border border-black/10 dark:border-white/10 text-[#181411] dark:text-white text-base font-medium leading-normal"
                >
                  Nouvelle commande
          </button>
        </div>
      </div>
    );
  }

  // Forcer les styles sur le body pour cette page
  useEffect(() => {
    console.log('🎨 Application des styles de design...');
    const originalBodyBg = document.body.style.backgroundColor;
    const originalBodyColor = document.body.style.color;
    document.body.style.setProperty('background-color', '#f8f7f5', 'important');
    document.body.style.setProperty('color', '#181411', 'important');
    
    // Vérifier que les styles sont appliqués
    setTimeout(() => {
      const computedBg = window.getComputedStyle(document.body).backgroundColor;
      console.log('✅ Background body appliqué:', computedBg);
    }, 100);
    
    return () => {
      document.body.style.backgroundColor = originalBodyBg;
      document.body.style.color = originalBodyColor;
    };
  }, []);

  // Debug: Log pour vérifier que le composant se charge
  useEffect(() => {
    console.log('🚀 PublicOrderingPage chargé avec le nouveau design');
    console.log('📦 Produits chargés:', products.length);
    console.log('🛒 Panier:', cart.length);
  }, [products.length, cart.length]);

  return (
    <div className="public-order-page relative min-h-screen w-full flex-col pb-28">
      {/* Header Sticky - Exactement comme le HTML */}
      <header className="public-order-header sticky top-0 z-10">
        <div className="flex items-center p-4 justify-between">
          <div className="flex size-10 shrink-0 items-center justify-center">
            {establishment?.logoUrl ? (
              <img 
                src={establishment.logoUrl} 
                alt={establishment.establishmentName || "Logo"} 
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <MenuIcon className="w-10 h-10 public-order-icon-primary" />
            )}
          </div>
          <h1 className="text-xl font-bold leading-tight tracking-[-0.015em] flex-1 text-center public-order-text-dark">
            {establishment?.establishmentName || "Menu"}
          </h1>
          <button 
            onClick={() => cart.length > 0 && setCartOpen(true)}
            className="relative flex w-10 items-center justify-end cursor-pointer"
            disabled={cart.length === 0}
            aria-label="Voir le panier"
          >
            <ShoppingBag className={`w-10 h-10 public-order-text-dark ${cart.length === 0 ? 'opacity-50' : ''}`} />
            {cartItemCount > 0 && (
              <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white public-order-badge">
                {cartItemCount}
            </div>
            )}
          </button>
        </div>
      </header>

      {/* Navigation Catégories - Exactement comme le HTML */}
      {categories.length > 1 && (
        <nav className="public-order-nav sticky top-[68px] z-10">
          <div className="flex gap-3 overflow-x-auto p-4 no-scrollbar">
            {categories.map((cat) => {
              const isSelected = cat === selectedCategory;
              const config = getCategoryConfig(cat);
              const IconComponent = config.icon;
              
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`public-order-category-button flex flex-col items-center justify-center gap-2 ${
                    isSelected ? 'ring-2 ring-white/50 scale-105' : ''
                  }`}
                  style={{ backgroundColor: config.color }}
                >
                  <IconComponent className="w-10 h-10" />
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Main Content - Exactement comme le HTML */}
      <main className="p-4 grid grid-cols-1 gap-6" style={{ backgroundColor: '#f8f7f5' }}>
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#8a7260] dark:text-white/70">
              Aucun produit disponible pour le moment.
                    </p>
                  </div>
        ) : (
          filteredProducts.map((product) => (
            <div
              key={product.id}
              className="public-order-card relative flex flex-col items-stretch justify-start overflow-hidden"
            >
              {/* Image Background - aspect-video comme dans le HTML */}
              <div
                className="public-order-product-image"
                style={{
                  backgroundImage: product.imageUrl && product.imageUrl.trim() !== ''
                    ? `url("${product.imageUrl}")`
                    : undefined,
                  backgroundColor: !product.imageUrl ? '#e6dfdb' : undefined
                }}
              >
                {!product.imageUrl && (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#f26c0d]/20 via-[#f26c0d]/10 to-[#f26c0d]/5">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-[#f26c0d]/30 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-[#f26c0d] font-bold text-xl">
                          {product.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs public-order-description">Pas d'image</p>
                  </div>
                </div>
                )}
              </div>

              {/* Bouton Add - Exactement comme le HTML */}
              <button
                onClick={() => addToCart(product)}
                className="public-order-button-add absolute top-4 right-4 flex cursor-pointer items-center justify-center"
              >
                <Plus className="w-7 h-7" />
              </button>

              {/* Product Info - Exactement comme le HTML */}
              <div className="flex flex-col items-stretch justify-center gap-1 p-4">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] public-order-text-dark">
                    {product.name}
                  </h2>
                  <p className="text-lg font-bold whitespace-nowrap public-order-price">
                    {product.price.toLocaleString('fr-FR', { useGrouping: false })} XAF
                  </p>
                </div>
                {product.description && (
                  <p className="text-base font-normal leading-normal public-order-description">
                    {product.description}
                  </p>
                )}
                </div>
              </div>
          ))
        )}
      </main>

      {/* Footer Fixe - Exactement comme le HTML */}
      {cart.length > 0 && (
        <footer className="public-order-footer fixed bottom-0 left-0 right-0 z-20 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <p className="text-sm font-normal public-order-description">Total du Panier</p>
              <p className="text-2xl font-extrabold public-order-text-dark">
                {total.toLocaleString('fr-FR', { useGrouping: false })} XAF
              </p>
            </div>
            <button
              onClick={() => {
                if (!selectedTable) {
                  setShowTableDialog(true);
                } else {
                  placeOrder();
                }
              }}
              className="public-order-button-commander flex flex-shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden"
            >
              <span className="truncate">Commander</span>
              <CheckCircle className="w-5 h-5" />
            </button>
          </div>
        </footer>
      )}

      {/* Drawer Panier */}
      <Drawer open={cartOpen} onOpenChange={setCartOpen}>
        <DrawerContent className="public-order-drawer max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="text-2xl font-bold public-order-text-dark">
              Mon Panier
            </DrawerTitle>
            <DrawerDescription className="text-base">
              {cartItemCount} {cartItemCount > 1 ? 'articles' : 'article'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="w-16 h-16 mx-auto mb-4 public-order-description opacity-50" />
                <p className="text-[#8a7260]">Votre panier est vide</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100"
                  >
                    <div className="flex-1">
                      <h3 className="font-bold text-lg public-order-text-dark">
                        {item.name}
                      </h3>
                      <p className="text-base public-order-price mt-1">
                        {(item.price * item.quantity).toLocaleString('fr-FR', { useGrouping: false })} XAF
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.quantity > 1 ? (
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center public-order-text-dark transition-colors"
                          aria-label="Diminuer la quantité"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="w-8 h-8" /> // Espace réservé pour garder l'alignement
                      )}
                      <span className="w-8 text-center font-bold text-lg public-order-text-dark">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => {
                          const product = products.find(p => p.id === item.productId);
                          if (product) addToCart(product);
                        }}
                        className="w-8 h-8 rounded-full bg-[#f26c0d] hover:bg-[#e55a00] flex items-center justify-center text-white transition-colors"
                        aria-label="Augmenter la quantité"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {cart.length > 0 && (
            <DrawerFooter className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold public-order-text-dark">Total</span>
                <span className="text-2xl font-extrabold public-order-price">
                  {total.toLocaleString('fr-FR', { useGrouping: false })} XAF
                </span>
              </div>
              <Button
                onClick={() => {
                  setCartOpen(false);
                  if (!selectedTable) {
                    setShowTableDialog(true);
                  } else {
                    placeOrder();
                  }
                }}
                className="public-order-button-commander w-full"
              >
                <span>Commander</span>
                <CheckCircle className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setCartOpen(false)}
                className="mt-2"
              >
                Continuer mes achats
              </Button>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>

      {/* Dialog Sélection Table */}
      <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Votre position
            </DialogTitle>
            <DialogDescription>
              Sélectionnez votre table ou zone pour finaliser votre commande
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {tablesPermissionDenied || tables.length === 0 ? (
              <div className="space-y-2">
                <Label htmlFor="table-input">Table ou zone</Label>
                  <Input
                  id="table-input"
                    placeholder="Ex: Table 3, Comptoir, Zone VIP..."
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                  />
              </div>
                ) : (
              <div className="space-y-2">
                <Label htmlFor="table-select">Table ou zone</Label>
                  <select
                  id="table-select"
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="">Sélectionnez votre table/zone</option>
                    {tables.map((table) => (
                      <option key={table.id} value={table.name}>
                        {table.name} {table.description && `- ${table.description}`}
                      </option>
                    ))}
                  </select>
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setShowTableDialog(false)}
                className="flex-1 px-4 py-2 rounded-full border border-input bg-white dark:bg-[#221710] text-[#181411] dark:text-white hover:bg-gray-50 dark:hover:bg-[#221710]/80 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (selectedTable) {
                    setShowTableDialog(false);
                    placeOrder();
                  }
                }}
                disabled={!selectedTable}
                className={`flex-1 px-4 py-2 rounded-full text-white font-medium transition-all ${
                  selectedTable 
                    ? 'bg-[#f26c0d] hover:bg-[#e55a00] cursor-pointer' 
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                Confirmer
              </button>
                      </div>
                    </div>
        </DialogContent>
      </Dialog>

      {/* Styles inline pour forcer le design */}
      <style dangerouslySetInnerHTML={{__html: `
        /* Force tous les styles pour cette page */
        body {
          background-color: #f8f7f5 !important;
          color: #181411 !important;
        }
        
        .public-order-page {
          background-color: #f8f7f5 !important;
          color: #181411 !important;
        }
        
        .public-order-header {
          background-color: rgba(248, 247, 245, 0.8) !important;
          backdrop-filter: blur(8px) !important;
        }
        
        .public-order-icon-primary {
          color: #f26c0d !important;
        }
        
        .public-order-text-dark {
          color: #181411 !important;
        }
        
        .public-order-badge {
          background-color: #f26c0d !important;
          color: white !important;
        }
        
        .public-order-card {
          background-color: #ffffff !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
          border-radius: 1rem !important;
        }
        
        .public-order-button-add {
          background-color: #f26c0d !important;
          color: white !important;
          width: 48px !important;
          height: 48px !important;
          border-radius: 9999px !important;
          box-shadow: 0 4px 12px rgba(242, 108, 13, 0.3) !important;
        }
        
        .public-order-price {
          color: #f26c0d !important;
          font-weight: 700 !important;
        }
        
        .public-order-description {
          color: #8a7260 !important;
        }
        
        .public-order-footer {
          background-color: rgba(255, 255, 255, 0.8) !important;
          backdrop-filter: blur(8px) !important;
          border-top: 1px solid rgba(0, 0, 0, 0.1) !important;
        }
        
        .public-order-button-commander {
          background-color: #f26c0d !important;
          color: white !important;
          border-radius: 9999px !important;
          height: 56px !important;
          padding: 0 24px !important;
          font-weight: 700 !important;
          font-size: 1.125rem !important;
          box-shadow: 0 10px 20px rgba(242, 108, 13, 0.3) !important;
        }
        
        .public-order-button-commander:hover {
          background-color: #e55a00 !important;
        }
        
        .public-order-nav {
          background-color: rgba(248, 247, 245, 0.8) !important;
          backdrop-filter: blur(8px) !important;
        }
        
        .public-order-category-button {
          width: 96px !important;
          flex-shrink: 0 !important;
          border-radius: 0.75rem !important;
          padding: 12px !important;
          color: white !important;
          font-weight: 700 !important;
          font-size: 0.75rem !important;
          border: none !important;
          cursor: pointer !important;
        }
        
        .public-order-category-button svg {
          width: 40px !important;
          height: 40px !important;
        }
        
        .public-order-product-image {
          aspect-ratio: 16 / 9 !important;
          width: 100% !important;
          background-size: cover !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
        }
        
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        .public-order-drawer {
          background-color: #f8f7f5 !important;
        }
        
        .public-order-drawer [data-vaul-drawer-content] {
          background-color: #f8f7f5 !important;
        }
        
        .public-order-drawer [data-vaul-drawer-overlay] {
          background-color: rgba(0, 0, 0, 0.5) !important;
        }
        
        /* Transitions pour les boutons */
        .public-order-button-add:hover {
          transform: scale(1.1) !important;
          transition: transform 0.2s ease !important;
        }
        
        .public-order-category-button:hover {
          transform: scale(1.05) !important;
          transition: transform 0.2s ease !important;
        }
        
        .public-order-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease !important;
        }
        
        .public-order-card:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 16px rgba(0,0,0,0.12) !important;
        }
        
        /* Styles pour les boutons du drawer */
        .public-order-drawer button {
          border: none !important;
          outline: none !important;
        }
        
        .public-order-drawer button:focus {
          outline: none !important;
        }
        
        /* Force le style sur tous les éléments de la page */
        .public-order-page * {
          box-sizing: border-box !important;
        }
        
        .public-order-page button:not(.public-order-button-add):not(.public-order-button-commander):not(.public-order-category-button) {
          transition: all 0.2s ease !important;
        }
        
        /* Amélioration du header */
        .public-order-header img {
          border: 2px solid rgba(242, 108, 13, 0.2) !important;
          object-fit: cover !important;
        }
        
        /* Style pour le footer amélioré */
        .public-order-footer {
          box-shadow: 0 -4px 12px rgba(0,0,0,0.08) !important;
        }
      `}} />
    </div>
  );
};

export default PublicOrderingPage;

