import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { db } from "@/lib/firebase";
import { doc, getDoc, addDoc, collection, onSnapshot, query, orderBy, QuerySnapshot, DocumentData, updateDoc, getDocs } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Plus, Minus, ShoppingBag, MapPin, CheckCircle, Package, Printer, Download, Grid3x3, Search, CreditCard, AlertCircle, Heart, X, Share2 } from "lucide-react";
import QRCodeLib from "qrcode";
import { generateTicketPDF } from "@/utils/ticketPDF";
import { printThermalTicket } from "@/utils/ticketThermal";
import { MenuThemeConfig, defaultMenuTheme } from "@/types/menuTheme";
import { getMenuDesignById, MenuDesignId, getDefaultDesignForEstablishment } from "@/types/menuDesigns";
import { isFoodBusiness as isFoodBusinessFn, isServiceBusiness, isBoutique } from "@/constants/establishmentTypes";
import { useToast } from "@/hooks/use-toast";
import { createMenuDigitalPaymentLink } from "@/lib/payments/menuDigitalPayment";
import { sendOrderNotificationViaServer } from "@/lib/securePayment";
import { ordersColRef } from "@/lib/collections";
import { enqueuePendingOrder, flushPendingOrders } from "@/lib/localSyncQueue";
import { appendElectronPaymentReturn, openPaymentUrl } from "@/lib/paymentNavigation";
import {
  RestaurantClassicTemplate,
  RestaurantModernTemplate,
  BarLoungeTemplate,
  CafeCozyTemplate,
  BoutiqueMinimalTemplate,
  BoutiqueGridTemplate,
  BoutiqueLuxuryTemplate,
  BoutiqueTemplate,
  ServiceTemplate,
  NackModernTemplate,
  NackShopTemplate,
  type TemplateProps,
} from "@/components/menuTemplates";

interface Product {
  id: string;
  name: string;
  price: number | string;
  imageUrl?: string;
  category?: string;
  available?: boolean;
  quantity?: number;
  stock?: number;
  rating?: number;
  ratingCount?: number;
  description?: string;
  /** Si true, le produit fait partie du menu du jour (visible sur le menu digital) */
  showOnMenuDigital?: boolean;
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
  category?: string;
}

interface Establishment {
  establishmentName: string;
  establishmentType?: string;
  logoUrl?: string;
  companyName?: string;
  fullAddress?: string;
  businessPhone?: string;
  rcsNumber?: string;
  nifNumber?: string;
  legalMentions?: string;
  customMessage?: string;
  ticketLogoUrl?: string;
  showDeliveryMention?: boolean;
  showCSSMention?: boolean;
  cssPercentage?: number;
  ticketFooterMessage?: string;
  paymentsEnabled?: boolean;
  deliveryEnabled?: boolean;
  deliveryPrice?: number;
}

const PublicOrderingPage = () => {
  // Hooks de routing
  const params = useParams<{ establishmentId: string }>();
  const location = useLocation();
  const { toast } = useToast();
  const establishmentId = useMemo(() => params?.establishmentId ?? null, [params?.establishmentId]);

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<TableZone[]>([]);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [collectionBase, setCollectionBase] = useState<'establishments' | 'profiles'>('profiles');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [showPaymentChoiceDialog, setShowPaymentChoiceDialog] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [receiptQR, setReceiptQR] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [menuTheme, setMenuTheme] = useState<MenuThemeConfig>(defaultMenuTheme);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showAirtelNumberDialog, setShowAirtelNumberDialog] = useState(false);
  const [airtelNumberInput, setAirtelNumberInput] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [showCartDetails, setShowCartDetails] = useState(false);
  const [productQuantity, setProductQuantity] = useState(1);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Livraison
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");

  // useRef
  const isMountedRef = useRef<boolean>(true);
  const unsubscribeProductsRef = useRef<(() => void) | null>(null);
  const unsubscribeTablesRef = useRef<(() => void) | null>(null);

  const establishmentType = establishment?.establishmentType || '';
  const isFoodBusiness = isFoodBusinessFn(establishmentType);
  const isSimpleBusiness = !isFoodBusiness;

  // Calcul du total de la commande (articles du panier + livraison si applicable)
  // Ce total est utilisé pour le paiement Menu Digital, PAS le prix de l'abonnement
  const total = useMemo(() => {
    const itemsTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = (isDelivery && establishment?.deliveryEnabled && establishment?.deliveryPrice) ? establishment.deliveryPrice : 0;
    return itemsTotal + deliveryFee;
  }, [cart, isDelivery, establishment]);

  // Vérifier si on revient d'un paiement réussi
  useEffect(() => {
    const state = location.state as { paymentSuccess?: boolean } | null;
    if (state?.paymentSuccess) {
      setShowPaymentSuccess(true);
      setCart([]); // Vider le panier après paiement réussi
      // Masquer le message après 5 secondes
      setTimeout(() => setShowPaymentSuccess(false), 5000);
    }
  }, [location.state]);

  // Charger le thème du menu (données métier sous profiles/{uid})
  useEffect(() => {
    if (!establishmentId) return;

    const loadTheme = async () => {
      try {
        // Charger d'abord depuis publicProfiles pour avoir le designId et le type
        const publicDoc = await getDoc(doc(db, 'publicProfiles', establishmentId));
        const publicData = publicDoc.exists() ? publicDoc.data() : {};
        
        // Ensuite charger le thème complet depuis menuDigital
        let themeDoc = await getDoc(doc(db, `profiles/${establishmentId}/menuDigital`, 'theme'));
        if (!themeDoc.exists()) {
          try {
            themeDoc = await getDoc(doc(db, `establishments/${establishmentId}/menuDigital`, 'theme'));
          } catch {
            /* rules establishments/menuDigital peuvent refuser le public */
          }
        }
        
        const establishmentType = publicData.establishmentType || publicData.type;
        
        if (themeDoc.exists()) {
          const themeData = themeDoc.data();
          // Utiliser le designId de publicProfiles si disponible, sinon celui du thème
          const designId = publicData.menuDesignId || themeData.designId;
          setMenuTheme({ 
            ...defaultMenuTheme, 
            ...themeData,
            designId: designId 
          } as MenuThemeConfig);
        } else if (publicData.menuDesignId) {
          // Si pas de thème mais un designId dans publicProfiles, utiliser le design par défaut
          setMenuTheme({ 
            ...defaultMenuTheme, 
            designId: publicData.menuDesignId 
          } as MenuThemeConfig);
        } else {
          // Aucun design défini, utiliser le design par défaut selon le type d'établissement
          const defaultDesign = getDefaultDesignForEstablishment(establishmentType);
          setMenuTheme({ 
            ...defaultDesign.theme,
            designId: defaultDesign.id,
            updatedAt: Date.now()
          } as MenuThemeConfig);
        }
      } catch (error: any) {
        console.error('[NACK FIREBASE ERROR]', {
          code: error?.code,
          message: error?.message,
          path: `publicProfiles/${establishmentId} | profiles/${establishmentId}/menuDigital/theme | establishments/${establishmentId}/menuDigital/theme`
        });
      }
    };

    loadTheme();
  }, [establishmentId]);

  // useEffect principal
  useEffect(() => {
    isMountedRef.current = true;

    if (unsubscribeProductsRef.current) {
      try {
        unsubscribeProductsRef.current();
      } catch { /* ignore */ }
      unsubscribeProductsRef.current = null;
    }
    if (unsubscribeTablesRef.current) {
      try {
        unsubscribeTablesRef.current();
      } catch { /* ignore */ }
      unsubscribeTablesRef.current = null;
    }

    const cleanup = () => {
      isMountedRef.current = false;
      if (unsubscribeProductsRef.current) {
        try {
          unsubscribeProductsRef.current();
        } catch { /* ignore */ }
        unsubscribeProductsRef.current = null;
      }
      if (unsubscribeTablesRef.current) {
        try {
          unsubscribeTablesRef.current();
        } catch { /* ignore */ }
        unsubscribeTablesRef.current = null;
      }
    };

    if (!establishmentId) {
      setIsLoading(false);
      return cleanup;
    }

    // Produits / tables / commandes QR vivent sous profiles/{uid}
    // (Stock, BarConnectée). establishments/{uid} peut exister comme shell vide.
    const loadEstablishmentData = async () => {
      // Métadonnées publiques (sans secrets) + shell établissement éventuel.
      // Les produits restent sous profiles/{uid}/products (lecture publique).
      let publicDoc, estDoc;
      try {
        [publicDoc, estDoc] = await Promise.all([
          getDoc(doc(db, 'publicProfiles', establishmentId)),
          getDoc(doc(db, 'establishments', establishmentId)),
        ]);
      } catch (e: any) {
        console.error('[NACK FIREBASE ERROR]', {
          code: e?.code,
          message: e?.message,
          path: `publicProfiles/${establishmentId} | establishments/${establishmentId}`
        });
        if (e?.code === 'permission-denied') setLoadError('permission-denied');
        else setLoadError('network-error');
        setIsLoading(false);
        return;
      }

      if (!isMountedRef.current) return;

      if (!publicDoc?.exists() && !estDoc?.exists()) {
        console.warn('[NACK DEBUG] Document not found', {
          publicProfilesExists: publicDoc?.exists(),
          establishmentsExists: estDoc?.exists(),
          establishmentId
        });
        setLoadError('not-found');
        setIsLoading(false);
        return;
      }

      const data = {
        ...(estDoc?.exists() ? estDoc.data() : {}),
        ...(publicDoc?.exists() ? publicDoc.data() : {}),
      };

      // Toujours profiles : c'est là que Stock / Menu Digital écrivent les produits
      const base: 'establishments' | 'profiles' = 'profiles';
      setCollectionBase(base);
      
      // S'assurer que deliveryPrice est un nombre
      const deliveryPrice = typeof data.deliveryPrice === 'number' 
        ? data.deliveryPrice 
        : (typeof data.deliveryPrice === 'string' ? parseInt(data.deliveryPrice) || 0 : 0);
      
      setEstablishment({
        establishmentName: data.name || data.establishmentName || 'Établissement',
        establishmentType: data.type || data.establishmentType,
        logoUrl: data.logoUrl,
        companyName: data.companyName,
        fullAddress: data.fullAddress || data.address,
        businessPhone: data.businessPhone || data.phone,
        rcsNumber: data.rcsNumber,
        nifNumber: data.nifNumber,
        legalMentions: data.legalMentions,
        customMessage: data.customMessage,
        ticketLogoUrl: data.ticketLogoUrl,
        showDeliveryMention: data.showDeliveryMention,
        showCSSMention: data.showCSSMention,
        cssPercentage: data.cssPercentage,
        ticketFooterMessage: data.ticketFooterMessage,
        paymentsEnabled: data.paymentsEnabled === true,
        deliveryEnabled: data.deliveryEnabled === true,
        deliveryPrice: deliveryPrice,
      } as Establishment);

      if (!isMountedRef.current) return;

      setupProductsAndTables(base);
    };
    loadEstablishmentData().catch((e) => {
      if (!isMountedRef.current) return;
      console.error('[PublicOrderingPage] loadEstablishmentData catch', e);
      if ((e as any)?.code === 'permission-denied') setLoadError('permission-denied');
      else setLoadError('network-error');
      setIsLoading(false);
    });

    function setupProductsAndTables(base: 'establishments' | 'profiles') {
    // Charger les produits
    const productsRef = collection(db, `${base}/${establishmentId}/products`);

    const handleProductsSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
      if (!isMountedRef.current) return;

      const productsData = snapshot.docs.map((docItem) => {
        const data = docItem.data();
        return {
          id: docItem.id,
          name: data.name || '',
          price: data.price || 0,
          category: data.category || '',
          available: data.available !== false,
          quantity: data.quantity || data.stock || 0,
          stock: data.quantity || data.stock || 0,
          rating: data.rating || 0,
          ratingCount: data.ratingCount || 0,
          description: data.description || '',
          imageUrl: (data.imageUrl && typeof data.imageUrl === 'string' && data.imageUrl.trim() !== '')
            ? data.imageUrl.trim()
            : undefined,
          showOnMenuDigital: data.showOnMenuDigital === true,
        } as Product;
      });

      // Prix + dispo ici ; le filtre "menu du jour" est appliqué dans filteredProducts
      const availableProducts = productsData.filter(p => {
        const priceValue = typeof p.price === 'number'
          ? p.price
          : parseFloat(String(p.price || '0')) || 0;
        return priceValue > 0 && p.available !== false;
      });

      availableProducts.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setProducts(availableProducts);
      setIsLoading(false);
    };

    let unsubscribeProducts: (() => void) | null = null;

    try {
      const productsQuery = query(productsRef, orderBy('name'));
      unsubscribeProducts = onSnapshot(
        productsQuery,
        handleProductsSnapshot,
        (error: any) => {
          console.error('[NACK FIREBASE ERROR]', {
            code: error?.code,
            message: error?.message,
            path: `${base}/${establishmentId}/products (with orderBy)`
          });
          // Erreur avec orderBy, charger sans tri
          if (unsubscribeProducts) {
            unsubscribeProducts();
            unsubscribeProducts = null;
          }
          const simpleQuery = query(productsRef);
          unsubscribeProducts = onSnapshot(
            simpleQuery,
            handleProductsSnapshot,
            (err: any) => {
              if (!isMountedRef.current) return;
              console.error('[NACK FIREBASE ERROR]', {
                code: err?.code,
                message: err?.message,
                path: `${base}/${establishmentId}/products (simple)`
              });
              setIsLoading(false);
            }
          );
          unsubscribeProductsRef.current = unsubscribeProducts;
        }
      );
      unsubscribeProductsRef.current = unsubscribeProducts;
    } catch (error: any) {
      console.error('[NACK FIREBASE ERROR]', {
        code: error?.code,
        message: error?.message,
        path: `${base}/${establishmentId}/products (query creation)`
      });
      // Erreur création query, charger directement
      unsubscribeProducts = onSnapshot(
        productsRef,
        handleProductsSnapshot,
        (err: any) => {
          if (!isMountedRef.current) return;
          console.error('[NACK FIREBASE ERROR]', {
            code: err?.code,
            message: err?.message,
            path: `${base}/${establishmentId}/products (fallback)`
          });
          setIsLoading(false);
        }
      );
      unsubscribeProductsRef.current = unsubscribeProducts;
    }

    // Charger les tables
    const tablesRef = collection(db, `${base}/${establishmentId}/tables`);
    const unsubscribeTables = onSnapshot(
      tablesRef,
      (snapshot) => {
        if (!isMountedRef.current) return;
        const tablesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TableZone[];

        const filteredTables = tablesData.filter(t => !('deleted' in t && t.deleted));
        setTables(filteredTables);
        setIsLoading(false);
      },
      (error: any) => {
        if (!isMountedRef.current) return;
        console.error('[NACK FIREBASE ERROR]', {
          code: error?.code,
          message: error?.message,
          path: `${base}/${establishmentId}/tables`
        });
        setIsLoading(false);
      }
    );
    unsubscribeTablesRef.current = unsubscribeTables;
    }

    return cleanup;
  }, [establishmentId]);

  useEffect(() => {
    const flush = async () => {
      if (!establishmentId) return;
      try {
        await flushPendingOrders(establishmentId);
      } catch {
        // ignore flush errors; la synchro reprendra au prochain passage online
      }
    };
    void flush();
    const onOnline = () => {
      void flush();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [establishmentId]);

  // ESC key closes any open dialog
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showTableDialog) { setShowTableDialog(false); return; }
      if (showPaymentChoiceDialog) { setShowPaymentChoiceDialog(false); return; }
      if (selectedProduct) { setSelectedProduct(null); setProductQuantity(1); return; }
      if (showAirtelNumberDialog) { setShowAirtelNumberDialog(false); return; }
      if (showCartDetails) { setShowCartDetails(false); return; }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showTableDialog, showPaymentChoiceDialog, selectedProduct, showAirtelNumberDialog, showCartDetails]);

  // Fonctions
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
          quantity: 1,
          category: product.category
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

  const updateCartItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.productId !== productId));
    } else {
      setCart(prev => prev.map(item =>
        item.productId === productId ? { ...item, quantity } : item
      ));
    }
  };

  const clearCart = () => {
    setCart([]);
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  const addToCartWithQuantity = (product: Product, quantity: number) => {
    const priceValue = typeof product.price === 'number'
      ? product.price
      : parseFloat(String(product.price)) || 0;

    setCart(prev => {
      const existingItem = prev.find(item => item.productId === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        return [...prev, {
          productId: product.id,
          name: product.name,
          price: priceValue,
          quantity: quantity,
          category: product.category
        }];
      }
    });

    // Feedback visuel
    toast({
      title: "Ajouté au panier",
      description: `${product.name} x${quantity}`,
      duration: 1500,
    });
  };

  const availableCategories = useMemo(() => {
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    
    // Ordre logique des catégories pour la restauration
    const foodOrder = ['Entrée', 'Plat / Repas', 'Plat', 'Grillades', 'Accompagnements', 'Dessert', 'Snack', 'Boisson alcoolisée', 'Boisson non alcoolisée', 'Boissons'];
    
    // Ordre logique pour les boutiques
    const shopOrder = ['Nouveau', 'Populaire', 'Promo', 'T-shirts', 'Chemises', 'Jeans', 'Pantalons', 'Robes', 'Vestes', 'Chaussures', 'Sacs', 'Accessoires'];
    
    // Trier selon l'ordre défini
    return categories.sort((a, b) => {
      const aIndex = foodOrder.findIndex(c => a.toLowerCase().includes(c.toLowerCase()));
      const bIndex = foodOrder.findIndex(c => b.toLowerCase().includes(c.toLowerCase()));
      
      // Si les deux catégories sont dans l'ordre, trier par position
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      // Si seulement a est dans l'ordre, a vient en premier
      if (aIndex !== -1) return -1;
      // Si seulement b est dans l'ordre, b vient en premier
      if (bIndex !== -1) return 1;
      // Sinon, trier alphabétiquement
      return a.localeCompare(b);
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    // Vérifier si des produits sont marqués pour le menu digital
    const menuProducts = products.filter(p => p.showOnMenuDigital === true);
    
    // Fallback : si aucun produit n'est marqué, afficher tous les produits
    const productsToDisplay = menuProducts.length > 0 ? menuProducts : products;

    return productsToDisplay.filter(product => {
      const matchesSearch = !searchTerm || product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategoryTab === "all" || product.category === activeCategoryTab;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, activeCategoryTab]);

  const requestAirtelNumber = async () => {
    if (!establishmentId || !airtelNumberInput.trim()) {
      alert('Veuillez entrer un numéro Airtel Money valide.');
      return;
    }

    // Note: La création de demande de Disbursement ID doit être faite depuis l'interface d'administration
    // (BarConnecteePage) car elle nécessite une authentification. Ici, on informe simplement le client.
    setShowAirtelNumberDialog(false);
    setAirtelNumberInput("");
    alert('Le paiement en ligne n\'est pas encore disponible pour cet établissement. L\'établissement doit configurer son Disbursement ID depuis son interface d\'administration. Vous pouvez commander sans paiement pour l\'instant.');
  };

  // Valider la table/livraison puis demander le choix de paiement (en ligne ou sur place)
  const proceedToCheckout = () => {
    if (!isDelivery && !selectedTable) {
      alert('Veuillez sélectionner une table ou activer la livraison.');
      setShowTableDialog(true);
      return;
    }
    if (isDelivery) {
      if (!deliveryName.trim()) {
        alert('Veuillez saisir le nom du destinataire.');
        setShowTableDialog(true);
        return;
      }
      if (!deliveryPhone.trim()) {
        alert('Veuillez saisir le numéro de téléphone du destinataire.');
        setShowTableDialog(true);
        return;
      }
      if (!deliveryAddress.trim()) {
        alert('Veuillez saisir l\'adresse de livraison.');
        setShowTableDialog(true);
        return;
      }
    }
    setShowPaymentChoiceDialog(true);
  };

  // Paiement en ligne direct (SingPay) quand le choix est déjà fait
  const payOnline = () => {
    setShowPaymentChoiceDialog(false);
    if (!establishment?.paymentsEnabled) {
      alert('Les paiements en ligne ne sont pas encore activés pour cet établissement. Vous pouvez commander et payer sur place.');
      placeOrder(false);
      return;
    }
    
    // Vérifier que le montant est valide
    if (total <= 0) {
      alert('Le montant de la commande doit être supérieur à 0.');
      return;
    }
    
    void placeOrder(true);
  };

  const placeOrder = async (withPayment: boolean = false) => {
    if (!establishmentId || cart.length === 0) {
      alert('Votre panier est vide.');
      return;
    }

    // Validation : table ou livraison
    if (!isDelivery && !selectedTable) {
      alert('Veuillez sélectionner une table ou activer la livraison.');
      return;
    }

    if (isDelivery) {
      if (!deliveryName.trim()) {
        alert('Veuillez saisir le nom du destinataire.');
        return;
      }
      if (!deliveryPhone.trim()) {
        alert('Veuillez saisir le numéro de téléphone du destinataire.');
        return;
      }
      if (!deliveryAddress.trim()) {
        alert('Veuillez saisir l\'adresse de livraison.');
        return;
      }
    }

    if (withPayment && !establishment?.paymentsEnabled) {
      alert('Les paiements en ligne ne sont pas encore activés pour cet établissement. Vous pouvez commander sans paiement.');
      return;
    }

    // DEBUG: Log template resolution
    console.log('[NACK DEBUG TEMPLATE]', {
      establishmentId,
      establishmentType,
      menuTheme,
      designId: menuTheme.designId,
      currentDesignId: currentDesign?.id,
      requestedTemplate: TEMPLATE_MAP[currentDesign?.id || ''],
      templateType: typeof TEMPLATE_MAP[currentDesign?.id || '']
    });

    // DEBUG: Validate total before order creation
    if (typeof total !== 'number' || !Number.isFinite(total) || Number.isNaN(total)) {
      console.error('[NACK DEBUG TOTAL INVALID]', { total, cart, establishment, deliveryFee: (isDelivery && establishment?.deliveryEnabled && establishment?.deliveryPrice) ? establishment.deliveryPrice : 0 });
      alert('Erreur calcul total. Veuillez réessayer.');
      return;
    }

    console.log('[NACK DEBUG COMPONENT]', {
      TemplateComponent: currentDesign?.id ? TEMPLATE_MAP[currentDesign.id] : 'fallback',
      type: typeof (currentDesign?.id ? TEMPLATE_MAP[currentDesign.id] : NackModernTemplate)
    });

    try {
      const orderNumberValue = `CMD${Date.now().toString().slice(-6)}`;
      const receiptNumber = `RCP${Date.now().toString().slice(-6)}`;

      if (withPayment && establishment?.paymentsEnabled) {
        setIsProcessingPayment(true);
        try {
          const transactionId = `TXN-MENU-${establishmentId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const base = (import.meta.env.VITE_PUBLIC_BASE_URL as string || window.location.origin).replace(/\/+$/, '');
          const reference = `menu-digital-${orderNumberValue}`;
          const redirectSuccess = appendElectronPaymentReturn(
            `${base}/payment/success?reference=${reference}&transactionId=${transactionId}&establishmentId=${establishmentId}`,
          );
          const redirectError = appendElectronPaymentReturn(
            `${base}/payment/error?reference=${reference}&transactionId=${transactionId}&establishmentId=${establishmentId}`,
          );
          const logoURL = establishment?.logoUrl || `${base}/favicon.png`;

          const orderData: Record<string, unknown> = {
            orderNumber: orderNumberValue,
            receiptNumber,
            tableZone: isDelivery ? 'Livraison' : selectedTable,
            items: cart,
            total,
            status: 'awaiting-validation',
            paymentStatus: 'unpaid',
            paymentPending: true,
            paymentTransactionId: transactionId,
            source: 'qr',
            createdAt: Date.now(),
            isDelivery: isDelivery || false,
            deliveryPrice: (isDelivery && establishment?.deliveryEnabled && establishment?.deliveryPrice) ? establishment.deliveryPrice : 0,
            customerInfo: {
              userAgent: navigator.userAgent,
              timestamp: Date.now()
            }
          };

          if (isDelivery) {
            orderData.deliveryInfo = {
              name: deliveryName,
              phone: deliveryPhone,
              address: deliveryAddress
            };
            orderData.deliveryAddress = deliveryAddress;
          }

          let createdOrderId: string | null = null;
          try {
            const docRef = await addDoc(ordersColRef(db, establishmentId), orderData);
            createdOrderId = docRef.id;
            console.log('[Payment] Order created before payment:', createdOrderId);

            void sendOrderNotificationViaServer({
              establishmentId,
              title: "Commande en attente de paiement",
              body: `Commande #${orderNumberValue} - ${isDelivery ? 'Livraison' : selectedTable} - ${total.toLocaleString('fr-FR')} XAF (paiement en cours)`,
              data: { orderNumber: orderNumberValue, type: "PENDING_PAYMENT" },
            });
          } catch (createError: any) {
            console.error('[NACK FIREBASE ERROR]', {
              code: createError?.code,
              message: createError?.message,
              path: `profiles/${establishmentId}/orders (pre-payment)`,
              orderData
            });
          }

          const paymentLink = await createMenuDigitalPaymentLink({
            amount: total,
            reference,
            redirectSuccess,
            redirectError,
            logoURL,
            establishmentId: establishmentId!,
            transactionId,
            orderData: { ...orderData, orderId: createdOrderId },
          });

          console.log('[Payment] Link created:', paymentLink);
          await openPaymentUrl(paymentLink);
          return;
        } catch (error) {
          console.error('Erreur création paiement:', error);
          alert('Erreur lors de la création du lien de paiement. Veuillez réessayer.');
        } finally {
          setIsProcessingPayment(false);
        }
      }

      // Si pas de paiement, créer la commande immédiatement dans orders
      // IMPORTANT: Les commandes sur place doivent arriver chez le gérant, le serveur et la cuisine
      const orderData: Record<string, unknown> = {
        orderNumber: orderNumberValue,
        receiptNumber,
        tableZone: isDelivery ? 'Livraison' : selectedTable,
        items: cart,
        total,
        status: 'awaiting-validation', // En attente de validation serveur avant d'aller en cuisine
        paymentStatus: 'unpaid',
        source: 'qr',
        createdAt: Date.now(),
        isDelivery: isDelivery || false,
        deliveryPrice: (isDelivery && establishment?.deliveryEnabled && establishment?.deliveryPrice) ? establishment.deliveryPrice : 0,
        customerInfo: {
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        }
      };

      // Ajouter les informations de livraison complètes
      if (isDelivery) {
        orderData.deliveryInfo = {
          name: deliveryName,
          phone: deliveryPhone,
          address: deliveryAddress
        };
        orderData.deliveryAddress = deliveryAddress;
      }

      // Créer la commande dans orders pour qu'elle arrive chez le gérant, le serveur et la cuisine
      let queuedOffline = false;
      let orderDocId: string | null = null;
      if (establishmentId) {
        console.log('[PublicOrderingPage] Création commande sur profiles/' + establishmentId + '/orders');
        try {
          const docRef = await addDoc(ordersColRef(db, establishmentId), orderData);
          orderDocId = docRef.id;
          console.log('[PublicOrderingPage] Commande créée avec ID:', docRef.id);
        } catch (error: any) {
          console.error('[NACK FIREBASE ERROR]', {
            code: error?.code,
            message: error?.message,
            path: `profiles/${establishmentId}/orders`,
            orderData
          });
          await enqueuePendingOrder({
            ownerUid: establishmentId,
            channel: "orders",
            payload: orderData,
          });
          queuedOffline = true;
        }

        if (establishmentId && !queuedOffline) {
          void sendOrderNotificationViaServer({
            establishmentId,
            title: "Nouvelle commande",
            body: `Commande #${orderNumberValue} - ${isDelivery ? 'Livraison' : selectedTable} - ${total.toLocaleString('fr-FR')} XAF`,
            data: { orderNumber: orderNumberValue, type: "NEW_ORDER" },
          });
        }
      }

      const receiptData = {
        orderId: orderDocId || orderNumberValue,
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
      if (queuedOffline) {
        alert("Commande enregistrée. Elle sera envoyée automatiquement dès le retour d'internet.");
      }

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
        },
        companyName: establishment.companyName,
        fullAddress: establishment.fullAddress,
        businessPhone: establishment.businessPhone,
        rcsNumber: establishment.rcsNumber,
        nifNumber: establishment.nifNumber,
        legalMentions: establishment.legalMentions,
        customMessage: establishment.customMessage,
        ticketLogoUrl: establishment.ticketLogoUrl,
        showDeliveryMention: establishment.showDeliveryMention,
        showCSSMention: establishment.showCSSMention,
        cssPercentage: establishment.cssPercentage,
        ticketFooterMessage: establishment.ticketFooterMessage,
      };

      await generateTicketPDF(ticketData);
    } catch (error) {
      console.error('Erreur génération ticket PDF:', error);
    }
  };

  const printReceipt = () => {
    if (!establishment || !orderNumber) return;

    try {
      const thermalData = {
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
        companyName: establishment.companyName,
        fullAddress: establishment.fullAddress,
        businessPhone: establishment.businessPhone,
        rcsNumber: establishment.rcsNumber,
        nifNumber: establishment.nifNumber,
        legalMentions: establishment.legalMentions,
        customMessage: establishment.customMessage,
        ticketLogoUrl: establishment.ticketLogoUrl,
        showDeliveryMention: establishment.showDeliveryMention,
        showCSSMention: establishment.showCSSMention,
        cssPercentage: establishment.cssPercentage,
        ticketFooterMessage: establishment.ticketFooterMessage
      };

      printThermalTicket(thermalData);
    } catch (error) {
      console.error('Erreur impression ticket:', error);
      alert('Erreur lors de l\'impression. Veuillez réessayer.');
    }
  };

  // Design actif
  const currentDesign = getMenuDesignById(menuTheme.designId);
  const isDarkMode = ['bar-lounge', 'boutique-luxury'].includes(currentDesign.id);
  const isBoutique = currentDesign.category === 'boutique';

  const getBackgroundStyle = () => {
    if (menuTheme.backgroundType === 'image' && menuTheme.backgroundColor.startsWith('http')) {
      return { backgroundImage: `url(${menuTheme.backgroundColor})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' };
    }
    const bg = menuTheme.backgroundColor;
    switch (currentDesign.id) {
      case 'restaurant-classic':
        return { backgroundColor: bg, backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(212,165,116,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(139,38,53,0.05) 0%, transparent 50%)' };
      case 'bar-lounge':
        return { backgroundColor: bg, backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(155,89,182,0.15) 0%, transparent 50%), radial-gradient(circle at 0% 100%, rgba(233,69,96,0.1) 0%, transparent 50%)' };
      case 'cafe-cozy':
        return { backgroundColor: bg, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(111,78,55,0.03) 20px, rgba(111,78,55,0.03) 40px)' };
      case 'boutique-luxury':
        return { backgroundColor: bg, backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(212,175,55,0.08) 0%, transparent 50%)' };
      default:
        return { backgroundColor: bg };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen" style={getBackgroundStyle()}>
        {/* Skeleton Header */}
        <div className="sticky top-0 z-40 backdrop-blur-lg border-b" style={{ 
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderColor: 'rgba(0,0,0,0.08)'
        }}>
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gray-200 animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-1" />
                <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Skeleton Search */}
        <div className="px-4 py-3">
          <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
        </div>

        {/* Skeleton Categories */}
        <div className="px-4 py-3">
          <div className="flex gap-2 overflow-hidden">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-9 w-20 bg-gray-100 rounded-xl animate-pulse flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Skeleton Products Grid */}
        <div className="container mx-auto px-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="aspect-square bg-gray-100 animate-pulse" />
                <div className="p-3">
                  <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
                  <div className="h-3 w-16 bg-gray-50 rounded animate-pulse mb-2" />
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                    <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow p-8">
          <h2 className="text-xl font-bold mb-2">
            {loadError === 'not-found' ? 'Établissement introuvable' : loadError === 'permission-denied' ? 'Accès refusé' : 'Erreur réseau'}
          </h2>
          <p className="text-gray-600 text-sm mb-4">
            {loadError === 'not-found' ? 'Ce lien de commande n\'existe pas ou a été supprimé.' : loadError === 'permission-denied' ? 'Permissions Firestore insuffisantes pour afficher ce menu. Vérifiez les règles publicProfiles.' : 'Impossible de charger le menu. Vérifiez votre connexion.'}
          </p>
          <button onClick={() => window.location.reload()} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 shadow-button hover:shadow-elegant h-10 px-4 py-2">Recharger</button>
        </div>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-full text-white" style={{ backgroundColor: menuTheme.primaryColor }}>
            <CheckCircle className="w-10 h-10" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold" style={{ color: menuTheme.primaryColor }}>Commande validée !</h2>
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
          <div className="grid grid-cols-2 gap-3 w-full">
            <button onClick={printReceipt} className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-white h-10 px-4 py-2" style={{ backgroundColor: menuTheme.primaryColor }}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </button>
            <button onClick={downloadReceipt} className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              <Download className="w-4 h-4 mr-2" />
              Télécharger
            </button>
          </div>
          <button
            onClick={() => {
              setOrderComplete(false);
              setCart([]);
              setSelectedTable("");
            }}
            className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            Nouvelle commande
          </button>
        </div>
      </div>
    );
  }

  const templateProps: TemplateProps = {
    establishment,
    filteredProducts: filteredProducts as any,
    cart: cart as any,
    total,
    searchTerm,
    activeCategoryTab,
    availableCategories,
    menuTheme,
    isFoodBusiness,
    onSearchChange: (v: string) => setSearchTerm(v),
    onCategoryChange: (v: string) => setActiveCategoryTab(v),
    onAddToCart: (p: any) => { try { addToCart(p); } catch(e){ console.error(e);} },
    onSelectProduct: (p: any) => setSelectedProduct(p),
    onCheckout: () => {
      if ((!isDelivery && !selectedTable) || (isDelivery && !deliveryAddress.trim())) {
        setShowTableDialog(true);
      } else {
        proceedToCheckout();
      }
    },
    onShowCart: () => setShowCartDetails(true),
    backgroundStyle: getBackgroundStyle(),
  };

  // Map sûre des templates — vérifie typeof avant rendu (cause racine de "Je is not a function")
  const TEMPLATE_MAP: Record<string, React.FC<any>> = {
    'nack-modern': NackModernTemplate,
    'nack-shop': NackShopTemplate,
    'nack-shop-fashion': NackShopTemplate,
    'nack-shop-premium': NackShopTemplate,
    'restaurant-classic': RestaurantClassicTemplate,
    'restaurant-modern': RestaurantModernTemplate,
    'bar-lounge': BarLoungeTemplate,
    'cafe-cozy': CafeCozyTemplate,
    'boutique-minimal': BoutiqueMinimalTemplate,
    'boutique-grid': BoutiqueGridTemplate,
    'boutique-luxury': BoutiqueLuxuryTemplate,
    'service-professional': ServiceTemplate,
    'service-creative': ServiceTemplate,
  };

  const renderTemplate = () => {
    // Guards : données non encore chargées → skeleton déjà géré, mais éviter crash si establishment null
    const safeEstablishment = establishment ?? { establishmentName: 'Menu' } as Establishment;
    const safeProducts = Array.isArray(filteredProducts) ? filteredProducts : [];
    const safeCart = Array.isArray(cart) ? cart : [];
    const safeTheme = menuTheme ?? defaultMenuTheme;

    const props = {
      ...templateProps,
      establishment: safeEstablishment,
      filteredProducts: safeProducts as any,
      cart: safeCart as any,
      menuTheme: safeTheme,
      backgroundStyle: safeTheme ? getBackgroundStyle() : {},
    };

    // 1. Si un designId explicite est stocké, tenter de l'utiliser
    const requestedId = (currentDesign?.id ?? '') as string;
    const RequestedComp = requestedId ? TEMPLATE_MAP[requestedId] : null;

    if (requestedId && RequestedComp && typeof RequestedComp === 'function') {
      // Vérifier cohérence avec le type d'établissement : si incohérent, fallback au défaut
      const isRestaurant = isFoodBusiness(establishmentType);
      const isShop = isBoutique(establishmentType);
      const isService = isServiceBusiness(establishmentType);
      const isBoutiqueDesign = ['nack-shop','nack-shop-fashion','nack-shop-premium','boutique-minimal','boutique-grid','boutique-luxury'].includes(requestedId);
      const isRestoDesign = ['nack-modern','restaurant-classic','restaurant-modern','bar-lounge','cafe-cozy'].includes(requestedId);
      const isServiceDesign = ['service-professional','service-creative'].includes(requestedId);
      const coherent = (isRestaurant && isRestoDesign) || (isShop && isBoutiqueDesign) || (isService && isServiceDesign) || (!establishmentType);
      if (coherent) {
        return <RequestedComp {...props} establishmentType={establishmentType} fullAddress={safeEstablishment.fullAddress} />;
      }
    } else if (requestedId && !RequestedComp) {
      console.warn(`[PublicOrderingPage] design inconnu "${requestedId}" → fallback`);
    }

    // 2. Fallback automatique selon le type d'établissement (toujours sûr)
    if (isServiceBusiness(establishmentType)) {
      const Comp = ServiceTemplate;
      if (Comp && typeof Comp === 'function') return <Comp {...props} />;
    }
    if (isBoutique(establishmentType)) {
      const Comp = NackShopTemplate;
      if (Comp && typeof Comp === 'function') return <Comp {...props} establishmentType={establishmentType} fullAddress={safeEstablishment.fullAddress} />;
    }
    // Défaut ultime sûr
    const Fallback = NackModernTemplate;
    if (Fallback && typeof Fallback === 'function') return <Fallback {...props} establishmentType={establishmentType} />;
    return <div className="p-8 text-center">Menu indisponible</div>;
  };

  return (
    <>
      {showPaymentSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 shadow-lg flex items-center gap-3">
            <div className="flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-900">Paiement reussi !</p>
              <p className="text-sm text-green-700">Votre commande a ete payee avec succes.</p>
            </div>
            <button onClick={() => setShowPaymentSuccess(false)} className="text-green-600 hover:text-green-800">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {renderTemplate()}

      {/* Dialog selection table ou livraison */}
      {showTableDialog && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowTableDialog(false)} />
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
            <button
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={() => setShowTableDialog(false)}
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <h2 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2" style={{ color: menuTheme.primaryColor }}>
                <MapPin className="w-5 h-5" />
                Votre position
              </h2>
              <p className="text-sm text-muted-foreground">
                Sélectionnez votre table, zone ou activez la livraison
              </p>
            </div>
            <div className="space-y-4">
              {/* Option livraison */}
              {establishment?.deliveryEnabled && (
                <div className="space-y-2 p-4 border rounded-lg bg-gray-50">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="deliveryCheckbox"
                      checked={isDelivery}
                      onChange={(e) => {
                        setIsDelivery(e.target.checked);
                        if (e.target.checked) {
                          setSelectedTable("");
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <label htmlFor="deliveryCheckbox" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                      Livraison à domicile
                      {establishment.deliveryPrice && (
                        <span className="text-sm font-normal text-gray-600 ml-2">
                          (+{establishment.deliveryPrice.toLocaleString('fr-FR')} XAF)
                        </span>
                      )}
                    </label>
                  </div>
                  {isDelivery && (
                    <div className="mt-2 space-y-3">
                      <div>
                        <label htmlFor="deliveryName" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Nom du destinataire *</label>
                        <Input
                          id="deliveryName"
                          placeholder="Ex: Jean Koumba"
                          value={deliveryName}
                          onChange={(e) => setDeliveryName(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label htmlFor="deliveryPhone" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Téléphone *</label>
                        <Input
                          id="deliveryPhone"
                          type="tel"
                          placeholder="Ex: 06 12 34 56 78"
                          value={deliveryPhone}
                          onChange={(e) => setDeliveryPhone(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label htmlFor="deliveryAddress" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Adresse de livraison *</label>
                        <Input
                          id="deliveryAddress"
                          placeholder="Ex: Quartier Nzeng-Ayong, Rue 123..."
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      {establishment.deliveryPrice && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-900">
                            <strong>Frais de livraison :</strong> {establishment.deliveryPrice.toLocaleString('fr-FR')} FCFA
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sélection table/zone (si livraison désactivée) */}
              {!isDelivery && (
                <>
                  {tables.length === 0 ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Table ou zone</label>
                      <Input
                        placeholder="Ex: Table 3, Comptoir..."
                        value={selectedTable}
                        onChange={(e) => setSelectedTable(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Table ou zone</label>
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
                </>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowTableDialog(false);
                    setIsDelivery(false);
                    setDeliveryAddress("");
                  }}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 flex-1"
                >
                  Annuler
                </button>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => {
                      if ((isDelivery && deliveryAddress.trim()) || (!isDelivery && selectedTable)) {
                        setShowTableDialog(false);
                        proceedToCheckout();
                      }
                    }}
                    disabled={(isDelivery && !deliveryAddress.trim()) || (!isDelivery && !selectedTable)}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex-1 text-white h-10 px-4 py-2"
                    style={{ backgroundColor: menuTheme.primaryColor }}
                  >
                    Continuer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog choix de paiement : en ligne (SingPay) ou sur place */}
      {showPaymentChoiceDialog && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowPaymentChoiceDialog(false)} />
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
            <button
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={() => setShowPaymentChoiceDialog(false)}
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <h2 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2" style={{ color: menuTheme.primaryColor }}>
                <CreditCard className="w-5 h-5" />
                Comment souhaitez-vous payer ?
              </h2>
              <p className="text-sm text-muted-foreground">
                {isDelivery ? 'Choisissez le mode de paiement pour votre livraison.' : 'Choisissez le mode de paiement pour votre commande.'}
              </p>
            </div>
            <div className="space-y-3">
              <div
                role="button"
                tabIndex={0}
                onClick={payOnline}
                onKeyDown={(e) => { if (e.key === 'Enter') payOnline(); }}
                className="flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md"
                style={{ borderColor: menuTheme.primaryColor }}
              >
                <div className="mt-1">
                  <CreditCard className="w-5 h-5" style={{ color: menuTheme.primaryColor }} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Payer en ligne à la commande</p>
                  <p className="text-sm text-gray-600">
                    {isDelivery
                      ? 'Réglez maintenant en ligne via SingPay, la livraison est déjà payée.'
                      : 'Réglez immédiatement en ligne via SingPay.'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">💳 Airtel Money, Moov Money, etc.</p>
                </div>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setShowPaymentChoiceDialog(false);
                  void placeOrder(false);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setShowPaymentChoiceDialog(false); void placeOrder(false); } }}
                className="flex items-start gap-3 rounded-xl border-2 border-gray-200 p-4 cursor-pointer transition-all hover:shadow-md"
              >
                <div className="mt-1">
                  <ShoppingBag className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Payer sur place</p>
                  <p className="text-sm text-gray-600">
                    {isDelivery
                      ? 'Réglez à la réception de votre commande.'
                      : 'Réglez directement à votre table, au comptoir ou à la caisse.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowPaymentChoiceDialog(false)}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 flex-1"
                >
                  Retour
                </button>
                <button
                  onClick={() => {
                    setShowPaymentChoiceDialog(false);
                    void placeOrder(false);
                  }}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex-1 text-white h-10 px-4 py-2"
                  style={{ backgroundColor: menuTheme.primaryColor }}
                >
                  Commander sur place
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fiche produit améliorée */}
      {!!selectedProduct && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/80" onClick={() => { setSelectedProduct(null); setProductQuantity(1); }} />
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background shadow-lg sm:rounded-lg p-0 overflow-hidden">
            <div className="flex flex-col max-h-[90vh]">
              {/* Image du produit */}
              <div className="relative w-full h-64 bg-gray-100">
                {selectedProduct.imageUrl ? (
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50">
                    <Package className="w-16 h-16 text-gray-300" />
                  </div>
                )}
                {/* Bouton favori */}
                <button
                  onClick={() => toggleFavorite(selectedProduct.id)}
                  className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md transition-transform active:scale-90"
                >
                  <Heart 
                    className="w-5 h-5" 
                    style={{ 
                      color: isFavorite(selectedProduct.id) ? '#ef4444' : '#666',
                      fill: isFavorite(selectedProduct.id) ? '#ef4444' : 'transparent'
                    }} 
                  />
                </button>
                {/* Badge catégorie */}
                {selectedProduct.category && (
                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
                    {selectedProduct.category}
                  </div>
                )}
              </div>

              {/* Contenu */}
              <div className="flex-1 overflow-y-auto p-5">
                <h2 className="text-xl font-bold mb-2" style={{ color: menuTheme.primaryColor }}>
                  {selectedProduct.name}
                </h2>
                {selectedProduct.description && (
                  <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                    {selectedProduct.description}
                  </p>
                )}
                
                {/* Prix */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-bold" style={{ color: menuTheme.primaryColor }}>
                    {(typeof selectedProduct.price === 'number'
                      ? selectedProduct.price
                      : parseFloat(String(selectedProduct.price)) || 0
                    ).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>

                {/* Sélecteur de quantité */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl mb-4">
                  <span className="text-sm font-medium text-gray-700">Quantité</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setProductQuantity(Math.max(1, productQuantity - 1))}
                      className="w-8 h-8 rounded-full flex items-center justify-center border hover:bg-gray-100 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-bold">{productQuantity}</span>
                    <button
                      onClick={() => setProductQuantity(productQuantity + 1)}
                      className="w-8 h-8 rounded-full flex items-center justify-center border hover:bg-gray-100 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: menuTheme.primaryColor + '10' }}>
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-lg font-bold" style={{ color: menuTheme.primaryColor }}>
                    {((typeof selectedProduct.price === 'number'
                      ? selectedProduct.price
                      : parseFloat(String(selectedProduct.price)) || 0
                    ) * productQuantity).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>

              {/* Bouton d'action */}
              <div className="p-4 border-t">
                <button
                  onClick={() => {
                    addToCartWithQuantity(selectedProduct, productQuantity);
                    setSelectedProduct(null);
                    setProductQuantity(1);
                  }}
                  className="w-full h-12 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-white font-bold text-base"
                  style={{ backgroundColor: menuTheme.primaryColor }}
                >
                  <ShoppingBag className="w-5 h-5 mr-2" />
                  Ajouter au panier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vue panier détaillée (Bottom Sheet) */}
      {showCartDetails && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCartDetails(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold" style={{ color: menuTheme.primaryColor }}>
                Votre panier
              </h2>
              <button
                onClick={() => setShowCartDetails(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Liste des articles */}
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Votre panier est vide</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.price.toLocaleString('fr-FR')} FCFA / unité</p>
                      </div>
                      
                      {/* Contrôles quantité */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCartItemQuantity(item.productId, item.quantity - 1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-white border hover:bg-gray-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-medium text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateCartItemQuantity(item.productId, item.quantity + 1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-white border hover:bg-gray-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {/* Prix total de l'article */}
                      <div className="text-right min-w-[70px]">
                        <p className="font-bold text-sm" style={{ color: menuTheme.primaryColor }}>
                          {(item.price * item.quantity).toLocaleString('fr-FR')} F
                        </p>
                      </div>
                      
                      {/* Bouton supprimer */}
                      <button
                        onClick={() => updateCartItemQuantity(item.productId, 0)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer avec total et boutons */}
            {cart.length > 0 && (
              <div className="border-t p-4 space-y-3">
                {/* Détails des prix */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Sous-total</span>
                    <span>{cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  {isDelivery && establishment?.deliveryEnabled && establishment?.deliveryPrice && (
                    <div className="flex justify-between text-gray-600">
                      <span>Livraison</span>
                      <span>{establishment.deliveryPrice.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-2 border-t">
                    <span>Total</span>
                    <span style={{ color: menuTheme.primaryColor }}>{total.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                </div>

                {/* Boutons d'action */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      clearCart();
                      setShowCartDetails(false);
                    }}
                    className="flex-1 py-3 rounded-xl border border-red-200 text-red-500 font-medium hover:bg-red-50"
                  >
                    Vider
                  </button>
                  <button
                    onClick={() => {
                      setShowCartDetails(false);
                      if ((!isDelivery && !selectedTable) || (isDelivery && !deliveryAddress.trim())) {
                        setShowTableDialog(true);
                      } else {
                        proceedToCheckout();
                      }
                    }}
                    className="flex-[2] py-3 rounded-xl text-white font-bold shadow-lg"
                    style={{ backgroundColor: menuTheme.primaryColor }}
                  >
                    Commander • {total.toLocaleString('fr-FR')} FCFA
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialogue pour demander le numéro Airtel Money */}
      {showAirtelNumberDialog && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowAirtelNumberDialog(false)} />
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
            <button
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={() => setShowAirtelNumberDialog(false)}
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <h2 className="text-lg font-semibold leading-none tracking-tight">Recevoir les paiements sur Airtel Money</h2>
              <p className="text-sm text-muted-foreground">
                Pour recevoir les paiements des commandes directement sur votre compte Airtel Money,
                veuillez entrer votre numéro Airtel Money. Votre demande sera envoyée à l'administration
                pour configuration du Disbursement ID.
              </p>
            </div>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="airtelNumber" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Numéro Airtel Money</label>
                <Input
                  id="airtelNumber"
                  type="tel"
                  placeholder="Ex: 0612345678"
                  value={airtelNumberInput}
                  onChange={(e) => setAirtelNumberInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Format: 10 chiffres (ex: 0612345678)
                </p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    Une fois votre demande approuvée par l'administration, vous recevrez un message de confirmation
                    et pourrez commencer à recevoir les paiements automatiquement.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
              <button onClick={() => {
                setShowAirtelNumberDialog(false);
                setAirtelNumberInput("");
              }} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                Annuler
              </button>
              <button onClick={requestAirtelNumber} disabled={!airtelNumberInput.trim()} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 shadow-button hover:shadow-elegant h-10 px-4 py-2">
                Envoyer la demande
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PublicOrderingPage;
